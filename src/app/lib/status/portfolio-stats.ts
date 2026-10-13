import { isAssignmentArchived, isProjectArchived } from './project-archive';

/**
 * Portfolio KPIs shared by Dashboard, Projects, Project Team and Insights so a
 * label means the same number on every page. Archived projects never count as
 * in flight, planning, on hold or staffed.
 */

type StatusSource = { status?: string | null; approvalStatus?: string | null };
type ProjectLike = StatusSource & {
  projectId: number;
  archivedAt?: string | null;
  leadByEmpId?: number | null;
};
type AssignmentLike = {
  projectId: number;
  empId?: number | null;
  employeeName?: string | null;
  isActive?: string | boolean | null;
  projectArchivedAt?: string | null;
};

type EmployeeLike = { employeeId: number; isActive?: boolean | null };

const IN_FLIGHT_STATUSES = new Set(['approved', 'active', 'in_review', 'in progress', 'in_progress']);
const PLANNING_STATUSES = new Set(['draft', 'planning', 'proposed']);
const ON_HOLD_STATUSES = new Set(['on_hold', 'on hold', 'paused', 'hold']);

/** Lower-cased delivery status, falling back to the approval status. */
export function normalizedProjectStatus(project: StatusSource): string {
  return (project.status || project.approvalStatus || '').trim().toLowerCase();
}

export type ProjectStatusBucket = 'inFlight' | 'planning' | 'onHold';

/** The one status rule: which KPI bucket a project's status falls in, if any. */
export function projectStatusBucket(project: StatusSource): ProjectStatusBucket | null {
  const status = normalizedProjectStatus(project);
  if (IN_FLIGHT_STATUSES.has(status)) return 'inFlight';
  if (PLANNING_STATUSES.has(status)) return 'planning';
  if (ON_HOLD_STATUSES.has(status)) return 'onHold';
  return null;
}

/** Employees without an explicit `isActive: false` count as active. */
export function isEmployeeActive(employee: { isActive?: boolean | null }): boolean {
  return employee.isActive !== false;
}

/** Assignment `isActive` arrives as `'Y'`/`'N'` (or legacy booleans/strings). */
export function isAssignmentActive(value: string | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return typeof value === 'string' && ['y', 'yes', 'true', '1'].includes(value.trim().toLowerCase());
}

/** Distinct, case-insensitive, non-blank values. */
export function uniqueCount<T>(items: readonly T[], pick: (item: T) => string | null | undefined): number {
  const seen = new Set<string>();
  for (const item of items) {
    const raw = pick(item)?.trim();
    if (raw) {
      seen.add(raw.toLowerCase());
    }
  }
  return seen.size;
}

/** KPI subtitle parts joined with " · ", skipping empty parts. */
export function dotJoin(parts: ReadonlyArray<string | null | undefined | false>): string {
  return parts.filter(Boolean).join(' · ');
}

export interface ProjectStatusBuckets {
  inFlight: number;
  planning: number;
  onHold: number;
}

export function projectStatusBuckets(projects: readonly ProjectLike[]): ProjectStatusBuckets {
  const buckets: ProjectStatusBuckets = { inFlight: 0, planning: 0, onHold: 0 };
  for (const project of projects) {
    const bucket = isProjectArchived(project) ? null : projectStatusBucket(project);
    if (bucket) {
      buckets[bucket] += 1;
    }
  }
  return buckets;
}

export interface AssignmentCounts {
  total: number;
  onActiveProjects: number;
  active: number;
  inactive: number;
  archived: number;
}

/** `active` / `inactive` cover assignments on non-archived projects only. */
export function assignmentCounts(assignments: readonly AssignmentLike[]): AssignmentCounts {
  let archived = 0;
  let active = 0;
  for (const assignment of assignments) {
    if (isAssignmentArchived(assignment)) {
      archived += 1;
    } else if (isAssignmentActive(assignment.isActive)) {
      active += 1;
    }
  }
  const onActiveProjects = assignments.length - archived;
  return {
    total: assignments.length,
    onActiveProjects,
    active,
    inactive: onActiveProjects - active,
    archived,
  };
}

export function assignmentCountsLabel(counts: AssignmentCounts): string {
  return dotJoin([`${counts.active} Active`, `${counts.inactive} Inactive`, `${counts.archived} Archived`]);
}

const assigneeKey = (assignment: AssignmentLike) =>
  assignment.empId ? String(assignment.empId) : assignment.employeeName;

/** Distinct people on non-archived projects (any assignment state). */
export function uniqueAssignees(assignments: readonly AssignmentLike[]): number {
  return uniqueCount(
    assignments.filter((assignment) => !isAssignmentArchived(assignment)),
    assigneeKey
  );
}

export interface WorkforceCounts {
  total: number;
  /** Has an active assignment on a non-archived project. */
  assigned: number;
  /** Active employees with no such assignment. */
  available: number;
}

export function workforceCounts(
  employees: readonly EmployeeLike[],
  assignments: readonly AssignmentLike[]
): WorkforceCounts {
  const booked = new Set(
    assignments
      .filter((assignment) => !isAssignmentArchived(assignment) && isAssignmentActive(assignment.isActive))
      .map((assignment) => assignment.empId)
  );
  const counts: WorkforceCounts = { total: employees.length, assigned: 0, available: 0 };
  for (const employee of employees) {
    if (booked.has(employee.employeeId)) {
      counts.assigned += 1;
    } else if (isEmployeeActive(employee)) {
      counts.available += 1;
    }
  }
  return counts;
}

export function workforceCountsLabel(counts: WorkforceCounts): string {
  return dotJoin([`${counts.assigned} Assigned`, `${counts.available} Available`]);
}

/** Allocation percentage points as people, one decimal: 220 → 2.2. */
export function allocationToPeople(allocationPct: number): number {
  return Math.round((allocationPct || 0) / 10) / 10;
}

export function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

export interface StaffingCounts {
  staffed: number;
  leadOnly: number;
  unstaffed: number;
}

/** Staffed: an active assignment. Lead Only: a lead but no active assignment. */
export function staffingCounts(
  projects: readonly ProjectLike[],
  assignments: readonly AssignmentLike[]
): StaffingCounts {
  const staffedIds = new Set(
    assignments
      .filter((assignment) => !isAssignmentArchived(assignment) && isAssignmentActive(assignment.isActive))
      .map((assignment) => assignment.projectId)
  );
  const counts: StaffingCounts = { staffed: 0, leadOnly: 0, unstaffed: 0 };
  for (const project of projects) {
    if (isProjectArchived(project)) {
      continue;
    }
    if (staffedIds.has(project.projectId)) {
      counts.staffed += 1;
    } else if (project.leadByEmpId) {
      counts.leadOnly += 1;
    } else {
      counts.unstaffed += 1;
    }
  }
  return counts;
}

export function staffingCountsLabel(counts: StaffingCounts): string {
  return dotJoin([`${counts.staffed} Staffed`, `${counts.leadOnly} Lead Only`, `${counts.unstaffed} Unstaffed`]);
}
