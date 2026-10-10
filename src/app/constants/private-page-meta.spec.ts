import { resolvePrivatePageMeta } from './private-page-meta';

describe('resolvePrivatePageMeta', () => {
  it('uses the create mirror for /new-project', () => {
    expect(resolvePrivatePageMeta('/new-project').projectMode).toBe('create');
  });

  it('uses the edit mirror for /new-project/:id (route redirects to update-project)', () => {
    const meta = resolvePrivatePageMeta('/new-project/5?tab=overview');
    expect(meta.skeleton).toBe('project-detail');
    expect(meta.projectMode).toBe('edit');
  });

  it('matches nested paths by prefix and falls back for unknown paths', () => {
    expect(resolvePrivatePageMeta('/employee/3').title).toBe('Employees');
    expect(resolvePrivatePageMeta('/nope').skeleton).toBe('simple');
  });
});
