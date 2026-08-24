import { Component, OnInit, computed, signal, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { IProject } from '../../model/interface/master';
import { MasterService } from '../../service/master.service';
import { DatePipe, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '@/app/components/ui/toast.service';
import { UbButtonDirective } from '@/app/components/ui/button';
import {
  ListSkeletonComponent,
  StatPillSkeletonComponent,
} from '@/app/components/ui/list-skeleton.component';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UbButtonDirective,
    RouterLink,
    ListSkeletonComponent,
    StatPillSkeletonComponent,
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

  private readonly projectsSignal = signal<IProject[]>([]);
  readonly projects = this.projectsSignal.asReadonly();
  readonly searchTerm = signal<string>('');
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

  projectForm: FormGroup = this.fb.group({
    projectId: [null],
    projectName: ['', Validators.required],
    clientName: ['', Validators.required],
    startDate: ['', Validators.required],
    leadByEmpId: [null],
    contactPerson: [''],
    contactNo: [''],
    emailId: ['', Validators.email],
  });

  expandedProjectId: number | null = null;
  editingProjectId: number | null = null;
  showCreatePanel = false;
  pendingDelete: IProject | null = null;
  isSaving = false;
  isDeleting = false;

  ngOnInit(): void {
    this.getProjects();
  }

  getProjects() {
    const snapshot = this.masterSrv.peekProjects();
    const hasLocalData = this.projects().length > 0;
    if (snapshot) {
      this.projectsSignal.set(snapshot);
      if (!this.expandedProjectId && snapshot.length) {
        this.expandedProjectId = snapshot[0].projectId ?? null;
      }
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
        if (!this.expandedProjectId && Res?.length) {
          this.expandedProjectId = Res[0].projectId ?? null;
        }
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
      error: () => {
        if (!snapshot && !hasLocalData) {
          this.projectsSignal.set([]);
        }
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
    });
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
      startDate: project.startDate ? project.startDate.substring(0, 10) : '',
    });
  }

  onDelete(id: number) {
    const project = this.projects().find((p) => p.projectId === id);
    if (!project) return;
    this.pendingDelete = project;
  }

  confirmDelete(confirmed: boolean) {
    if (!confirmed || !this.pendingDelete?.projectId) {
      this.pendingDelete = null;
      return;
    }
    const { projectId, projectName } = this.pendingDelete;
    this.isDeleting = true;
    this.masterSrv.deleteProjectById(projectId).subscribe(
      () => {
        this.isDeleting = false;
        this.pendingDelete = null;
        this.projectsSignal.update((list) =>
          list.filter((project) => project.projectId !== projectId)
        );
        this.toast.success({
          title: 'Project deleted',
          description: `${projectName} has been removed.`,
        });
        if (this.expandedProjectId === projectId) {
          this.expandedProjectId = null;
        }
      },
      () => {
        this.isDeleting = false;
        this.toast.error({
          title: 'Delete failed',
          description: 'Something went wrong while removing the project.',
        });
      }
    );
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
      emailId: '',
    });
  }

  closeCreatePanel() {
    this.isSaving = false;
    this.showCreatePanel = false;
  }

  cancelEdit() {
    this.isSaving = false;
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
    this.searchTerm.set(term);
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
    const project: IProject = {
      ...this.projectForm.value,
      startDate: this.projectForm.value.startDate,
    };
    this.isSaving = true;
    if (project.projectId) {
      this.masterSrv.updateProject(project).subscribe(
        () => {
          this.isSaving = false;
          this.getProjects();
          this.toast.success({
            title: 'Project updated',
            description: 'Changes have been saved successfully.',
          });
          this.cancelEdit();
        },
        () => {
          this.isSaving = false;
          this.toast.error({
            title: 'Update failed',
            description: 'Unable to update the project right now.',
          });
        }
      );
    } else {
      this.masterSrv.saveProject(project as any).subscribe(
        () => {
          this.isSaving = false;
          this.getProjects();
          this.toast.success({
            title: 'Project created',
            description: 'A new project is now tracked in the system.',
          });
          this.showCreatePanel = false;
          this.cancelEdit();
        },
        () => {
          this.isSaving = false;
          this.toast.error({
            title: 'Creation failed',
            description: 'Unable to create project right now.',
          });
        }
      );
    }
  }

  formattedDate(date: string | null | undefined) {
    if (!date) {
      return '—';
    }
    return this.datePipe.transform(date, 'MMM d, y') ?? date;
  }
}
