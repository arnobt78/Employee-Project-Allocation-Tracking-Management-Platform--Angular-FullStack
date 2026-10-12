import type { ArchiveView } from '@/app/constants/tabs';

/** Archived projects keep their data but drop out of schedules, capacity and insights. */
export function isProjectArchived(project: { archivedAt?: string | null } | null | undefined): boolean {
  return !!project?.archivedAt;
}

/** An assignment is archived with its project (`projectArchivedAt` comes from the API). */
export function isAssignmentArchived(
  assignment: { projectArchivedAt?: string | null } | null | undefined
): boolean {
  return !!assignment?.projectArchivedAt;
}

export interface ProjectCounts {
  active: number;
  archived: number;
  total: number;
}

/** The one counting rule every page uses: "Projects" means non-archived. */
export function projectCounts(
  projects: ReadonlyArray<{ archivedAt?: string | null }>
): ProjectCounts {
  const archived = projects.filter(isProjectArchived).length;
  return { active: projects.length - archived, archived, total: projects.length };
}

export function projectCountsLabel(counts: ProjectCounts): string {
  return `${counts.active} Active · ${counts.archived} Archived`;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Confirm copy for a permanent delete; `assignmentCount` is null when the team is not loaded yet. */
export function deleteProjectWarning(assignmentCount: number | null): string {
  const what =
    assignmentCount === 0
      ? 'This permanently deletes the project.'
      : `This permanently deletes the project and ${
          assignmentCount === null
            ? 'all of its team assignments'
            : `its ${plural(assignmentCount, 'team assignment')}`
        }, freeing their allocation.`;
  return `${what} This cannot be undone. Archive it instead to keep it restorable.`;
}

/** Success copy built from the API's `{ data: { deletedAssignments } }`. */
export function deletedProjectDescription(
  projectName: string,
  response: { data?: unknown } | null | undefined
): string {
  const count = Number((response?.data as { deletedAssignments?: unknown } | null)?.deletedAssignments);
  return Number.isFinite(count) && count > 0
    ? `${projectName} and ${plural(count, 'assignment')} were permanently deleted.`
    : `${projectName} was permanently deleted.`;
}

/** `?view=archived` selects the Archived tab; anything else is Active. */
export function parseArchiveView(value: string | null | undefined): ArchiveView {
  return value === 'archived' ? 'archived' : 'active';
}

export function inArchiveView<T>(
  items: readonly T[],
  view: ArchiveView,
  isArchived: (item: T) => boolean
): T[] {
  return items.filter((item) => isArchived(item) === (view === 'archived'));
}
