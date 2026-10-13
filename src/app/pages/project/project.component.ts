import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  signal,
  inject,
} from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IProject } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import { MasterService } from '../../service/master.service';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { ActionButtonComponent } from '@/app/components/ui/action-button.component';
import { ListPaginationComponent } from '@/app/components/ui/list-pagination.component';
import { ListPageShellComponent } from '@/app/components/ui/list-page-shell.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import { FieldLabelComponent } from '@/app/components/ui/field-label.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import {
  ListToolbarComponent,
  ListToolbarMenuFilter,
  ListToolbarMenuFilterChange,
} from '@/app/components/ui/list-toolbar.component';
import { SelectMenuOption } from '@/app/components/ui/select-menu.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  ARCHIVE_VIEW_TABS,
  TAB_ACTIVE_CLASS,
  TAB_IDLE_CLASS,
  TAB_ROW_CLASS,
  type ArchiveView,
} from '@/app/constants/tabs';
import {
  bindListQuery,
  ListQueryController,
  paginateList,
} from '@/app/lib/list-query';
import { MutationTracker, PendingSet } from '@/app/lib/mutation-tracker';
import { removeBy, upsertBy } from '@/app/lib/list-ops';
import { contactAvatar, employeeAvatar, type AvatarView } from '@/app/lib/media/employee-avatar';
import {
  deletedProjectDescription,
  deleteProjectWarning,
  inArchiveView,
  isProjectArchived,
  parseArchiveView,
  projectCounts,
  projectCountsLabel,
} from '@/app/lib/status/project-archive';
import { titleCaseLabel } from '@/app/lib/format/labels';
import { BADGE_TONE_CLASS, projectStatusMeta } from '@/app/lib/status/project-status';
import {
  normalizedProjectStatus,
  projectStatusBuckets,
  uniqueCount,
} from '@/app/lib/status/portfolio-stats';
import { PORTFOLIO_KPIS } from '@/app/constants/portfolio-kpis';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    RouterLink,
    AlertDialogComponent,
    ActionButtonComponent,
    ListPaginationComponent,
    ListPageShellComponent,
    KpiStatCardComponent,
    FieldLabelComponent,
    UserAvatarComponent,
    ListToolbarComponent,
  ],
  providers: [DatePipe],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css'],
})
export class ProjectComponent implements OnInit {
  private readonly masterSrv = inject(MasterService);
  private readonly datePipe = inject(DatePipe);
  private readonly mutations = inject(MutationTracker);
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
  private readonly employeesSignal = signal<Employee[]>(this.masterSrv.peekEmployees() ?? []);
  private readonly employeesById = computed(
    () => new Map(this.employeesSignal().map((employee) => [employee.employeeId, employee]))
  );

  readonly viewParam = signal('');
  readonly view = computed<ArchiveView>(() => parseArchiveView(this.viewParam()));
  readonly viewTabs = ARCHIVE_VIEW_TABS;
  readonly tabRowClass = TAB_ROW_CLASS;
  readonly tabActiveClass = TAB_ACTIVE_CLASS;
  readonly tabIdleClass = TAB_IDLE_CLASS;

  readonly counts = computed(() => projectCounts(this.projects()));
  readonly countsLabel = computed(() => projectCountsLabel(this.counts()));
  private readonly activeProjects = computed(() =>
    inArchiveView(this.projects(), 'active', isProjectArchived)
  );
  private readonly viewProjects = computed(() =>
    inArchiveView(this.projects(), this.view(), isProjectArchived)
  );

  expandedProjectId: number | null = null;

  readonly filteredProjects = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.filterValue().trim().toLowerCase();
    const client = this.clientFilter().trim().toLowerCase();
    return this.viewProjects().filter((project) => {
      if (status && normalizedProjectStatus(project) !== status) {
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
      options: this.uniqueStatusOptions(this.viewProjects()),
    },
    {
      id: 'client',
      label: 'Client',
      emptyIcon: 'building-2',
      value: this.clientFilter(),
      options: this.uniqueOptions(
        this.viewProjects(),
        (p) => p.clientName,
        'building-2'
      ),
    },
  ]);

  readonly kpi = PORTFOLIO_KPIS;
  readonly statusBuckets = computed(() => projectStatusBuckets(this.projects()));

