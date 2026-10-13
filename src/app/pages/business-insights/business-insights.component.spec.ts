import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

import { BusinessInsightsComponent } from './business-insights.component';
import { MasterService } from '../../service/master.service';
import { IProject } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';
import { kpiCards, warmPortfolioCaches } from '@/app/testing/portfolio-fixture';

describe('BusinessInsightsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessInsightsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('renders the same mirror skeleton as the route placeholder on a cold load', () => {
    const master = TestBed.inject(MasterService);
    spyOn(master, 'peekProjects').and.returnValue(null);
    spyOn(master, 'peekEmployees').and.returnValue(null);
    spyOn(master, 'peekProjectEmployees').and.returnValue(null);
    spyOn(master, 'getAllProjects').and.returnValue(NEVER);
    spyOn(master, 'getAllEmp').and.returnValue(NEVER);
    spyOn(master, 'getProjectEmp').and.returnValue(NEVER);

    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="insights-skeleton"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="page-header"]').length).toBe(1);
  });

  it('skips the skeleton when the caches are warm', () => {
    const master = TestBed.inject(MasterService);
    spyOn(master, 'peekProjects').and.returnValue([
      { projectId: 1, projectName: 'Aurora', startDate: '2026-01-01' } as IProject,
    ]);
    spyOn(master, 'peekEmployees').and.returnValue([
      { employeeId: 1, employeeName: 'Ava', department: 'Design' } as Employee,
    ]);
    spyOn(master, 'peekProjectEmployees').and.returnValue([]);
    spyOn(master, 'getAllProjects').and.returnValue(NEVER);
    spyOn(master, 'getAllEmp').and.returnValue(NEVER);
    spyOn(master, 'getProjectEmp').and.returnValue(NEVER);

    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="insights-skeleton"]')).toBeNull();
    expect(el.textContent).toContain('Project Status Distribution');
    expect(el.querySelectorAll('app-kpi-stat-card').length).toBeGreaterThanOrEqual(4);
    expect(el.querySelector('button[ehAction]')).toBeTruthy();
  });

  it('subtitles every overview card with the shared counts and drops the pill row', () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cards = kpiCards(el);

    expect(cards['Projects']).toBe('5 | 4 Active · 1 Archived');
    expect(cards['Total Employees']).toBe('5 | 4 Assigned · 1 Available');
    expect(cards['Resource Utilization']).toBe('44% | 2.2 of 5 people allocated');
    expect(cards['Avg Readiness']).toBe('0% | Across 0 of 4 active projects');
    expect(cards['Planning']).toBe('1 | 1 of 4 active');
    expect(cards['In Flight']).toBe('2 | 2 of 4 active');
    expect(cards['On Hold']).toBe('1 | 1 of 4 active');
    expect(el.querySelectorAll('.eh-badge').length).toBe(0);
  });

  it('writes "—" for a department without projects in the CSV', async () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    let blob: Blob | undefined;
    spyOn(window.URL, 'createObjectURL').and.callFake((value: Blob | MediaSource) => {
      blob = value as Blob;
      return 'blob:test';
    });
    spyOn(window.URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');

    fixture.componentInstance.exportToCSV();
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    const csv = await blob!.text();

    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain('Human Resources,1,0,—');
    expect(csv).toContain('Engineering,2,2,');
  });

  it('shows Reset Filters only while a filter is set, and resets to All', () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const link = () => el.querySelector('app-clear-filters-button button') as HTMLButtonElement | null;

    expect(link()).toBeNull();

    component.filterForm.patchValue({ department: 'Engineering' });
    component.onFilterChange();
    fixture.detectChanges();
    expect(component.insights()?.workforce.total).toBe(2);
    expect(link()?.textContent).toContain('Reset Filters');

    link()!.click();
    fixture.detectChanges();
    expect(component.filterForm.value).toEqual(
      jasmine.objectContaining({ dateRange: 'all', department: 'all' })
    );
    expect(component.insights()?.workforce.total).toBe(5);
    expect(link()).toBeNull();
    expect(document.activeElement?.id).toBe('insights-date-range');
    expect(el.querySelector('#insights-department')?.textContent).toContain('All Departments');
  });

  it('reports capacity in people and "—" for departments without projects', () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    const fixture = TestBed.createComponent(BusinessInsightsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.capacityPeople()).toEqual({
      total: '5 people',
      utilized: '2.2 people',
      available: '2.8 people',
    });
    const departments = component.insights()?.departmentBreakdown ?? [];
    expect(departments.find((d) => d.department === 'Human Resources')?.averageReadiness).toBeNull();
    expect(component.readinessText(null)).toBe('—');
    expect(component.readinessText(60)).toBe('60%');
  });
});
