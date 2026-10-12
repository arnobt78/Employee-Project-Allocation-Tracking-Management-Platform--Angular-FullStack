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
  isAssignmentArchived,
  isProjectArchived,
  projectCounts,
  projectCountsLabel,
} from '@/app/lib/status/project-archive';

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

  projectStats: {
    nonArchived: number;
    archived: number;
    active: number;
    inactive: number;
    planning: number;
    assigned: number;
    nonAssigned: number;
    activeAssignments: number;
    inactiveAssignments: number;
  } | null = null;

  projectStatusSlices: DashboardChartSlice[] = [];
  assignmentSlices: DashboardChartSlice[] = [];

  constructor(private masterService: MasterService) {}

  ngOnInit(): void {
    this.loadPageData();
  }

  /** "N Active · M Archived" from the cached list, else from the dashboard aggregate. */
  get projectCountsLabel(): string {
    if (this.projectStats) {
      return projectCountsLabel({
        active: this.projectStats.nonArchived,
        archived: this.projectStats.archived,
        total: this.projectStats.nonArchived + this.projectStats.archived,
      });
    }
    const active = this.dashboardData?.totalProject ?? 0;
    const archived = this.dashboardData?.archivedProject ?? 0;
    return projectCountsLabel({ active, archived, total: active + archived });
  }

  get opsSummary(): string {
    const emp = this.dashboardData?.totalEmployee ?? 0;
    const proj = this.dashboardData?.totalProject ?? 0;
    const active = this.dashboardData?.activeProjectEmployees ?? 0;
    return `${emp} people · ${proj} projects · ${active} actively assigned`;
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
    if (!this.projects.length) {
      this.projectStats = {
        nonArchived: 0,
        archived: 0,
        active: 0,
        inactive: 0,
        planning: 0,
        assigned: 0,
        nonAssigned: 0,
        activeAssignments: 0,
        inactiveAssignments: 0,
      };
      this.refreshChartSlices();
      return;
    }

    const counts = projectCounts(this.projects);
    const nonArchivedProjects = this.projects.filter((p) => !isProjectArchived(p));
    const liveAssignments = this.projectEmployees.filter(
      (pe) => !isAssignmentArchived(pe)
    );

    const activeProjectEmployees = liveAssignments.filter((pe) =>
      this.isActive(pe.isActive)
    );

    const projectIdsWithActiveAssignments = new Set(
      activeProjectEmployees.map((pe) => pe.projectId)
    );

    const activeProjects: IProject[] = [];
    const inactiveProjects: IProject[] = [];
    const planningProjects: IProject[] = [];
    const assignedProjects: IProject[] = [];
    const nonAssignedProjects: IProject[] = [];

    nonArchivedProjects.forEach((p) => {
      const hasActiveAssignments = projectIdsWithActiveAssignments.has(
        p.projectId
      );
      const hasLead = p.leadByEmpId != null;

      if (hasActiveAssignments) {
        assignedProjects.push(p);
      } else {
        nonAssignedProjects.push(p);
      }

      if (hasActiveAssignments) {
        activeProjects.push(p);
      } else if (hasLead) {
        planningProjects.push(p);
        activeProjects.push(p);
      } else {
        inactiveProjects.push(p);
      }
    });

    const activeAssignmentsCount = activeProjectEmployees.length;
    const inactiveAssignmentsCount =
      liveAssignments.length - activeAssignmentsCount;

    this.projectStats = {
      nonArchived: counts.active,
      archived: counts.archived,
      active: activeProjects.length,
      inactive: inactiveProjects.length,
      planning: planningProjects.length,
      assigned: assignedProjects.length,
      nonAssigned: nonAssignedProjects.length,
      activeAssignments: activeAssignmentsCount,
      inactiveAssignments: inactiveAssignmentsCount,
    };
    this.refreshChartSlices();
  }

  private refreshChartSlices(): void {
    const stats = this.projectStats;
    if (!stats) {
      this.projectStatusSlices = [];
      this.assignmentSlices = [];
      return;
    }
    this.projectStatusSlices = [
      {
        label: 'Assigned Active',
        value: stats.assigned,
        color: 'rgba(16, 185, 129, 0.85)',
      },
      {
        label: 'Planning',
        value: stats.planning,
        color: 'rgba(139, 92, 246, 0.85)',
      },
      {
        label: 'Inactive',
        value: stats.inactive,
        color: 'rgba(148, 163, 184, 0.75)',
      },
      {
        label: 'Archived',
        value: stats.archived,
        color: 'rgba(100, 116, 139, 0.7)',
      },
    ].filter((s) => s.value > 0);

    this.assignmentSlices = [
      {
        label: 'Active',
        value: stats.activeAssignments,
        color: 'rgba(56, 189, 248, 0.85)',
      },
      {
        label: 'Inactive',
        value: stats.inactiveAssignments,
        color: 'rgba(244, 63, 94, 0.75)',
      },
      {
        label: 'Unassigned Projects',
        value: stats.nonAssigned,
        color: 'rgba(245, 158, 11, 0.8)',
      },
    ].filter((s) => s.value > 0);
  }

  private isActive(value: string | boolean | null | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['y', 'yes', 'true', '1'].includes(value.toLowerCase());
    }
    return false;
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
