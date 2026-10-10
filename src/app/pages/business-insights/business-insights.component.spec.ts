import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';

import { BusinessInsightsComponent } from './business-insights.component';
import { MasterService } from '../../service/master.service';
import { IProject } from '../../model/interface/master';
import { Employee } from '../../model/class/Employee';

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
  });
});
