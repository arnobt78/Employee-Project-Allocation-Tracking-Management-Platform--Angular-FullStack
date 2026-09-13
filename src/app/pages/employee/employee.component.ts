import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
import { UbButtonDirective } from '@/app/components/ui/button';
import { ToastService } from '@/app/components/ui/toast.service';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from '@/app/components/ui/list-skeleton.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { CardCloseButtonComponent } from '@/app/components/ui/card-close-button.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ListPaginationComponent } from '@/app/components/ui/list-pagination.component';
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
    UbButtonDirective,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
    AlertDialogComponent,
    CardCloseButtonComponent,
    UserAvatarComponent,
    PageHeaderComponent,
    ListPaginationComponent,
  ],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css'],
})
export class EmployeeComponent implements OnInit {
  employeeForm: FormGroup;
  private readonly employeesSignal = signal<Employee[]>([]);
  readonly employees = this.employeesSignal.asReadonly();
  readonly filteredEmployees = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.employees();
    }
    return this.employees().filter(
      (employee) =>
        employee.employeeName?.toLowerCase().includes(term) ||
        employee.department?.toLowerCase().includes(term) ||
        employee.employeeId?.toString().includes(term)
    );
  });
  readonly pagedEmployees = computed(() =>
    paginateList(this.filteredEmployees(), this.listPage())
  );

  readonly searchTerm = signal<string>('');
  readonly listPage = signal(1);
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);
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
  private listQuery!: ListQueryController;

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
    private toast: ToastService
  ) {
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
      this.listPage
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
          list.filter((emp) => emp.employeeId !== employeeId)
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

  goToPage(page: number) {
    this.listQuery.setPage(page);
  }

  saveDialogTitle(): string {
    const name = this.employeeForm.value?.employeeName?.trim();
    return name ? `Save Changes To ${name}?` : 'Save Employee Changes?';
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
      dateValue: string | null | undefined
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
