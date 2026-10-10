import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { NEVER, Subject, of } from 'rxjs';

import { ProjectFormComponent } from './project-form.component';
import { MasterService } from '../../service/master.service';
import { IProject } from '../../model/interface/master';

describe('ProjectFormComponent', () => {
  let component: ProjectFormComponent;
  let fixture: ComponentFixture<ProjectFormComponent>;

  async function setup(routeParams: Record<string, string>) {
    await TestBed.configureTestingModule({
      imports: [ProjectFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of(routeParams) } },
      ],
    }).compileComponents();
  }

  function create() {
    fixture = TestBed.createComponent(ProjectFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const project = {
    projectId: 7,
    projectName: 'Aurora Web Revamp',
    clientName: 'Aurora',
    startDate: '2026-01-01',
  } as IProject;

  describe('create mode', () => {
    beforeEach(() => setup({}));

    it('renders the live form without a skeleton', () => {
      const el = create();
      expect(component).toBeTruthy();
      expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeNull();
      expect(el.querySelector('[data-testid="project-header-meta"]')).toBeTruthy();
    });
  });

  describe('edit mode', () => {
    let master: MasterService;
    let response$: Subject<IProject>;

    beforeEach(async () => {
      await setup({ id: '7' });
      master = TestBed.inject(MasterService);
      response$ = new Subject<IProject>();
      spyOn(master, 'getAllEmp').and.returnValue(of([]));
      spyOn(master, 'getProjectResourceInsights').and.returnValue(NEVER);
      spyOn(master, 'getProjectById').and.returnValue(response$);
    });

    it('shows the shared mirror skeleton on a cold load, then the live page', () => {
      spyOn(master, 'peekProject').and.returnValue(null);
      const el = create();
      expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeTruthy();

      response$.next(project);
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeNull();
      expect(el.querySelector('h1')?.textContent).toContain('Aurora Web Revamp');
    });

    it('hydrates instantly from the projects cache and revalidates while pristine', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: false });
      const el = create();
      expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeNull();
      expect(el.querySelector('h1')?.textContent).toContain('Aurora Web Revamp');

      response$.next({ ...project, projectName: 'Aurora Web Revamp v2' });
      fixture.detectChanges();
      expect(el.querySelector('h1')?.textContent).toContain('Aurora Web Revamp v2');
    });

    it('hydrates from a fresh mutation snapshot without refetching', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const el = create();
      expect(el.querySelector('[data-testid="project-detail-skeleton"]')).toBeNull();
      expect(el.querySelector('h1')?.textContent).toContain('Aurora Web Revamp');
      expect(master.getProjectById).not.toHaveBeenCalled();
    });

    it('does not overwrite in-progress edits when revalidating', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: false });
      create();
      component.projectForm.controls['projectName'].setValue('My edit');
      component.projectForm.markAsDirty();

      response$.next({ ...project, projectName: 'Server name' });
      fixture.detectChanges();
      expect(component.projectForm.controls['projectName'].value).toBe('My edit');
      expect(component.currentProject()?.projectName).toBe('Server name');
    });
  });
});
