import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { ProjectEmployeeComponent } from './project-employee.component';
import { IProjectEmployee } from '../../model/interface/master';

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

  it('renders assignment status with the shared badge', () => {
    expect(component.assignmentStatus(true)).toEqual(
      jasmine.objectContaining({ label: 'Active', tone: 'emerald' })
    );
    expect(component.assignmentStatus('N')).toEqual(
      jasmine.objectContaining({ label: 'Inactive', tone: 'slate' })
    );
  });
});
