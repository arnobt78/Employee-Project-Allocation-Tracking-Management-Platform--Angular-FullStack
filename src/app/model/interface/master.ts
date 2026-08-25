export interface IApiResponse<T = unknown> {
  message: string;
  result: boolean;
  data: T;
}

export interface AuthUser {
  username: string;
  role: string;
  displayName?: string | null;
}

export interface DemoAccount {
  id: string;
  label: string;
  username: string;
  role?: string;
}

export interface IAuditMetadata {
  createdBy?: number | string;
  createdAt?: string;
  updatedBy?: number | string;
  updatedAt?: string;
  source?: 'ui' | 'api' | 'automation';
  correlationId?: string;
}

export interface IStatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: number | string;
  changedByName?: string;
  comment?: string;
  attachments?: IProjectDocument[];
  metadata?: Record<string, unknown>;
  previousStatus?: string;
  note?: string;
}

export interface ITimelineEntry {
  id: string;
  label: string;
  description?: string;
  state: 'completed' | 'in-progress' | 'blocked' | 'upcoming';
  occurredAt: string;
  dueAt?: string;
  assigneeIds?: number[];
  supportingDocs?: IProjectDocument[];
  status?: string;
  actorId?: number | string;
  actorName?: string;
}

export interface IReviewerComment {
  section: string;
  comment: string;
  reviewerId: number;
  reviewerName?: string;
  createdAt: string;
  severity?: 'info' | 'warning' | 'critical';
  suggestions?: string[];
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: number | string;
}

export type ReadinessStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'done';

export interface IReadinessChecklistItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  weight: number;
  status: ReadinessStatus;
  ownerId?: number | null;
  ownerName?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  statusUpdatedAt?: string;
  lastUpdatedBy?: number | string;
}

export interface IReadinessChecklistState {
  items: IReadinessChecklistItem[];
  totalWeight: number;
  completedWeight: number;
  percent: number;
  updatedAt: string;
  updatedBy?: number | string;
  summary?: string;
}

export type ApprovalStatus = 'draft' | 'in_review' | 'approved' | 'rejected';

export interface IApprovalAction {
  actorId?: number;
  actorName?: string;
  comment?: string;
  nextStatus?: ApprovalStatus;
}

export interface IReviewerCommentEntry extends IReviewerComment {
  id: string;
}

export interface IProjectDocument {
  id: string;
  name: string;
  url: string;
  type?: string;
  description?: string;
  uploadedAt: string;
  uploadedBy?: number | string;
  tags?: string[];
  folder?: string;
  externalSystem?: string;
}

export type ResourceLoadStatus = 'available' | 'limited' | 'overbooked';

export interface IResourceAllocationSummary {
  capacityPct: number;
  allocatedPct: number;
  availablePct: number;
  status: ResourceLoadStatus;
  activeAssignments: number;
}

export interface IResourceAssignmentDigest {
  projectId: number;
  projectName?: string;
  role?: string;
  allocationPct?: number | null;
  isCurrentProject?: boolean;
  isActive?: boolean;
  assignedDate?: string;
}

export interface IResourceProfile {
  employeeId: number;
  employeeName: string;
  role?: string;
  title?: string;
  department?: string;
  location?: string;
  timezone?: string;
  employmentType?: string;
  skills: string[];
  tags: string[];
  certifications: string[];
  allocation: IResourceAllocationSummary;
  activeAssignments: IResourceAssignmentDigest[];
  lastActiveAt?: string;
  isActive?: boolean;
  fitScore?: number;
  fitNotes?: string;
}

export interface IProjectResourceAssignment {
  empProjectId: number;
  role?: string;
  allocationPct?: number | null;
  allocationStatus: ResourceLoadStatus;
  isActive: boolean;
  assignedDate?: string;
  employee: IResourceProfile;
}

export interface IProjectResourceMetrics {
  benchCount: number;
  overbookedCount: number;
  averageAllocation: number;
  activeAssignmentCount: number;
  teamSize: number;
}

export interface IProjectResourceInsights {
  projectId: number;
  projectName: string;
  retrievedAt: string;
  resourcesPlan?: Record<string, unknown> | null;
  lead: IResourceProfile | null;
  assignments: IProjectResourceAssignment[];
  recommendedLeads: IResourceProfile[];
  recommendedCollaborators: IResourceProfile[];
  metrics: IProjectResourceMetrics;
}

export interface IContentfulBrief {
  entryId: string | null;
  title?: string | null;
  overview?: IProjectOverview;
  raw?: unknown;
}

export interface IAiOverviewDraft {
  source: 'gemini' | 'groq';
  overview: IProjectOverview;
  raw?: string;
  prompt?: string;
}

