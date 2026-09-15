import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
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

interface DashboardSnapshot {
  totalEmployee: number;
  totalProject: number;
  activeProjectEmployees: number;
  recentProjects: IProject[];
  recentEmployee: Employee[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
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

    const archivedProjects = this.projects.filter(
      (p) => p.archivedAt != null && p.archivedAt !== ''
    );
    const nonArchivedProjects = this.projects.filter(
      (p) => !p.archivedAt || p.archivedAt === ''
    );

    const activeProjectEmployees = this.projectEmployees.filter((pe) =>
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

    const activeAssignmentsCount = this.projectEmployees.filter((pe) =>
      this.isActive(pe.isActive)
    ).length;
    const inactiveAssignmentsCount =
      this.projectEmployees.length - activeAssignmentsCount;

    this.projectStats = {
      nonArchived: nonArchivedProjects.length,
      archived: archivedProjects.length,
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
        label: 'Assigned active',
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
        label: 'Unassigned projects',
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

  projectStatusIcon(status: string | undefined): string {
    const key = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (key.includes('active') || key === 'approved') return 'zap';
    if (key.includes('review')) return 'git-pull-request';
    if (key.includes('hold') || key.includes('pause')) return 'pause-circle';
    if (key.includes('draft')) return 'pencil';
    if (key.includes('archiv')) return 'archive';
    if (key.includes('complete') || key.includes('done')) return 'check';
    return 'circle-dot';
  }

  projectStatusTone(status: string | undefined): string {
    const key = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (key.includes('active') || key === 'approved') {
      return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow-[0_8px_24px_rgba(16,185,129,0.25)]';
    }
    if (key.includes('review')) {
      return 'border-amber-400/40 bg-amber-500/15 text-amber-100 shadow-[0_8px_24px_rgba(245,158,11,0.25)]';
    }
    if (key.includes('hold') || key.includes('pause')) {
      return 'border-slate-400/40 bg-slate-500/20 text-slate-100 shadow-[0_8px_24px_rgba(100,116,139,0.3)]';
    }
    if (key.includes('draft')) {
      return 'border-violet-400/40 bg-violet-500/15 text-violet-100 shadow-[0_8px_24px_rgba(139,92,246,0.25)]';
    }
    if (key.includes('archiv')) {
      return 'border-white/20 bg-white/10 text-white/70 shadow-[0_8px_24px_rgba(0,0,0,0.25)]';
    }
    return 'border-sky-400/40 bg-sky-500/15 text-sky-100 shadow-[0_8px_24px_rgba(2,132,199,0.25)]';
  }

  formatStatusLabel(status: string | undefined): string {
    const raw = (status || 'in_progress').replace(/_/g, ' ');
    return raw;
  }
}
