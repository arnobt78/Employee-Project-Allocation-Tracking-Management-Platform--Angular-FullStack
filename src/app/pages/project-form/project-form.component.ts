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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
import { UbButtonDirective } from '@/app/components/ui/button';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Observable, startWith } from 'rxjs';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { AlertDialogComponent } from '@/app/components/ui/alert-dialog.component';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { ProjectFormSkeletonComponent } from '@/app/components/ui/project-form-skeleton.component';

const readinessTaskDefinitions = [
  {
    id: 'scopeDefined',
    title: 'Scope confirmed',
    description: 'Requirements baseline captured and shared with stakeholders.',
    category: 'Scope',
    weight: 25,
    defaultDueInDays: 7 },
  {
    id: 'budgetApproved',
    title: 'Budget approved',
    description: 'Finance sign-off received for the projected spend.',
    category: 'Budget',
    weight: 20,
    defaultDueInDays: 14 },
  {
    id: 'legalReviewed',
    title: 'Contracts reviewed',
    description: 'Master services agreement and NDAs cleared with legal.',
    category: 'Legal',
    weight: 20,
    defaultDueInDays: 21 },
  {
    id: 'assetsPrepared',
    title: 'Assets prepared',
    description: 'Brand assets, data rooms, and collateral ready to share.',
    category: 'Assets',
    weight: 15,
    defaultDueInDays: 10 },
  {
    id: 'kickoffScheduled',
    title: 'Kickoff scheduled',
    description: 'Kickoff meeting on calendar with internal and client teams.',
    category: 'Timeline',
    weight: 20,
    defaultDueInDays: 28 }] as const;

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
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Complete' };

const READINESS_STATUS_VALUES: Record<ReadinessStatus, number> = {
  not_started: 0,
  in_progress: 0.5,
  blocked: 0,
  done: 1 };

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
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
  { value: 'contact', label: 'Client contact' },
  { value: 'approval', label: 'Approval workflow' }];

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
    RouterLink,
    ReactiveFormsModule,
    UbButtonDirective,
    SelectMenuComponent,
    AlertDialogComponent,
    PageHeaderComponent,
    ProjectFormSkeletonComponent,
  ],
  templateUrl: './project-form.component.html',
  styleUrl: './project-form.component.css' })