export interface IGenerateOverviewDraftRequest {
  project?: Partial<IProject>;
  readiness?: IReadinessChecklistState | null;
  assignments?: Array<{
    employeeName?: string;
    role?: string;
    allocationPct?: number | null;
    allocationStatus?: ResourceLoadStatus | null;
  }>;
}

export interface IExternalIntegrationReference {
  provider: 'contentful' | 'notion' | 'drive' | 'sharepoint' | 'confluence' | 'custom';
  referenceId: string;
  label?: string;
  syncStatus?: 'idle' | 'syncing' | 'error';
  lastSyncedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface IProjectOverview {
  summary: string;
  objectives: string[];
  successCriteria: string[];
  stakeholderNotes?: string;
  personas?: string[];
  aiDraftSource?: 'gemini' | 'groq' | 'openrouter' | 'manual' | 'contentful';
  aiDraftGeneratedAt?: string;
  aiDraftConfidence?: number;
  cmsEntryId?: string;
  cmsEntryTitle?: string;
}

export interface ILeadershipAssignment {
  leadByEmpId?: number;
  sponsorEmpId?: number;
  advisors?: number[];
  reviewers?: number[];
  escalationContacts?: number[];
}

export interface IContactProfile {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  organization?: string;
  preferredChannel?: 'email' | 'phone' | 'slack' | 'teams';
  notes?: string;
}

export interface IParentDept {
  departmentId: number;
  departmentName: string;
  departmentLogo: string;
  description?: string;
  leadContact?: string;
  leadEmail?: string;
  leadPhone?: string;
}

export interface IChildDept {
  childDeptId: number;
  departmentName: string;
  parentDeptId: number;
  description?: string;
}

export interface IProjectEmployee {
  empProjectId: number;
  projectId: number;
  empId: number;
  assignedDate: string;
  role: string;
  isActive: string;
  projectName: string;
  employeeName: string;
  employeeAvatarUrl?: string | null;
  allocationPct?: number;
  billable?: boolean;
  billingRate?: number;
  costRate?: number;
  notes?: string;
  responsibilities?: string[];
  skillsApplied?: string[];
  toolsUsed?: string[];
  schedule?: Record<string, unknown>;
  contribution?: Record<string, unknown>;
  unassignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IProject {
  projectId: number;
  projectName: string;
  clientName: string;
  startDate: string;
  leadByEmpId: number;
  contactPerson: string;
  contactNo: string;
  emailId: string;
  employeeName: string;
  clientIndustry?: string;
  endDate?: string;
  sponsorEmpId?: number;
  contactProfile?: IContactProfile;
  contactTitle?: string;
  contactNotes?: string;
  overview?: IProjectOverview;
  scope?: Record<string, unknown>;
  successMetrics?: string[];
  status?: string;
  statusReason?: string;
  statusHistory?: IStatusHistoryEntry[];
  timeline?: ITimelineEntry[];
  milestones?: ITimelineEntry[];
  categories?: string[];
  tags?: string[];
  focusAreas?: string[];
  blockers?: string[];
  risks?: Array<Record<string, unknown>>;
  riskRegister?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  financials?: Record<string, unknown>;
  resourcesPlan?: Record<string, unknown>;
  readinessChecklist?: IReadinessChecklistState;
  readinessScore?: number;
  approvalStatus?: ApprovalStatus;
  approvalRequestedAt?: string;
  approvalRequestedBy?: number;
  approvalResolvedAt?: string;
  approvalResolvedBy?: number;
  approvalReason?: string;
  approvalNotes?: Record<string, unknown>;
  reviewerComments?: IReviewerCommentEntry[];
  progress?: number;
  health?: string;
  documents?: IProjectDocument[];
  externalLinks?: Array<{ label: string; url: string }>;
  aiGeneratedInsights?: Record<string, unknown>;
  cmsContentRefs?: IExternalIntegrationReference[];
  lastSyncedAt?: string;
  stageGate?: Record<string, unknown>;
  governance?: Record<string, unknown>;
  communicationPlan?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
  audit?: IAuditMetadata;
}

// Add the Employee interface here
export interface Employee {
  employeeId: number;
  employeeName: string;
  contactNo: string;
  emailId: string;
  deptId: number;
  password: string;
  gender: string;
  role: string;
  department: string; // Ensure this property is included
  title?: string;
  avatarUrl?: string;
  location?: string;
  timezone?: string;
  employmentType?: string;
  managerId?: number;
  hireDate?: string;
  bio?: string;
  about?: string;
  notes?: string;
  tags?: string[];
  skills?: string[];
  certifications?: string[];
  interests?: string[];
  languages?: string[];
  socialLinks?: Record<string, string>;
  workPreferences?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  performanceSnapshot?: Record<string, unknown>;
  documents?: Array<Record<string, unknown>>;
  customFields?: Record<string, unknown>;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
  audit?: IAuditMetadata;
}

export type SectionId = 'overview' | 'team' | 'contact' | 'approval';

