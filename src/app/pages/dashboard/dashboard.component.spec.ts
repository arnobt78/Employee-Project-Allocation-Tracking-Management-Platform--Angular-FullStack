import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NEVER, of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { MasterService } from '../../service/master.service';
import {
  FIXTURE_EMPLOYEES,
  FIXTURE_PROJECTS,
  kpiCards,
  warmPortfolioCaches,
} from '@/app/testing/portfolio-fixture';

const SNAPSHOT = {
  totalEmployee: 5,
  totalProject: 4,
  archivedProject: 1,
  activeProjectEmployees: 5,
  recentProjects: [],
  recentEmployee: [],
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  const gridCards = () =>
    kpiCards(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="dashboard-kpi-grid"]') as HTMLElement
    );

  it('should create', () => {
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows the same project, status, staffing and assignment counts as the other pages', () => {
    const master = TestBed.inject(MasterService);
    warmPortfolioCaches(master);
    spyOn(master, 'peekDashboard').and.returnValue(SNAPSHOT);
    spyOn(master, 'peekDepartments').and.returnValue(null);
    spyOn(master, 'getDashboardData').and.returnValue(NEVER);
    spyOn(master, 'getAllDept').and.returnValue(NEVER);

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const cards = gridCards();

    expect(Object.keys(cards)).toEqual([
      'Employees', 'Projects', 'People', 'In Flight', 'Planning', 'On Hold', 'Staffing', 'Assignments', 'Archived',
    ]);
    expect(cards).toEqual({
      Employees: '5 | 4 Assigned · 1 Available',
      Projects: '5 | 4 Active · 1 Archived',
      People: '4 | Unique assignees on active projects',
      'In Flight': '2 | Approved or in review',
      Planning: '1 | Draft or planning',
      'On Hold': '1 | Paused projects',
      Staffing: '4 | 4 Staffed · 0 Lead Only · 0 Unstaffed',
      Assignments: '7 | 5 Active · 1 Inactive · 1 Archived',
      Archived: '1 | Restore from Projects',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      '4 people on projects · 5 active assignments'
    );
  });

  it('still fills the cards when the assignment list fails to load', () => {
    const master = TestBed.inject(MasterService);
    spyOn(master, 'peekDashboard').and.returnValue(SNAPSHOT);
    spyOn(master, 'peekDepartments').and.returnValue(null);
    spyOn(master, 'peekProjects').and.returnValue(null);
    spyOn(master, 'peekEmployees').and.returnValue(null);
    spyOn(master, 'peekProjectEmployees').and.returnValue(null);
    spyOn(master, 'getDashboardData').and.returnValue(NEVER);
    spyOn(master, 'getAllDept').and.returnValue(NEVER);
    spyOn(master, 'getAllProjects').and.returnValue(of(FIXTURE_PROJECTS));
    spyOn(master, 'getAllEmp').and.returnValue(of(FIXTURE_EMPLOYEES));
    spyOn(master, 'getProjectEmp').and.returnValue(throwError(() => new Error('offline')));

    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cards = gridCards();

    expect(fixture.componentInstance.stats).not.toBeNull();
    expect(el.querySelectorAll('[data-testid="dashboard-kpi-grid"] app-text-stub').length).toBe(0);
    expect(cards['Staffing']).toBe('0 | 0 Staffed · 4 Lead Only · 0 Unstaffed');
    expect(cards['Employees']).toBe('5 | 0 Assigned · 5 Available');
  });
});
