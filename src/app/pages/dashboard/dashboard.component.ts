import { Component, OnInit, signal } from '@angular/core';
import { MasterService } from '../../service/master.service';
import { IParentDept, IProject, IProjectEmployee } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from '@/app/components/ui/list-skeleton.component';

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
  imports: [ListSkeletonComponent, StatPillSkeletonComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
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

  constructor(private masterService: MasterService) {}

  ngOnInit(): void {
    this.loadPageData();
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
      return;
    }

    const archivedProjects = this.projects.filter(
      (p) => p.archivedAt != null && p.archivedAt !== ''
    );
    const nonArchivedProjects = this.projects.filter(
      (p) => !p.archivedAt || p.archivedAt === ''
    );

    const activeProjectEmployees = this.projectEmployees.filter(
      (pe) =>
        pe.isActive === 'Y' ||
        pe.isActive === 'y' ||
        pe.isActive === 'true' ||
        String(pe.isActive).toLowerCase() === 'true'
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
      const hasActiveAssignments = projectIdsWithActiveAssignments.has(p.projectId);
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
}
