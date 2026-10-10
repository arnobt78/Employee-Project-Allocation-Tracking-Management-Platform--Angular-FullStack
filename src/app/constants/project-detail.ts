import type { SectionId } from '@/app/model/interface/master';

export const PROJECT_DETAIL_SUBTITLE =
  'Configure the essentials before rolling the project out to your teams. Organize the information into focused sections, edit inline, and save when you are ready.';

export const READINESS_TASK_DEFINITIONS = [
  {
    id: 'scopeDefined',
    title: 'Scope confirmed',
    description: 'Requirements baseline captured and shared with stakeholders.',
    category: 'Scope',
    weight: 25,
    defaultDueInDays: 7,
  },
  {
    id: 'budgetApproved',
    title: 'Budget approved',
    description: 'Finance sign-off received for the projected spend.',
    category: 'Budget',
    weight: 20,
    defaultDueInDays: 14,
  },
  {
    id: 'legalReviewed',
    title: 'Contracts reviewed',
    description: 'Master services agreement and NDAs cleared with legal.',
    category: 'Legal',
    weight: 20,
    defaultDueInDays: 21,
  },
  {
    id: 'assetsPrepared',
    title: 'Assets prepared',
    description: 'Brand assets, data rooms, and collateral ready to share.',
    category: 'Assets',
    weight: 15,
    defaultDueInDays: 10,
  },
  {
    id: 'kickoffScheduled',
    title: 'Kickoff scheduled',
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

export const PROJECT_DETAIL_FOOTER_COPY = {
  autosave:
    'Changes are auto-populated into the preview cards as you type. Remember to save a section after editing.',
  archive:
    'Need to archive this project? You can remove it safely from the workspace below.',
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
