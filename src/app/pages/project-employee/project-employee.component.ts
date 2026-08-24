import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MasterService } from '../../service/master.service';
import { IProjectEmployee, IProject } from '../../model/interface/master';
import { CommonModule } from '@angular/common';
import { Employee } from '../../model/class/Employee';
import { ToastService } from '@/app/components/ui/toast.service';
import { UbButtonDirective } from '@/app/components/ui/button';
import { DatePipe } from '@angular/common';

import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from '@/app/components/ui/list-skeleton.component';

@Component({
  selector: 'app-project-employee',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UbButtonDirective,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
  ],
  providers: [DatePipe],
  templateUrl: './project-employee.component.html',
  styleUrls: ['./project-employee.component.css'],
})
export class ProjectEmployeeComponent implements OnInit {
  private readonly masterService = inject(MasterService);
  private readonly toast = inject(ToastService);
  private readonly datePipe = inject(DatePipe);
  private readonly fb = inject(FormBuilder);

  private readonly assignmentsSignal = signal<IProjectEmployee[]>([]);
  readonly assignments = this.assignmentsSignal.asReadonly();

  private readonly projectsSignal = signal<IProject[]>([]);
  readonly projects = this.projectsSignal.asReadonly();

  private readonly employeesSignal = signal<Employee[]>([]);
  readonly employees = this.employeesSignal.asReadonly();

