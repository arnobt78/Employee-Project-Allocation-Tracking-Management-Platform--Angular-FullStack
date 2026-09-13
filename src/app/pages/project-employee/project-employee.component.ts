import {
  Component,
  DestroyRef,
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
import { ActivatedRoute, Router } from '@angular/router';
import { MasterService } from '../../service/master.service';
import { IProjectEmployee, IProject } from '../../model/interface/master';
import { CommonModule, DatePipe } from '@angular/common';
import { Employee } from '../../model/class/Employee';
import { ToastService } from '@/app/components/ui/toast.service';
import { UbButtonDirective } from '@/app/components/ui/button';
import { ListSkeletonComponent } from '@/app/components/ui/list-skeleton.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { CardCloseButtonComponent } from '@/app/components/ui/card-close-button.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { ListPaginationComponent } from '@/app/components/ui/list-pagination.component';
import { ListPageShellComponent } from '@/app/components/ui/list-page-shell.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import {
  ListToolbarComponent,
  ListToolbarFilterOption,
} from '@/app/components/ui/list-toolbar.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  bindListQuery,
  ListQueryController,
  paginateList,
} from '@/app/lib/list-query';

@Component({
  selector: 'app-project-employee',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    ReactiveFormsModule,
    UbButtonDirective,
    ListSkeletonComponent,
    SelectMenuComponent,
    AlertDialogComponent,
    CardCloseButtonComponent,
    UserAvatarComponent,
    ListPaginationComponent,
    ListPageShellComponent,
    KpiStatCardComponent,
    ListToolbarComponent,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listQuery!: ListQueryController;

  readonly pageMeta = PRIVATE_PAGE_META['/project-employee'];

  private readonly assignmentsSignal = signal<IProjectEmployee[]>([]);
  readonly assignments = this.assignmentsSignal.asReadonly();

  private readonly projectsSignal = signal<IProject[]>([]);
  readonly projects = this.projectsSignal.asReadonly();

  private readonly employeesSignal = signal<Employee[]>([]);
  readonly employees = this.employeesSignal.asReadonly();

  readonly projectOptions = computed<SelectMenuOption[]>(() =>
    this.projects().map((project) => ({
      value: String(project.projectId),
      label: project.projectName,
      icon: 'folder-kanban',
    }))
  );

  readonly employeeOptions = computed<SelectMenuOption[]>(() =>
    this.employees().map((employee) => ({
      value: String(employee.employeeId),
      label: employee.employeeName,
      imageSeed: employee.emailId || employee.employeeName,
      imageUrl: employee.avatarUrl ?? null,
    }))
  );

  readonly searchTerm = signal<string>('');
  readonly filterValue = signal<string>('');
  readonly listPage = signal(1);
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);

  readonly statusFilterOptions: ListToolbarFilterOption[] = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  readonly hasActiveFilters = computed(
    () => this.searchTerm().trim().length > 0 || this.filterValue().trim().length > 0
  );

  readonly filteredAssignments = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const filter = this.filterValue().trim().toLowerCase();
    return this.assignments().filter((item) => {
      const active = this.isActive(item.isActive);
      if (filter === 'active' && !active) {
        return false;
      }
      if (filter === 'inactive' && active) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        item.projectName?.toLowerCase().includes(term) ||
        item.employeeName?.toLowerCase().includes(term) ||
        item.role?.toLowerCase().includes(term) ||
        item.assignedDate?.toLowerCase().includes(term)
      );
    });
  });
  readonly pagedAssignments = computed(() =>
    paginateList(this.filteredAssignments(), this.listPage())
  );

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
      [Validators.required, Validators.min(0), Validators.max(200)]],
    isActive: [true],
    notes: [''] });

  expandedAssignmentId: number | null = null;
  editingAssignmentId: number | null = null;
  showCreatePanel = false;
  pendingDelete: IProjectEmployee | null = null;
  pendingSave = false;
  isSaving = false;
  isDeleting = false;

  ngOnInit(): void {
    this.listQuery = bindListQuery(
      this.route,
      this.router,
      this.destroyRef,
      this.searchTerm,
      this.listPage,
      this.filterValue
    );
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
      } });
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
      } });
    this.getProjectEmployees(() => {
      assignmentsLoaded = true;
      markComplete();
    });
  }

  getProjectEmployees(onComplete?: () => void) {
    this.masterService.getProjectEmp().subscribe({
      next: (res: IProjectEmployee[]) => {
        this.assignmentsSignal.set(res ?? []);
        onComplete?.();
      },
      error: () => {
        if (this.assignments().length === 0) {
          this.assignmentsSignal.set([]);
        }
        onComplete?.();
      } });
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
      notes: projectEmployee.notes || '' });
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
    if (!this.projectEmployeeForm.valid || this.isSaving) {
      if (!this.isSaving) {
        this.toast.error({
          title: 'Missing details',
          description: 'Please complete all required fields.',
        });
      }
      return;
    }
    if (this.projectEmployeeForm.value.empProjectId) {
      this.pendingSave = true;
      return;
    }
    this.runCreate();
  }

  dismissSave() {
    if (this.isSaving) {
      return;
    }
    this.pendingSave = false;
  }

  confirmSave() {
    if (!this.projectEmployeeForm.valid || this.isSaving) {
      return;
    }
    const projectEmployee = this.buildPayload();
    if (!projectEmployee.empProjectId) {
      this.pendingSave = false;
      this.runCreate();
      return;
    }
    this.isSaving = true;
    this.masterService.updateProjectEmp(projectEmployee).subscribe({
      next: () => {
        this.getProjectEmployees(() => {
          this.isSaving = false;
          this.pendingSave = false;
          this.projectEmployeeForm.reset();
          this.editingAssignmentId = null;
          this.toast.success({
            title: 'Assignment updated',
            description: 'Changes saved successfully.',
          });
        });
      },
      error: () => {
        this.isSaving = false;
        this.toast.error({
          title: 'Update failed',
          description: 'Unable to update project assignment.',
        });
      },
    });
  }

  private runCreate() {
    const projectEmployee = this.buildPayload();
    this.isSaving = true;
    this.masterService.saveProjectEmp(projectEmployee).subscribe({
      next: () => {
        this.getProjectEmployees(() => {
          this.isSaving = false;
          this.showCreatePanel = false;
          this.resetForm();
          this.toast.success({
            title: 'Assignment created',
            description: 'A new team assignment has been added.',
          });
        });
      },
      error: () => {
        this.isSaving = false;
        this.toast.error({
          title: 'Creation failed',
          description: 'Unable to create project assignment.',
        });
      },
    });
  }

  private buildPayload() {
    return {
      ...this.projectEmployeeForm.value,
      projectId: Number(this.projectEmployeeForm.value.projectId),
      empId: Number(this.projectEmployeeForm.value.empId),
      allocationPct: Number(this.projectEmployeeForm.value.allocationPct) || 0,
      isActive: this.projectEmployeeForm.value.isActive ? 'Y' : 'N',
    };
  }

  confirmDelete() {
    if (!this.pendingDelete || this.isDeleting) {
      return;
    }
    const { empProjectId, projectName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterService.deleteProjectEmpById(empProjectId).subscribe({
      next: () => {
        this.assignmentsSignal.update((list) =>
          list.filter((item) => item.empProjectId !== empProjectId)
        );
        this.isDeleting = false;
        this.pendingDelete = null;
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
      error: () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Delete failed',
          description: 'Unable to remove project assignment.',
        });
      },
    });
  }

  dismissDelete() {
    if (this.isDeleting) {
      return;
    }
    this.pendingDelete = null;
  }

  closeExpanded() {
    this.expandedAssignmentId = null;
    this.cancelEdit();
  }

  toggleExpand(empProjectId: number | null | undefined) {
    const target = empProjectId ?? null;
    this.expandedAssignmentId =
      this.expandedAssignmentId === target ? null : target;
    if (this.expandedAssignmentId !== this.editingAssignmentId) {
      this.cancelEdit();
    }
  }

  startCreate() {
    this.isSaving = false;
    this.showCreatePanel = true;
    this.editingAssignmentId = null;
    this.expandedAssignmentId = null;
    this.resetForm();
  }

  closeCreatePanel() {
    this.isSaving = false;
    this.showCreatePanel = false;
  }

  updateSearch(term: string) {
    this.listQuery.setSearch(term);
  }

  setStatusFilter(value: string) {
    this.listQuery.setFilter(value);
  }

  clearListFilters() {
    this.listQuery.clearFilters();
  }

  goToPage(page: number) {
    this.listQuery.setPage(page);
  }

  cancelEdit() {
    this.isSaving = false;
    this.pendingSave = false;
    if (this.editingAssignmentId !== null) {
      this.projectEmployeeForm.reset();
      this.editingAssignmentId = null;
    }
  }

  saveDialogTitle(): string {
    const name =
      this.employeeNameFor(this.projectEmployeeForm.value?.empId) ||
      this.projectNameFor(this.projectEmployeeForm.value?.projectId);
    return name && name !== '—'
      ? `Save Changes To ${name}?`
      : 'Save Assignment Changes?';
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

  employeeAvatarSeed(item: IProjectEmployee): string {
    const emp = this.employees().find((e) => e.employeeId === item.empId);
    return emp?.emailId || item.employeeName || String(item.empId);
  }

  employeeAvatarUrl(item: IProjectEmployee): string | null {
    if (item.employeeAvatarUrl) {
      return item.employeeAvatarUrl;
    }
    return (
      this.employees().find((e) => e.employeeId === item.empId)?.avatarUrl ??
      null
    );
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
