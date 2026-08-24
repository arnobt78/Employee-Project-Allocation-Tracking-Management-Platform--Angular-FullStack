import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, ListSkeletonComponent, StatPillSkeletonComponent],
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
    this.isLoading.set(true);

    let dashboardLoaded = false;
    let departmentsLoaded = false;
    let projectsLoaded = false;
    let employeesLoaded = false;
    let projectEmployeesLoaded = false;

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
        this.dashboardData = {
          totalEmployee: 0,
          totalProject: 0,
          activeProjectEmployees: 0,
          recentProjects: [],
          recentEmployee: [],
        };
        dashboardLoaded = true;
        markComplete();
      },
    });

    this.masterService.getAllDept().subscribe({
      next: (response) => {
        if (response?.result && Array.isArray(response.data)) {
          this.parentDepartments = response.data;
        } else if (Array.isArray(response)) {
          this.parentDepartments = response as unknown as IParentDept[];
        }
        departmentsLoaded = true;
        markComplete();
      },
      error: () => {
        this.parentDepartments = [];
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
        this.projects = [];
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
        this.employees = [];
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
        this.projectEmployees = [];
        projectEmployeesLoaded = true;
        markComplete();
      },
    });
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
