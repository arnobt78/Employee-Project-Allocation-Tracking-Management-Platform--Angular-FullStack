import { ApiHttpMethod } from '@/app/model/interface/master';
import type { StatusTone } from '@/app/lib/status/project-status';

/** Static API Documentation copy shared by the live page and its loading mirror. */
export const API_DOC_METHOD_TABS: readonly ApiHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
];

export const API_DOC_METHOD_ICONS: Record<ApiHttpMethod, string> = {
  GET: 'download',
  POST: 'plus',
  PUT: 'pencil',
  DELETE: 'trash-2',
};

export const API_DOC_TAB_ACTIVE_CLASS =
  'inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';
export const API_DOC_TAB_IDLE_CLASS =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';

export const API_DOC_CHIP_ACTIVE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/20 px-3 py-1 text-xs font-medium text-primary';
export const API_DOC_CHIP_IDLE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white';

export const API_DOC_CATEGORY_META: Record<string, { icon: string; tone: StatusTone }> = {
  Employees: { icon: 'users', tone: 'sky' },
  Projects: { icon: 'folder-kanban', tone: 'violet' },
  Assignments: { icon: 'briefcase', tone: 'emerald' },
  Departments: { icon: 'building-2', tone: 'sky' },
  Approvals: { icon: 'badge-check', tone: 'amber' },
  Dashboard: { icon: 'layout-dashboard', tone: 'rose' },
  Schedule: { icon: 'calendar-days', tone: 'emerald' },
  Content: { icon: 'file-text', tone: 'amber' },
  AI: { icon: 'sparkles', tone: 'violet' },
};

export const API_DOC_DEFAULT_CATEGORY = { icon: 'tag', tone: 'neutral' as StatusTone };

export const API_DOC_SECTION_ICONS = {
  info: 'info',
  baseUrl: 'link',
  version: 'tag',
  parameters: 'list-filter',
  requestBody: 'file-text',
  response: 'circle-check',
  errors: 'circle-alert',
  allCategories: 'layers',
  empty: 'search',
} as const;

export const API_DOC_COPY = {
  versionPill: 'Version',
  baseUrl: 'Base URL:',
  version: 'Version:',
  allCategories: 'All Categories',
  copyUrl: 'Copy URL',
  retry: 'Retry',
  parameters: 'Parameters',
  requestBody: 'Request Body',
  response: 'Response',
  errorResponses: 'Error Responses',
  required: 'Required',
  optional: 'Optional',
  empty: 'No endpoints found for the selected method and category.',
  copiedTitle: 'Copied',
  copyFailedTitle: "Couldn't copy URL",
  copyFailedDescription: 'Clipboard access was blocked by the browser.',
} as const;
