import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup } from '@angular/forms';
import {
  isAssignmentArchived,
  isProjectArchived,
  projectCounts,
  projectCountsLabel,
  type ProjectCounts,
} from '@/app/lib/status/project-archive';
import {
  allocationToPeople,
  isAssignmentActive,
  isEmployeeActive,
  normalizedProjectStatus,
  peopleLabel,
  projectStatusBucket,
  workforceCounts,
  workforceCountsLabel,
  type WorkforceCounts,
} from '@/app/lib/status/portfolio-stats';
import { MasterService } from '../../service/master.service';
import { IProject, IProjectEmployee } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import { InsightsSkeletonComponent } from '@/app/components/ui/insights-skeleton.component';
import {
  INSIGHTS_BUDGET_KPIS,
  INSIGHTS_DEFAULT_FILTER_DISPLAY,
  INSIGHTS_FILTER_ICONS,
  INSIGHTS_FILTER_LABELS,
  INSIGHTS_KPIS,
  INSIGHTS_READINESS_DISTRIBUTION_TITLE,
  INSIGHTS_READINESS_RANGES,
  INSIGHTS_RESOURCE_KPIS,
  INSIGHTS_SECTION_ICONS,
  INSIGHTS_STATUS_DISTRIBUTION_TITLE,
  INSIGHTS_STATUS_ITEMS,
  INSIGHTS_TAB_ACTIVE_CLASS,
  INSIGHTS_TAB_IDLE_CLASS,
  INSIGHTS_TABS,
  InsightsKpi,
  InsightsTabId,
} from '@/app/constants/business-insights';
import { ActionButtonComponent } from '@/app/components/ui/action-button.component';
import { ClearFiltersButtonComponent } from '@/app/components/ui/clear-filters-button.component';
import { FieldLabelComponent } from '@/app/components/ui/field-label.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import { ToastService } from '@/app/components/ui/toast.service';
import { BADGE_TONE_CLASS } from '@/app/lib/status/project-status';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';

export interface IBusinessInsights {
  projectStatusDistribution: {
    draft: number;
    in_progress: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  };
  resourceUtilization: {
    totalEmployees: number;
    activeAssignments: number;
    averageAllocation: number;
    overbookedCount: number;
    availableCount: number;
  };
  readinessScores: {
    average: number;
    /** Projects with a readiness above 0%, the ones the average covers. */
    scoredCount: number;
    distribution: Array<{ range: string; count: number }>;
  };
  teamCapacity: {
    totalCapacity: number;
    utilizedCapacity: number;
    availableCapacity: number;
    utilizationPercentage: number;
  };
  projectHealthTrends: Array<{
    month: string;
    healthy: number;
    atRisk: number;
    critical: number;
  }>;
  budgetMetrics: {
    totalBudget: number;
    allocatedBudget: number;
    spentBudget: number;
    remainingBudget: number;
  };
  departmentBreakdown: Array<{
    department: string;
    employeeCount: number;
    projectCount: number;
    /** `null` when the department leads no projects. */
    averageReadiness: number | null;
  }>;
  projectTypeBreakdown: Array<{
    type: string;
    count: number;
    averageReadiness: number;
  }>;
  filteredProjectCount?: number; // Non-archived projects (used for calculations)
  archivedProjectCount?: number;
  workforce: WorkforceCounts;
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function withValues(
  kpis: readonly InsightsKpi[],
  values: Array<string | number>,
  hints: readonly string[] = []
) {
  return kpis.map((kpi, index) => ({ ...kpi, value: values[index], hint: hints[index] ?? '' }));
}

@Component({
  selector: 'app-business-insights',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ActionButtonComponent,
    ClearFiltersButtonComponent,
    FieldLabelComponent,
    KpiStatCardComponent,
    InsightsSkeletonComponent,
    SelectMenuComponent,
    PageHeaderComponent,
  ],
  templateUrl: './business-insights.component.html',
  styleUrls: ['./business-insights.component.css'] })
