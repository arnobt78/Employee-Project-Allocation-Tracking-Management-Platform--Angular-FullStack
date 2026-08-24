import { Component, OnInit, computed, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MasterService } from '../../service/master.service';
import { Employee } from '../../model/class/Employee';
import { CommonModule } from '@angular/common';
import { UbButtonDirective } from '@/app/components/ui/button';
import { ToastService } from '@/app/components/ui/toast.service';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from '@/app/components/ui/list-skeleton.component';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UbButtonDirective,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
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

  readonly searchTerm = signal<string>('');
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);
  expandedEmployeeId: number | null = null;
  editingEmployeeId: number | null = null;
  showCreatePanel = false;
  pendingDelete: Employee | null = null;
  isSaving = false;
  isDeleting = false;

  constructor(
    private fb: FormBuilder,
    private masterService: MasterService,
    private toast: ToastService
  ) {
    this.employeeForm = this.fb.group({
      employeeId: [null], // Add employeeId to the form
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
    this.getEmployees();
  }

  getEmployees() {
    this.isLoading.set(true);
    this.masterService.getAllEmp().subscribe({
      next: (res: Employee[]) => {
        this.employeesSignal.set(res ?? []);
        if (!this.expandedEmployeeId && res?.length) {
          this.expandedEmployeeId = res[0].employeeId ?? null;
        }
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
      error: () => {
        this.employeesSignal.set([]);
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
    // Format hireDate for date input (YYYY-MM-DD)
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
    this.editingEmployeeId = null;
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

  promptDelete(employee: Employee) {
    this.pendingDelete = employee;
  }

  confirmDelete(confirmed: boolean) {
    if (!confirmed || !this.pendingDelete?.employeeId) {
      this.pendingDelete = null;
      return;
    }
    const { employeeId, employeeName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterService.deleteEmpById(employeeId).subscribe(
      () => {
        this.isDeleting = false;
        this.pendingDelete = null;
        this.employeesSignal.update((list) =>
          list.filter((emp) => emp.employeeId !== employeeId)
        );
        this.toast.success({
          title: 'Employee removed',
          description: `${employeeName} has been deleted.`,
        });
        if (this.expandedEmployeeId === employeeId) {
          this.expandedEmployeeId = null;
        }
      },
      () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Deletion failed',
          description: 'Unable to delete the employee right now.',
        });
      }
    );
  }

  onSave() {
    if (this.employeeForm.valid && !this.isSaving) {
      const employee = this.normalizePayload(this.employeeForm.value);
      this.isSaving = true;
      if (employee.employeeId) {
        // Update existing employee
        this.masterService.updateEmp(employee).subscribe(
          () => {
            this.isSaving = false;
            this.getEmployees();
            this.employeeForm.reset();
            this.toast.success({
              title: 'Employee updated',
              description: 'Employee details were saved successfully.',
            });
            this.editingEmployeeId = null;
          },
          () => {
            this.isSaving = false;
            this.toast.error({
              title: 'Update failed',
              description: 'Something went wrong while saving changes.',
            });
          }
        );
      } else {
        // Create new employee
        this.masterService.saveEmp(employee).subscribe(
          () => {
            this.isSaving = false;
            this.getEmployees();
            this.employeeForm.reset();
            this.toast.success({
              title: 'Employee created',
              description: 'A new employee record is now available.',
            });
            this.showCreatePanel = false;
          },
          () => {
            this.isSaving = false;
            this.toast.error({
              title: 'Creation failed',
              description: 'Unable to save the new employee.',
            });
          }
        );
      }
    }
  }

  updateSearch(term: string) {
    this.searchTerm.set(term);
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

    // Convert date input (YYYY-MM-DD) to ISO string or keep as is
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
