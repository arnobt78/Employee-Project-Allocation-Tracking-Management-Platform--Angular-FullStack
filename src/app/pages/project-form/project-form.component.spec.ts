import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, NEVER, Subject, of } from 'rxjs';

import { ProjectFormComponent } from './project-form.component';
import { MasterService } from '../../service/master.service';
import { IProject } from '../../model/interface/master';

describe('ProjectFormComponent', () => {
  let component: ProjectFormComponent;
  let fixture: ComponentFixture<ProjectFormComponent>;
  let params$: BehaviorSubject<Params>;

  async function setup(routeParams: Params) {
    params$ = new BehaviorSubject<Params>(routeParams);
    await TestBed.configureTestingModule({
      imports: [ProjectFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: params$ } },
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

    it('drops the mode badge and keeps readiness on a single header line', () => {
      const el = create();
      const meta = el.querySelector('[data-testid="project-header-meta"]')!;
      expect(meta.textContent).not.toContain('Draft');
      expect(meta.textContent).not.toContain('Editing');
      expect(meta.querySelector('[data-testid="project-header-readiness"]')).toBeTruthy();
      expect(el.querySelector('app-page-header')?.hasAttribute('align')).toBeFalse();
    });

    it('marks required overview fields and uses the shared input sizing', () => {
      const el = create();
      const label = el.querySelector('label[for="projectName"]')!;
      expect(label.textContent).toContain('*');
      expect(label.querySelector('svg, lucide-icon')).toBeTruthy();
      expect(el.querySelector('#projectName')?.classList).toContain('eh-input');
      expect(el.querySelector('#startDate')?.classList).toContain('eh-input');
    });

    it('creates a new project without a confirmation dialog', () => {
      const master = TestBed.inject(MasterService);
      const save = spyOn(master, 'saveProject').and.returnValue(NEVER);
      create();
      component.projectForm.patchValue({
        projectName: 'Nova',
        clientName: 'Nova Inc',
        startDate: '2026-01-01',
      });
      component.saveAllChanges();
      expect(component.pendingSave()).toBeNull();
      expect(save).toHaveBeenCalledTimes(1);

      component.saveAllChanges();
      expect(save).toHaveBeenCalledTimes(1);
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

    it('confirms before saving an existing project and closes after success', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const update$ = new Subject<IProject>();
      const update = spyOn(master, 'updateProject').and.returnValue(update$);
      create();

      component.saveAllChanges();
      expect(component.pendingSave()).toBe('all');
      expect(update).not.toHaveBeenCalled();

      component.confirmSave();
      expect(update).toHaveBeenCalledTimes(1);
      expect(component.isSaving()).toBeTrue();
      component.dismissSave();
      expect(component.pendingSave()).toBe('all');

      update$.next(project);
      expect(component.pendingSave()).toBeNull();
      expect(component.isSaving()).toBeFalse();
    });

    it('keeps the save dialog open after a failed save so the user can retry', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const update$ = new Subject<IProject>();
      spyOn(master, 'updateProject').and.returnValue(update$);
      create();

      component.saveAllChanges();
      component.confirmSave();
      update$.error(new Error('boom'));
      expect(component.pendingSave()).toBe('all');
      expect(component.isSaving()).toBeFalse();
    });

    it('does not open the save dialog when the form is invalid', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      create();
      component.projectForm.controls['projectName'].setValue('');
      component.saveAllChanges();
      expect(component.pendingSave()).toBeNull();
    });

    it('confirms approve before calling the API', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'in_review' },
        fresh: true,
      });
      const approve$ = new Subject<IProject>();
      const approve = spyOn(master, 'approveProject').and.returnValue(approve$);
      create();

      component.approveProjectAction();
      expect(component.pendingApproval()).toBe('approve');
      expect(component.approvalConfirmCopy()?.confirmLabel).toBe('Approve');
      expect(approve).not.toHaveBeenCalled();

      component.confirmApprovalAction();
      expect(approve).toHaveBeenCalledTimes(1);
      expect(component.isApprovalConfirmBusy()).toBeTrue();
      expect(component.approvalBusyLabel()).toBe('Approving…');

      approve$.next({ ...project, approvalStatus: 'approved' });
      expect(component.pendingApproval()).toBeNull();
    });

    it('requires a reason before opening the reject dialog', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'in_review' },
        fresh: true,
      });
      create();

      component.rejectProjectAction();
      expect(component.pendingApproval()).toBeNull();

      component.approvalForm.patchValue({ comment: 'Budget too high' });
      component.rejectProjectAction();
      expect(component.pendingApproval()).toBe('reject');
      expect(component.approvalConfirmCopy()?.destructive).toBeTrue();

      component.dismissApprovalConfirm();
      expect(component.pendingApproval()).toBeNull();
    });

    it('confirms reset before returning the project to draft', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'approved' },
        fresh: true,
      });
      const reset$ = new Subject<IProject>();
      const reset = spyOn(master, 'resetProjectApproval').and.returnValue(reset$);
      create();

      component.resetProjectApprovalAction();
      expect(component.pendingApproval()).toBe('reset');
      expect(component.approvalConfirmCopy()?.confirmLabel).toBe('Reset To Draft');
      expect(reset).not.toHaveBeenCalled();

      component.confirmApprovalAction();
      expect(reset).toHaveBeenCalledTimes(1);
      expect(component.isApprovalConfirmBusy()).toBeTrue();
      component.dismissApprovalConfirm();
      expect(component.pendingApproval()).toBe('reset');

      reset$.next({ ...project, approvalStatus: 'draft' });
      expect(component.pendingApproval()).toBeNull();
    });

    it('archives only after confirmation and leaves for the projects list', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const delete$ = new Subject<unknown>();
      const remove = spyOn(master, 'deleteProjectById').and.returnValue(
        delete$ as never
      );
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      create();

      component.requestDelete();
      expect(component.pendingDelete()).toBeTrue();
      expect(remove).not.toHaveBeenCalled();

      component.confirmDelete();
      expect(remove).toHaveBeenCalledOnceWith(7);
      component.dismissDelete();
      expect(component.pendingDelete()).toBeTrue();

      delete$.next({});
      expect(component.pendingDelete()).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/projects']);
    });

    it('closes open dialogs when the route switches to another project', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      create();
      component.saveAllChanges();
      component.requestDelete();
      expect(component.pendingSave()).toBe('all');
      expect(component.pendingDelete()).toBeTrue();

      params$.next({ id: '8' });
      expect(component.pendingSave()).toBeNull();
      expect(component.pendingDelete()).toBeFalse();
      expect(component.pendingApproval()).toBeNull();
    });

    it('names each select trigger with its field label', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const el = create();
      const id = 'readiness-scopeDefined-status';
      const trigger = el.querySelector<HTMLButtonElement>(`#${id}`)!;
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('aria-labelledby')).toBe(`${id}-label ${id}`);
      expect(el.querySelector(`#${id}-label`)?.textContent).toContain('Status');
    });
  });
});