export class BusinessInsightsComponent implements OnInit {
  private readonly masterService = inject(MasterService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly pageMeta = PRIVATE_PAGE_META['/business-insights'];
  readonly insightsSignal = signal<IBusinessInsights | null>(null);
  readonly insights = this.insightsSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();

  readonly projectsSignal = signal<IProject[]>([]);
  readonly employeesSignal = signal<Employee[]>([]);
  readonly projectEmployeesSignal = signal<IProjectEmployee[]>([]);

  readonly dateRangeOptions: SelectMenuOption[] = [
    { value: 'all', ...INSIGHTS_DEFAULT_FILTER_DISPLAY.dateRange },
    { value: 'last30', label: 'Last 30 Days', icon: 'calendar-days' },
    { value: 'last90', label: 'Last 90 Days', icon: 'calendar-range' },
    { value: 'last365', label: 'Last Year', icon: 'calendar' },
    { value: 'custom', label: 'Custom Range', icon: 'sliders-horizontal' },
  ];

  // Computed list of unique departments for dropdown
  readonly departmentsSignal = computed(() => {
    const employees = this.employeesSignal();
    const departments = new Set<string>();
    employees.forEach((emp) => {
      if (emp.department && emp.department.trim()) {
        departments.add(emp.department);
      }
    });
    return Array.from(departments).sort();
  });

  readonly departmentOptions = computed<SelectMenuOption[]>(() => [
    { value: 'all', ...INSIGHTS_DEFAULT_FILTER_DISPLAY.department },
    ...this.departmentsSignal().map((dept) => ({
      value: dept,
      label: dept,
      icon: 'building-2',
    })),
  ]);

  filterForm: FormGroup;
  readonly filtersActive = signal(false);

  readonly activeTabSignal = signal<InsightsTabId>('overview');
  readonly activeTab = this.activeTabSignal.asReadonly();

  readonly tabs = INSIGHTS_TABS;
  readonly tabActiveClass = INSIGHTS_TAB_ACTIVE_CLASS;
  readonly tabIdleClass = INSIGHTS_TAB_IDLE_CLASS;
  readonly filterLabels = INSIGHTS_FILTER_LABELS;
  readonly filterIcons = INSIGHTS_FILTER_ICONS;
  readonly sectionIcons = INSIGHTS_SECTION_ICONS;
  readonly badgeTone = BADGE_TONE_CLASS;
  readonly statusTitle = INSIGHTS_STATUS_DISTRIBUTION_TITLE;
  readonly readinessTitle = INSIGHTS_READINESS_DISTRIBUTION_TITLE;
  readonly statusDistribution = computed(() => {
    const distribution = this.insights()?.projectStatusDistribution;
    const total = this.projectTotals().active;
    return INSIGHTS_STATUS_ITEMS.map((item) => {
      const value = distribution?.[item.key] || 0;
      return { ...item, value, hint: `${value} of ${total} active` };
    });
  });

  /** Follows the active filters once insights are computed, else the raw list. */
  readonly projectTotals = computed<ProjectCounts>(() => {
    const insights = this.insights();
    if (insights?.filteredProjectCount == null) {
      return projectCounts(this.projectsSignal());
    }
    const active = insights.filteredProjectCount;
    const archived = insights.archivedProjectCount ?? 0;
    return { active, archived, total: active + archived };
  });

  readonly overviewKpis = computed(() => {
    const insights = this.insights();
    const projects = this.projectTotals();
    const readiness = insights?.readinessScores;
    const capacity = insights?.teamCapacity;
    const workforce = insights?.workforce;
    return withValues(
      INSIGHTS_KPIS,
      [
        projects.total,
        workforce?.total ?? 0,
        `${readiness?.average || 0}%`,
        `${capacity?.utilizationPercentage || 0}%`,
      ],
      [
        projectCountsLabel(projects),
        workforce ? workforceCountsLabel(workforce) : '',
        this.readinessHint(readiness?.scoredCount ?? 0, projects.active),
        `${allocationToPeople(capacity?.utilizedCapacity ?? 0)} of ${peopleLabel(
          allocationToPeople(capacity?.totalCapacity ?? 0)
        )} allocated`,
      ]
    );
  });

  readonly resourceKpis = computed(() => {
    const resources = this.insights()?.resourceUtilization;
    return withValues(
      INSIGHTS_RESOURCE_KPIS,
      [
        resources?.totalEmployees || 0,
        resources?.activeAssignments || 0,
        `${resources?.averageAllocation || 0}%`,
        resources?.availableCount || 0,
      ],
      ['Active employees', 'On active projects', 'Per active employee', 'No active assignment']
    );
  });

  readonly capacityPeople = computed(() => {
    const capacity = this.insights()?.teamCapacity;
    return {
      total: peopleLabel(allocationToPeople(capacity?.totalCapacity ?? 0)),
      utilized: peopleLabel(allocationToPeople(capacity?.utilizedCapacity ?? 0)),
      available: peopleLabel(allocationToPeople(capacity?.availableCapacity ?? 0)),
    };
  });

  readonly budgetKpis = computed(() => {
    const budget = this.insights()?.budgetMetrics;
    return withValues(
      INSIGHTS_BUDGET_KPIS,
      [budget?.totalBudget, budget?.allocatedBudget, budget?.spentBudget, budget?.remainingBudget].map(
        (amount) => USD.format(amount || 0)
      )
    );
  });

  constructor() {
    this.filterForm = this.fb.group({
      dateRange: ['all'], // all, last30, last90, last365, custom
      startDate: [''],
      endDate: [''],
      department: ['all'],
      projectType: ['all'] });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /** "—" for a department with no projects to average. */
  readinessText(average: number | null): string {
    return average == null ? '—' : `${average}%`;
  }

  /** The average skips 0% projects, so say how many it covers when that differs. */
  private readinessHint(scored: number, active: number): string {
    const projects = `active ${active === 1 ? 'project' : 'projects'}`;
    return scored === active ? `Across ${active} ${projects}` : `Across ${scored} of ${active} ${projects}`;
  }

  loadData(): void {
    const projectsSnap = this.masterService.peekProjects();
    const employeesSnap = this.masterService.peekEmployees();
    const projectEmployeesSnap = this.masterService.peekProjectEmployees();

    const hasWarm =
      projectsSnap != null &&
      employeesSnap != null &&
      projectEmployeesSnap != null;

    if (projectsSnap) {
      this.projectsSignal.set(projectsSnap);
    }
    if (employeesSnap) {
      this.employeesSignal.set(employeesSnap);
    }
    if (projectEmployeesSnap) {
      this.projectEmployeesSignal.set(projectEmployeesSnap);
    }

    if (hasWarm) {
      this.calculateInsights();
    } else {
      this.loadingSignal.set(true);
    }

    let projectsLoaded = projectsSnap != null;
    let employeesLoaded = employeesSnap != null;
    let projectEmployeesLoaded = projectEmployeesSnap != null;

    const checkAndCalculate = () => {
      if (projectsLoaded && employeesLoaded && projectEmployeesLoaded) {
        this.calculateInsights();
      }
    };

    this.masterService.getAllProjects().subscribe({
      next: (projects) => {
        this.projectsSignal.set(projects);
        projectsLoaded = true;
        checkAndCalculate();
      },
      error: (error) => {
        console.error('[Business Insights] Failed to load projects', error);
        if (!hasWarm) {
          this.loadingSignal.set(false);
        }
      } });

    this.masterService.getAllEmp().subscribe({
      next: (employees) => {
        this.employeesSignal.set(employees);
        employeesLoaded = true;
        checkAndCalculate();
      },
      error: (error) => {
        console.error('[Business Insights] Failed to load employees', error);
        if (!hasWarm) {
          this.loadingSignal.set(false);
        }
      } });

    this.masterService.getProjectEmp().subscribe({
      next: (projectEmployees) => {
        this.projectEmployeesSignal.set(projectEmployees);
        projectEmployeesLoaded = true;
        checkAndCalculate();
      },
      error: (error) => {
        console.error(
          '[Business Insights] Failed to load project employees',
          error
        );
        this.projectEmployeesSignal.set(projectEmployeesSnap ?? []);
        projectEmployeesLoaded = true;
        checkAndCalculate();
      } });
  }

  calculateInsights(): void {
    const projects = this.projectsSignal();
    const employees = this.employeesSignal();
    const projectEmployees = this.projectEmployeesSignal();

    if (!projects.length || !employees.length) {
      this.loadingSignal.set(false);
      return;
    }

    const filters = this.filterForm.value;

    // Step 1: Separate archived projects (excluded from calculations but counted separately)
    const archivedProjects = projects.filter(isProjectArchived);
    let filteredProjects = projects.filter((p) => !isProjectArchived(p));
    let filteredEmployees = [...employees];

    // Keep ALL assignments (both active and inactive) for proper state calculation
    // We'll filter to active assignments later for utilization calculations
    let allProjectEmployees = [...projectEmployees];
    // Archived projects' allocation never counts toward utilization.
    let activeProjectEmployees = projectEmployees.filter(
      (pe) => !isAssignmentArchived(pe) && isAssignmentActive(pe.isActive)
    );

    // Apply department filter
    if (filters.department && filters.department !== 'all') {
      // Filter employees by department
      filteredEmployees = filteredEmployees.filter(
        (emp) => emp.department === filters.department
      );

      // Filter project-employee assignments by department
      const employeeIdsInDept = new Set(
        filteredEmployees.map((e) => e.employeeId)
      );
      allProjectEmployees = allProjectEmployees.filter((pe) => {
        return employeeIdsInDept.has(pe.empId);
      });
      activeProjectEmployees = activeProjectEmployees.filter((pe) => {
        return employeeIdsInDept.has(pe.empId);
      });

      // Filter projects by department: include projects where department employees are:
      // 1. Project leads, OR
      // 2. Assigned to the project (via ProjectEmployee) - includes both active and inactive
      const projectIdsWithDeptAssignments = new Set(
        allProjectEmployees.map((pe) => pe.projectId)
      );
      filteredProjects = filteredProjects.filter((p) => {
        // Include if lead is in department OR if department employees are assigned to it
        return (
          (p.leadByEmpId && employeeIdsInDept.has(p.leadByEmpId)) ||
          projectIdsWithDeptAssignments.has(p.projectId)
        );
      });

    }

    // Apply date filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      // Check if custom range is selected but no dates provided - treat as "all time"
      const isCustomWithoutDates =
        filters.dateRange === 'custom' &&
        (!filters.startDate || !filters.endDate);

      if (!isCustomWithoutDates) {
        switch (filters.dateRange) {
          case 'last30':
            cutoffDate.setDate(now.getDate() - 30);
            break;
          case 'last90':
            cutoffDate.setDate(now.getDate() - 90);
            break;
          case 'last365':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
          case 'custom':
            if (filters.startDate && filters.endDate) {
              filteredProjects = filteredProjects.filter((p) => {
                const projectDate = p.startDate ? new Date(p.startDate) : null;
                const start = new Date(filters.startDate);
                const end = new Date(filters.endDate);
                return (
                  projectDate && projectDate >= start && projectDate <= end
                );
              });
            }
            break;
        }

        if (filters.dateRange !== 'custom') {
          filteredProjects = filteredProjects.filter((p) => {
            const projectDate = p.startDate ? new Date(p.startDate) : null;
            // Only include projects that have already started (not in the future)
            // and are within the date range
            return (
              projectDate && projectDate >= cutoffDate && projectDate <= now
            );
          });
        }

        // After filtering projects by date, filter assignments and employees
        // Filter assignments based on ALL projects (not just department-led projects)
        // because employees can be assigned to projects even if they don't lead them
        const allProjects = this.projectsSignal();
        let dateFilteredProjectIds: Set<number>;

        if (
          filters.dateRange === 'custom' &&
          filters.startDate &&
          filters.endDate
        ) {
          const start = new Date(filters.startDate);
          const end = new Date(filters.endDate);
          dateFilteredProjectIds = new Set(
            allProjects
              .filter((p) => {
                const projectDate = p.startDate ? new Date(p.startDate) : null;
                return (
                  projectDate && projectDate >= start && projectDate <= end
                );
              })
              .map((p) => p.projectId)
          );
        } else {
          dateFilteredProjectIds = new Set(
            allProjects
              .filter((p) => {
                const projectDate = p.startDate ? new Date(p.startDate) : null;
                // Only include projects that have already started (not in the future)
                // and are within the date range
                return (
                  projectDate && projectDate >= cutoffDate && projectDate <= now
                );
              })
              .map((p) => p.projectId)
          );
        }

        // Filter project-employee assignments to only those in date-filtered projects
        allProjectEmployees = allProjectEmployees.filter((pe) => {
          return dateFilteredProjectIds.has(pe.projectId);
        });
        activeProjectEmployees = activeProjectEmployees.filter((pe) => {
          return dateFilteredProjectIds.has(pe.projectId);
        });

        // Filter employees to only those assigned to date-filtered projects
        // This includes both: employees assigned via ProjectEmployee AND project leads
        const employeeIdsInFilteredProjects = new Set(
          activeProjectEmployees.map((pe) => pe.empId)
        );
        // Also include project leads from filtered projects
        filteredProjects.forEach((p) => {
          if (p.leadByEmpId) {
            employeeIdsInFilteredProjects.add(p.leadByEmpId);
          }
        });

        filteredEmployees = filteredEmployees.filter((emp) => {
          return employeeIdsInFilteredProjects.has(emp.employeeId);
        });
      }
      // If custom range is selected but no dates provided, skip date filtering
      // (treat as "all time" - no date filtering applied)
    }

    // Count archived projects (after all filters)
    let filteredArchivedProjects = archivedProjects;
    if (filters.department && filters.department !== 'all') {
      const employeeIdsInDept = new Set(
        employees
          .filter((e) => e.department === filters.department)
          .map((e) => e.employeeId)
      );
      filteredArchivedProjects = archivedProjects.filter((p) => {
        const hasDeptLead =
          p.leadByEmpId && employeeIdsInDept.has(p.leadByEmpId);
        const hasDeptAssignment = allProjectEmployees.some(
          (pe) =>
            pe.projectId === p.projectId && employeeIdsInDept.has(pe.empId)
        );
        return hasDeptLead || hasDeptAssignment;
      });
    }
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      const isCustomWithoutDates =
        filters.dateRange === 'custom' &&
        (!filters.startDate || !filters.endDate);

      if (!isCustomWithoutDates) {
        switch (filters.dateRange) {
          case 'last30':
            cutoffDate.setDate(now.getDate() - 30);
            break;
          case 'last90':
            cutoffDate.setDate(now.getDate() - 90);
            break;
          case 'last365':
            cutoffDate.setFullYear(now.getFullYear() - 1);
            break;
        }
        if (filters.dateRange !== 'custom') {
          filteredArchivedProjects = filteredArchivedProjects.filter((p) => {
            const projectDate = p.startDate ? new Date(p.startDate) : null;
            return (
              projectDate && projectDate >= cutoffDate && projectDate <= now
            );
          });
        } else if (filters.startDate && filters.endDate) {
          const start = new Date(filters.startDate);
          const end = new Date(filters.endDate);
          filteredArchivedProjects = filteredArchivedProjects.filter((p) => {
            const projectDate = p.startDate ? new Date(p.startDate) : null;
            return projectDate && projectDate >= start && projectDate <= end;
          });
        }
      }
    }

    const archivedProjectCount = filteredArchivedProjects.length;

    // Calculate insights using filtered data
    const insights: IBusinessInsights = {
      projectStatusDistribution:
        this.calculateStatusDistribution(filteredProjects),
      resourceUtilization: this.calculateResourceUtilization(
        filteredProjects,
        filteredEmployees,
        activeProjectEmployees
      ),
      readinessScores: this.calculateReadinessScores(filteredProjects),
      teamCapacity: this.calculateTeamCapacity(
        filteredProjects,
        filteredEmployees,
        activeProjectEmployees
      ),
      projectHealthTrends: this.calculateHealthTrends(filteredProjects),
      budgetMetrics: this.calculateBudgetMetrics(filteredProjects),
      departmentBreakdown: this.calculateDepartmentBreakdown(
        filteredProjects, // Use filtered projects to respect department/date filters
        filteredEmployees, // Use filtered employees to respect department/date filters
        filters.department // Pass department filter to properly group projects
      ),
      projectTypeBreakdown:
        this.calculateProjectTypeBreakdown(filteredProjects),
      filteredProjectCount: filteredProjects.length,
      archivedProjectCount,
      workforce: workforceCounts(filteredEmployees, activeProjectEmployees) };

    this.insightsSignal.set(insights);
    this.loadingSignal.set(false);
  }

