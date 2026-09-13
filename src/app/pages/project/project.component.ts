import { Component, DestroyRef, OnInit, computed, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators } from '@angular/forms';
import { IProject } from '../../model/interface/master';
import { MasterService } from '../../service/master.service';
import { DatePipe, CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '@/app/components/ui/toast.service';
import { UbButtonDirective } from '@/app/components/ui/button';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent } from '@/app/components/ui/list-skeleton.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { CardCloseButtonComponent } from '@/app/components/ui/card-close-button.component';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ListPaginationComponent } from '@/app/components/ui/list-pagination.component';
import {
  bindListQuery,
  ListQueryController,
  paginateList,
} from '@/app/lib/list-query';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    ReactiveFormsModule,
    UbButtonDirective,
    RouterLink,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
    AlertDialogComponent,
    CardCloseButtonComponent,
    PageHeaderComponent,
    ListPaginationComponent,
  ],
  providers: [DatePipe],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'], // Corrected from styleUrl to styleUrls
})
export class ProjectComponent implements OnInit {
  protected readonly routerLinkDirective = RouterLink;
  private readonly masterSrv = inject(MasterService);
  private readonly datePipe = inject(DatePipe);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listQuery!: ListQueryController;

  private readonly projectsSignal = signal<IProject[]>([]);
  readonly projects = this.projectsSignal.asReadonly();
  readonly searchTerm = signal<string>('');
  readonly listPage = signal(1);
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);
  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.projects();
    }
    return this.projects().filter((project) => {
      return (
        project.projectName?.toLowerCase().includes(term) ||
        project.clientName?.toLowerCase().includes(term) ||
        project.contactPerson?.toLowerCase().includes(term) ||
        project.startDate?.toLowerCase().includes(term)
      );
    });
  });
  readonly pagedProjects = computed(() =>
    paginateList(this.filteredProjects(), this.listPage())
  );

  projectForm: FormGroup = this.fb.group({
    projectId: [null],
    projectName: ['', Validators.required],
    clientName: ['', Validators.required],
    startDate: ['', Validators.required],
    leadByEmpId: [null],
    contactPerson: [''],
    contactNo: [''],
    emailId: ['', Validators.email] });

  expandedProjectId: number | null = null;
  editingProjectId: number | null = null;
  showCreatePanel = false;
  pendingDelete: IProject | null = null;
  pendingSave = false;
  isSaving = false;
  isDeleting = false;

  ngOnInit(): void {
    this.listQuery = bindListQuery(
      this.route,
      this.router,
      this.destroyRef,
      this.searchTerm,
      this.listPage
    );
    this.getProjects();
  }

  getProjects() {
    const snapshot = this.masterSrv.peekProjects();
    const hasLocalData = this.projects().length > 0;
    if (snapshot) {
      this.projectsSignal.set(snapshot);
      this.isLoading.set(false);
      this.hasLoaded.set(true);
    } else if (hasLocalData) {
      this.isLoading.set(false);
      this.hasLoaded.set(true);
    } else {
      this.isLoading.set(true);
    }

    this.masterSrv.getAllProjects().subscribe({
      next: (Res: IProject[]) => {
        this.projectsSignal.set(Res ?? []);
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
      error: () => {
        if (!snapshot && !hasLocalData) {
          this.projectsSignal.set([]);
        }
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      } });
  }

  onEdit(id: number) {
    const project = this.projects().find((p) => p.projectId === id);
    if (!project) {
      return;
    }
    this.showCreatePanel = false;
    this.editingProjectId = id;
    this.expandedProjectId = id;
    this.projectForm.patchValue({
      ...project,
      startDate: project.startDate ? project.startDate.substring(0, 10) : '' });
  }

  onDelete(id: number) {
    const project = this.projects().find((p) => p.projectId === id);
    if (!project) return;
    this.pendingDelete = project;
  }

  confirmDelete() {
    if (!this.pendingDelete?.projectId || this.isDeleting) {
      return;
    }
    const { projectId, projectName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterSrv.deleteProjectById(projectId).subscribe({
      next: () => {
        this.projectsSignal.update((list) =>
          list.filter((project) => project.projectId !== projectId)
        );
        this.isDeleting = false;
        this.pendingDelete = null;
        this.toast.success({
          title: 'Project deleted',
          description: `${projectName} has been removed.`,
        });
        if (this.expandedProjectId === projectId) {
          this.expandedProjectId = null;
        }
      },
      error: () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Delete failed',
          description: 'Something went wrong while removing the project.',
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
    this.expandedProjectId = null;
    this.cancelEdit();
  }

  toggleExpand(projectId: number | null | undefined) {
    const target = projectId ?? null;
    this.expandedProjectId = this.expandedProjectId === target ? null : target;
    if (this.expandedProjectId !== this.editingProjectId) {
      this.cancelEdit();
    }
  }

  startCreate() {
    this.isSaving = false;
    this.showCreatePanel = true;
    this.editingProjectId = null;
    this.expandedProjectId = null;
    const today = new Date().toISOString().substring(0, 10);
    this.projectForm.reset({
      projectId: null,
      projectName: '',
      clientName: '',
      startDate: today,
      leadByEmpId: null,
      contactPerson: '',
      contactNo: '',
      emailId: '' });
  }

  closeCreatePanel() {
    this.isSaving = false;
    this.showCreatePanel = false;
  }

  cancelEdit() {
    this.isSaving = false;
    this.pendingSave = false;
    this.editingProjectId = null;
    this.projectForm.reset({
      projectId: null,
      projectName: '',
      clientName: '',
      startDate: '',
      leadByEmpId: null,
      contactPerson: '',
      contactNo: '',
      emailId: '',
    });
  }

  updateSearch(term: string) {
    this.listQuery.setSearch(term);
  }

  goToPage(page: number) {
    this.listQuery.setPage(page);
  }

  onSave() {
    if (this.projectForm.invalid) {
      this.toast.error({
        title: 'Incomplete details',
        description: 'Please fill all required fields before saving.',
      });
      return;
    }
    if (this.isSaving) {
      return;
    }
    const projectId = this.projectForm.value.projectId;
    if (projectId) {
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
    if (this.projectForm.invalid || this.isSaving) {
      return;
    }
    const project: IProject = {
      ...this.projectForm.value,
      startDate: this.projectForm.value.startDate,
    };
    if (!project.projectId) {
      this.pendingSave = false;
      this.runCreate();
      return;
    }
    this.isSaving = true;
    this.masterSrv.updateProject(project).subscribe({
      next: () => {
        this.masterSrv.getAllProjects().subscribe({
          next: (res) => {
            this.projectsSignal.set(res ?? []);
            this.isSaving = false;
            this.pendingSave = false;
            this.cancelEdit();
            this.toast.success({
              title: 'Project updated',
              description: 'Changes have been saved successfully.',
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
          description: 'Unable to update the project right now.',
        });
      },
    });
  }

  private runCreate() {
    const project: IProject = {
      ...this.projectForm.value,
      startDate: this.projectForm.value.startDate,
    };
    this.isSaving = true;
    this.masterSrv.saveProject(project as any).subscribe({
      next: () => {
        this.masterSrv.getAllProjects().subscribe({
          next: (res) => {
            this.projectsSignal.set(res ?? []);
            this.isSaving = false;
            this.showCreatePanel = false;
            this.cancelEdit();
            this.toast.success({
              title: 'Project created',
              description: 'A new project is now tracked in the system.',
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
          description: 'Unable to create project right now.',
        });
      },
    });
  }

  saveDialogTitle(): string {
    const name = this.projectForm.value?.projectName?.trim();
    return name ? `Save Changes To ${name}?` : 'Save Project Changes?';
  }

  formattedDate(date: string | null | undefined) {
    if (!date) {
      return '—';
    }
    return this.datePipe.transform(date, 'MMM d, y') ?? date;
  }
}