  readonly kpiClients = computed(() =>
    uniqueCount(this.activeProjects(), (p) => p.clientName)
  );

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      !!this.filterValue().trim() ||
      !!this.clientFilter().trim()
  );

  pendingDelete: IProject | null = null;
  pendingArchive: IProject | null = null;
  readonly pendingDeletes = new PendingSet<number>();
  /** Loaded when the delete dialog opens; null until the team list arrives. */
  readonly deleteAssignmentCount = signal<number | null>(null);
  readonly pendingArchives = new PendingSet<number>();

  get isDeleting(): boolean {
    const id = this.pendingDelete?.projectId;
    return id != null && this.pendingDeletes.has(id);
  }

  get isArchiving(): boolean {
    const id = this.pendingArchive?.projectId;
    return id != null && this.pendingArchives.has(id);
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
        client: this.clientFilter,
        view: this.viewParam,
      }
    );
    this.getProjects();
    this.masterSrv.warmLists(['assignments']);
    this.masterSrv.getAllEmp().subscribe({
      next: (employees) => this.employeesSignal.set(employees ?? []),
      error: () => undefined,
    });
  }

  setView(view: ArchiveView) {
    this.expandedProjectId = null;
    this.listQuery.setExtra('view', view === 'archived' ? view : '');
  }

  leadAvatar(project: IProject): AvatarView | null {
    if (!project.leadByEmpId) {
      return null;
    }
    const lead = this.employeesById().get(Number(project.leadByEmpId));
    return employeeAvatar(lead, project.employeeName);
  }

  /** The lead's email lives on their employee record, never on the project. */
  leadEmail(project: IProject): string {
    return this.employeesById().get(Number(project.leadByEmpId))?.emailId ?? '';
  }

  readonly contactAvatar = contactAvatar;

  onArchive(project: IProject) {
    this.pendingArchive = project;
  }

  dismissArchive() {
    if (!this.isArchiving) {
      this.pendingArchive = null;
    }
  }

  confirmArchive() {
    const target = this.pendingArchive;
    if (target?.projectId) {
      this.changeArchived(target, true);
    }
  }

  restore(project: IProject) {
    this.changeArchived(project, false);
  }

  private changeArchived(project: IProject, archived: boolean) {
    const { projectId, projectName } = project;
    this.mutations.track(this.masterSrv.setProjectArchived(projectId, archived), {
      pending: this.pendingArchives,
      destroyRef: this.destroyRef,
      key: projectId,
      onSuccess: (saved) => {
        this.projectsSignal.update((list) => upsertBy(list, 'projectId', saved));
        this.pendingArchive = null;
        if (this.expandedProjectId === projectId) {
          this.expandedProjectId = null;
        }
      },
      successToast: archived
        ? {
            title: 'Project archived',
            description: `${projectName} and its team moved to Archived. Restore it any time.`,
          }
        : {
            title: 'Project restored',
            description: `${projectName} and its team are active again.`,
          },
      errorToast: {
        title: archived ? 'Archive failed' : 'Restore failed',
        description: 'Something went wrong. Please try again.',
      },
    });
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
    this.deleteAssignmentCount.set(null);
    this.masterSrv
      .getProjectEmp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (this.pendingDelete?.projectId === id) {
            this.deleteAssignmentCount.set(rows.filter((row) => row.projectId === id).length);
          }
        },
        error: () => undefined,
      });
  }

  confirmDelete() {
    const target = this.pendingDelete;
    if (!target?.projectId) {
      return;
    }
    const { projectId, projectName } = target;
    this.mutations.track(this.masterSrv.deleteProjectById(projectId), {
      pending: this.pendingDeletes,
      destroyRef: this.destroyRef,
      key: projectId,
      onSuccess: () => {
        this.projectsSignal.update((list) => removeBy(list, 'projectId', projectId));
        this.pendingDelete = null;
        if (this.expandedProjectId === projectId) {
          this.expandedProjectId = null;
        }
      },
      successToast: (res) => ({
        title: 'Project deleted',
        description: deletedProjectDescription(projectName, res),
      }),
      errorToast: {
        title: 'Delete failed',
        description: 'Something went wrong while removing the project.',
      },
    });
  }

  deleteWarning(): string {
    return deleteProjectWarning(this.deleteAssignmentCount());
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

  readonly statusMeta = projectStatusMeta;
  readonly badgeTone = BADGE_TONE_CLASS;

  displayHealth(project: IProject): string {
    return titleCaseLabel(project.health) || '—';
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
        label: titleCaseLabel(raw),
        icon: projectStatusMeta(raw).icon,
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
}
