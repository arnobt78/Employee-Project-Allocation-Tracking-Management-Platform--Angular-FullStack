import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MasterService } from '../../service/master.service';
import {
  ApprovalStatus,
  IProject,
  IReadinessChecklistItem,
  IReadinessChecklistState,
  IReviewerCommentEntry,
  IStatusHistoryEntry,
  ITimelineEntry,
  IProjectResourceInsights,
  IProjectResourceAssignment,
  IResourceAssignmentDigest,
  IResourceProfile,
  IProjectOverview,
  IContentfulBrief,
  IAiOverviewDraft,
  IExternalIntegrationReference,
  ReadinessStatus,
  ResourceLoadStatus,
  SectionId } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import { ToastService } from '@/app/components/ui/toast.service';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, startWith } from 'rxjs';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { ActionButtonComponent } from '@/app/components/ui/action-button.component';
import { MutationTracker, PendingSet } from '@/app/lib/mutation-tracker';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { FieldLabelComponent } from '@/app/components/ui/field-label.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { ProjectDetailSkeletonComponent } from '@/app/components/ui/project-detail-skeleton.component';
import { ProjectHeaderMetaComponent } from '@/app/components/ui/project-header-meta.component';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';
import { contactAvatar, employeeAvatar, type AvatarView } from '@/app/lib/media/employee-avatar';
import {
  deletedProjectDescription,
  deleteProjectWarning,
  isProjectArchived,
} from '@/app/lib/status/project-archive';
import { titleCaseLabel } from '@/app/lib/format/labels';
import {
  PROJECT_CONTENT_HELPER_COPY,
  PROJECT_CREATE_SECTION_VALUES,
  PROJECT_DETAIL_FIELD_ICONS,
  PROJECT_DETAIL_CONFIRM_COPY,
  PROJECT_DETAIL_FOOTER_COPY,
  PROJECT_DETAIL_SECTION_ICONS,
  PROJECT_DETAIL_SECTION_LABELS,
  PROJECT_DETAIL_SUBTITLE,
  PROJECT_OVERVIEW_FIELD_LABELS,
  READINESS_CHECKLIST_COPY,
  READINESS_FIELD_LABELS,
  READINESS_TASK_DEFINITIONS,
  type ProjectDetailConfirmCopy,
} from '@/app/constants/project-detail';

const readinessTaskDefinitions = READINESS_TASK_DEFINITIONS;

type ApprovalAction = 'request' | 'approve' | 'reject' | 'reset';

const APPROVAL_PENDING_LABELS: Record<ApprovalAction, string> = {
  request: 'Requesting…',
  approve: 'Approving…',
  reject: 'Rejecting…',
  reset: 'Resetting…',
};

const APPROVAL_CONFIRM_COPY: Record<
  ApprovalAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    icon: string;
    destructive: boolean;
  }
> = {
  request: {
    title: 'Request Approval?',
    description:
      'The project moves to In Review, reviewers are notified by email, and the request is logged in the audit trail.',
    confirmLabel: 'Request Approval',
    icon: 'send',
    destructive: false,
  },
  approve: {
    title: 'Approve This Project?',
    description:
      'The project moves to Approved and the approval is logged in the audit trail.',
    confirmLabel: 'Approve',
    icon: 'circle-check',
    destructive: false,
  },
  reject: {
    title: 'Reject This Project?',
    description:
      'The project moves to Rejected and your comment is recorded as the reason.',
    confirmLabel: 'Reject',
    icon: 'x',
    destructive: true,
  },
  reset: {
    title: 'Reset Approval?',
    description:
      'The approval status returns to Draft. The history stays in the audit trail.',
    confirmLabel: 'Reset To Draft',
    icon: 'rotate-ccw',
    destructive: true,
  },
};

type SaveScope = 'section' | 'all';

type DetailConfirm =
  | { kind: 'restore' }
  | { kind: 'assign'; employeeName: string; allocationPct: number }
  | { kind: 'comment' }
  | { kind: 'resolve'; comment: IReviewerCommentEntry };

const PENDING = {
  save: 'save',
  delete: 'delete',
  archive: 'archive',
  assign: 'assign',
  comment: 'comment',
  approval: (action: ApprovalAction) => `approval:${action}`,
  resolve: (commentId: string) => `resolve:${commentId}`,
} as const;

type ReadinessTaskDefinition = (typeof readinessTaskDefinitions)[number];
type ReadinessTaskId = ReadinessTaskDefinition['id'];
type ReadinessFormGroupShape = {
  status: FormControl<ReadinessStatus>;
  ownerId: FormControl<number | null>;
  dueDate: FormControl<string | null>;
  notes: FormControl<string>;
};
type ReadinessTaskFormGroup = FormGroup<ReadinessFormGroupShape>;
type ReadinessFormValue = Record<
  ReadinessTaskId,
  {
    status: ReadinessStatus;
    ownerId: number | null;
    dueDate: string | null;
    notes: string;
  }
>;

const READINESS_STATUS_LABELS: Record<ReadinessStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Complete' };

const READINESS_STATUS_VALUES: Record<ReadinessStatus, number> = {
  not_started: 0,
  in_progress: 0.5,
  blocked: 0,
  done: 1 };

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected' };

const APPROVAL_STATUS_CLASSES: Record<ApprovalStatus, string> = {
  draft: 'border border-white/20 bg-white/10 text-white/80',
  in_review: 'border border-sky-400/40 bg-sky-500/10 text-sky-200',
  approved: 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  rejected: 'border border-rose-400/40 bg-rose-500/10 text-rose-200' };

const REVIEWER_COMMENT_SECTIONS: Array<{ value: SectionId; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'team', label: 'Leadership' },
  { value: 'contact', label: 'Client Contact' },
  { value: 'approval', label: 'Approval Workflow' }];

const REVIEWER_SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' }];

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    ReactiveFormsModule,
    SelectMenuComponent,
    AlertDialogComponent,
    ActionButtonComponent,
    FieldLabelComponent,
    PageHeaderComponent,
    ProjectDetailSkeletonComponent,
    ProjectHeaderMetaComponent,
    UserAvatarComponent,
  ],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.css' })
