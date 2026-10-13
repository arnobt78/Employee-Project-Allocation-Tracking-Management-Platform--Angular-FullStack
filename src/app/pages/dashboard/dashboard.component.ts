import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MasterService } from '../../service/master.service';
import {
  IParentDept,
  IProject,
  IProjectEmployee,
} from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import {
  DashboardChartComponent,
  DashboardChartSlice,
} from '@/app/components/ui/dashboard-chart.component';
import { DashboardSkeletonComponent } from '@/app/components/ui/dashboard-skeleton.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import { BADGE_TONE_CLASS, projectStatusMeta } from '@/app/lib/status/project-status';
import { employeeAvatar } from '@/app/lib/media/employee-avatar';
import {
  projectCounts,
  projectCountsLabel,
  type ProjectCounts,
} from '@/app/lib/status/project-archive';
import {
  assignmentCounts,
  assignmentCountsLabel,
  closedCount,
  closedCountsLabel,
  dotJoin,
  peopleLabel,
  projectStatusBuckets,
  staffingCounts,
  staffingCountsLabel,
  uniqueAssignees,
  workforceCounts,
  workforceCountsLabel,
  type AssignmentCounts,
  type ProjectStatusBuckets,
  type StaffingCounts,
  type WorkforceCounts,
} from '@/app/lib/status/portfolio-stats';
import { PORTFOLIO_KPIS } from '@/app/constants/portfolio-kpis';

interface DashboardStats {
  projects: ProjectCounts;
  status: ProjectStatusBuckets;
  staffing: StaffingCounts;
  assignments: AssignmentCounts;
  workforce: WorkforceCounts;
  /** Unique people on active projects, as on Project Team. */
  people: number;
}

interface DashboardSnapshot {
  totalEmployee: number;
  /** Non-archived projects. */
  totalProject: number;
  archivedProject?: number;
  activeProjectEmployees: number;
  recentProjects: IProject[];
  recentEmployee: Employee[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    UserAvatarComponent,
    PageHeaderComponent,
    KpiStatCardComponent,
    DashboardChartComponent,
    DashboardSkeletonComponent,
    AppIconComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  readonly pageMeta = PRIVATE_PAGE_META['/dashboard'];
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);
  dashboardData: DashboardSnapshot | null = null;
  parentDepartments: IParentDept[] = [];

  projects: IProject[] = [];
  employees: Employee[] = [];
  projectEmployees: IProjectEmployee[] = [];

  /** Computed from the cached lists with the shared portfolio helpers. */
  stats: DashboardStats | null = null;
  readonly kpi = PORTFOLIO_KPIS;

  projectStatusSlices: DashboardChartSlice[] = [];
  assignmentSlices: DashboardChartSlice[] = [];

  constructor(private masterService: MasterService) {}

  ngOnInit(): void {
    this.loadPageData();
  }

  /** From the lists once loaded, else from the dashboard aggregate (`totalProject` is non-archived). */
  get projectTotals(): ProjectCounts {
    if (this.stats) {
      return this.stats.projects;
    }
    const active = this.dashboardData?.totalProject ?? 0;
    const archived = this.dashboardData?.archivedProject ?? 0;
    return { active, archived, total: active + archived };
  }

  get projectCountsLabel(): string {
    return projectCountsLabel(this.projectTotals);
  }

  get employeeTotal(): number {
    return this.stats?.workforce.total ?? this.dashboardData?.totalEmployee ?? 0;
  }

  get employeesHint(): string {
    return this.stats ? workforceCountsLabel(this.stats.workforce) : 'Assigned · Available';
  }

  get closedTotal(): number {
    return this.stats ? closedCount(this.stats.status) : 0;
  }

  get closedHint(): string {
    return this.stats ? closedCountsLabel(this.stats.status) : this.kpi.closed.hint;
  }

  get staffingHint(): string {
    return this.stats ? staffingCountsLabel(this.stats.staffing) : 'Staffed · Lead Only · Unstaffed';
  }

  get assignmentsHint(): string {
    return this.stats ? assignmentCountsLabel(this.stats.assignments) : 'Active · Inactive · Archived';
  }

