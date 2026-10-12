import type { SectionId } from '@/app/model/interface/master';

export const PROJECT_DETAIL_SUBTITLE =
  'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.';

export const READINESS_TASK_DEFINITIONS = [
  {
    id: 'scopeDefined',
    title: 'Scope Confirmed',
    description: 'Requirements baseline captured and shared with stakeholders.',
    category: 'Scope',
    weight: 25,
    defaultDueInDays: 7,
  },
  {
    id: 'budgetApproved',
    title: 'Budget Approved',
    description: 'Finance sign-off received for the projected spend.',
    category: 'Budget',
    weight: 20,
    defaultDueInDays: 14,
  },
  {
    id: 'legalReviewed',
    title: 'Contracts Reviewed',
    description: 'Master services agreement and NDAs cleared with legal.',
    category: 'Legal',
    weight: 20,
    defaultDueInDays: 21,
  },
  {
    id: 'assetsPrepared',
    title: 'Assets Prepared',
    description: 'Brand assets, data rooms, and collateral ready to share.',
    category: 'Assets',
    weight: 15,
    defaultDueInDays: 10,
  },
  {
    id: 'kickoffScheduled',
    title: 'Kickoff Scheduled',
    description: 'Kickoff meeting on calendar with internal and client teams.',
    category: 'Timeline',
    weight: 20,
    defaultDueInDays: 28,
  },
] as const;

export const READINESS_CHECKLIST_COPY = {
  title: 'Readiness Checklist',
  subtitle: 'Confirm essentials before project kickoff',
} as const;

export const READINESS_FIELD_LABELS = {
  status: 'Project Status',
  owner: 'Project Owner',
  dueDate: 'Due Date',
  notes: 'Notes (Optional)',
} as const;

export const PROJECT_DETAIL_SECTION_LABELS: Record<SectionId, string> = {
  overview: 'Project Overview',
  team: 'Leadership',
  contact: 'Client Contact',
  approval: 'Approval Process',
};

export const PROJECT_DETAIL_SECTION_ICONS: Record<SectionId, string> = {
  overview: 'folder-kanban',
  team: 'shield-user',
  contact: 'contact',
  approval: 'shield-check',
};

/** Lucide icon shown beside each field label (shared by edit forms and read tiles). */
export const PROJECT_DETAIL_FIELD_ICONS = {
  status: 'circle-dot',
  owner: 'user',
  dueDate: 'calendar',
  notes: 'file-text',
  projectName: 'folder-kanban',
  clientName: 'building-2',
  startDate: 'calendar-days',
  health: 'activity',
  summary: 'file-text',
  objectives: 'target',
  successCriteria: 'circle-check',
  stakeholderNotes: 'users',
  lead: 'shield-user',
  contactPerson: 'contact',
  contactNo: 'phone',
  emailId: 'mail',
  role: 'briefcase',
  allocation: 'chart-column',
  assignedDate: 'calendar',
  actor: 'user',
  externalApprover: 'id-card',
  comment: 'message-square-plus',
  section: 'list-checks',
  severity: 'triangle-alert',
  reviewer: 'user',
  entryId: 'hash',
  contentType: 'tag',
  slug: 'link',
} as const;

export const PROJECT_DETAIL_FOOTER_COPY = {
  autosave:
    'Changes are auto-populated into the preview cards as you type. Remember to save a section after editing.',
  archive:
    'Archive keeps the project and its team restorable; Delete Permanently removes both for good.',
  archived:
    'This project is archived and hidden from Timeline, Calendar, Insights and capacity. Restore it to edit its team again.',
} as const;

export interface ProjectDetailConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
  icon: string;
  busyLabel: string;
}

export const PROJECT_DETAIL_CONFIRM_COPY = {
  restore: (projectName: string): ProjectDetailConfirmCopy => ({
    title: `Restore ${projectName}?`,
    description:
      'The project and its team return to the Active tab, Timeline, Calendar, Insights and capacity.',
    confirmLabel: 'Restore Project',
    icon: 'archive-restore',
    busyLabel: 'Restoring…',
  }),
  assign: (
    employeeName: string,
    projectName: string,
    allocationPct: number
  ): ProjectDetailConfirmCopy => ({
    title: `Add ${employeeName} To The Team?`,
    description: `${employeeName} is assigned to ${projectName} at ${allocationPct}% allocation. Their capacity and the Project Team list update right away.`,
    confirmLabel: 'Add Assignment',
    icon: 'plus',
    busyLabel: 'Assigning…',
  }),
  comment: (projectName: string): ProjectDetailConfirmCopy => ({
    title: 'Post Reviewer Comment?',
    description: `The comment is added to ${projectName}'s review log and stays in the audit trail.`,
    confirmLabel: 'Add Comment',
    icon: 'message-square-plus',
    busyLabel: 'Posting…',
  }),
  resolve: (resolved: boolean): ProjectDetailConfirmCopy =>
    resolved
      ? {
          title: 'Reopen This Comment?',
          description: 'The comment is marked Open again and needs follow-up.',
          confirmLabel: 'Reopen Comment',
          icon: 'rotate-ccw',
          busyLabel: 'Updating…',
        }
      : {
          title: 'Mark This Comment As Resolved?',
          description: 'The comment is marked Resolved. You can reopen it later.',
          confirmLabel: 'Mark as Resolved',
          icon: 'circle-check',
          busyLabel: 'Updating…',
        },
} as const;

export const PROJECT_OVERVIEW_FIELD_LABELS = {
  projectName: 'Project Name',
  clientName: 'Client Name',
  startDate: 'Start Date',
  health: 'Health',
  summary: 'Project Summary',
  objectives: 'Project Objectives',
  successCriteria: 'Success Criteria',
  stakeholderNotes: 'Stakeholder Notes',
} as const;

export const PROJECT_CONTENT_HELPER_COPY = {
  title: 'Content Helper',
  description:
    'Pull the latest brief from Contentful or let AI draft a first pass for you.',
  fetchContentful: 'Fetch from Contentful',
  generateAiDraft: 'Generate AI Draft',
} as const;

/** Section header values a brand-new (empty) project displays. */
export const PROJECT_CREATE_SECTION_VALUES: Record<SectionId, string> = {
  overview: 'None',
  team: 'Unassigned',
  contact: 'Not assigned',
  approval: 'Draft',
};

export const PROJECT_DETAIL_SECTION_ORDER: readonly SectionId[] = [
  'overview',
  'team',
  'contact',
  'approval',
];
