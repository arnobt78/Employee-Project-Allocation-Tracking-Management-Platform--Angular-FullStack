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
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
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

const IN_FLIGHT_STATUSES = new Set([
  'approved',
  'active',
  'in_review',
  'in progress',
  'in_progress',
]);

const PLANNING_STATUSES = new Set(['draft', 'planning', 'proposed']);

const ON_HOLD_STATUSES = new Set(['on_hold', 'on hold', 'paused', 'hold']);

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    RouterLink,
    AlertDialogComponent,
    ListPaginationComponent,
    ListPageShellComponent,
    KpiStatCardComponent,
    FieldLabelComponent,
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

  private readonly initialPeek = this.masterSrv.peekProjects();
  private readonly projectsSignal = signal<IProject[]>(this.initialPeek ?? []);
  readonly projects = this.projectsSignal.asReadonly();
  readonly searchTerm = signal('');
  readonly filterValue = signal('');
  readonly clientFilter = signal('');
  readonly listPage = signal(1);
  readonly isLoading = signal(this.initialPeek === null);
  readonly hasLoaded = signal(this.initialPeek !== null);

  expandedProjectId: number | null = null;

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.filterValue().trim().toLowerCase();
    const client = this.clientFilter().trim().toLowerCase();
    return this.projects().filter((project) => {
      if (status && this.normalizedStatus(project) !== status) {
        return false;
      }
      if (client && (project.clientName ?? '').trim().toLowerCase() !== client) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        project.projectName?.toLowerCase().includes(term) ||
        project.clientName?.toLowerCase().includes(term) ||
        project.contactPerson?.toLowerCase().includes(term) ||
        project.startDate?.toLowerCase().includes(term) ||
        project.status?.toLowerCase().includes(term) ||
        project.approvalStatus?.toLowerCase().includes(term)
      );
    });
  });

  readonly pagedProjects = computed(() =>
    paginateList(this.filteredProjects(), this.listPage())
  );

  readonly menuFilters = computed((): ListToolbarMenuFilter[] => [
    {
      id: 'status',
      label: 'Status',
      emptyIcon: 'circle-dot',
      value: this.filterValue(),
      options: this.uniqueStatusOptions(this.projects()),
    },
    {
      id: 'client',
      label: 'Client',
      emptyIcon: 'building-2',
      value: this.clientFilter(),
      options: this.uniqueOptions(
        this.projects(),
        (p) => p.clientName,
        'building-2'
      ),
    },
  ]);

  readonly kpiTotal = computed(() => this.projects().length);

  readonly kpiInFlight = computed(
    () =>
      this.projects().filter((p) =>
        IN_FLIGHT_STATUSES.has(this.normalizedStatus(p))
      ).length
  );

  readonly kpiPlanning = computed(
    () =>
      this.projects().filter((p) =>
        PLANNING_STATUSES.has(this.normalizedStatus(p))
      ).length
  );

  readonly kpiOnHold = computed(
    () =>
      this.projects().filter((p) =>
        ON_HOLD_STATUSES.has(this.normalizedStatus(p))
      ).length
  );

  readonly kpiArchived = computed(
    () =>
      this.projects().filter(
        (p) => p.archivedAt != null && p.archivedAt !== ''
      ).length
  );

  readonly kpiClients = computed(() =>
    this.uniqueCount(this.projects(), (p) => p.clientName)
  );

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      !!this.filterValue().trim() ||
      !!this.clientFilter().trim()
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
      this.filterValue,
      {
        client: this.clientFilter,
      }
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

  toggleExpand(projectId: number | null | undefined) {
    const target = projectId ?? null;
    this.expandedProjectId =
      this.expandedProjectId === target ? null : target;
  }

  readinessPercent(project: IProject): number {
    const raw =
      project.readinessScore ?? project.readinessChecklist?.percent ?? 0;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  projectSummary(project: IProject): string {
    return (project.overview?.summary ?? '').trim();
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
        if (this.expandedProjectId === projectId) {
          this.expandedProjectId = null;
        }
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

  onMenuFilterChange(change: ListToolbarMenuFilterChange) {
    switch (change.id) {
      case 'status':
        this.listQuery.setFilter(change.value);
        break;
      case 'client':
        this.listQuery.setExtra('client', change.value);
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

  formattedDate(date: string | null | undefined) {
    if (!date) {
      return '—';
    }
    return this.datePipe.transform(date, 'MMM d, y') ?? date;
  }

  dateRangeLabel(project: IProject): string {
    const start = this.formattedDate(project.startDate);
    if (!project.endDate) {
      return start;
    }
    return `${start} – ${this.formattedDate(project.endDate)}`;
  }

  displayStatus(project: IProject): string {
    const raw = (project.status || project.approvalStatus || '').trim();
    if (!raw) {
      return 'Unknown';
    }
    return this.formatStatusLabel(raw);
  }

  displayHealth(project: IProject): string {
    const raw = (project.health ?? '').trim();
    if (!raw) {
      return '—';
    }
    return this.toTitleCase(raw);
  }

  statusIcon(status: string | undefined): string {
    const key = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (key.includes('active') || key === 'approved') return 'zap';
    if (key.includes('review')) return 'git-pull-request';
    if (key.includes('hold') || key.includes('pause')) return 'pause-circle';
    if (key.includes('draft') || key.includes('plan')) return 'pencil';
    if (key.includes('archiv')) return 'archive';
    if (key.includes('complete') || key.includes('done')) return 'check';
    if (key.includes('reject') || key.includes('cancel')) return 'x';
    return 'circle-dot';
  }

  statusBadgeClasses(status: string | undefined): string {
    const key = (status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (key.includes('active') || key === 'approved') {
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    }
    if (key.includes('review')) {
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    }
    if (key.includes('hold') || key.includes('pause')) {
      return 'border-slate-400/30 bg-slate-500/15 text-slate-100';
    }
    if (key.includes('draft') || key.includes('plan')) {
      return 'border-violet-400/30 bg-violet-500/10 text-violet-100';
    }
    if (key.includes('archiv')) {
      return 'border-white/20 bg-white/10 text-white/70';
    }
    if (key.includes('complete') || key.includes('done')) {
      return 'border-sky-400/30 bg-sky-500/10 text-sky-200';
    }
    if (key.includes('reject') || key.includes('cancel')) {
      return 'border-rose-400/30 bg-rose-500/10 text-rose-200';
    }
    return 'border-sky-400/30 bg-sky-500/10 text-sky-200';
  }

  private formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').trim();
  }

  private toTitleCase(value: string): string {
    return this.formatStatusLabel(value)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private normalizedStatus(project: IProject): string {
    return (project.status || project.approvalStatus || '').trim().toLowerCase();
  }

  private uniqueStatusOptions(projects: readonly IProject[]): SelectMenuOption[] {
    const seen = new Set<string>();
    const options: SelectMenuOption[] = [];
    for (const project of projects) {
      const raw = (project.status || project.approvalStatus || '').trim();
      if (!raw) {
        continue;
      }
      const key = raw.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({
        value: raw,
        label: this.toTitleCase(raw),
        icon: this.statusIcon(raw),
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  private uniqueOptions(
    projects: readonly IProject[],
    pick: (p: IProject) => string | null | undefined,
    icon: string
  ): SelectMenuOption[] {
    const seen = new Set<string>();
    const options: SelectMenuOption[] = [];
    for (const project of projects) {
      const raw = pick(project)?.trim();
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
    projects: readonly IProject[],
    pick: (p: IProject) => string | null | undefined
  ): number {
    const seen = new Set<string>();
    for (const project of projects) {
      const raw = pick(project)?.trim();
      if (!raw) {
        continue;
      }
      seen.add(raw.toLowerCase());
    }
    return seen.size;
  }
}
