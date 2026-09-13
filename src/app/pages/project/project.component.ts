import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  signal,
  inject,
} from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IProject } from '../../model/interface/master';
import { MasterService } from '../../service/master.service';
import { ToastService } from '@/app/components/ui/toast.service';
import { UbButtonDirective } from '@/app/components/ui/button';
import { ListSkeletonComponent } from '@/app/components/ui/list-skeleton.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
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
  selector: 'app-project',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    UbButtonDirective,
    RouterLink,
    ListSkeletonComponent,
    AlertDialogComponent,
    ListPaginationComponent,
    ListPageShellComponent,
    KpiStatCardComponent,
    ListToolbarComponent,
  ],
  providers: [DatePipe],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'],
})
export class ProjectComponent implements OnInit {
  private readonly masterSrv = inject(MasterService);
  private readonly datePipe = inject(DatePipe);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private listQuery!: ListQueryController;

  readonly pageMeta = PRIVATE_PAGE_META['/projects'];

  private readonly projectsSignal = signal<IProject[]>([]);
  readonly projects = this.projectsSignal.asReadonly();
  readonly searchTerm = signal('');
  readonly filterValue = signal('');
  readonly listPage = signal(1);
  readonly isLoading = signal(true);
  readonly hasLoaded = signal(false);

  readonly statusFilterOptions = computed<ListToolbarFilterOption[]>(() => {
    const statuses = new Set<string>();
    for (const p of this.projects()) {
      const s = (p.status ?? '').trim();
      if (s) statuses.add(s);
    }
    return [...statuses].sort().map((value) => ({ value, label: value }));
  });

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.filterValue().trim().toLowerCase();
    return this.projects().filter((project) => {
      const matchesStatus =
        !status || (project.status ?? '').trim().toLowerCase() === status;
      if (!matchesStatus) return false;
      if (!term) return true;
      return (
        project.projectName?.toLowerCase().includes(term) ||
        project.clientName?.toLowerCase().includes(term) ||
        project.contactPerson?.toLowerCase().includes(term) ||
        project.startDate?.toLowerCase().includes(term) ||
        project.status?.toLowerCase().includes(term)
      );
    });
  });

  readonly pagedProjects = computed(() =>
    paginateList(this.filteredProjects(), this.listPage())
  );

  readonly kpiTotal = computed(() => this.projects().length);
  readonly kpiFiltered = computed(() => this.filteredProjects().length);
  readonly kpiActiveStatuses = computed(() => {
    const activeLike = ['approved', 'active', 'in_review', 'in progress'];
    return this.projects().filter((p) =>
      activeLike.includes((p.status ?? '').trim().toLowerCase())
    ).length;
  });

  readonly hasActiveFilters = computed(
    () => !!this.searchTerm().trim() || !!this.filterValue().trim()
  );

  pendingDelete: IProject | null = null;
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
      },
    });
  }

  startCreate() {
    void this.router.navigateByUrl('/new-project');
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

  formattedDate(date: string | null | undefined) {
    if (!date) {
      return '—';
    }
    return this.datePipe.transform(date, 'MMM d, y') ?? date;
  }
}
