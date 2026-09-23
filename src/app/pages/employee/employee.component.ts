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
import { Employee } from '../../model/class/Employee';
import { CommonModule } from '@angular/common';
import { ToastService } from '@/app/components/ui/toast.service';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { CardCloseButtonComponent } from '@/app/components/ui/card-close-button.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { ListPaginationComponent } from '@/app/components/ui/list-pagination.component';
import { ListPageShellComponent } from '@/app/components/ui/list-page-shell.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import { FieldLabelComponent } from '@/app/components/ui/field-label.component';
import {
  ListToolbarComponent,
  ListToolbarMenuFilter,
  ListToolbarMenuFilterChange,
} from '@/app/components/ui/list-toolbar.component';
import { SelectMenuOption } from '@/app/components/ui/select-menu.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  bindListQuery,
  ListQueryController,
  paginateList,
} from '@/app/lib/list-query';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    ReactiveFormsModule,
    AlertDialogComponent,
    CardCloseButtonComponent,
    UserAvatarComponent,
    ListPaginationComponent,
    ListPageShellComponent,
    KpiStatCardComponent,
    FieldLabelComponent,
    ListToolbarComponent,
  ],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css'],
})
export class EmployeeComponent implements OnInit {
  readonly pageMeta = PRIVATE_PAGE_META['/employee'];

  employeeForm: FormGroup;

  private readonly masterService = inject(MasterService);
  private readonly initialPeek = this.masterService.peekEmployees();
  private readonly employeesSignal = signal<Employee[]>(this.initialPeek ?? []);
  readonly employees = this.employeesSignal.asReadonly();

  readonly searchTerm = signal('');
  readonly filterValue = signal('');
  readonly roleFilter = signal('');
  readonly etypeFilter = signal('');
  readonly titleFilter = signal('');
  readonly listPage = signal(1);
  readonly isLoading = signal(this.initialPeek === null);
  readonly hasLoaded = signal(this.initialPeek !== null);

  readonly filteredEmployees = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const deptFilter = this.filterValue().trim().toLowerCase();
    const role = this.roleFilter().trim().toLowerCase();
    const etype = this.etypeFilter().trim().toLowerCase();
    const title = this.titleFilter().trim().toLowerCase();