export class ProjectFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly masterService = inject(MasterService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly mutations = inject(MutationTracker);
  private readonly destroyRef = inject(DestroyRef);

  private readonly employeesSignal = signal<Employee[]>([]);
  readonly employees = this.employeesSignal.asReadonly();

  readonly employeeSelectOptions = computed<SelectMenuOption[]>(() =>
    this.employees().map((employee) => ({
      value: String(employee.employeeId),
      label: employee.employeeName,
      imageSeed: employeeAvatar(employee).seed,
      imageUrl: employee.avatarUrl ?? null,
    }))
  );

  readonly readinessStatusOptions: SelectMenuOption[] = Object.entries(
    READINESS_STATUS_LABELS
  ).map(([value, label]) => ({
    value,
    label,
    icon:
      value === 'done'
        ? 'circle-check'
        : value === 'in_progress'
          ? 'loader'
          : value === 'blocked'
            ? 'octagon-alert'
            : 'circle-dashed',
  }));

  readonly healthSelectOptions: SelectMenuOption[] = [
    { value: 'on_track', label: 'On Track', icon: 'activity' },
    { value: 'at_risk', label: 'At Risk', icon: 'siren' },
    { value: 'off_track', label: 'Off Track', icon: 'x' },
  ];

  readonly reviewerSectionOptions: SelectMenuOption[] =
    REVIEWER_COMMENT_SECTIONS.map((section) => ({
      value: section.value,
      label: section.label,
      icon:
        section.value === 'overview'
          ? 'file-text'
          : section.value === 'team'
            ? 'users'
            : section.value === 'contact'
              ? 'contact'
              : 'git-pull-request',
    }));

  readonly reviewerSeveritySelectOptions: SelectMenuOption[] =
    REVIEWER_SEVERITIES.map((severity) => ({
      value: severity.value,
      label: severity.label,
      icon:
        severity.value === 'critical'
          ? 'siren'
          : severity.value === 'warning'
            ? 'triangle-alert'
            : 'info',
    }));

  private readonly currentProjectSignal = signal<IProject | null>(null);
  readonly currentProject = this.currentProjectSignal.asReadonly();

  private resourceInsightsRequestToken = 0;
  private projectRequestToken = 0;
  /** Project id in the current route; 0 while creating. */
  private routedProjectId = 0;
  private readonly resourceInsightsSignal =
    signal<IProjectResourceInsights | null>(null);
  readonly resourceInsights = this.resourceInsightsSignal.asReadonly();

  private readonly modeSignal = signal<'create' | 'edit'>('create');
  readonly mode = this.modeSignal.asReadonly();
  /** True while GetProject hydrates an edit route (avoids Untitled/0% flash). */
  private readonly isLoadingSignal = signal(false);
  readonly isLoading = this.isLoadingSignal.asReadonly();

  readonly readinessTasks = readinessTaskDefinitions;
  readonly subtitle = PROJECT_DETAIL_SUBTITLE;
  readonly sectionLabels = PROJECT_DETAIL_SECTION_LABELS;
  readonly sectionIcons = PROJECT_DETAIL_SECTION_ICONS;
  readonly fieldIcons = PROJECT_DETAIL_FIELD_ICONS;
  readonly fieldLabels = READINESS_FIELD_LABELS;
  readonly checklistCopy = READINESS_CHECKLIST_COPY;
  readonly footerCopy = PROJECT_DETAIL_FOOTER_COPY;
  readonly overviewLabels = PROJECT_OVERVIEW_FIELD_LABELS;
  readonly contentHelperCopy = PROJECT_CONTENT_HELPER_COPY;
  readonly readinessTotal = this.readinessTasks.length;
  readonly readinessForm = this.fb.group(
    this.buildReadinessControls()
  ) as unknown as FormGroup<Record<ReadinessTaskId, ReadinessTaskFormGroup>>;
  private readonly readinessFormValue = signal<ReadinessFormValue>(
    this.readinessForm.getRawValue() as ReadinessFormValue
  );
  private readonly readinessBaseline = signal<IReadinessChecklistState | null>(
    null
  );
  readonly readinessView = computed(() =>
    this.buildReadinessView(this.readinessFormValue())
  );
  readonly readinessProgress = computed(() => this.readinessView().percent);
  readonly readinessCompleted = computed(
    () => this.readinessView().completedItems
  );
  readonly readinessRemaining = computed(
    () => this.readinessView().remainingItems
  );

  readonly approvalForm = this.fb.group({
    actorId: this.fb.control<number | null>(null),
    actorName: this.fb.control<string>('', { nonNullable: true }),
    comment: this.fb.control<string>('', { nonNullable: true }) });

  readonly reviewerCommentForm = this.fb.group({
    section: ['overview', Validators.required],
    reviewerId: [null],
    reviewerName: [''],
    comment: ['', [Validators.required, Validators.minLength(3)]],
    severity: ['info'] });

  readonly overviewDetailsForm = this.fb.group({
    summary: [''],
    objectives: [''],
    successCriteria: [''],
    stakeholderNotes: [''] });

  private readonly overviewMetadataSignal =
    signal<Partial<IProjectOverview> | null>(null);

  readonly contentfulForm = this.fb.group({
    entryId: [''],
    contentType: [''],
    slug: [''],
    preview: [false] });
  readonly contentfulPanelOpen = signal<boolean>(false);
  readonly contentfulLoading = signal<boolean>(false);
  readonly contentfulError = signal<string | null>(null);
  readonly contentfulBrief = signal<IContentfulBrief | null>(null);

  readonly aiPanelOpen = signal<boolean>(false);
  readonly aiProcessing = signal<boolean>(false);
  readonly aiError = signal<string | null>(null);
  readonly aiDraft = signal<IAiOverviewDraft | null>(null);

  private readonly cmsReferencesSignal =
    signal<IExternalIntegrationReference[]>([]);
  readonly cmsReferences = this.cmsReferencesSignal.asReadonly();

  readonly approvalStatus = computed<ApprovalStatus>(() =>
    this.normalizeApprovalStatus(this.currentProjectSignal()?.approvalStatus)
  );
  readonly approvalHistory = computed<IStatusHistoryEntry[]>(() => {
    const history = this.currentProjectSignal()?.statusHistory ?? [];
    return [...history].sort((a, b) =>
      (b.changedAt ?? '').localeCompare(a.changedAt ?? '')
    );
  });
  readonly approvalTimeline = computed<ITimelineEntry[]>(() => {
    const events = this.currentProjectSignal()?.timeline ?? [];
    return [...events].sort((a, b) =>
      (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '')
    );
  });
  readonly reviewerComments = computed<IReviewerCommentEntry[]>(() => {
    const comments = this.currentProjectSignal()?.reviewerComments ?? [];
    return [...comments].sort((a, b) => {
      if (a.resolved === b.resolved) {
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      }
      return a.resolved ? 1 : -1;
    });
  });
  readonly canRequestApproval = computed(
    () =>
      this.approvalStatus() === 'draft' || this.approvalStatus() === 'rejected'
  );
  readonly canApprove = computed(() => this.approvalStatus() === 'in_review');
  readonly canReject = this.canApprove;
  readonly canResetApproval = computed(() =>
    ['approved', 'rejected'].includes(this.approvalStatus())
  );
  readonly pending = new PendingSet<string>();
  readonly approvalPendingLabels = APPROVAL_PENDING_LABELS;
  readonly approvalProcessing = computed(() =>
    this.pending.some((key) => key.startsWith('approval:'))
  );
  readonly reviewerCommentProcessing = computed(() =>
    this.pending.some((key) => key === PENDING.comment || key.startsWith('resolve:'))
  );
  readonly isAddingComment = computed(() => this.pending.has(PENDING.comment));

  isApprovalPending(action: ApprovalAction): boolean {
    return this.pending.has(PENDING.approval(action));
  }

  isResolvePending(commentId: string): boolean {
    return this.pending.has(PENDING.resolve(commentId));
  }

  private readonly collaboratorAssignmentProfileSignal =
    signal<IResourceProfile | null>(null);
  readonly collaboratorAssignmentProfile =
    this.collaboratorAssignmentProfileSignal.asReadonly();
  readonly collaboratorAssignmentProcessing = computed(() =>
    this.pending.has(PENDING.assign)
  );
  readonly collaboratorAssignmentForm = this.fb.group({
    role: this.fb.control<string>('', { nonNullable: true }),
    allocationPct: this.fb.control<number | null>(25, [
      Validators.required,
      Validators.min(1),
      Validators.max(200)]),
    assignedDate: this.fb.control<string>(this.todayString(), {
      nonNullable: true }) });

  readonly projectForm: FormGroup = this.fb.group({
    projectId: [0],
    projectName: ['', [Validators.required, Validators.minLength(3)]],
    clientName: ['', [Validators.required, Validators.minLength(3)]],
    startDate: ['', Validators.required],
    health: [''],
    leadByEmpId: [null],
    contactPerson: [''],
    contactNo: ['', [Validators.pattern(/^[\d\s+\-()]{7,20}$/)]],
    emailId: ['', Validators.email] });
  private readonly projectNameValue = toSignal(
    this.projectForm.controls['projectName'].valueChanges.pipe(
      startWith(this.projectForm.controls['projectName'].value ?? '')
    ),
    { initialValue: this.projectForm.controls['projectName'].value ?? '' }
  );

  private readonly formChangeSignal = toSignal(
    this.projectForm.valueChanges.pipe(
      startWith(this.projectForm.getRawValue())
    ),
    { initialValue: this.projectForm.getRawValue() }
  );

  readonly expandedSection = signal<SectionId | null>('overview');
  readonly editingSection = signal<SectionId | null>('overview');
  readonly isSaving = computed(() => this.pending.has(PENDING.save));
  readonly isDeleting = computed(() => this.pending.has(PENDING.delete));
  readonly pendingDelete = signal<boolean>(false);
  readonly isArchiving = computed(() => this.pending.has(PENDING.archive));
  readonly pendingArchive = signal<boolean>(false);
  readonly isArchived = computed(() => isProjectArchived(this.currentProjectSignal()));
  /** Loaded when the delete dialog opens; null until the team list arrives. */
  private readonly deleteAssignmentCount = signal<number | null>(null);
  readonly deleteWarning = computed(() => deleteProjectWarning(this.deleteAssignmentCount()));
  readonly pendingSave = signal<SaveScope | null>(null);
  readonly pendingApproval = signal<ApprovalAction | null>(null);
  readonly approvalConfirmCopy = computed(() => {
    const action = this.pendingApproval();
    return action ? APPROVAL_CONFIRM_COPY[action] : null;
  });
  readonly approvalBusyLabel = computed(() => {
    const action = this.pendingApproval();
    return action ? APPROVAL_PENDING_LABELS[action] : 'Working…';
  });
  readonly isApprovalConfirmBusy = computed(() => {
    const action = this.pendingApproval();
    return action ? this.pending.has(PENDING.approval(action)) : false;
  });
  readonly pendingConfirm = signal<DetailConfirm | null>(null);
  readonly detailConfirmCopy = computed<ProjectDetailConfirmCopy | null>(() => {
    const confirm = this.pendingConfirm();
    if (!confirm) {
      return null;
    }
    const projectName = this.currentProjectSignal()?.projectName || this.projectTitle();
    switch (confirm.kind) {
      case 'restore':
        return PROJECT_DETAIL_CONFIRM_COPY.restore(projectName);
      case 'assign':
        return PROJECT_DETAIL_CONFIRM_COPY.assign(
          confirm.employeeName,
          projectName,
          confirm.allocationPct
        );
      case 'comment':
        return PROJECT_DETAIL_CONFIRM_COPY.comment(projectName);
      case 'resolve':
        return PROJECT_DETAIL_CONFIRM_COPY.resolve(Boolean(confirm.comment.resolved));
    }
  });
  readonly isDetailConfirmBusy = computed(() => {
    const confirm = this.pendingConfirm();
    return confirm ? this.pending.has(this.detailConfirmKey(confirm)) : false;
  });

  readonly progress = computed(() => {
    this.formChangeSignal();
    const readinessContribution = (this.readinessProgress() / 100) * 50;
    let score = readinessContribution;

    if (this.isOverviewComplete()) {
      score += 30;
    }
    if (this.isLeadershipComplete()) {
      score += 10;
    }
    if (this.isContactComplete()) {
      score += 10;
    }

    return Math.round(Math.min(score, 100));
  });

  readonly projectTitle = computed(() => {
    const name = (this.projectNameValue() ?? '').toString().trim();
    if (name.length > 0) {
      return name;
    }
    const fallback = this.currentProjectSignal()?.projectName?.toString().trim();
    return fallback && fallback.length > 0 ? fallback : 'Untitled Project';
  });

  readonly isEditMode = computed(() => this.modeSignal() === 'edit');

  ngOnInit(): void {
    this.loadEmployees();
    this.readinessForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.readinessFormValue.set(
          this.readinessForm.getRawValue() as ReadinessFormValue
        );
      });
    this.overviewDetailsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.overviewDetailsForm.pristine) {
          this.overviewMetadataSignal.set({
            aiDraftSource: 'manual' });
        }
      });
    this.activatedRoute.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const idParam = params['id'];
        const parsedId =
          idParam !== undefined && idParam !== null ? Number(idParam) : 0;
        const id = Number.isFinite(parsedId) ? parsedId : 0;
        this.routedProjectId = id;
        this.closeTransientUi();

        if (id > 0) {
          this.modeSignal.set('edit');
          this.editingSection.set(null);
          this.fetchProject(id);
        } else {
          this.projectRequestToken++;
          this.modeSignal.set('create');
          this.isLoadingSignal.set(false);
          this.editingSection.set('overview');
          this.projectForm.patchValue({
            startDate: this.todayString(),
          });
          this.resetReadinessForm();
          this.resetApprovalForms();
          this.resourceInsightsSignal.set(null);
          this.applyOverviewToForms(null);
          this.contentfulBrief.set(null);
          this.contentfulError.set(null);
          this.contentfulPanelOpen.set(false);
          this.aiDraft.set(null);
          this.aiError.set(null);
          this.aiPanelOpen.set(false);
          this.overviewMetadataSignal.set(null);
          this.cmsReferencesSignal.set([]);
        }
      });
  }

  toggleSection(section: SectionId) {
    this.expandedSection.update((current) =>
      current === section ? null : section
    );
    if (
      section !== 'approval' &&
      this.expandedSection() === section &&
      !this.isEditMode()
    ) {
      this.editingSection.set(section);
    }
  }

  startEdit(section: SectionId) {
    if (section === 'approval') {
      return;
    }
    this.expandedSection.set(section);
    this.editingSection.set(section);
  }

  cancelEdit() {
    const current = this.currentProjectSignal();
    if (current) {
      this.projectForm.patchValue({
        projectId: current.projectId,
        projectName: current.projectName,
        clientName: current.clientName,
        startDate: current.startDate?.substring(0, 10),
        health: current.health ?? '',
        leadByEmpId: current.leadByEmpId ?? null,
        contactPerson: current.contactPerson ?? '',
        contactNo: current.contactNo ?? '',
        emailId: current.emailId ?? '' });
      this.applyOverviewToForms(current.overview ?? null);
    } else {
      this.projectForm.reset({
        projectId: 0,
        startDate: this.todayString() });
      this.applyOverviewToForms(null);
    }
    this.contentfulPanelOpen.set(false);
    this.contentfulBrief.set(null);
    this.contentfulError.set(null);
    this.aiPanelOpen.set(false);
    this.aiDraft.set(null);
    this.aiError.set(null);
    this.projectForm.markAsPristine();
    this.editingSection.set(null);
  }

  saveSection() {
    this.requestSave('section');
  }

  saveAllChanges() {
    this.requestSave('all');
  }

  /** Existing projects confirm before overwriting; new projects save straight away. */
  private requestSave(scope: SaveScope) {
    if (!this.ensureFormValid() || this.isSaving()) {
      return;
    }
    if (this.isEditMode()) {
      this.pendingSave.set(scope);
      return;
    }
    this.runSave(scope);
  }

  confirmSave() {
    const scope = this.pendingSave();
    if (!scope || this.isSaving()) {
      return;
    }
    if (!this.ensureFormValid()) {
      this.pendingSave.set(null);
      return;
    }
    this.runSave(scope);
  }

  dismissSave() {
    if (this.isSaving()) {
      return;
    }
    this.pendingSave.set(null);
  }

  saveDialogTitle(): string {
    const name = this.projectForm.controls['projectName'].value?.trim();
    return name ? `Save Changes To ${name}?` : 'Save Project Changes?';
  }

  private runSave(scope: SaveScope) {
    const wasEdit = this.isEditMode();
    this.submitProject((applied) => {
      this.toast.success({
        title: wasEdit
          ? scope === 'all'
            ? 'Project updated'
            : 'Project saved'
          : 'Project created',
        description: wasEdit
          ? scope === 'all'
            ? 'All changes have been saved.'
            : 'Updates applied to the project.'
          : 'A new project has been created.',
      });
      if (!applied) {
        return;
      }
      this.pendingSave.set(null);
      this.editingSection.set(null);
      if (!wasEdit) {
        this.modeSignal.set('edit');
      }
    });
  }

  private ensureFormValid(): boolean {
    if (this.projectForm.valid) {
      return true;
    }
    this.projectForm.markAllAsTouched();
    this.toast.error({
      title: 'Incomplete details',
      description: 'Please resolve validation warnings before continuing.',
    });
    return false;
  }

  submitProject(onSuccess?: (applied: boolean) => void) {
    if (!this.ensureFormValid()) {
      return;
    }
    const readinessChecklist = this.buildReadinessPayload();
    const payload: IProject = {
      ...(this.currentProjectSignal() ?? {}),
      ...this.projectForm.getRawValue(),
      readinessChecklist,
      readinessScore: readinessChecklist.percent,
      overview: this.buildOverviewPayload(),
      cmsContentRefs: this.cmsReferencesSignal() };
    const isCreate = !payload.projectId;
    const request$ = isCreate
      ? this.masterService.saveProject(payload)
      : this.masterService.updateProject(payload);

    this.mutations.track(request$, {
      pending: this.pending,
      destroyRef: this.destroyRef,
      key: PENDING.save,
      onSuccess: (res) => {
        const applied = this.applyMutationResult(res, {
          loadInsights: !isCreate,
        });
        if (applied && res.projectId && res.projectId > 0) {
          this.router.navigate(['/update-project', res.projectId], {
            replaceUrl: true });
        }
        onSuccess?.(applied);
      },
      errorToast: {
        title: 'Save failed',
        description: 'Unable to persist changes right now. Try again later.' },
    });
  }

  requestDelete() {
    const projectId = this.currentProjectSignal()?.projectId;
    if (!this.isEditMode() || !projectId) {
      return;
    }
    this.pendingDelete.set(true);
    this.deleteAssignmentCount.set(null);
    this.masterService
      .getProjectEmp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (this.currentProjectSignal()?.projectId === projectId) {
            this.deleteAssignmentCount.set(rows.filter((row) => row.projectId === projectId).length);
          }
        },
        error: () => undefined,
      });
  }

  confirmDelete() {
    const projectId = this.projectForm.controls['projectId'].value;
    if (!projectId) {
      return;
    }
    const projectName = this.currentProjectSignal()?.projectName || this.projectTitle();
    this.mutations.track(this.masterService.deleteProjectById(projectId), {
      pending: this.pending,
      destroyRef: this.destroyRef,
      key: PENDING.delete,
      onSuccess: () => {
        if (projectId !== this.routedProjectId) {
          return;
        }
        this.pendingDelete.set(false);
        this.resetReadinessForm();
        this.resourceInsightsSignal.set(null);
        this.router.navigate(['/projects']);
      },
      successToast: (res) => ({
        title: 'Project deleted',
        description: deletedProjectDescription(projectName, res),
      }),
      errorToast: {
        title: 'Delete failed',
        description: 'Unable to delete the project right now.',
      },
    });
  }

  requestArchive() {
    if (!this.isEditMode() || this.isArchived()) {
      return;
    }
    this.pendingArchive.set(true);
  }

  dismissArchive() {
    if (this.isArchiving()) {
      return;
    }
    this.pendingArchive.set(false);
  }

  confirmArchive() {
    this.changeArchived(true);
  }

  requestRestore() {
    if (!this.isArchived() || this.isArchiving()) {
      return;
    }
    this.pendingConfirm.set({ kind: 'restore' });
  }

  /** Re-checks each action before it runs; a stale confirmation just closes. */
  confirmDetailAction() {
    const confirm = this.pendingConfirm();
    if (!confirm || this.isDetailConfirmBusy()) {
      return;
    }
    switch (confirm.kind) {
      case 'restore':
        if (!this.isArchived()) {
          this.pendingConfirm.set(null);
          return;
        }
        this.changeArchived(false);
        return;
      case 'assign':
        this.runCollaboratorAssignment();
        return;
      case 'comment':
        this.runReviewerComment();
        return;
      case 'resolve':
        this.runResolveComment(confirm.comment);
        return;
    }
  }

  dismissDetailConfirm() {
    if (this.isDetailConfirmBusy()) {
      return;
    }
    this.pendingConfirm.set(null);
  }

  private detailConfirmKey(confirm: DetailConfirm): string {
    switch (confirm.kind) {
      case 'restore':
        return PENDING.archive;
      case 'assign':
        return PENDING.assign;
      case 'comment':
        return PENDING.comment;
      case 'resolve':
        return PENDING.resolve(confirm.comment.id);
    }
  }

  private changeArchived(archived: boolean) {
    const projectId = this.projectForm.controls['projectId'].value;
    if (!projectId) {
      return;
    }
    const projectName = this.currentProjectSignal()?.projectName || this.projectTitle();
    this.mutations.track(this.masterService.setProjectArchived(projectId, archived), {
      pending: this.pending,
      destroyRef: this.destroyRef,
      key: PENDING.archive,
      onSuccess: (project) => {
        if (projectId !== this.routedProjectId) {
          return;
        }
        this.pendingArchive.set(false);
        this.pendingConfirm.set(null);
        this.currentProjectSignal.set(this.cloneProject(project));
      },
      successToast: archived
        ? {
            title: 'Project archived',
            description: `${projectName} moved to the Archived tab. Restore it any time.`,
          }
        : {
            title: 'Project restored',
            description: `${projectName} is active again.`,
          },
      errorToast: {
        title: archived ? 'Archive failed' : 'Restore failed',
        description: archived
          ? 'Unable to archive the project right now.'
          : 'Unable to restore the project right now.',
      },
    });
  }

  dismissDelete() {
    if (this.isDeleting()) {
      return;
    }
    this.pendingDelete.set(false);
  }

  leadName(leadByEmpId: number | null | undefined) {
    if (!leadByEmpId) return null;
    return this.employees().find((emp) => emp.employeeId === leadByEmpId)
      ?.employeeName;
  }

  displayValue(field: FieldKey) {
    const control = this.projectForm.controls[field];
    const value = control.value;
    switch (field) {
      case 'startDate':
        if (!value) {
          return 'Not scheduled';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return value;
        }
        return new Intl.DateTimeFormat('de-DE').format(date);
      case 'leadByEmpId':
        return value
          ? this.leadName(value) ?? `Employee #${value}`
          : PROJECT_CREATE_SECTION_VALUES.team;
      case 'health': {
        return titleCaseLabel(value?.toString()) || 'Not Set';
      }
      case 'contactNo':
        return value || 'Not provided';
      case 'emailId':
        return value || 'Not provided';
      case 'contactPerson':
        return value || PROJECT_CREATE_SECTION_VALUES.contact;
      default:
        return value || PROJECT_CREATE_SECTION_VALUES.overview;
    }
  }

  allocationStatusClass(status?: ResourceLoadStatus) {
    switch (status) {
      case 'available':
        return 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
      case 'limited':
        return 'border border-amber-400/40 bg-amber-500/10 text-amber-200';
      case 'overbooked':
        return 'border border-rose-400/40 bg-rose-500/10 text-rose-200';
      default:
        return 'border border-white/15 bg-white/10 text-white/70';
    }
  }

  allocationStatusLabel(status?: ResourceLoadStatus) {
    switch (status) {
      case 'available':
        return 'Available';
      case 'limited':
        return 'Limited';
      case 'overbooked':
        return 'Overbooked';
      default:
        return 'Unknown';
    }
  }

  formatPercent(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    const rounded = Math.round(value * 10) / 10;
    const formatted =
      Math.abs(rounded - Math.round(rounded)) < 0.0001
        ? Math.round(rounded).toString()
        : rounded.toFixed(1);
    return `${formatted}%`;
  }

  formatScore(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '—';
    }
    return value.toFixed(1);
  }

  availabilitySummary(profile: IResourceProfile | null | undefined) {
    if (!profile) {
      return 'Availability unknown';
    }
    const available = this.formatPercent(profile.allocation.availablePct);
    const active = profile.allocation.activeAssignments;
    return `${available} capacity • ${active} active ${
      active === 1 ? 'project' : 'projects'
    }`;
  }

  applyRecommendedLead(candidate: IResourceProfile | null | undefined) {
    if (!candidate?.employeeId) {
      return;
    }
    this.startEdit('team');
    queueMicrotask(() => {
      this.projectForm.controls['leadByEmpId'].setValue(candidate.employeeId);
      this.toast.success({
        title: 'Lead selected',
        description: `${candidate.employeeName} is selected as the project lead. Save to confirm.`,
      });
    });
  }

  trackAssignmentById(_: number, assignment: IProjectResourceAssignment) {
    return assignment.empProjectId;
  }

  trackResourceByEmployee(_: number, resource: IResourceProfile) {
    return resource.employeeId;
  }

  trackDigest(_: number, digest: IResourceAssignmentDigest) {
    return `${digest.projectId}-${digest.role ?? 'any'}`;
  }

  startCollaboratorAssignment(profile: IResourceProfile) {
    const current = this.collaboratorAssignmentProfileSignal();
    if (current?.employeeId === profile.employeeId) {
      this.cancelCollaboratorAssignment();
      return;
    }
    this.collaboratorAssignmentProfileSignal.set(profile);
    const suggestedAllocation =
      profile.allocation && profile.allocation.availablePct !== undefined
        ? Math.max(
            5,
            Math.min(
              Math.round(profile.allocation.availablePct),
              200
            )
          )
        : 25;
    this.collaboratorAssignmentForm.reset(
      {
        role: profile.role?.length
          ? profile.role
          : profile.title?.length
          ? profile.title
          : 'Contributor',
        allocationPct: suggestedAllocation,
        assignedDate: this.todayString() },
      { emitEvent: false }
    );
    this.collaboratorAssignmentForm.markAsPristine();
  }

  /** The component is reused across `/update-project/:id`, so dialogs must not carry over to another project. */
  private closeTransientUi() {
    this.pendingSave.set(null);
    this.pendingApproval.set(null);
    this.pendingDelete.set(false);
    this.pendingArchive.set(false);
    this.pendingConfirm.set(null);
    this.cancelCollaboratorAssignment();
  }

  cancelCollaboratorAssignment() {
    this.collaboratorAssignmentProfileSignal.set(null);
    this.collaboratorAssignmentForm.reset(
      {
        role: '',
        allocationPct: 25,
        assignedDate: this.todayString() },
      { emitEvent: false }
    );
  }

  submitCollaboratorAssignment() {
    const payload = this.collaboratorAssignmentPayload(true);
    const profile = this.collaboratorAssignmentProfileSignal();
    if (!payload || !profile || this.collaboratorAssignmentProcessing()) {
      return;
    }
    this.pendingConfirm.set({
      kind: 'assign',
      employeeName: profile.employeeName,
      allocationPct: payload.allocationPct,
    });
  }

  private collaboratorAssignmentPayload(reportInvalid: boolean) {
    const profile = this.collaboratorAssignmentProfileSignal();
    const project = this.currentProjectSignal();
    if (!profile || !project?.projectId || this.isArchived()) {
      return null;
    }

    if (this.collaboratorAssignmentForm.invalid) {
      if (reportInvalid) {
        this.collaboratorAssignmentForm.markAllAsTouched();
        this.toast.error({
          title: 'Missing details',
          description: 'Provide role, allocation, and a start date.' });
      }
      return null;
    }

    const value = this.collaboratorAssignmentForm.getRawValue();
    return {
      projectId: project.projectId,
      empId: profile.employeeId,
      role: (value.role ?? '').trim() || profile.role || 'Contributor',
      allocationPct:
        value.allocationPct !== null && value.allocationPct !== undefined
          ? Number(value.allocationPct)
          : 0,
      assignedDate: value.assignedDate,
      isActive: 'Y' };
  }

  private runCollaboratorAssignment() {
    const payload = this.collaboratorAssignmentPayload(false);
    const profile = this.collaboratorAssignmentProfileSignal();
    if (!payload || !profile) {
      this.pendingConfirm.set(null);
      return;
    }
    const { projectId } = payload;

    this.mutations.track(this.masterService.saveProjectEmp(payload), {
      pending: this.pending,
      destroyRef: this.destroyRef,
      key: PENDING.assign,
      onSuccess: () => {
        if (projectId !== this.routedProjectId) {
          return;
        }
        this.pendingConfirm.set(null);
        this.cancelCollaboratorAssignment();
        this.refreshProjectSnapshot(projectId);
        this.loadResourceInsights(projectId);
      },
      onError: (error) => {
        console.error('[Resource] collaborator assignment failed', {
          projectId,
          empId: profile.employeeId,
          error });
      },
      successToast: {
        title: 'Contributor added',
        description: `${profile.employeeName} has been assigned to the project.` },
      errorToast: {
        title: 'Assignment failed',
        description:
          'Unable to create the assignment right now. Please try again.' },
    });
  }

  toggleContentfulPanel() {
    this.contentfulPanelOpen.update((open) => !open);
  }

  clearContentfulBrief() {
    this.contentfulBrief.set(null);
    this.contentfulError.set(null);
  }

  loadContentfulBrief() {
    if (this.contentfulForm.invalid) {
      this.contentfulForm.markAllAsTouched();
      this.toast.error({
        title: 'Missing identifier',
        description: 'Provide an entry ID or content type to fetch from Contentful.' });
      return;
    }
    const value = this.contentfulForm.getRawValue();
    if (
      (!value.entryId || !value.entryId.trim().length) &&
      (!value.contentType || !value.contentType.trim().length)
    ) {
      this.toast.error({
        title: 'Identifier required',
        description: 'Provide an entry ID or content type before fetching.' });
      return;
    }
    this.contentfulLoading.set(true);
    this.masterService
      .fetchContentfulBrief({
        entryId: value.entryId?.trim() || undefined,
        contentType: value.contentType?.trim() || undefined,
        slug: value.slug?.trim() || undefined,
        preview: value.preview ?? false,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brief) => {
          this.contentfulLoading.set(false);
          this.contentfulBrief.set(brief);
          this.contentfulError.set(null);
          this.contentfulPanelOpen.set(true);
          this.toast.success({
            title: 'Brief loaded',
            description: 'Review the Contentful entry below.' });
        },
        error: (error) => {
          this.contentfulLoading.set(false);
          const message =
            error?.error?.message ??
            error?.message ??
            'Unable to fetch Contentful entry.';
          this.contentfulError.set(message);
          this.toast.error({
            title: 'Contentful error',
            description: message });
          console.error('[Contentful] fetch failed', error);
        } });
  }

  applyContentfulOverview(brief: IContentfulBrief | null | undefined) {
    if (!brief) {
      return;
    }
    const overview = brief.overview ?? {
      summary: '',
      objectives: [],
      successCriteria: [] };
    this.overviewDetailsForm.patchValue(
      {
        summary: overview.summary ?? '',
        objectives: this.joinMultiline(overview.objectives),
        successCriteria: this.joinMultiline(overview.successCriteria),
        stakeholderNotes: overview.stakeholderNotes ?? '' },
      { emitEvent: false }
    );
    this.overviewDetailsForm.markAsPristine();
    this.overviewMetadataSignal.set({
      aiDraftSource: overview.aiDraftSource ?? 'contentful',
      aiDraftGeneratedAt:
        overview.aiDraftGeneratedAt ?? new Date().toISOString(),
      cmsEntryId: overview.cmsEntryId ?? brief.entryId ?? undefined,
      cmsEntryTitle: overview.cmsEntryTitle ?? brief.title ?? undefined });
    this.upsertContentfulReference(brief);
    this.toast.success({
      title: 'Overview updated',
      description: 'Contentful brief applied to the overview.' });
  }

  toggleAiPanel() {
    this.aiPanelOpen.update((open) => !open);
  }

  clearAiDraft() {
    this.aiDraft.set(null);
    this.aiError.set(null);
  }

  private upsertContentfulReference(brief: IContentfulBrief) {
    const entryId = brief.entryId?.toString().trim();
    if (!entryId) {
      return;
    }
    const formValue = this.contentfulForm.getRawValue();
    const metadata: Record<string, unknown> = {
      contentType: formValue.contentType?.trim() || undefined,
      slug: formValue.slug?.trim() || undefined,
      appliedAt: new Date().toISOString() };
    Object.keys(metadata).forEach((key) => {
      if (
        metadata[key] === undefined ||
        metadata[key] === null ||
        metadata[key] === ''
      ) {
        delete metadata[key];
      }
    });
    const current = this.cmsReferencesSignal();
    const nextReference: IExternalIntegrationReference = {
      provider: 'contentful',
      referenceId: entryId,
      label: brief.title ?? undefined,
      syncStatus: 'idle',
      metadata: Object.keys(metadata).length ? metadata : undefined };
    const existingIndex = current.findIndex(
      (ref) => ref.provider === 'contentful' && ref.referenceId === entryId
    );
    if (existingIndex >= 0) {
      const updated = current.map((ref, index) => {
        if (index !== existingIndex) {
          return ref;
        }
        return {
          ...ref,
          label: nextReference.label ?? ref.label,
          metadata: {
            ...(ref.metadata ?? {}),
            ...(nextReference.metadata ?? {}) },
          syncStatus: nextReference.syncStatus };
      });
      this.cmsReferencesSignal.set(updated);
    } else {
      this.cmsReferencesSignal.set([...current, nextReference]);
    }
  }

  generateOverviewDraft() {
    const request = this.buildOverviewGenerationPayload();
    this.aiProcessing.set(true);
    this.aiError.set(null);
    this.masterService
      .generateOverviewDraft(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.aiProcessing.set(false);
          this.aiDraft.set(draft);
          this.aiPanelOpen.set(true);
          this.toast.success({
            title: 'AI draft ready',
            description: `Overview generated with ${draft.source.toUpperCase()}.`,
          });
        },
        error: (error) => {
          this.aiProcessing.set(false);
          const message =
            error?.error?.message ??
            error?.message ??
            'Unable to generate overview draft.';
          this.aiError.set(message);
          this.toast.error({
            title: 'Generation failed',
            description: message,
          });
          console.error('[AI] overview generation failed', error);
        },
      });
  }

  applyAiDraft(draft: IAiOverviewDraft | null | undefined) {
    if (!draft) {
      return;
    }
    const overview = draft.overview ?? {
      summary: '',
      objectives: [],
      successCriteria: [] };
    this.overviewDetailsForm.patchValue(
      {
        summary: overview.summary ?? '',
        objectives: this.joinMultiline(overview.objectives),
        successCriteria: this.joinMultiline(overview.successCriteria),
        stakeholderNotes: overview.stakeholderNotes ?? '' },
      { emitEvent: false }
    );
    this.overviewDetailsForm.markAsPristine();
    this.overviewMetadataSignal.set({
      aiDraftSource: draft.source,
      aiDraftGeneratedAt: new Date().toISOString() });
    this.toast.success({
      title: 'Overview updated',
      description: `AI draft from ${draft.source.toUpperCase()} applied.` });
  }

  assignmentStatusLabel(assignment: IProjectResourceAssignment) {
    return assignment.isActive ? 'Active' : 'Inactive';
  }

  approvalStatusLabel(status?: string) {
    return APPROVAL_STATUS_LABELS[this.normalizeApprovalStatus(status)];
  }

  approvalStatusBadgeClass(status?: string) {
    return (
      APPROVAL_STATUS_CLASSES[this.normalizeApprovalStatus(status)] ??
      APPROVAL_STATUS_CLASSES.draft
    );
  }

  commentSeverityClass(severity?: string) {
    const entry = REVIEWER_SEVERITIES.find(
      (item) => item.value === severity
    )?.value;
    switch (entry) {
      case 'critical':
        return 'border border-rose-400/40 bg-rose-500/10 text-rose-200';
      case 'warning':
        return 'border border-amber-400/40 bg-amber-500/10 text-amber-200';
      default:
        return 'border border-sky-400/40 bg-sky-500/10 text-sky-200';
    }
  }

  formatDateTime(value?: string | null) {
    if (!value) {
      return '—';
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  timelineLabel(label?: string | null): string {
    return titleCaseLabel(label);
  }

  reviewerSectionLabel(section?: string | null): string {
    return (
      REVIEWER_COMMENT_SECTIONS.find((item) => item.value === section)?.label ??
      titleCaseLabel(section)
    );
  }

  avatarFor(id: number | string | null | undefined, name?: string | null): AvatarView {
    const numeric = Number(id);
    const employee = numeric
      ? this.employees().find((emp) => emp.employeeId === numeric)
      : undefined;
    return employeeAvatar(employee, name ?? '');
  }

  actorAvatar(actorId?: number | string | null, actorName?: string | null): AvatarView {
    return this.avatarFor(actorId, this.actorDisplayName(actorId, actorName));
  }

  leadAvatar(): AvatarView | null {
    const id = Number(this.projectForm.controls['leadByEmpId'].value);
    return id ? this.avatarFor(id, this.displayValue('leadByEmpId')) : null;
  }

  clientAvatar(): AvatarView | null {
    const name = String(this.projectForm.controls['clientName'].value ?? '').trim();
    return name ? employeeAvatar(null, name) : null;
  }

  contactAvatar(): AvatarView | null {
    return contactAvatar({
      contactPerson: String(this.projectForm.controls['contactPerson'].value ?? ''),
      emailId: String(this.projectForm.controls['emailId'].value ?? ''),
    });
  }

  actorDisplayName(
    actorId?: number | string | null,
    actorName?: string | null
  ) {
    if (actorName && actorName.trim().length) {
      return actorName.trim();
    }
    if (typeof actorId === 'number' && actorId) {
      return this.leadName(actorId) ?? `User #${actorId}`;
    }
    if (
      typeof actorId === 'string' &&
      actorId.trim().length &&
      !Number.isNaN(Number(actorId))
    ) {
      const numeric = Number(actorId);
      return this.leadName(numeric) ?? actorId;
    }
    if (typeof actorId === 'string' && actorId.trim().length) {
      return actorId;
    }
    return 'System';
  }

  requestApprovalAction() {
    this.requestApprovalConfirm('request');
  }

  approveProjectAction() {
    this.requestApprovalConfirm('approve');
  }

  rejectProjectAction() {
    this.requestApprovalConfirm('reject');
  }

  resetProjectApprovalAction() {
    this.requestApprovalConfirm('reset');
  }

  confirmApprovalAction() {
    const action = this.pendingApproval();
    if (!action || this.isApprovalConfirmBusy()) {
      return;
    }
    if (!this.canRunApprovalAction(action)) {
      this.pendingApproval.set(null);
      return;
    }
    this.performApprovalAction(action);
  }

  dismissApprovalConfirm() {
    if (this.isApprovalConfirmBusy()) {
      return;
    }
    this.pendingApproval.set(null);
  }

  private requestApprovalConfirm(action: ApprovalAction) {
    if (this.approvalProcessing() || !this.canRunApprovalAction(action)) {
      return;
    }
    this.pendingApproval.set(action);
  }

  private canRunApprovalAction(action: ApprovalAction): boolean {
    if (!this.currentProjectSignal()?.projectId) {
      this.toast.error({
        title: 'Project not saved',
        description: 'Save the project before managing approvals.',
      });
      return false;
    }
    if (action === 'reject' && !this.buildApprovalPayload().comment) {
      this.toast.error({
        title: 'Provide a reason',
        description: 'Please include a short note explaining the rejection.',
      });
      return false;
    }
    return true;
  }

  submitReviewerComment() {
    if (this.reviewerCommentForm.invalid) {
      this.reviewerCommentForm.markAllAsTouched();
      this.toast.error({
        title: 'Missing details',
        description: 'Please provide a comment before submitting.' });
      return;
    }
    if (!this.currentProjectSignal()?.projectId || this.reviewerCommentProcessing()) {
      return;
    }
    this.pendingConfirm.set({ kind: 'comment' });
  }

  private runReviewerComment() {
    const project = this.currentProjectSignal();
    if (!project?.projectId || this.reviewerCommentForm.invalid) {
      this.pendingConfirm.set(null);
      return;
    }

    const payload = this.reviewerCommentForm.getRawValue();
    this.mutations.track(
      this.masterService.addReviewerComment(project.projectId, payload),
      {
        pending: this.pending,
        destroyRef: this.destroyRef,
        key: PENDING.comment,
        onSuccess: (updatedProject) => {
          if (!this.applyMutationResult(updatedProject)) {
            return;
          }
          this.pendingConfirm.set(null);
          this.reviewerCommentForm.reset(
            {
              section: payload.section ?? 'overview',
              reviewerId: null,
              reviewerName: '',
              comment: '',
              severity: payload.severity ?? 'info' },
            { emitEvent: false }
          );
          Object.values(this.reviewerCommentForm.controls).forEach((control) =>
            control.markAsUntouched()
          );
          this.reviewerCommentForm.markAsPristine();
        },
        onError: () => {
          console.error('[Approval] add reviewer comment failed', {
            projectId: project.projectId,
            payload });
        },
        successToast: {
          title: 'Comment added',
          description: 'Reviewer feedback has been logged.' },
        errorToast: {
          title: 'Action failed',
          description: 'Unable to add reviewer comment right now.' },
      }
    );
  }

  toggleReviewerCommentResolved(comment: IReviewerCommentEntry) {
    if (!this.currentProjectSignal()?.projectId || this.reviewerCommentProcessing()) {
      return;
    }
    this.pendingConfirm.set({ kind: 'resolve', comment });
  }

  private runResolveComment(comment: IReviewerCommentEntry) {
    const project = this.currentProjectSignal();
    const current = project?.reviewerComments?.find((entry) => entry.id === comment.id);
    if (!project?.projectId || !current || Boolean(current.resolved) !== Boolean(comment.resolved)) {
      this.pendingConfirm.set(null);
      return;
    }

    const payload = {
      resolved: !comment.resolved,
      ...this.buildApprovalPayload() };
    this.mutations.track(
      this.masterService.resolveReviewerComment(project.projectId, comment.id, payload),
      {
        pending: this.pending,
        destroyRef: this.destroyRef,
        key: PENDING.resolve(comment.id),
        onSuccess: (updatedProject) => {
          if (this.applyMutationResult(updatedProject)) {
            this.pendingConfirm.set(null);
          }
        },
        successToast: {
          title: comment.resolved ? 'Comment reopened' : 'Comment resolved',
          description: 'Reviewer comment state has been updated.' },
        errorToast: {
          title: 'Action failed',
          description: 'Unable to update reviewer comment right now.' },
      }
    );
  }

  private performApprovalAction(action: ApprovalAction) {
    const project = this.currentProjectSignal();
    if (!project?.projectId || !this.canRunApprovalAction(action)) {
      return;
    }
    if (this.approvalProcessing()) {
      return;
    }
    const payload = this.buildApprovalPayload();
    let request$: Observable<IProject>;
    let successTitle = '';
    switch (action) {
      case 'request':
        request$ = this.masterService.requestProjectApproval(
          project.projectId,
          payload
        );
        successTitle = 'Approval requested';
        break;
      case 'approve':
        request$ = this.masterService.approveProject(
          project.projectId,
          payload
        );
        successTitle = 'Project approved';
        break;
      case 'reject':
        request$ = this.masterService.rejectProject(project.projectId, payload);
        successTitle = 'Project rejected';
        break;
      case 'reset':
        request$ = this.masterService.resetProjectApproval(
          project.projectId,
          payload
        );
        successTitle = 'Approval reset';
        break;
      default:
        return;
    }

    this.mutations.track(request$, {
      pending: this.pending,
      destroyRef: this.destroyRef,
      key: PENDING.approval(action),
      onSuccess: (updatedProject) => {
        if (!this.applyMutationResult(this.cloneProject(updatedProject))) {
          return;
        }
        this.pendingApproval.set(null);
        this.approvalForm.patchValue({ comment: '' }, { emitEvent: false });
        if (action === 'reset') {
          this.approvalForm.patchValue({ actorName: '' }, { emitEvent: false });
        }
      },
      onError: () => {
        console.error('[Approval] approval action failed', {
          action,
          projectId: project.projectId,
          payload });
      },
      successToast: (updatedProject) => ({
        title: successTitle,
        description: `Status is now ${this.approvalStatusLabel(
          updatedProject.approvalStatus
        )}.` }),
      errorToast: {
        title: 'Approval update failed',
        description: 'Unable to update approval status right now.' },
    });
  }

  private buildApprovalPayload() {
    const value = this.approvalForm.getRawValue();
    const cleanActorName =
      typeof value.actorName === 'string' && value.actorName.trim().length
        ? value.actorName.trim()
        : undefined;
    const selectedActorId =
      value.actorId !== null && value.actorId !== undefined
        ? Number(value.actorId)
        : null;
    const fallbackActorId = this.currentProjectSignal()?.leadByEmpId ?? null;
    return {
      actorId: selectedActorId ?? fallbackActorId ?? undefined,
      actorName: cleanActorName,
      comment:
        typeof value.comment === 'string' ? value.comment.trim() : undefined };
  }

  private normalizeApprovalStatus(status?: string | null): ApprovalStatus {
    const normalized = (status ?? '')
      .toString()
      .trim()
      .toLowerCase() as ApprovalStatus;
    return APPROVAL_STATUS_LABELS[normalized] ? normalized : 'draft';
  }

  isTaskComplete(taskId: ReadinessTaskId) {
    return this.readinessStatus(taskId) === 'done';
  }

  controlInvalid(field: FieldKey) {
    const control = this.projectForm.controls[field];
    return control.invalid && (control.dirty || control.touched);
  }

  /**
   * Warm entry (list or detail snapshot) hydrates instantly. A fresh snapshot
   * (e.g. the create/update response) skips revalidation; otherwise the
   * authoritative GetProject response only re-hydrates the forms while nothing
   * is edited, and just refreshes the save/cancel baseline when dirty.
   */
  private fetchProject(id: number) {
    const requestToken = ++this.projectRequestToken;
    const snapshot = this.masterService.peekProject(id);
    if (snapshot?.fresh) {
      this.hydrateProject(snapshot.project);
      return;
    }
    const cached = snapshot?.project ?? null;
    if (cached) {
      this.hydrateProject(cached);
    } else {
      this.isLoadingSignal.set(true);
    }
    this.masterService
      .getProjectById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          if (requestToken !== this.projectRequestToken) {
            return;
          }
          if (cached && !this.formsPristine()) {
            this.currentProjectSignal.set(this.cloneProject(project));
            return;
          }
          this.hydrateProject(project, { loadInsights: !cached });
        },
        error: () => {
          if (requestToken !== this.projectRequestToken || cached) {
            return;
          }
          this.isLoadingSignal.set(false);
          this.toast.error({
            title: 'Load failed',
            description: 'Unable to load project details. Please retry.',
          });
          this.router.navigate(['/projects']);
        },
      });
  }

  private loadEmployees() {
    this.masterService
      .getAllEmp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (employees) => {
          this.employeesSignal.set(employees ?? []);
          this.applyDefaultApprovalActor();
        },
      });
  }

  private loadResourceInsights(projectId: number) {
    if (!projectId || projectId <= 0) {
      this.resourceInsightsSignal.set(null);
      return;
    }
    const requestToken = ++this.resourceInsightsRequestToken;
    this.masterService
      .getProjectResourceInsights(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (insights) => {
          if (requestToken === this.resourceInsightsRequestToken) {
            this.resourceInsightsSignal.set(insights);
          }
        },
        error: (error) => {
          if (requestToken === this.resourceInsightsRequestToken) {
            console.error('[Resource] failed to load insights', {
              projectId,
              error });
            this.resourceInsightsSignal.set(null);
          }
        } });
  }

  private buildReadinessControls(): Record<
    ReadinessTaskId,
    ReadinessTaskFormGroup
  > {
    return this.readinessTasks.reduce(
      (controls, task) => ({
        ...controls,
        [task.id]: this.fb.group({
          status: this.fb.control<ReadinessStatus>('not_started', {
            nonNullable: true }),
          ownerId: this.fb.control<number | null>(null),
          dueDate: this.fb.control<string | null>(
            this.defaultDueDate(task.defaultDueInDays)
          ),
          notes: this.fb.control<string>('') }) }),
      {} as Record<ReadinessTaskId, ReadinessTaskFormGroup>
    );
  }

  private buildReadinessView(formValue: ReadinessFormValue) {
    const totalWeight = this.readinessTasks.reduce(
      (sum, task) => sum + task.weight,
      0
    );
    let completedWeight = 0;
    let completedItems = 0;
    let remainingItems = 0;
    const items = this.readinessTasks.map((task) => {
      const value = formValue[task.id];
      const status = value?.status ?? 'not_started';
      completedWeight += task.weight * READINESS_STATUS_VALUES[status];
      if (status === 'done') {
        completedItems += 1;
      } else {
        remainingItems += 1;
      }
      return {
        id: task.id,
        status,
        ownerId: value?.ownerId ?? null,
        dueDate: value?.dueDate ?? null };
    });
    const percent = totalWeight
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;
    return {
      items,
      totalWeight,
      completedWeight,
      percent,
      completedItems,
      remainingItems };
  }

  private readinessGroup(taskId: ReadinessTaskId): ReadinessTaskFormGroup {
    return this.readinessForm.controls[taskId] as ReadinessTaskFormGroup;
  }

  private readinessStatus(taskId: ReadinessTaskId): ReadinessStatus {
    return this.readinessGroup(taskId).controls.status.value;
  }

  readinessStatusLabel(taskId: ReadinessTaskId): string {
    return READINESS_STATUS_LABELS[this.readinessStatus(taskId)];
  }

  statusBadgeClass(taskId: ReadinessTaskId): string {
    const status = this.readinessStatus(taskId);
    switch (status) {
      case 'done':
        return 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
      case 'in_progress':
        return 'border border-sky-400/40 bg-sky-500/10 text-sky-200';
      case 'blocked':
        return 'border border-rose-400/40 bg-rose-500/10 text-rose-200';
      default:
        return 'border border-white/15 bg-white/10 text-white/70';
    }
  }

  private defaultDueDate(offsetDays?: number): string | null {
    if (!offsetDays || offsetDays <= 0) {
      return null;
    }
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().substring(0, 10);
  }

  private defaultReadinessValue(): ReadinessFormValue {
    return this.readinessTasks.reduce((acc, task) => {
      acc[task.id] = {
        status: 'not_started',
        ownerId: null,
        dueDate: this.defaultDueDate(task.defaultDueInDays),
        notes: '' };
      return acc;
    }, {} as ReadinessFormValue);
  }

  private setReadinessFormValue(value: ReadinessFormValue) {
    this.readinessTasks.forEach((task) => {
      const group = this.readinessGroup(task.id);
      group.setValue(value[task.id], { emitEvent: false });
    });
    this.readinessForm.markAsPristine();
    this.readinessForm.updateValueAndValidity({ emitEvent: true });
    this.readinessFormValue.set(
      this.readinessForm.getRawValue() as ReadinessFormValue
    );
  }

  private buildReadinessPayload(
    formValueOverride?: ReadinessFormValue,
    baselineOverride?: IReadinessChecklistState | null
  ): IReadinessChecklistState {
    const formValue =
      formValueOverride ??
      (this.readinessForm.getRawValue() as ReadinessFormValue);
    const baseline = baselineOverride ?? this.readinessBaseline();
    const baselineMap = new Map(
      baseline?.items?.map((item) => [item.id, item]) ?? []
    );
    const employeesById = new Map(
      this.employees().map((emp) => [emp.employeeId, emp.employeeName])
    );
    const totalWeight = this.readinessTasks.reduce(
      (sum, task) => sum + task.weight,
      0
    );
    const nowIso = new Date().toISOString();
    let completedWeight = 0;

    const items: IReadinessChecklistItem[] = this.readinessTasks.map((task) => {
      const value = formValue[task.id];
      const status = value?.status ?? 'not_started';
      const ownerId = value?.ownerId ?? null;
      const dueDate =
        value?.dueDate && value.dueDate.trim().length > 0
          ? value.dueDate
          : null;
      const notes = value?.notes ?? '';
      const previous = baselineMap.get(task.id);
      const statusUpdatedAt =
        previous && previous.status === status
          ? previous.statusUpdatedAt ?? nowIso
          : nowIso;
      const ownerName = ownerId
        ? employeesById.get(ownerId) ?? previous?.ownerName ?? null
        : null;

      completedWeight += task.weight * READINESS_STATUS_VALUES[status];

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        weight: task.weight,
        status,
        ownerId,
        ownerName,
        dueDate,
        notes,
        statusUpdatedAt,
        lastUpdatedBy: previous?.lastUpdatedBy };
    });

    const percent = totalWeight
      ? Math.round((completedWeight / totalWeight) * 100)
      : 0;

    return {
      items,
      totalWeight,
      completedWeight,
      percent,
      updatedAt: nowIso,
      updatedBy: baseline?.updatedBy,
      summary: baseline?.summary };
  }

  private formValueFromChecklist(
    checklist?: IReadinessChecklistState | null
  ): ReadinessFormValue {
    const fallback = this.defaultReadinessValue();
    if (!checklist?.items?.length) {
      return fallback;
    }
    const value: Partial<ReadinessFormValue> = {};
    checklist.items.forEach((item) => {
      const id = item.id as ReadinessTaskId;
      if (!this.readinessTasks.find((task) => task.id === id)) {
        return;
      }
      value[id] = {
        status: item.status ?? 'not_started',
        ownerId:
          typeof item.ownerId === 'number'
            ? item.ownerId
            : item.ownerId ?? null,
        dueDate: item.dueDate ?? fallback[id].dueDate ?? null,
        notes: item.notes ?? '' };
    });
    return this.readinessTasks.reduce((acc, task) => {
      acc[task.id] = value[task.id] ?? fallback[task.id];
      return acc;
    }, {} as ReadinessFormValue);
  }

  private applyReadinessFromProject(
    checklist?: IReadinessChecklistState | null
  ) {
    const value = this.formValueFromChecklist(checklist);
    this.setReadinessFormValue(value);
    const baseline: IReadinessChecklistState =
      checklist ?? this.buildReadinessPayload(value, null);
    this.readinessBaseline.set(JSON.parse(JSON.stringify(baseline)));
  }

  private applyOverviewToForms(overview: IProjectOverview | null | undefined) {
    const summary = overview?.summary ?? '';
    const objectives = this.joinMultiline(overview?.objectives);
    const successCriteria = this.joinMultiline(overview?.successCriteria);
    const stakeholderNotes = overview?.stakeholderNotes ?? '';

    this.overviewDetailsForm.patchValue(
      {
        summary,
        objectives,
        successCriteria,
        stakeholderNotes },
      { emitEvent: false }
    );
    this.overviewDetailsForm.markAsPristine();
    if (overview) {
      this.overviewMetadataSignal.set({
        aiDraftSource: overview.aiDraftSource,
        aiDraftGeneratedAt: overview.aiDraftGeneratedAt,
        cmsEntryId: overview.cmsEntryId,
        cmsEntryTitle: overview.cmsEntryTitle });
    } else {
      this.overviewMetadataSignal.set(null);
    }
  }

  private joinMultiline(values?: string[] | null): string {
    if (!values || !values.length) {
      return '';
    }
    return values.join('\n');
  }

  private splitMultiline(value?: string | null): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private buildOverviewPayload(): IProjectOverview | null {
    const value = this.overviewDetailsForm.getRawValue();
    const summary = (value.summary ?? '').trim();
    const objectives = this.splitMultiline(value.objectives);
    const successCriteria = this.splitMultiline(value.successCriteria);
    const stakeholderNotes = (value.stakeholderNotes ?? '').trim();

    const payload: IProjectOverview = {
      summary,
      objectives,
      successCriteria };

    if (stakeholderNotes) {
      payload.stakeholderNotes = stakeholderNotes;
    }

    const meta = this.overviewMetadataSignal();
    if (meta) {
      Object.assign(payload, meta);
      if (!payload.aiDraftGeneratedAt && meta.aiDraftSource) {
        payload.aiDraftGeneratedAt =
          meta.aiDraftGeneratedAt ?? new Date().toISOString();
      }
      if (meta.cmsEntryId === undefined && payload.aiDraftSource !== 'contentful') {
        delete payload.cmsEntryId;
        delete payload.cmsEntryTitle;
      }
    }

    return payload;
  }

  private buildOverviewGenerationPayload() {
    const projectSnapshot = this.currentProjectSignal();
    const formValue = this.projectForm.getRawValue();
    const overviewValue = this.overviewDetailsForm.getRawValue();
    const readiness = this.buildReadinessPayload();
    const assignments = this.resourceInsights()?.assignments ?? [];

    return {
      project: {
        projectId: projectSnapshot?.projectId ?? undefined,
        projectName:
          (formValue.projectName ?? projectSnapshot?.projectName ?? '')
            .toString()
            .trim(),
        clientName:
          (formValue.clientName ?? projectSnapshot?.clientName ?? '')
            .toString()
            .trim(),
        startDate:
          formValue.startDate ??
          projectSnapshot?.startDate ??
          this.todayString(),
        contactPerson:
          (formValue.contactPerson ?? projectSnapshot?.contactPerson ?? '')
            .toString()
            .trim(),
        overview: {
          summary: (overviewValue.summary ?? '').trim(),
          objectives: this.splitMultiline(overviewValue.objectives),
          successCriteria: this.splitMultiline(overviewValue.successCriteria),
          stakeholderNotes: (overviewValue.stakeholderNotes ?? '').trim() } },
      readiness,
      assignments: assignments.map((assignment) => ({
        employeeName: assignment.employee?.employeeName,
        role: assignment.role ?? assignment.employee?.role,
        allocationPct: assignment.allocationPct ?? null,
        allocationStatus: assignment.allocationStatus })) };
  }

  private cloneProject(project: IProject): IProject {
    return JSON.parse(JSON.stringify(project)) as IProject;
  }

  private formsPristine(): boolean {
    return (
      this.projectForm.pristine &&
      this.readinessForm.pristine &&
      this.overviewDetailsForm.pristine
    );
  }

  /**
   * Mutation responses are newer than any in-flight GetProject; drop those reads.
   * A response for a project the user has since navigated away from is ignored.
   */
  private applyMutationResult(
    project: IProject,
    options: { loadInsights?: boolean } = {}
  ): boolean {
    if (this.routedProjectId && project.projectId !== this.routedProjectId) {
      return false;
    }
    this.projectRequestToken++;
    this.hydrateProject(project, options);
    return true;
  }

  private hydrateProject(
    project: IProject | null,
    options: { loadInsights?: boolean } = {}
  ) {
    const loadInsights = options.loadInsights ?? true;
    if (!project) {
      this.resourceInsightsSignal.set(null);
      this.isLoadingSignal.set(false);
      return;
    }
    const snapshot = this.cloneProject(project);
    this.contentfulPanelOpen.set(false);
    this.contentfulBrief.set(null);
    this.contentfulError.set(null);
    this.aiPanelOpen.set(false);
    this.aiDraft.set(null);
    this.aiError.set(null);
    this.cmsReferencesSignal.set(snapshot.cmsContentRefs ?? []);
    this.currentProjectSignal.set(snapshot);
    this.projectForm.patchValue(
      {
        projectId: snapshot.projectId ?? 0,
        projectName: snapshot.projectName ?? '',
        clientName: snapshot.clientName ?? '',
        startDate: snapshot.startDate
          ? snapshot.startDate.substring(0, 10)
          : '',
        health: snapshot.health ?? '',
        leadByEmpId: snapshot.leadByEmpId ?? null,
        contactPerson: snapshot.contactPerson ?? '',
        contactNo: snapshot.contactNo ?? '',
        emailId: snapshot.emailId ?? '' },
      { emitEvent: false }
    );
    this.applyReadinessFromProject(snapshot.readinessChecklist);
    this.applyOverviewToForms(snapshot.overview ?? null);
    this.applyDefaultApprovalActor(snapshot);
    this.projectForm.markAsPristine();
    if (snapshot.projectId && snapshot.projectId > 0) {
      if (loadInsights) {
        this.loadResourceInsights(snapshot.projectId);
      }
    } else {
      this.resourceInsightsSignal.set(null);
    }
    this.isLoadingSignal.set(false);
  }

  private refreshProjectSnapshot(projectId: number | null | undefined) {
    if (!projectId) {
      return;
    }
    const requestToken = ++this.projectRequestToken;
    this.masterService
      .getProjectById(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          if (requestToken === this.projectRequestToken) {
            this.hydrateProject(project);
          }
        },
        error: (error) => {
          this.toast.error({
            title: 'Refresh failed',
            description:
              'Unable to refresh the project data at the moment. Try again shortly.',
          });
          console.error('[Approval] refreshProjectSnapshot failed', {
            projectId,
            error,
          });
        },
      });
  }

  private resetReadinessForm() {
    const value = this.defaultReadinessValue();
    this.setReadinessFormValue(value);
    const baseline = this.buildReadinessPayload(value, null);
    this.readinessBaseline.set(JSON.parse(JSON.stringify(baseline)));
  }

  private resetApprovalForms() {
    this.approvalForm.reset({
      actorId: null,
      actorName: '',
      comment: '' });
    this.reviewerCommentForm.reset({
      section: 'overview',
      reviewerId: null,
      reviewerName: '',
      comment: '',
      severity: 'info' });
    this.applyDefaultApprovalActor();
  }

  private applyDefaultApprovalActor(project?: IProject | null) {
    const actorControl = this.approvalForm.controls['actorId'];
    const hasSelection =
      actorControl.value !== null && actorControl.value !== undefined;
    if (hasSelection) {
      return;
    }
    const candidate =
      project?.leadByEmpId ?? this.currentProjectSignal()?.leadByEmpId ?? null;
    if (candidate) {
      actorControl.patchValue(candidate, { emitEvent: false });
    }
  }

  private todayString() {
    return new Date().toISOString().substring(0, 10);
  }

  private isOverviewComplete(): boolean {
    const controls = this.projectForm.controls;
    const requiredKeys: FieldKey[] = ['projectName', 'clientName', 'startDate'];
    return requiredKeys.every((key) => this.isControlValid(controls[key]));
  }

  private isLeadershipComplete(): boolean {
    return this.isControlValid(this.projectForm.controls['leadByEmpId']);
  }

  private isContactComplete(): boolean {
    const contactPersonControl = this.projectForm.controls['contactPerson'];
    const contactPersonValue = (contactPersonControl?.value ?? '')
      .toString()
      .trim();
    if (!contactPersonValue) {
      return false;
    }

    const emailControl = this.projectForm.controls['emailId'];
    const emailValue = (emailControl?.value ?? '').toString().trim();
    const emailValid =
      emailValue.length === 0 || this.isControlValid(emailControl);

    const contactNoControl = this.projectForm.controls['contactNo'];
    const contactNoValue = (contactNoControl?.value ?? '').toString().trim();
    const contactNoValid =
      contactNoValue.length === 0 || this.isControlValid(contactNoControl);

    return emailValid && contactNoValid;
  }

  private isControlValid(control: AbstractControl | null | undefined) {
    if (!control) {
      return false;
    }
    control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    const value = control.value;
    if (typeof value === 'string') {
      return control.valid && value.trim().length > 0;
    }
    return (
      control.valid && value !== null && value !== undefined && value !== ''
    );
  }
}

type FieldKey =
  | 'projectName'
  | 'clientName'
  | 'startDate'
  | 'health'
  | 'leadByEmpId'
  | 'contactPerson'
  | 'contactNo'
  | 'emailId';
