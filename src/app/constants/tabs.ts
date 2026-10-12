/** Underlined tab row shared by every tabbed page (Insights, Timeline, API Doc/Status, Projects, Project Team). */
export const TAB_ACTIVE_CLASS =
  'inline-flex items-center gap-2 border-b-2 border-primary px-4 py-2 text-sm font-medium text-primary';

export const TAB_IDLE_CLASS =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white';

export const TAB_ROW_CLASS = 'flex gap-2 overflow-x-auto border-b border-white/10';

export type ArchiveView = 'active' | 'archived';

export const ARCHIVE_VIEW_TABS: ReadonlyArray<{ id: ArchiveView; label: string; icon: string }> = [
  { id: 'active', label: 'Active', icon: 'folder-open' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
];