  private calculateStatusDistribution(projects: IProject[]) {
    const distribution = {
      draft: 0,
      in_progress: 0,
      completed: 0,
      on_hold: 0,
      cancelled: 0 };

    const buckets = { inFlight: 'in_progress', planning: 'draft', onHold: 'on_hold' } as const;
    projects.forEach((p) => {
      const bucket = projectStatusBucket(p);
      const status = normalizedProjectStatus(p);
      if (bucket) {
        distribution[buckets[bucket]]++;
      } else if (/complete|done/.test(status)) {
        distribution.completed++;
      } else if (/reject|cancel/.test(status)) {
        distribution.cancelled++;
      } else {
        distribution.draft++;
      }
    });

    return distribution;
  }

  private calculateResourceUtilization(
    projects: IProject[],
    employees: Employee[],
    projectEmployees: IProjectEmployee[]
  ) {
    const totalEmployees = employees.filter(isEmployeeActive).length;

    const activeAssignments = projectEmployees.filter((pe) => isAssignmentActive(pe.isActive));

    // Calculate total allocation percentage across all employees
    const employeeAllocations = new Map<number, number>();
    activeAssignments.forEach((assignment) => {
      const empId = assignment.empId;
      const allocation = assignment.allocationPct || 0;
      const current = employeeAllocations.get(empId) || 0;
      employeeAllocations.set(empId, current + allocation);
    });

    // Calculate average allocation
    const totalAllocation = Array.from(employeeAllocations.values()).reduce(
      (sum, alloc) => sum + alloc,
      0
    );
    const averageAllocation =
      totalEmployees > 0 ? totalAllocation / totalEmployees : 0;

    // Count overbooked employees (allocation > 100%)
    const overbookedCount = Array.from(employeeAllocations.values()).filter(
      (alloc) => alloc > 100
    ).length;

    const availableCount = workforceCounts(employees, activeAssignments).available;

    return {
      totalEmployees,
      activeAssignments: activeAssignments.length,
      averageAllocation: Math.round(averageAllocation),
      overbookedCount,
      availableCount };
  }

