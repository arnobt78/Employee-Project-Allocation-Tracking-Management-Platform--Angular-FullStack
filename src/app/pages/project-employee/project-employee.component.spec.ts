import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { ProjectEmployeeComponent } from './project-employee.component';
import { IProjectEmployee } from '../../model/interface/master';
import { MasterService } from '../../service/master.service';
import { kpiCards, warmPortfolioCaches } from '@/app/testing/portfolio-fixture';

describe('ProjectEmployeeComponent', () => {
  let component: ProjectEmployeeComponent;
  let fixture: ComponentFixture<ProjectEmployeeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectEmployeeComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectEmployeeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels the unassigned date instead of a bare dash', () => {
    const base = { empProjectId: 1, empId: 2, projectId: 3 } as IProjectEmployee;
    expect(component.unassignedLabel({ ...base, isActive: 'Y' })).toBe(
      'Still Assigned'
    );
    expect(component.unassignedLabel({ ...base, isActive: 'N' })).toBe(
      'Not Recorded'
    );
    expect(
      component.unassignedLabel({ ...base, isActive: 'N', unassignedAt: '2026-02-03T00:00:00Z' })
    ).not.toMatch(/^(—|Still Assigned|Not Recorded)$/);
  });

  it('counts all assignments and the people on active projects', () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    const warm = TestBed.createComponent(ProjectEmployeeComponent);
    warm.detectChanges();
    const cards = kpiCards(warm.nativeElement as HTMLElement);

    expect(cards['Total Assignments']).toBe('7 | 6 On Active Projects · 1 Archived');
    expect(cards['Active']).toMatch(/^5 \|/);
    expect(cards['Inactive']).toMatch(/^1 \|/);
    expect(cards['Projects']).toBe('5 | 4 Active · 1 Archived');
    expect(cards['People']).toBe('4 | Unique assignees on active projects');
  });

  it('renders assignment status with the shared badge', () => {
    expect(component.assignmentStatus(true)).toEqual(
      jasmine.objectContaining({ label: 'Active', tone: 'emerald' })
    );
    expect(component.assignmentStatus('N')).toEqual(
      jasmine.objectContaining({ label: 'Inactive', tone: 'slate' })
    );
  });
});
