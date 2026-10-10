import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  FAILURE_CHECK_DELAYS_MS,
  NotificationMonitorService,
} from './notification-monitor.service';
import { MasterService } from './master.service';
import { AuthService } from './auth.service';
import { ToastService } from '../components/ui/toast.service';
import { MutationTracker } from '../lib/mutation-tracker';
import { INotificationLogEntry } from '../model/interface/master';

describe('NotificationMonitorService', () => {
  let failures: jasmine.Spy;
  let toastError: jasmine.Spy;
  let authenticated: boolean;
  let notify: () => void;

  const failure = (id: string, recipientCount = 2): INotificationLogEntry => ({
    id,
    event: 'project_created',
    entityType: 'project',
    entityId: 5001,
    status: 'failed',
    provider: null,
    recipientCount,
    error: 'SMTP down',
    createdAt: new Date().toISOString(),
  });

  beforeEach(() => {
    authenticated = true;
    failures = jasmine.createSpy('getNotificationFailures').and.returnValue(of([]));
    toastError = jasmine.createSpy('error');
    TestBed.configureTestingModule({
      providers: [
        { provide: MasterService, useValue: { getNotificationFailures: failures } },
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
        { provide: ToastService, useValue: { error: toastError } },
        {
          provide: MutationTracker,
          useValue: {
            onMutationSuccess: (listener: () => void) => {
              notify = listener;
              return () => undefined;
            },
          },
        },
      ],
    });
    TestBed.inject(NotificationMonitorService).start();
  });

  const lastDelay = FAILURE_CHECK_DELAYS_MS[FAILURE_CHECK_DELAYS_MS.length - 1];

  it('checks once per delay after a mutation and stays silent without failures', fakeAsync(() => {
    notify();
    tick(lastDelay);
    expect(failures).toHaveBeenCalledTimes(FAILURE_CHECK_DELAYS_MS.length);
    expect(toastError).not.toHaveBeenCalled();
  }));

  it('toasts each failure once, summing recipients', fakeAsync(() => {
    failures.and.returnValue(of([failure('a', 2), failure('b', 3)]));
    notify();
    tick(lastDelay);
    expect(toastError).toHaveBeenCalledTimes(1);
    const [{ title, description }] = toastError.calls.mostRecent().args;
    expect(title).toBe('2 email deliveries failed');
    expect(description).toContain('Email to 5 recipients failed');
  }));

  it('coalesces a burst of mutations into one schedule from the earliest', fakeAsync(() => {
    notify();
    tick(1_000);
    notify();
    tick(lastDelay);
    expect(failures).toHaveBeenCalledTimes(FAILURE_CHECK_DELAYS_MS.length);
    const sinces = new Set(failures.calls.allArgs().map(([since]) => since));
    expect(sinces.size).toBe(1);
  }));

  it('does not poll when signed out', fakeAsync(() => {
    authenticated = false;
    notify();
    tick(lastDelay);
    expect(failures).not.toHaveBeenCalled();
  }));
});