  /**
   * Recalculates readiness score from checklist items, matching backend logic
   * This ensures consistency with backend calculations
   */
  private recalculateReadinessScore(project: IProject): number {
    // If readinessScore is explicitly provided, use it (backend may have set it)
    if (
      project.readinessScore != null &&
      typeof project.readinessScore === 'number'
    ) {
      return project.readinessScore;
    }

    // Recalculate from checklist items (matching backend normalizeReadinessChecklist logic)
    const checklist = project.readinessChecklist;
    if (!checklist || !Array.isArray(checklist.items)) {
      return 0;
    }

    // Readiness definitions matching backend (weights must sum to 100)
    const READINESS_DEFINITIONS = [
      { id: 'scopeDefined', weight: 25 },
      { id: 'budgetApproved', weight: 20 },
      { id: 'legalReviewed', weight: 20 },
      { id: 'assetsPrepared', weight: 15 },
      { id: 'kickoffScheduled', weight: 20 }];

    const READINESS_STATUS_VALUES: Record<string, number> = {
      not_started: 0,
      in_progress: 0.5,
      blocked: 0,
      done: 1 };

    const READINESS_TOTAL_WEIGHT = READINESS_DEFINITIONS.reduce(
      (total, item) => total + item.weight,
      0
    );

    // Create map of items by ID
    const itemsById = new Map(
      checklist.items
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => [item.id, item])
    );

