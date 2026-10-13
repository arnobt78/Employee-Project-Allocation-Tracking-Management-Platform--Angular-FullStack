import {
  allocationToPeople,
  assignmentCounts,
  assignmentCountsLabel,
  dotJoin,
  isAssignmentActive,
  isEmployeeActive,
  normalizedProjectStatus,
  peopleLabel,
  projectStatusBucket,
  projectStatusBuckets,
  staffingCounts,
  staffingCountsLabel,
  uniqueAssignees,
  uniqueCount,
  workforceCounts,
  workforceCountsLabel,
} from './portfolio-stats';

const ARCHIVED_AT = '2026-01-01T00:00:00.000Z';

describe('portfolio stats', () => {
  const projects = [
    { projectId: 1, status: 'Active', leadByEmpId: 10 },
    { projectId: 2, status: 'in_review', leadByEmpId: 11 },
    { projectId: 3, status: 'draft', leadByEmpId: 12 },
    { projectId: 4, status: 'on_hold', leadByEmpId: 0 },
    { projectId: 5, status: 'active', leadByEmpId: 13, archivedAt: ARCHIVED_AT },
    { projectId: 6, approvalStatus: 'planning', leadByEmpId: 0 },
  ];
  const assignments = [
    { projectId: 1, empId: 10, isActive: 'Y' },
    { projectId: 1, empId: 20, isActive: 'Y' },
    { projectId: 2, empId: 20, isActive: 'N' },
    { projectId: 4, empId: 30, isActive: 'Y' },
    { projectId: 5, empId: 40, isActive: 'Y', projectArchivedAt: ARCHIVED_AT },
  ];

  it('normalizes status and active flags', () => {
    expect(normalizedProjectStatus({ status: ' Active ' })).toBe('active');
    expect(normalizedProjectStatus({ approvalStatus: 'Draft' })).toBe('draft');
    expect(normalizedProjectStatus({})).toBe('');
    expect(['Y', 'yes', 'TRUE', '1', true].map(isAssignmentActive)).toEqual([true, true, true, true, true]);
    expect(['N', '', 'false', null, undefined, false].map(isAssignmentActive)).toEqual([
      false, false, false, false, false, false,
    ]);
  });

  it('buckets non-archived projects by status, like the Projects page', () => {
    expect(projectStatusBuckets(projects)).toEqual({ inFlight: 2, planning: 2, onHold: 1 });
    expect(projectStatusBuckets([])).toEqual({ inFlight: 0, planning: 0, onHold: 0 });
  });

  it('splits assignments into active, inactive and archived', () => {
    const counts = assignmentCounts(assignments);
    expect(counts).toEqual({ total: 5, onActiveProjects: 4, active: 3, inactive: 1, archived: 1 });
    expect(assignmentCountsLabel(counts)).toBe('3 Active · 1 Inactive · 1 Archived');
  });

  it('counts people on active projects in any assignment state', () => {
    expect(uniqueAssignees(assignments)).toBe(3);
    expect(uniqueAssignees([{ projectId: 1, empId: 20, isActive: 'N' }])).toBe(1);
    expect(uniqueAssignees([{ projectId: 1, empId: 0, employeeName: 'Ann' }])).toBe(1);
  });

  it('buckets a single status with the shared rule', () => {
    expect(projectStatusBucket({ approvalStatus: 'approved' })).toBe('inFlight');
    expect(projectStatusBucket({ status: 'Proposed' })).toBe('planning');
    expect(projectStatusBucket({ status: 'paused' })).toBe('onHold');
    expect(projectStatusBucket({ status: 'completed' })).toBeNull();
  });

  it('splits the workforce into assigned and available with one rule', () => {
    const employees = [
      { employeeId: 10 },
      { employeeId: 20, isActive: true },
      { employeeId: 30, isActive: false },
      { employeeId: 40 },
      { employeeId: 50, isActive: false },
    ];
    const team = [
      { projectId: 1, empId: 10, isActive: 'Y' },
      { projectId: 2, empId: 20, isActive: 'N' },
      { projectId: 1, empId: 30, isActive: 'Y' },
      { projectId: 5, empId: 40, isActive: 'Y', projectArchivedAt: ARCHIVED_AT },
    ];
    const counts = workforceCounts(employees, team);
    expect(counts).toEqual({ total: 5, assigned: 2, available: 2 });
    expect(workforceCountsLabel(counts)).toBe('2 Assigned · 2 Available');
    expect(isEmployeeActive({})).toBeTrue();
    expect(isEmployeeActive({ isActive: false })).toBeFalse();
  });

  it('converts allocation points to people', () => {
    expect(allocationToPeople(220)).toBe(2.2);
    expect(allocationToPeople(500)).toBe(5);
    expect(allocationToPeople(0)).toBe(0);
    expect(peopleLabel(2.2)).toBe('2.2 people');
    expect(peopleLabel(1)).toBe('1 person');
  });

  it('classifies staffing of non-archived projects', () => {
    const counts = staffingCounts(projects, assignments);
    expect(counts).toEqual({ staffed: 2, leadOnly: 2, unstaffed: 1 });
    expect(staffingCountsLabel(counts)).toBe('2 Staffed · 2 Lead Only · 1 Unstaffed');
  });

  it('joins subtitle parts and counts distinct values', () => {
    expect(dotJoin(['4 Active', null, '', false, '1 Archived'])).toBe('4 Active · 1 Archived');
    expect(uniqueCount(['A', 'a', ' b ', '', null], (value) => value)).toBe(2);
  });
});