  readonly searchTerm = signal<string>('');
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);
  readonly filteredAssignments = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.assignments();
    }
    return this.assignments().filter((item) => {
      return (
        item.projectName?.toLowerCase().includes(term) ||
        item.employeeName?.toLowerCase().includes(term) ||
        item.role?.toLowerCase().includes(term) ||
        item.assignedDate?.toLowerCase().includes(term)
      );
    });
  });

  readonly metrics = computed(() => {
    const data = this.assignments();
    const active = data.filter((item) => this.isActive(item.isActive)).length;
    return {
      total: data.length,
      active,
      inactive: data.length - active,
    };
  });

  projectEmployeeForm: FormGroup = this.fb.group({
    empProjectId: [null],
    projectId: ['', Validators.required],
    empId: ['', Validators.required],
    assignedDate: [this.todayString(), Validators.required],
    role: ['', Validators.required],
    allocationPct: [
      0,
      [Validators.required, Validators.min(0), Validators.max(200)],
    ],
    isActive: [true],
    notes: [''],
  });

  expandedAssignmentId: number | null = null;
  editingAssignmentId: number | null = null;
  showCreatePanel = false;
  pendingDelete: IProjectEmployee | null = null;
  isSaving = false;
  isDeleting = false;

  ngOnInit(): void {
    const projectsSnap = this.masterService.peekProjects();
    const employeesSnap = this.masterService.peekEmployees();
    const assignmentsSnap = this.masterService.peekProjectEmployees();
    const hasLocalAssignments = this.assignments().length > 0;

    // Warm for list/metrics only when assignment data exists (sibling peeks alone must not skip skeleton).
    const assignmentsWarm = assignmentsSnap != null || hasLocalAssignments;

    if (projectsSnap) {
      this.projectsSignal.set(projectsSnap);
    }
    if (employeesSnap) {
      this.employeesSignal.set(employeesSnap);
    }
    if (assignmentsSnap) {
      this.assignmentsSignal.set(assignmentsSnap);
      if (!this.expandedAssignmentId && assignmentsSnap.length) {
        this.expandedAssignmentId = assignmentsSnap[0].empProjectId ?? null;
      }
    }

    this.isLoading.set(!assignmentsWarm);
    if (assignmentsWarm) {
      this.hasLoaded.set(true);
    }

    let projectsLoaded = projectsSnap != null;
    let employeesLoaded = employeesSnap != null;
    let assignmentsLoaded = assignmentsSnap != null;

    const markComplete = () => {
      if (projectsLoaded && employeesLoaded && assignmentsLoaded) {
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      }
    };

    this.masterService.getAllProjects().subscribe({
      next: (projects) => {
        this.projectsSignal.set(projects ?? []);
        projectsLoaded = true;
        markComplete();
      },
      error: () => {
        if (!projectsSnap) {
          this.projectsSignal.set([]);
        }
        projectsLoaded = true;
        markComplete();
      },
    });
    this.masterService.getAllEmp().subscribe({
      next: (employees) => {
        this.employeesSignal.set(employees ?? []);
        employeesLoaded = true;
        markComplete();
      },
      error: () => {
        if (!employeesSnap) {
          this.employeesSignal.set([]);
        }
        employeesLoaded = true;
        markComplete();
      },
    });
    this.getProjectEmployees(() => {
      assignmentsLoaded = true;
      markComplete();
    });
  }

  getProjectEmployees(onComplete?: () => void) {
    this.masterService.getProjectEmp().subscribe({
      next: (res: IProjectEmployee[]) => {
        this.assignmentsSignal.set(res ?? []);
        if (!this.expandedAssignmentId && res?.length) {
          this.expandedAssignmentId = res[0].empProjectId ?? null;
        }
        onComplete?.();
      },
      error: () => {
        if (this.assignments().length === 0) {
          this.assignmentsSignal.set([]);
        }
        onComplete?.();
      },
    });
  }

  onEdit(projectEmployee: IProjectEmployee) {
    this.showCreatePanel = false;
    this.editingAssignmentId = projectEmployee.empProjectId;
    this.expandedAssignmentId = projectEmployee.empProjectId;
    this.projectEmployeeForm.patchValue({
      empProjectId: projectEmployee.empProjectId,
      projectId: projectEmployee.projectId,
      empId: projectEmployee.empId,
      assignedDate: projectEmployee.assignedDate
        ? projectEmployee.assignedDate.substring(0, 10)
        : '',
      role: projectEmployee.role,
      allocationPct:
        projectEmployee.allocationPct !== undefined &&
        projectEmployee.allocationPct !== null
          ? projectEmployee.allocationPct
          : 0,
      isActive: this.isActive(projectEmployee.isActive),
      notes: projectEmployee.notes || '',
    });
  }

  onDelete(id: number) {
    const assignment = this.assignments().find(
      (item) => item.empProjectId === id
    );
    if (!assignment) {
      return;
    }
    this.pendingDelete = assignment;
  }

  onSave() {
    if (this.projectEmployeeForm.valid && !this.isSaving) {
      const projectEmployee = {
        ...this.projectEmployeeForm.value,
        allocationPct: Number(this.projectEmployeeForm.value.allocationPct) || 0,
        isActive: this.projectEmployeeForm.value.isActive ? 'Y' : 'N',
      };
      this.isSaving = true;
      if (projectEmployee.empProjectId) {
        // Update existing project employee
        this.masterService.updateProjectEmp(projectEmployee).subscribe(
          () => {
            this.isSaving = false;
            this.getProjectEmployees();
            this.projectEmployeeForm.reset();
            this.toast.success({
              title: 'Assignment updated',
              description: 'Changes saved successfully.',
            });
            this.editingAssignmentId = null;
            this.expandedAssignmentId = null;
          },
          (_error: any) => {
            this.isSaving = false;
            this.toast.error({
              title: 'Update failed',
              description: 'Unable to update project assignment.',
            });
          }
        );
      } else {
        // Create new project employee
        this.masterService.saveProjectEmp(projectEmployee).subscribe(
          () => {
            this.isSaving = false;
            this.getProjectEmployees();
            this.projectEmployeeForm.reset();
            this.toast.success({
              title: 'Assignment created',
              description: 'A new team assignment has been added.',
            });
            this.showCreatePanel = false;
            this.resetForm();
          },
          (_error: any) => {
            this.isSaving = false;
            this.toast.error({
              title: 'Creation failed',
              description: 'Unable to create project assignment.',
            });
          }
        );
      }
    } else {
      if (!this.isSaving) {
        this.toast.error({
          title: 'Missing details',
          description: 'Please complete all required fields.',
        });
      }
    }
  }

  confirmDelete(confirmed: boolean) {
    if (!confirmed || !this.pendingDelete) {
      this.pendingDelete = null;
      return;
    }
    const { empProjectId, projectName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterService.deleteProjectEmpById(empProjectId).subscribe(
      () => {
        this.isDeleting = false;
        this.pendingDelete = null;
        this.assignmentsSignal.update((list) =>
          list.filter((item) => item.empProjectId !== empProjectId)
        );
        this.toast.success({
          title: 'Assignment removed',
          description: `${projectName} assignment deleted.`,
        });
        if (this.expandedAssignmentId === empProjectId) {
          this.expandedAssignmentId = null;
        }
        if (this.editingAssignmentId === empProjectId) {
          this.editingAssignmentId = null;
        }
      },
      () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Delete failed',
          description: 'Unable to remove project assignment.',
        });
      }
    );
  }

  toggleExpand(empProjectId: number | null | undefined) {
    const target = empProjectId ?? null;
    this.expandedAssignmentId =
      this.expandedAssignmentId === target ? null : target;
    if (this.expandedAssignmentId !== this.editingAssignmentId) {
      this.cancelEdit();
    }
  }

  toggleCreatePanel() {
    this.isSaving = false;
    this.showCreatePanel = !this.showCreatePanel;
    this.editingAssignmentId = null;
    this.expandedAssignmentId = null;
    if (this.showCreatePanel) {
      this.resetForm();
    } else {
      this.projectEmployeeForm.reset();
    }
  }

  updateSearch(term: string) {
    this.searchTerm.set(term);
  }

  cancelEdit() {
    if (this.editingAssignmentId !== null) {
      this.isSaving = false;
      this.projectEmployeeForm.reset();
      this.editingAssignmentId = null;
    }
  }

  formattedDate(value: string | null | undefined) {
    if (!value) {
      return '—';
    }
    return this.datePipe.transform(value, 'MMM d, y') ?? value;
  }

  projectNameFor(id: number | null | undefined) {
    if (id == null) return '—';
    return this.projects().find((project) => project.projectId === id)
      ?.projectName;
  }

  employeeNameFor(id: number | null | undefined) {
    if (id == null) return '—';
    return this.employees().find((emp) => emp.employeeId === id)?.employeeName;
  }

  statusBadge(isActive: string | boolean | null | undefined) {
    return this.isActive(isActive)
      ? 'inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
      : 'inline-flex items-center rounded-full border border-slate-400/40 bg-slate-500/15 px-3 py-1 text-xs font-medium text-slate-200';
  }

  isActive(value: string | boolean | null | undefined): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['y', 'yes', 'true', '1'].includes(value.toLowerCase());
    }
    return false;
  }

  private todayString() {
    return new Date().toISOString().substring(0, 10);
  }

  private resetForm() {
    this.projectEmployeeForm.reset({
      empProjectId: null,
      projectId: '',
      empId: '',
      assignedDate: this.todayString(),
      role: '',
      allocationPct: 0,
      isActive: true,
      notes: '',
    });
  }
}