export class ProjectFormComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly masterService = inject(MasterService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly employeesSignal = signal<Employee[]>([]);
  readonly employees = this.employeesSignal.asReadonly();

  readonly employeeSelectOptions = computed<SelectMenuOption[]>(() =>
    this.employees().map((employee) => ({
      value: String(employee.employeeId),
      label: employee.employeeName,
      imageSeed: employee.emailId || employee.employeeName,
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
  private readonly resourceInsightsSignal =
    signal<IProjectResourceInsights | null>(null);
  readonly resourceInsights = this.resourceInsightsSignal.asReadonly();

  private readonly modeSignal = signal<'create' | 'edit'>('create');
  readonly mode = this.modeSignal.asReadonly();
  /** True while GetProject hydrates an edit route (avoids Untitled/0% flash). */
  private readonly isLoadingSignal = signal(false);
  readonly isLoading = this.isLoadingSignal.asReadonly();

  readonly readinessTasks = readinessTaskDefinitions;
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
  readonly approvalProcessing = signal<boolean>(false);
  readonly reviewerCommentProcessing = signal<boolean>(false);

  private readonly collaboratorAssignmentProfileSignal =
    signal<IResourceProfile | null>(null);
  readonly collaboratorAssignmentProfile =
    this.collaboratorAssignmentProfileSignal.asReadonly();
  readonly collaboratorAssignmentProcessing = signal<boolean>(false);
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
  readonly isSaving = signal<boolean>(false);
  readonly isDeleting = signal<boolean>(false);
  readonly pendingDelete = signal<boolean>(false);

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
    return fallback && fallback.length > 0 ? fallback : 'Untitled project';
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
    this.activatedRoute.params.subscribe((params) => {
      const idParam = params['id'];
      const parsedId =
        idParam !== undefined && idParam !== null ? Number(idParam) : 0;
      const id = Number.isFinite(parsedId) ? parsedId : 0;

      if (id > 0) {
        this.modeSignal.set('edit');
        this.editingSection.set(null);
        this.isLoadingSignal.set(true);
        this.fetchProject(id);
      } else {
        this.modeSignal.set('create');
        this.isLoadingSignal.set(false);
        this.editingSection.set('overview');
        this.projectForm.patchValue({
          startDate: this.todayString() });
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

  saveSection(_section: SectionId) {
    this.submitProject(() => {
      this.toast.success({
        title: 'Project saved',
        description: this.isEditMode()
          ? 'Updates applied to the project.'
          : 'A new project has been created.' });
      this.editingSection.set(null);
      if (!this.isEditMode()) {
        this.modeSignal.set('edit');
      }
    });
  }

  saveAllChanges() {
    this.submitProject(() => {
      this.toast.success({
        title: this.isEditMode() ? 'Project updated' : 'Project created',
        description: this.isEditMode()
          ? 'All changes have been saved.'
          : 'A new project has been created.' });
      this.editingSection.set(null);
      if (!this.isEditMode()) {
        this.modeSignal.set('edit');
      }
    });
  }

  submitProject(onSuccess?: () => void) {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      this.toast.error({
        title: 'Incomplete details',
        description: 'Please resolve validation warnings before continuing.' });
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
    this.isSaving.set(true);

    const request$ =
      payload.projectId && payload.projectId !== 0
        ? this.masterService.updateProject(payload)
        : this.masterService.saveProject(payload as any);

    request$.subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.hydrateProject(res);
        if (res.projectId && res.projectId > 0) {
          this.router.navigate(['/update-project', res.projectId], {
            replaceUrl: true });
        }
        if (onSuccess) {
          onSuccess();
        }
      },
      error: () => {
        this.isSaving.set(false);
        this.toast.error({
          title: 'Save failed',
          description: 'Unable to persist changes right now. Try again later.' });
      } });
  }

  requestDelete() {
    if (!this.isEditMode()) {
      return;
    }
    this.pendingDelete.set(true);
  }

  confirmDelete() {
    const projectId = this.projectForm.controls['projectId'].value;
    if (!projectId || this.isDeleting()) {
      return;
    }
    this.isDeleting.set(true);
    this.masterService.deleteProjectById(projectId).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.pendingDelete.set(false);
        this.toast.success({
          title: 'Project removed',
          description: 'The project has been archived successfully.',
        });
        this.resetReadinessForm();
        this.resourceInsightsSignal.set(null);
        this.router.navigate(['/projects']);
      },
      error: () => {
        this.isDeleting.set(false);
        this.toast.error({
          title: 'Delete failed',
          description: 'Unable to archive the project currently.',
        });
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
          : 'Unassigned';
      case 'contactNo':
        return value || 'Not provided';
      case 'emailId':
        return value || 'Not provided';
      case 'contactPerson':
        return value || 'Not assigned';
      default:
        return value || 'None';
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
        description: `${candidate.employeeName} has been assigned as the project lead. Save to confirm.` });
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
    const profile = this.collaboratorAssignmentProfileSignal();
    const project = this.currentProjectSignal();
    if (!profile || !project?.projectId) {
      return;
    }

    if (this.collaboratorAssignmentForm.invalid) {
      this.collaboratorAssignmentForm.markAllAsTouched();
      this.toast.error({
        title: 'Missing details',
        description: 'Provide role, allocation, and a start date.' });
      return;
    }

    const value = this.collaboratorAssignmentForm.getRawValue();
    const payload = {
      projectId: project.projectId,
      empId: profile.employeeId,
      role: (value.role ?? '').trim() || profile.role || 'Contributor',
      allocationPct:
        value.allocationPct !== null && value.allocationPct !== undefined
          ? Number(value.allocationPct)
          : 0,
      assignedDate: value.assignedDate,
      isActive: 'Y' };

    this.collaboratorAssignmentProcessing.set(true);
    this.masterService.saveProjectEmp(payload as any).subscribe({
      next: () => {
        this.collaboratorAssignmentProcessing.set(false);
        this.toast.success({
          title: 'Contributor added',
          description: `${profile.employeeName} has been assigned to the project.` });
        this.cancelCollaboratorAssignment();
        this.refreshProjectSnapshot(project.projectId);
        this.loadResourceInsights(project.projectId);
      },
      error: (error) => {
        this.collaboratorAssignmentProcessing.set(false);
        this.toast.error({
          title: 'Assignment failed',
          description:
            'Unable to create the assignment right now. Please try again.' });
        console.error('[Resource] collaborator assignment failed', {
          projectId: project.projectId,
          empId: profile.employeeId,
          error });
      } });
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
        preview: value.preview ?? false })
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
    this.masterService.generateOverviewDraft(request).subscribe({
      next: (draft) => {
        this.aiProcessing.set(false);
        this.aiDraft.set(draft);
        this.aiPanelOpen.set(true);
        this.toast.success({
          title: 'AI draft ready',
          description: `Overview generated with ${draft.source.toUpperCase()}.` });
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
          description: message });
        console.error('[AI] overview generation failed', error);
      } });
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
    this.performApprovalAction('request');
  }

  approveProjectAction() {
    this.performApprovalAction('approve');
  }

  rejectProjectAction() {
    this.performApprovalAction('reject');
  }

  resetProjectApprovalAction() {
    this.performApprovalAction('reset');
  }

  submitReviewerComment() {
    if (this.reviewerCommentForm.invalid) {
      this.reviewerCommentForm.markAllAsTouched();
      this.toast.error({
        title: 'Missing details',
        description: 'Please provide a comment before submitting.' });
      return;
    }

    const project = this.currentProjectSignal();
    if (!project?.projectId) {
      return;
    }

    const payload = this.reviewerCommentForm.getRawValue();
    this.reviewerCommentProcessing.set(true);
    this.masterService
      .addReviewerComment(project.projectId, payload)
      .subscribe({
        next: (updatedProject) => {
          this.reviewerCommentProcessing.set(false);
          this.hydrateProject(updatedProject);
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
          this.toast.success({
            title: 'Comment added',
            description: 'Reviewer feedback has been logged.' });
          this.refreshProjectSnapshot(updatedProject.projectId);
        },
        error: () => {
          this.reviewerCommentProcessing.set(false);
          this.toast.error({
            title: 'Action failed',
            description: 'Unable to add reviewer comment right now.' });
          console.error('[Approval] add reviewer comment failed', {
            projectId: project.projectId,
            payload });
        } });
  }

  toggleReviewerCommentResolved(comment: IReviewerCommentEntry) {
    const project = this.currentProjectSignal();
    if (!project?.projectId) {
      return;
    }

    this.reviewerCommentProcessing.set(true);
    const payload = {
      resolved: !comment.resolved,
      ...this.buildApprovalPayload() };
    this.masterService
      .resolveReviewerComment(project.projectId, comment.id, payload)
      .subscribe({
        next: (updatedProject) => {
          this.reviewerCommentProcessing.set(false);
          this.hydrateProject(updatedProject);
          const message = comment.resolved
            ? 'Comment reopened'
            : 'Comment resolved';
          this.toast.success({
            title: message,
            description: 'Reviewer comment state has been updated.' });
          this.refreshProjectSnapshot(updatedProject.projectId);
        },
        error: () => {
          this.reviewerCommentProcessing.set(false);
          this.toast.error({
            title: 'Action failed',
            description: 'Unable to update reviewer comment right now.' });
        } });
  }

  private performApprovalAction(
    action: 'request' | 'approve' | 'reject' | 'reset'
  ) {
    const project = this.currentProjectSignal();
    if (!project?.projectId) {
      this.toast.error({
        title: 'Project not saved',
        description: 'Save the project before managing approvals.' });
      return;
    }

    const payload = this.buildApprovalPayload();
    if (action === 'reject' && !payload.comment) {
      this.toast.error({
        title: 'Provide a reason',
        description: 'Please include a short note explaining the rejection.' });
      return;
    }

    this.approvalProcessing.set(true);
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
        this.approvalProcessing.set(false);
        return;
    }

    request$.subscribe({
      next: (updatedProject) => {
        this.approvalProcessing.set(false);
        const snapshot = this.cloneProject(updatedProject);
        this.hydrateProject(snapshot);
        this.approvalForm.patchValue({ comment: '' }, { emitEvent: false });
        if (action === 'reset') {
          this.approvalForm.patchValue({ actorName: '' }, { emitEvent: false });
        }
        this.toast.success({
          title: successTitle,
          description: `Status is now ${this.approvalStatusLabel(
            snapshot.approvalStatus
          )}.` });
        this.refreshProjectSnapshot(snapshot.projectId);
      },
      error: () => {
        this.approvalProcessing.set(false);
        this.toast.error({
          title: 'Approval update failed',
          description: 'Unable to update approval status right now.' });
        console.error('[Approval] approval action failed', {
          action,
          projectId: project.projectId,
          payload });
      } });
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

  private fetchProject(id: number) {
    this.masterService.getProjectById(id).subscribe({
      next: (project) => this.hydrateProject(project),
      error: () => {
        this.isLoadingSignal.set(false);
        this.toast.error({
          title: 'Load failed',
          description: 'Unable to load project details. Please retry.' });
        this.router.navigate(['/projects']);
      } });
  }

  private loadEmployees() {
    this.masterService.getAllEmp().subscribe({
      next: (employees) => {
        this.employeesSignal.set(employees ?? []);
        this.applyDefaultApprovalActor();
      } });
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

  private hydrateProject(project: IProject | null) {
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
      this.loadResourceInsights(snapshot.projectId);
    } else {
      this.resourceInsightsSignal.set(null);
    }
    this.isLoadingSignal.set(false);
  }

  private refreshProjectSnapshot(projectId: number | null | undefined) {
    if (!projectId) {
      return;
    }
    this.masterService.getProjectById(projectId).subscribe({
      next: (project) => this.hydrateProject(project),
      error: (error) => {
        this.toast.error({
          title: 'Refresh failed',
          description:
            'Unable to refresh the project data at the moment. Try again shortly.' });
        console.error('[Approval] refreshProjectSnapshot failed', {
          projectId,
          error });
      } });
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
  | 'leadByEmpId'
  | 'contactPerson'
  | 'contactNo'
  | 'emailId';