    return this.employees().filter((employee) => {
      if (
        deptFilter &&
        (employee.department?.toLowerCase() ?? '') !== deptFilter
      ) {
        return false;
      }
      if (role && (employee.role?.toLowerCase() ?? '') !== role) {
        return false;
      }
      if (etype && (employee.employmentType?.toLowerCase() ?? '') !== etype) {
        return false;
      }
      if (title && (employee.title?.toLowerCase() ?? '') !== title) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        employee.employeeName?.toLowerCase().includes(term) ||
        employee.department?.toLowerCase().includes(term) ||
        employee.employeeId?.toString().includes(term) ||
        employee.role?.toLowerCase().includes(term) ||
        employee.title?.toLowerCase().includes(term) ||
        employee.emailId?.toLowerCase().includes(term)
      );
    });
  });

  readonly pagedEmployees = computed(() =>
    paginateList(this.filteredEmployees(), this.listPage()),
  );

  readonly menuFilters = computed((): ListToolbarMenuFilter[] => [
    {
      id: 'dept',
      label: 'Department',
      emptyIcon: 'building-2',
      value: this.filterValue(),
      options: this.uniqueOptions(
        this.employees(),
        (e) => e.department,
        'building-2',
      ),
    },
    {
      id: 'role',
      label: 'Role',
      emptyIcon: 'briefcase',
      value: this.roleFilter(),
      options: this.uniqueOptions(this.employees(), (e) => e.role, 'briefcase'),
    },
    {
      id: 'etype',
      label: 'Employment Type',
      emptyIcon: 'clock',
      value: this.etypeFilter(),
      options: this.uniqueOptions(
        this.employees(),
        (e) => e.employmentType,
        'clock',
      ),
    },
    {
      id: 'title',
      label: 'Title',
      emptyIcon: 'id-card',
      value: this.titleFilter(),
      options: this.uniqueOptions(this.employees(), (e) => e.title, 'id-card'),
    },
  ]);

  readonly totalEmployeesKpi = computed(() => this.employees().length);
  readonly departmentsKpi = computed(() =>
    this.uniqueCount(this.employees(), (e) => e.department),
  );
  readonly rolesKpi = computed(() =>
    this.uniqueCount(this.employees(), (e) => e.role),
  );
  readonly activeEmployeesKpi = computed(
    () => this.employees().filter((e) => e.isActive !== false).length,
  );
  readonly employmentTypesKpi = computed(() =>
    this.uniqueCount(this.employees(), (e) => e.employmentType),
  );
  readonly fullTimeKpi = computed(
    () =>
      this.employees().filter(
        (e) => (e.employmentType ?? '').trim().toLowerCase() === 'full-time',
      ).length,
  );

  readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.filterValue().trim().length > 0 ||
      this.roleFilter().trim().length > 0 ||
      this.etypeFilter().trim().length > 0 ||
      this.titleFilter().trim().length > 0,
  );

  expandedEmployeeId: number | null = null;
  editingEmployeeId: number | null = null;
  showCreatePanel = false;
  pendingDelete: Employee | null = null;
  pendingSave = false;
  isSaving = false;
  isDeleting = false;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);
  private listQuery!: ListQueryController;

  constructor(private fb: FormBuilder) {
    this.employeeForm = this.fb.group({
      employeeId: [null],
      employeeName: ['', Validators.required],
      department: ['', Validators.required],
      deptId: [null],
      role: [''],
      title: [''],
      employmentType: [''],
      contactNo: [''],
      emailId: ['', Validators.email],
      location: [''],
      timezone: [''],
      hireDate: [''],
      skills: [''],
      tags: [''],
    });
  }

  ngOnInit(): void {
    this.listQuery = bindListQuery(
      this.route,
      this.router,
      this.destroyRef,
      this.searchTerm,
      this.listPage,
      this.filterValue,
      {
        role: this.roleFilter,
        etype: this.etypeFilter,
        title: this.titleFilter,
      },
    );
    this.getEmployees();
  }

  getEmployees() {
    const snapshot = this.masterService.peekEmployees();
    const hasLocalData = this.employees().length > 0;
    if (snapshot) {
      this.employeesSignal.set(snapshot);
      this.isLoading.set(false);
      this.hasLoaded.set(true);
    } else if (hasLocalData) {
      this.isLoading.set(false);
      this.hasLoaded.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.masterService.getAllEmp().subscribe({
      next: (res: Employee[]) => {
        this.employeesSignal.set(res ?? []);
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
      error: () => {
        if (!snapshot && !hasLocalData) {
          this.employeesSignal.set([]);
        }
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
    });
  }

  toggleExpand(employeeId: number | null | undefined) {
    const targetId = employeeId ?? null;
    this.expandedEmployeeId =
      this.expandedEmployeeId === targetId ? null : targetId;
    if (this.expandedEmployeeId !== this.editingEmployeeId) {
      this.cancelEdit();
    }
  }

  closeExpanded() {
    this.expandedEmployeeId = null;
    this.cancelEdit();
  }

  startCreate() {
    this.isSaving = false;
    this.showCreatePanel = true;
    this.editingEmployeeId = null;
    this.expandedEmployeeId = null;
    this.employeeForm.reset({
      employeeId: null,
      employeeName: '',
      department: '',
      deptId: null,
      role: '',
      title: '',
      employmentType: '',
      contactNo: '',
      emailId: '',
      location: '',
      timezone: '',
      hireDate: '',
      skills: '',
      tags: '',
    });
  }

  closeCreatePanel() {
    this.isSaving = false;
    this.showCreatePanel = false;
  }

  onEdit(employee: Employee) {
    this.showCreatePanel = false;
    this.editingEmployeeId = employee.employeeId ?? null;
    this.expandedEmployeeId = employee.employeeId ?? null;
    const formatDateForInput = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };

    this.employeeForm.patchValue({
      employeeId: employee.employeeId ?? null,
      employeeName: employee.employeeName ?? '',
      department: employee.department ?? '',
      deptId: employee.deptId ?? null,
      role: employee.role ?? '',
      title: employee.title ?? '',
      employmentType: employee.employmentType ?? '',
      contactNo: employee.contactNo ?? '',
      emailId: employee.emailId ?? '',
      location: employee.location ?? '',
      timezone: employee.timezone ?? '',
      hireDate: formatDateForInput(employee.hireDate),
      skills: Array.isArray(employee.skills) ? employee.skills.join(', ') : '',
      tags: Array.isArray(employee.tags) ? employee.tags.join(', ') : '',
    });
  }

  cancelEdit() {
    this.isSaving = false;
    this.pendingSave = false;
    this.editingEmployeeId = null;
  }

  promptDelete(employee: Employee) {
    this.pendingDelete = employee;
  }

  dismissDelete() {
    if (this.isDeleting) {
      return;
    }
    this.pendingDelete = null;
  }

  confirmDelete() {
    if (!this.pendingDelete?.employeeId || this.isDeleting) {
      return;
    }
    const { employeeId, employeeName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterService.deleteEmpById(employeeId).subscribe({
      next: () => {
        this.employeesSignal.update((list) =>
          list.filter((emp) => emp.employeeId !== employeeId),
        );
        this.isDeleting = false;
        this.pendingDelete = null;
        this.toast.success({
          title: 'Employee removed',
          description: `${employeeName} has been deleted.`,
        });
        if (this.expandedEmployeeId === employeeId) {
          this.expandedEmployeeId = null;
        }
      },
      error: () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Deletion failed',
          description: 'Unable to delete the employee right now.',
        });
      },
    });
  }

  onSave() {
    if (!this.employeeForm.valid || this.isSaving) {
      return;
    }
    const employee = this.normalizePayload(this.employeeForm.value);
    if (employee.employeeId) {
      this.pendingSave = true;
      return;
    }
    this.runCreate(employee);
  }

  dismissSave() {
    if (this.isSaving) {
      return;
    }
    this.pendingSave = false;
  }

  confirmSave() {
    if (!this.employeeForm.valid || this.isSaving) {
      return;
    }
    const employee = this.normalizePayload(this.employeeForm.value);
    if (!employee.employeeId) {
      this.pendingSave = false;
      this.runCreate(employee);
      return;
    }
    this.isSaving = true;
    this.masterService.updateEmp(employee).subscribe({
      next: () => {
        this.masterService.getAllEmp().subscribe({
          next: (res) => {
            this.employeesSignal.set(res ?? []);
            this.isSaving = false;
            this.pendingSave = false;
            this.editingEmployeeId = null;
            this.employeeForm.reset();
            this.toast.success({
              title: 'Employee updated',
              description: 'Employee details were saved successfully.',
            });
          },
          error: () => {
            this.isSaving = false;
            this.pendingSave = false;
            this.toast.error({
              title: 'Update failed',
              description: 'Saved on server but the list could not refresh.',
            });
          },
        });
      },
      error: () => {
        this.isSaving = false;
        this.toast.error({
          title: 'Update failed',
          description: 'Something went wrong while saving changes.',
        });
      },
    });
  }

  private runCreate(employee: Employee) {
    this.isSaving = true;
    this.masterService.saveEmp(employee).subscribe({
      next: () => {
        this.masterService.getAllEmp().subscribe({
          next: (res) => {
            this.employeesSignal.set(res ?? []);
            this.isSaving = false;
            this.employeeForm.reset();
            this.showCreatePanel = false;
            this.toast.success({
              title: 'Employee created',
              description: 'A new employee record is now available.',
            });
          },
          error: () => {
            this.isSaving = false;
            this.showCreatePanel = false;
            this.toast.error({
              title: 'Creation failed',
              description: 'Created but the list could not refresh.',
            });
          },
        });
      },
      error: () => {
        this.isSaving = false;
        this.toast.error({
          title: 'Creation failed',
          description: 'Unable to save the new employee.',
        });
      },
    });
  }

  updateSearch(term: string) {
    this.listQuery.setSearch(term);
  }

  onMenuFilterChange(change: ListToolbarMenuFilterChange) {
    switch (change.id) {
      case 'dept':
        this.listQuery.setFilter(change.value);
        break;
      case 'role':
        this.listQuery.setExtra('role', change.value);
        break;
      case 'etype':
        this.listQuery.setExtra('etype', change.value);
        break;
      case 'title':
        this.listQuery.setExtra('title', change.value);
        break;
      default:
        break;
    }
  }

  clearListFilters() {
    this.listQuery.clearFilters();
  }

  goToPage(page: number) {
    this.listQuery.setPage(page);
  }

  saveDialogTitle(): string {
    const name = this.employeeForm.value?.employeeName?.trim();
    return name ? `Save Changes To ${name}?` : 'Save Employee Changes?';
  }

  private uniqueOptions(
    employees: readonly Employee[],
    pick: (e: Employee) => string | null | undefined,
    icon: string,
  ): SelectMenuOption[] {
    const seen = new Set<string>();
    const options: SelectMenuOption[] = [];
    for (const employee of employees) {
      const raw = pick(employee)?.trim();
      if (!raw) {
        continue;
      }
      const key = raw.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({ value: raw, label: raw, icon });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  private uniqueCount(
    employees: readonly Employee[],
    pick: (e: Employee) => string | null | undefined,
  ): number {
    const seen = new Set<string>();
    for (const employee of employees) {
      const raw = pick(employee)?.trim();
      if (!raw) {
        continue;
      }
      seen.add(raw.toLowerCase());
    }
    return seen.size;
  }

  private normalizePayload(raw: any): Employee {
    const parseCsv = (value: unknown) => {
      if (typeof value !== 'string') {
        return [];
      }
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    };

    const normalizeDate = (
      dateValue: string | null | undefined,
    ): string | null => {
      if (!dateValue || typeof dateValue !== 'string') return null;
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return null;
        return date.toISOString();
      } catch {
        return null;
      }
    };

    return {
      employeeId: raw.employeeId ?? null,
      employeeName: raw.employeeName ?? '',
      department: raw.department ?? '',
      deptId:
        raw.deptId !== null && raw.deptId !== undefined && raw.deptId !== ''
          ? Number(raw.deptId)
          : null,
      role: raw.role ?? '',
      title: raw.title ?? '',
      employmentType: raw.employmentType ?? '',
      contactNo: raw.contactNo ?? '',
      emailId: raw.emailId ?? '',
      location: raw.location ?? '',
      timezone: raw.timezone ?? '',
      hireDate: normalizeDate(raw.hireDate),
      skills: parseCsv(raw.skills),
      tags: parseCsv(raw.tags),
    } as Employee;
  }
}
