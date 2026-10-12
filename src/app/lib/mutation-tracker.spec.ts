import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { TestBed, fakeAsync, flush } from '@angular/core/testing';
import { Subject, throwError } from 'rxjs';
import { MutationTracker, PendingSet } from './mutation-tracker';
import { ToastService } from '../components/ui/toast.service';

describe('MutationTracker', () => {
  let tracker: MutationTracker;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      providers: [{ provide: ToastService, useValue: toast }],
    });
    tracker = TestBed.inject(MutationTracker);
  });

  it('keeps the key pending until the response is applied', () => {
    const pending = new PendingSet<number>();
    const response = new Subject<string>();
    const applied: string[] = [];

    tracker.track(response, {
      pending,
      key: 1,
      onSuccess: (value) => {
        expect(pending.has(1)).toBeTrue();
        applied.push(value);
      },
      successToast: (value) => ({ title: `Saved ${value}` }),
      errorToast: { title: 'Failed' },
    });
    expect(pending.has(1)).toBeTrue();

    response.next('A');
    expect(applied).toEqual(['A']);
    expect(pending.has(1)).toBeFalse();
    expect(toast.success).toHaveBeenCalledWith({ title: 'Saved A' });
  });

  it('restores state, toasts and clears pending on error', () => {
    const pending = new PendingSet<number>();
    const onError = jasmine.createSpy('onError');

    tracker.track(throwError(() => new Error('down')), {
      pending,
      key: 1,
      onError,
      errorToast: { title: 'Failed' },
    });

    expect(onError).toHaveBeenCalled();
    expect(pending.has(1)).toBeFalse();
    expect(toast.error).toHaveBeenCalledWith({ title: 'Failed' });
  });

  it("shows a 4xx response's message but never a 5xx body", () => {
    const pending = new PendingSet<number>();
    const conflict = new HttpErrorResponse({
      status: 409,
      error: { result: false, message: 'Employee is already assigned to this project' },
    });
    const crash = new HttpErrorResponse({ status: 500, error: { message: 'stack trace' } });
    const errorToast = { title: 'Creation failed', description: 'Unable to create.' };

    tracker.track(throwError(() => conflict), { pending, key: 1, errorToast });
    tracker.track(throwError(() => crash), { pending, key: 2, errorToast });

    expect(toast.error.calls.argsFor(0)).toEqual([
      { title: 'Creation failed', description: 'Employee is already assigned to this project' },
    ]);
    expect(toast.error.calls.argsFor(1)).toEqual([errorToast]);
  });

  it('tracks keys independently and ignores a duplicate submit', () => {
    const pending = new PendingSet<number>();
    const first = new Subject<void>();
    const second = new Subject<void>();
    const options = { pending, errorToast: { title: 'Failed' } };

    tracker.track(first, { ...options, key: 1 });
    expect(tracker.track(new Subject<void>(), { ...options, key: 1 })).toBeNull();
    tracker.track(second, { ...options, key: 2 });

    first.next();
    expect(pending.has(1)).toBeFalse();
    expect(pending.has(2)).toBeTrue();
  });

  it('notifies listeners after a successful mutation only', () => {
    const listener = jasmine.createSpy('listener');
    const stop = tracker.onMutationSuccess(listener);
    const pending = new PendingSet();
    const ok = new Subject<void>();

    tracker.track(throwError(() => new Error('x')), {
      pending,
      key: 'a',
      errorToast: { title: 'Failed' },
    });
    tracker.track(ok, { pending, key: 'b', errorToast: { title: 'Failed' } });
    ok.next();
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    tracker.track(ok, { pending, key: 'c', errorToast: { title: 'Failed' } });
    ok.next();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears pending even when onSuccess throws', fakeAsync(() => {
    const pending = new PendingSet<number>();
    const response = new Subject<void>();
    tracker.track(response, {
      pending,
      key: 1,
      onSuccess: () => {
        throw new Error('render failed');
      },
      errorToast: { title: 'Failed' },
    });
    response.next();
    expect(pending.has(1)).toBeFalse();
    expect(() => flush()).toThrowError('render failed');
  }));

  it('clears pending when the request completes without a value', () => {
    const pending = new PendingSet<number>();
    const response = new Subject<void>();
    tracker.track(response, { pending, key: 1, errorToast: { title: 'Failed' } });
    response.complete();
    expect(pending.has(1)).toBeFalse();
  });

  it('skips view callbacks after the owner is destroyed', () => {
    const pending = new PendingSet<number>();
    const response = new Subject<void>();
    const onSuccess = jasmine.createSpy('onSuccess');
    let destroy: () => void = () => undefined;
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroy = callback;
        return () => undefined;
      },
    } as DestroyRef;

    tracker.track(response, {
      pending,
      key: 1,
      onSuccess,
      destroyRef,
      successToast: { title: 'Saved' },
      errorToast: { title: 'Failed' },
    });
    destroy();
    response.next();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith({ title: 'Saved' });
    expect(pending.has(1)).toBeFalse();
  });
});