  get opsSummary(): string {
    if (!this.stats) {
      return `${this.dashboardData?.activeProjectEmployees ?? 0} active assignments`;
    }
    const { people, assignments } = this.stats;
    return dotJoin([`${peopleLabel(people)} on projects`, `${assignments.active} active assignments`]);
  }

  private loadPageData(): void {
    const dashboardSnap = this.masterService.peekDashboard();
    const departmentsSnap = this.masterService.peekDepartments();
    const projectsSnap = this.masterService.peekProjects();
    const employeesSnap = this.masterService.peekEmployees();
    const projectEmployeesSnap = this.masterService.peekProjectEmployees();

    const seededFromCache = dashboardSnap != null;

    if (dashboardSnap) {
      this.dashboardData = dashboardSnap as DashboardSnapshot;
    }
    if (departmentsSnap) {
      this.applyDepartments(departmentsSnap);
    }
    if (projectsSnap) {
      this.projects = projectsSnap;
    }
    if (employeesSnap) {
      this.employees = employeesSnap;
    }
    if (projectEmployeesSnap) {
      this.projectEmployees = projectEmployeesSnap;
    }
    if (projectsSnap && employeesSnap && projectEmployeesSnap) {
      this.calculateProjectStatistics();
    }

    this.isLoading.set(!seededFromCache);
    if (seededFromCache) {
      this.hasLoaded.set(true);
    }

    let dashboardLoaded = dashboardSnap != null;
    let departmentsLoaded = departmentsSnap != null;
    let projectsLoaded = projectsSnap != null;
    let employeesLoaded = employeesSnap != null;
    let projectEmployeesLoaded = projectEmployeesSnap != null;

    const markComplete = () => {
      if (
        dashboardLoaded &&
        departmentsLoaded &&
        projectsLoaded &&
        employeesLoaded &&
        projectEmployeesLoaded
      ) {
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      }
    };

    this.masterService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data as DashboardSnapshot;
        dashboardLoaded = true;
        markComplete();
      },
      error: () => {
        if (!this.dashboardData) {
          this.dashboardData = {
            totalEmployee: 0,
            totalProject: 0,
            activeProjectEmployees: 0,
            recentProjects: [],
            recentEmployee: [],
          };
        }
        dashboardLoaded = true;
        markComplete();
      },
    });

    this.masterService.getAllDept().subscribe({
      next: (response) => {
        this.applyDepartments(response);
        departmentsLoaded = true;
        markComplete();
      },
      error: () => {
        if (!departmentsSnap) {
          this.parentDepartments = [];
        }
        departmentsLoaded = true;
        markComplete();
      },
    });

    this.masterService.getAllProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        projectsLoaded = true;
        this.tryCalculateStatistics(
          projectsLoaded,
          employeesLoaded,
          projectEmployeesLoaded
        );
        markComplete();
      },
      error: () => {
        if (!projectsSnap) {
          this.projects = [];
        }
        projectsLoaded = true;
        this.tryCalculateStatistics(projectsLoaded, employeesLoaded, projectEmployeesLoaded);
        markComplete();
      },
    });

    this.masterService.getAllEmp().subscribe({
      next: (employees) => {
        this.employees = employees;
        employeesLoaded = true;
        this.tryCalculateStatistics(
          projectsLoaded,
          employeesLoaded,
          projectEmployeesLoaded
        );
        markComplete();
      },
      error: () => {
        if (!employeesSnap) {
          this.employees = [];
        }
        employeesLoaded = true;
        this.tryCalculateStatistics(projectsLoaded, employeesLoaded, projectEmployeesLoaded);
        markComplete();
      },
    });

    this.masterService.getProjectEmp().subscribe({
      next: (projectEmployees) => {
        this.projectEmployees = projectEmployees;
        projectEmployeesLoaded = true;
        this.tryCalculateStatistics(
          projectsLoaded,
          employeesLoaded,
          projectEmployeesLoaded
        );
        markComplete();
      },
      error: () => {
        if (!projectEmployeesSnap) {
          this.projectEmployees = [];
        }
        projectEmployeesLoaded = true;
        this.tryCalculateStatistics(projectsLoaded, employeesLoaded, projectEmployeesLoaded);
        markComplete();
      },
    });
  }

  private applyDepartments(response: unknown): void {
    const res = response as { result?: boolean; data?: IParentDept[] };
    if (res?.result && Array.isArray(res.data)) {
      this.parentDepartments = res.data;
    } else if (Array.isArray(response)) {
      this.parentDepartments = response as IParentDept[];
    }
  }

  private tryCalculateStatistics(
    projectsLoaded: boolean,
    employeesLoaded: boolean,
    projectEmployeesLoaded: boolean
  ): void {
    if (projectsLoaded && employeesLoaded && projectEmployeesLoaded) {
      this.calculateProjectStatistics();
    }
  }

  calculateProjectStatistics(): void {
    this.stats = {
      projects: projectCounts(this.projects),
      status: projectStatusBuckets(this.projects),
      staffing: staffingCounts(this.projects, this.projectEmployees),
      assignments: assignmentCounts(this.projectEmployees),
      workforce: workforceCounts(this.employees, this.projectEmployees),
      people: uniqueAssignees(this.projectEmployees),
    };
    this.refreshChartSlices();
  }

  private refreshChartSlices(): void {
    const stats = this.stats;
    if (!stats) {
      this.projectStatusSlices = [];
      this.assignmentSlices = [];
      return;
    }
    this.projectStatusSlices = [
      { label: 'Staffed', value: stats.staffing.staffed, color: 'rgba(16, 185, 129, 0.85)' },
      { label: 'Lead Only', value: stats.staffing.leadOnly, color: 'rgba(139, 92, 246, 0.85)' },
      { label: 'Unstaffed', value: stats.staffing.unstaffed, color: 'rgba(148, 163, 184, 0.75)' },
      { label: 'Closed', value: closedCount(stats.status), color: 'rgba(14, 165, 233, 0.7)' },
      { label: 'Archived', value: stats.projects.archived, color: 'rgba(100, 116, 139, 0.7)' },
    ].filter((s) => s.value > 0);

    this.assignmentSlices = [
      { label: 'Active', value: stats.assignments.active, color: 'rgba(56, 189, 248, 0.85)' },
      { label: 'Inactive', value: stats.assignments.inactive, color: 'rgba(244, 63, 94, 0.75)' },
      { label: 'Archived', value: stats.assignments.archived, color: 'rgba(100, 116, 139, 0.7)' },
    ].filter((s) => s.value > 0);
  }

  getDepartmentLogo(logo: string): string {
    if (!logo) {
      return '';
    }
    return logo.startsWith('/') ? logo : `/${logo}`;
  }

  /** Dark raster logos (e.g. Operations gear) stay unreadable — prefer Lucide. */
  preferColoredDeptIcon(name: string): boolean {
    const key = (name || '').toLowerCase();
    return key.includes('operat');
  }

  departmentIcon(name: string): string {
    const key = (name || '').toLowerCase();
    if (key.includes('engineer') || key.includes('tech') || key.includes('it')) {
      return 'zap';
    }
    if (key.includes('human') || key.includes('hr') || key.includes('people')) {
      return 'users';
    }
    if (key.includes('operat') || key.includes('admin')) {
      return 'settings';
    }
    if (key.includes('sales') || key.includes('market')) {
      return 'chart-column';
    }
    if (key.includes('finance') || key.includes('account')) {
      return 'activity';
    }
    return 'building-2';
  }

  departmentBlurb(dept: IParentDept): string {
    if (dept.description?.trim()) {
      return dept.description.trim();
    }
    const headcount = this.employees.filter(
      (e) =>
        (e.department || '').toLowerCase() ===
        (dept.departmentName || '').toLowerCase()
    ).length;
    if (headcount > 0) {
      return `${headcount} team member${headcount === 1 ? '' : 's'} in this division`;
    }
    if (dept.leadContact) {
      return `Led by ${dept.leadContact}`;
    }
    return 'Parent division across the organization';
  }

  readonly statusMeta = projectStatusMeta;
  readonly badgeTone = BADGE_TONE_CLASS;
  readonly avatarFor = employeeAvatar;
}
