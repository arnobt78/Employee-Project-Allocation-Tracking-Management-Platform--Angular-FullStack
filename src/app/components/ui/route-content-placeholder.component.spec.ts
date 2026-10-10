import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideRouter } from '@angular/router';
import { RouteContentPlaceholderComponent } from './route-content-placeholder.component';

describe('RouteContentPlaceholderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteContentPlaceholderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function render(path: string): HTMLElement {
    spyOn(TestBed.inject(Location), 'path').and.returnValue(path);
    const fixture = TestBed.createComponent(RouteContentPlaceholderComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the project detail mirror with a pending title for edit routes', () => {
    const el = render('/update-project/7');
    expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="page-header-title-pending"]')).toBeTruthy();
    expect(el.textContent).toContain('Editing');
    expect(el.textContent).toContain('Readiness Checklist');
  });

  it('renders the project detail mirror in draft mode for new projects', () => {
    const el = render('/new-project');
    expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="page-header-title-pending"]')).toBeNull();
    expect(el.textContent).toContain('Untitled project');
    expect(el.textContent).toContain('Draft');
    expect(el.textContent).toContain('Project Name');
    expect(el.textContent).toContain('Create Project');
    expect(el.textContent).not.toContain('Archive Project');
  });

  it('renders the API documentation mirror with static tabs', () => {
    const el = render('/api-doc');
    expect(el.querySelector('[data-testid="api-doc-skeleton"]')).toBeTruthy();
    expect(el.textContent).toContain('All Categories');
    expect(el.textContent).toContain('DELETE');
  });

  it('renders the API status mirror with static labels', () => {
    const el = render('/api-status');
    expect(el.querySelector('[data-testid="api-status-skeleton"]')).toBeTruthy();
    expect(el.textContent).toContain('Overall Status');
    expect(el.textContent).toContain('Data Statistics');
  });

  it('renders the insights mirror with static labels', () => {
    const el = render('/business-insights');
    expect(el.querySelector('[data-testid="insights-skeleton"]')).toBeTruthy();
    expect(el.textContent).toContain('Export CSV');
    expect(el.textContent).toContain('Project Status Distribution');
  });

  it('renders the calendar mirror with the static month grid', () => {
    const el = render('/calendar-timeline');
    expect(el.querySelector('[data-testid="calendar-skeleton"]')).toBeTruthy();
    expect(el.querySelector('app-calendar-month-shell')).toBeTruthy();
    expect(el.querySelector('app-calendar-view')).toBeNull();
    expect(el.textContent).toContain('Calendar View');
  });

  it('keeps the shared header + list mirror for list pages', () => {
    const el = render('/projects');
    expect(el.querySelector('[data-testid="page-header"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeNull();
  });
});
