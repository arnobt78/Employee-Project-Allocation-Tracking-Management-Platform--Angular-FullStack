import {
  deletedProjectDescription,
  deleteProjectWarning,
  inArchiveView,
  isAssignmentArchived,
  isProjectArchived,
  parseArchiveView,
  projectCounts,
  projectCountsLabel,
} from './project-archive';

describe('project archive helpers', () => {
  const projects = [
    { projectId: 1 },
    { projectId: 2, archivedAt: '2026-01-01T00:00:00.000Z' },
    { projectId: 3, archivedAt: null },
    { projectId: 4, archivedAt: '' },
  ];

  it('treats only a set archivedAt as archived', () => {
    expect(projects.map(isProjectArchived)).toEqual([false, true, false, false]);
    expect(isProjectArchived(null)).toBeFalse();
    expect(isAssignmentArchived({ projectArchivedAt: '2026-01-01' })).toBeTrue();
    expect(isAssignmentArchived({ projectArchivedAt: null })).toBeFalse();
  });

  it('counts active and archived with one rule and labels them', () => {
    const counts = projectCounts(projects);
    expect(counts).toEqual({ active: 3, archived: 1, total: 4 });
    expect(projectCountsLabel(counts)).toBe('3 Active · 1 Archived');
    expect(projectCounts([])).toEqual({ active: 0, archived: 0, total: 0 });
  });

  it('describes a permanent delete before and after it happens', () => {
    expect(deleteProjectWarning(3)).toContain('its 3 team assignments');
    expect(deleteProjectWarning(1)).toContain('its 1 team assignment,');
    expect(deleteProjectWarning(0)).toBe(
      'This permanently deletes the project. This cannot be undone. Archive it instead to keep it restorable.'
    );
    expect(deleteProjectWarning(null)).toContain('all of its team assignments');
    expect(deletedProjectDescription('Apollo', { data: { deletedAssignments: 2 } })).toBe(
      'Apollo and 2 assignments were permanently deleted.'
    );
    expect(deletedProjectDescription('Apollo', { data: null })).toBe(
      'Apollo was permanently deleted.'
    );
  });

  it('parses the view query and filters by it', () => {
    expect(parseArchiveView('archived')).toBe('archived');
    expect(parseArchiveView('ARCHIVED')).toBe('active');
    expect(parseArchiveView(null)).toBe('active');
    expect(inArchiveView(projects, 'archived', isProjectArchived).map((p) => p.projectId)).toEqual([2]);
    expect(inArchiveView(projects, 'active', isProjectArchived).map((p) => p.projectId)).toEqual([
      1, 3, 4,
    ]);
  });
});