    // Calculate completed weight
    let completedWeight = 0;
    READINESS_DEFINITIONS.forEach((definition) => {
      const item = itemsById.get(definition.id);
      if (item) {
        const status = item.status || 'not_started';
        const statusValue =
          READINESS_STATUS_VALUES[status] !== undefined
            ? READINESS_STATUS_VALUES[status]
            : 0;
        completedWeight += definition.weight * statusValue;
      }
    });

    // Calculate percent (matching backend: Math.round((completedWeight / READINESS_TOTAL_WEIGHT) * 100))
    const percent =
      READINESS_TOTAL_WEIGHT > 0
        ? Math.round((completedWeight / READINESS_TOTAL_WEIGHT) * 100)
        : 0;

    return percent;
  }

  private calculateReadinessScores(projects: IProject[]) {
    // Recalculate readiness scores from checklist items to match backend logic
    // Include ALL projects in distribution (even those with 0% readiness)
    const allScores = projects.map((p) => this.recalculateReadinessScore(p));

    // For average calculation, exclude 0% scores to get meaningful average
    const scoresForAverage = allScores.filter((s) => s > 0);

    const average =
      scoresForAverage.length > 0
        ? scoresForAverage.reduce((sum, s) => sum + s, 0) /
          scoresForAverage.length
        : 0;

    // Distribution includes ALL projects (including 0% readiness)
    const distribution = INSIGHTS_READINESS_RANGES.map((range) => ({
      range,
      count: 0,
    }));

    allScores.forEach((score) => {
      if (score <= 25) distribution[0].count++;
      else if (score <= 50) distribution[1].count++;
      else if (score <= 75) distribution[2].count++;
      else distribution[3].count++;
    });

    return { average: Math.round(average), scoredCount: scoresForAverage.length, distribution };
  }

  private calculateTeamCapacity(
    projects: IProject[],
    employees: Employee[],
    projectEmployees: IProjectEmployee[]
  ) {
    const totalEmployees = employees.filter(isEmployeeActive).length;
    const totalCapacity = totalEmployees * 100;

    const activeAssignments = projectEmployees.filter((pe) => isAssignmentActive(pe.isActive));
    const utilizedCapacity = activeAssignments.reduce(
      (sum, assignment) => sum + (assignment.allocationPct || 0),
      0
    );

    const availableCapacity = Math.max(0, totalCapacity - utilizedCapacity);
    const utilizationPercentage =
      totalCapacity > 0
        ? Math.round((utilizedCapacity / totalCapacity) * 100)
        : 0;

    return {
      totalCapacity,
      utilizedCapacity: Math.round(utilizedCapacity),
      availableCapacity: Math.round(availableCapacity),
      utilizationPercentage };
  }

  private calculateHealthTrends(_projects: IProject[]) {
    // Simplified - would need historical data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month) => ({
      month,
      healthy: Math.floor(Math.random() * 5) + 1,
      atRisk: Math.floor(Math.random() * 3),
      critical: Math.floor(Math.random() * 2) }));
  }

  private calculateBudgetMetrics(projects: IProject[]) {
    let totalBudget = 0;
    let allocatedBudget = 0;
    let spentBudget = 0;

    projects.forEach((p) => {
      // Check for budget object (primary source)
      const budget = p.budget as any;
      if (budget && typeof budget === 'object' && budget !== null) {
        // Use budget object if it exists
        totalBudget += typeof budget.total === 'number' ? budget.total : 0;
        allocatedBudget +=
          typeof budget.allocated === 'number' ? budget.allocated : 0;
        spentBudget += typeof budget.spent === 'number' ? budget.spent : 0;
      } else {
        // Fallback to budgetAllocation from resourcesPlan (backward compatibility)
        const budgetAllocation = (p.resourcesPlan as any)?.budgetAllocation;
        if (budgetAllocation && typeof budgetAllocation === 'number') {
          totalBudget += budgetAllocation;
          // If no budget object, allocated and spent remain 0
        }
      }
    });

    return {
      totalBudget,
      allocatedBudget,
      spentBudget,
      remainingBudget: Math.max(0, totalBudget - spentBudget) };
  }

  private calculateDepartmentBreakdown(
    projects: IProject[],
    employees: Employee[],
    departmentFilter?: string
  ) {
    const deptMap = new Map<
      string,
      { employees: number; projects: number; readiness: number[] }
    >();

    employees.forEach((emp) => {
      const dept = emp.department || 'Unassigned';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { employees: 0, projects: 0, readiness: [] });
      }
      deptMap.get(dept)!.employees++;
    });

    projects.forEach((p) => {
      // If a department filter is applied, count all filtered projects under that department
      // Otherwise, count by lead's department
      let dept: string;
      if (departmentFilter && departmentFilter !== 'all') {
        // When filtering by a specific department, all projects belong to that department
        dept = departmentFilter;
      } else {
        // When showing all departments, group by lead's department
        const lead = employees.find((e) => e.employeeId === p.leadByEmpId);
        dept = lead?.department || 'Unassigned';
      }

      if (deptMap.has(dept)) {
        deptMap.get(dept)!.projects++;
        // Recalculate readiness score from checklist items (matching other calculations)
        const readiness = this.recalculateReadinessScore(p);
        // Only include projects with readiness > 0 in average calculation
        if (readiness > 0) {
          deptMap.get(dept)!.readiness.push(readiness);
        }
      }
    });

    return Array.from(deptMap.entries()).map(([department, data]) => ({
      department,
      employeeCount: data.employees,
      projectCount: data.projects,
      averageReadiness:
        data.projects === 0
          ? null
          : data.readiness.length > 0
            ? Math.round(data.readiness.reduce((a, b) => a + b, 0) / data.readiness.length)
            : 0 }));
  }

  private calculateProjectTypeBreakdown(projects: IProject[]) {
    const typeMap = new Map<string, { count: number; readiness: number[] }>();

    projects.forEach((p) => {
      const type = p.clientIndustry || p.tags?.[0] || 'General';
      if (!typeMap.has(type)) {
        typeMap.set(type, { count: 0, readiness: [] });
      }
      typeMap.get(type)!.count++;
      // Recalculate readiness score from checklist items (matching other calculations)
      const readiness = this.recalculateReadinessScore(p);
      // Only include projects with readiness > 0 in average calculation
      if (readiness > 0) {
        typeMap.get(type)!.readiness.push(readiness);
      }
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      averageReadiness:
        data.readiness.length > 0
          ? Math.round(
              data.readiness.reduce((a, b) => a + b, 0) / data.readiness.length
            )
          : 0 }));
  }

  setActiveTab(tab: InsightsTabId): void {
    this.activeTabSignal.set(tab);
  }

  onFilterChange(): void {
    const { dateRange, department } = this.filterForm.value;
    this.filtersActive.set(dateRange !== 'all' || department !== 'all');
    this.calculateInsights();
  }

  resetFilters(): void {
    this.filterForm.reset({
      dateRange: 'all',
      startDate: '',
      endDate: '',
      department: 'all',
      projectType: 'all',
    });
    this.onFilterChange();
    // The link unmounts while focused; keep keyboard focus inside the filter row.
    document.getElementById('insights-date-range')?.focus();
  }

  exportToCSV(): void {
    const insights = this.insightsSignal();
    if (!insights) {
      this.toast.info({
        title: 'Nothing to Export Yet',
        description: 'Wait for the insights to finish loading, then try again.',
      });
      return;
    }
    try {
      this.downloadCsv(insights);
      this.toast.success({
        title: 'Report Exported',
        description: 'Business insights CSV downloaded.',
      });
    } catch (error) {
      console.error('CSV export failed', error);
      this.toast.error({
        title: "Couldn't Export Report",
        description: 'The browser blocked the CSV download. Please try again.',
      });
    }
  }

  private downloadCsv(insights: IBusinessInsights): void {

    const csvRows: string[] = [];
    csvRows.push('Business Insights Report');
    csvRows.push(`Generated: ${new Date().toLocaleString()}`);
    csvRows.push('');

    // Project Status Distribution
    csvRows.push('Project Status Distribution');
    csvRows.push('Status,Count');
    Object.entries(insights.projectStatusDistribution).forEach(
      ([status, count]) => {
        csvRows.push(`${status},${count}`);
      }
    );
    csvRows.push('');

    // Resource Utilization
    csvRows.push('Resource Utilization');
    csvRows.push('Metric,Value');
    Object.entries(insights.resourceUtilization).forEach(([key, value]) => {
      csvRows.push(`${key},${value}`);
    });
    csvRows.push('');

    // Department Breakdown
    csvRows.push('Department Breakdown');
    csvRows.push('Department,Employees,Projects,Avg Readiness');
    insights.departmentBreakdown.forEach((dept) => {
      csvRows.push(
        `${dept.department},${dept.employeeCount},${dept.projectCount},${this.readinessText(dept.averageReadiness)}`
      );
    });

    // The byte-order mark makes Excel read the file as UTF-8 ("—", "·").
    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `business-insights-${
      new Date().toISOString().split('T')[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportToPDF(): void {
    this.toast.info({
      title: 'Opening Print Dialog',
      description: 'Choose "Save as PDF" as the destination to export this report.',
    });
    setTimeout(() => window.print());
  }
}
