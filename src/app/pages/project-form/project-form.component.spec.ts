import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Params, Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, NEVER, Subject, of } from 'rxjs';

import { ProjectFormComponent } from './project-form.component';
import { MasterService } from '../../service/master.service';
import { IProject } from '../../model/interface/master';
import { UserAvatarComponent } from '@/app/components/ui/user-avatar.component';

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

    it('closes the reject dialog if the reason is cleared before confirming', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'in_review' },
        fresh: true,
      });
      const reject = spyOn(master, 'rejectProject').and.returnValue(NEVER);
      create();
      component.approvalForm.patchValue({ comment: 'Budget too high' });
      component.rejectProjectAction();
      component.approvalForm.patchValue({ comment: '' });

      component.confirmApprovalAction();
      expect(reject).not.toHaveBeenCalled();
      expect(component.pendingApproval()).toBeNull();
    });

    it('ignores a save that finishes after switching to another project', () => {
      spyOn(master, 'peekProject').and.callFake((id: number) => ({
        project: { ...project, projectId: id, projectName: `Project ${id}` },
        fresh: true,
      }));
      const update$ = new Subject<IProject>();
      spyOn(master, 'updateProject').and.returnValue(update$);
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      create();
      component.saveAllChanges();
      component.confirmSave();

      params$.next({ id: '8' });
      update$.next({ ...project, projectName: 'Late save' });

      expect(component.currentProject()?.projectId).toBe(8);
      expect(component.currentProject()?.projectName).toBe('Project 8');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('confirms an approval request before calling the API', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'draft' },
        fresh: true,
      });
      const request$ = new Subject<IProject>();
      const request = spyOn(master, 'requestProjectApproval').and.returnValue(request$);
      create();

      component.requestApprovalAction();
      expect(component.pendingApproval()).toBe('request');
      expect(component.approvalConfirmCopy()?.confirmLabel).toBe('Request Approval');
      expect(request).not.toHaveBeenCalled();

      component.confirmApprovalAction();
      expect(request).toHaveBeenCalledTimes(1);
      expect(component.approvalBusyLabel()).toBe('Requesting…');
      request$.next({ ...project, approvalStatus: 'in_review' });
      expect(component.pendingApproval()).toBeNull();
    });

    it('restores an archived project only after confirmation and keeps the dialog on failure', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, archivedAt: '2026-07-10T00:00:00.000Z' },
        fresh: true,
      });
      const restore$ = new Subject<IProject>();
      const restore = spyOn(master, 'setProjectArchived').and.returnValue(restore$);
      create();

      component.requestRestore();
      expect(component.detailConfirmCopy()?.title).toBe('Restore Aurora Web Revamp?');
      expect(restore).not.toHaveBeenCalled();

      component.confirmDetailAction();
      expect(restore).toHaveBeenCalledOnceWith(7, false);
      expect(component.isDetailConfirmBusy()).toBeTrue();
      component.dismissDetailConfirm();
      expect(component.pendingConfirm()).not.toBeNull();

      restore$.error(new Error('boom'));
      expect(component.pendingConfirm()).toEqual({ kind: 'restore' });
      expect(component.isDetailConfirmBusy()).toBeFalse();

      const retry$ = new Subject<IProject>();
      restore.and.returnValue(retry$);
      component.confirmDetailAction();
      retry$.next({ ...project, archivedAt: undefined });
      expect(component.pendingConfirm()).toBeNull();
      expect(component.isArchived()).toBeFalse();
    });

    it('confirms a new team assignment with the person and allocation', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const assign$ = new Subject<unknown>();
      const assign = spyOn(master, 'saveProjectEmp').and.returnValue(assign$ as never);
      create();

      component.startCollaboratorAssignment({
        employeeId: 3,
        employeeName: 'Liam Patel',
        role: 'Developer',
      } as never);
      component.collaboratorAssignmentForm.patchValue({ allocationPct: 40 });
      component.submitCollaboratorAssignment();
      expect(component.detailConfirmCopy()?.title).toBe('Add Liam Patel To The Team?');
      expect(component.detailConfirmCopy()?.description).toContain('40%');
      expect(assign).not.toHaveBeenCalled();

      component.confirmDetailAction();
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign.calls.mostRecent().args[0]).toEqual(
        jasmine.objectContaining({ projectId: 7, empId: 3, allocationPct: 40 })
      );
      assign$.next({});
      expect(component.pendingConfirm()).toBeNull();
      expect(component.collaboratorAssignmentProfile()).toBeNull();
    });

    it('keeps the assignment dialog open on failure and closes it if the form turns invalid', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const assign$ = new Subject<unknown>();
      const assign = spyOn(master, 'saveProjectEmp').and.returnValue(assign$ as never);
      create();
      component.startCollaboratorAssignment({ employeeId: 3, employeeName: 'Liam Patel' } as never);

      component.submitCollaboratorAssignment();
      component.confirmDetailAction();
      assign$.error(new Error('boom'));
      expect(component.pendingConfirm()?.kind).toBe('assign');

      component.collaboratorAssignmentForm.patchValue({ allocationPct: null });
      assign.calls.reset();
      component.confirmDetailAction();
      expect(assign).not.toHaveBeenCalled();
      expect(component.pendingConfirm()).toBeNull();
    });

    it('closes the restore dialog without a request if the project is already active', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, archivedAt: '2026-07-10T00:00:00.000Z' },
        fresh: true,
      });
      const restore = spyOn(master, 'setProjectArchived').and.returnValue(NEVER);
      create();
      component.requestRestore();
      (component as unknown as { currentProjectSignal: { set(p: IProject): void } })
        .currentProjectSignal.set({ ...project });

      component.confirmDetailAction();
      expect(restore).not.toHaveBeenCalled();
      expect(component.pendingConfirm()).toBeNull();
    });

    it('changes the delivery status only after confirmation and resets the menu on cancel', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'approved', status: 'in_flight' },
        fresh: true,
      });
      const status$ = new Subject<IProject>();
      const setStatus = spyOn(master, 'setProjectStatus').and.returnValue(status$);
      create();
      expect(component.deliveryStatus()).toBe('in_flight');
      expect(component.canSetDeliveryStatus()).toBeTrue();

      component.deliveryStatusControl.setValue('completed');
      component.requestDeliveryStatus('completed');
      expect(component.detailConfirmCopy()?.title).toBe('Mark Aurora Web Revamp As Completed?');
      component.dismissDetailConfirm();
      expect(component.pendingConfirm()).toBeNull();
      expect(component.deliveryStatusControl.value).toBe('in_flight');
      expect(setStatus).not.toHaveBeenCalled();

      component.requestDeliveryStatus('completed');
      component.confirmDetailAction();
      expect(setStatus).toHaveBeenCalledOnceWith(7, 'completed');
      status$.next({ ...project, approvalStatus: 'approved', status: 'completed' });
      expect(component.pendingConfirm()).toBeNull();
      expect(component.isClosed()).toBeTrue();
      expect(component.isTeamLocked()).toBeTrue();
      expect(component.deliveryStatusControl.value).toBe('completed');
    });

    it('hides the delivery status until approval and locks the team of a closed project', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, approvalStatus: 'approved', status: 'cancelled' },
        fresh: true,
      });
      const el = create();
      expect(el.textContent).toContain('This project is Cancelled.');
      component.startEdit('team');
      expect(component.editingSection()).not.toBe('team');
      component.startCollaboratorAssignment({ employeeId: 3, employeeName: 'Liam Patel' } as never);
      component.submitCollaboratorAssignment();
      expect(component.pendingConfirm()).toBeNull();
      component.applyRecommendedLead({ employeeId: 3, employeeName: 'Liam Patel' } as never);
      expect(component.editingSection()).not.toBe('team');

      (component as unknown as { currentProjectSignal: { set(p: IProject): void } })
        .currentProjectSignal.set({ ...project, approvalStatus: 'in_review', status: 'in_review' });
      expect(component.deliveryStatus()).toBeNull();
      expect(component.canSetDeliveryStatus()).toBeFalse();
      expect(component.isTeamLocked()).toBeFalse();
    });

    it('shows "No lead" without an avatar when the lead no longer exists', () => {
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, leadByEmpId: 106 },
        fresh: true,
      });
      create();
      expect(component.displayValue('leadByEmpId')).toBe('No lead');
      expect(component.leadAvatar()).toBeNull();
    });

    it('ignores a restore that finishes after switching to another project', () => {
      spyOn(master, 'peekProject').and.callFake((id: number) => ({
        project: { ...project, projectId: id, archivedAt: '2026-07-10T00:00:00.000Z' },
        fresh: true,
      }));
      const restore$ = new Subject<IProject>();
      spyOn(master, 'setProjectArchived').and.returnValue(restore$);
      create();
      component.requestRestore();
      component.confirmDetailAction();

      params$.next({ id: '8' });
      component.reviewerCommentForm.patchValue({ comment: 'Please add milestones' });
      component.submitReviewerComment();
      restore$.next({ ...project, archivedAt: undefined });
      expect(component.pendingConfirm()).toEqual({ kind: 'comment' });
      expect(component.currentProject()?.projectId).toBe(8);
      expect(component.isArchived()).toBeTrue();
    });

    it('keeps the comment dialog open when posting fails', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const comment$ = new Subject<IProject>();
      spyOn(master, 'addReviewerComment').and.returnValue(comment$);
      create();
      component.reviewerCommentForm.patchValue({ comment: 'Please add milestones' });
      component.submitReviewerComment();
      component.confirmDetailAction();
      comment$.error(new Error('boom'));
      expect(component.pendingConfirm()).toEqual({ kind: 'comment' });
      expect(component.reviewerCommentForm.controls.comment.value).toBe('Please add milestones');
    });

    it('confirms before posting a reviewer comment and ignores an invalid form', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      const comment$ = new Subject<IProject>();
      const add = spyOn(master, 'addReviewerComment').and.returnValue(comment$);
      create();

      component.submitReviewerComment();
      expect(component.pendingConfirm()).toBeNull();

      component.reviewerCommentForm.patchValue({ comment: 'Please add milestones' });
      component.submitReviewerComment();
      expect(component.pendingConfirm()).toEqual({ kind: 'comment' });
      expect(add).not.toHaveBeenCalled();

      component.confirmDetailAction();
      expect(add).toHaveBeenCalledTimes(1);
      comment$.next(project);
      expect(component.pendingConfirm()).toBeNull();
      expect(component.reviewerCommentForm.controls.comment.value).toBe('');
    });

    it('confirms resolving a comment and closes if it changed meanwhile', () => {
      const comment = { id: 'c1', comment: 'Fix scope', resolved: false } as never;
      spyOn(master, 'peekProject').and.returnValue({
        project: { ...project, reviewerComments: [comment] },
        fresh: true,
      });
      const resolve$ = new Subject<IProject>();
      const resolve = spyOn(master, 'resolveReviewerComment').and.returnValue(resolve$);
      create();

      component.toggleReviewerCommentResolved(comment);
      expect(component.detailConfirmCopy()?.confirmLabel).toBe('Mark as Resolved');
      component.confirmDetailAction();
      expect(resolve).toHaveBeenCalledOnceWith(7, 'c1', jasmine.objectContaining({ resolved: true }));
      resolve$.next({ ...project, reviewerComments: [{ ...(comment as object), resolved: true }] } as IProject);
      expect(component.pendingConfirm()).toBeNull();

      resolve.calls.reset();
      component.toggleReviewerCommentResolved(comment);
      component.confirmDetailAction();
      expect(resolve).not.toHaveBeenCalled();
      expect(component.pendingConfirm()).toBeNull();
    });

    it('closes the action dialog when the route switches to another project', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      create();
      component.reviewerCommentForm.patchValue({ comment: 'Please add milestones' });
      component.submitReviewerComment();
      expect(component.pendingConfirm()).not.toBeNull();

      params$.next({ id: '8' });
      expect(component.pendingConfirm()).toBeNull();
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

    it('shows a robot avatar next to the client name', () => {
      spyOn(master, 'peekProject').and.returnValue({ project, fresh: true });
      create();
      const seeds = fixture.debugElement
        .queryAll(By.directive(UserAvatarComponent))
        .map((node) => (node.componentInstance as UserAvatarComponent).seed);
      expect(seeds).toContain('Aurora');
    });
  });
});
