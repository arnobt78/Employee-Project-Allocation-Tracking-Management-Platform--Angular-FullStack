import {
  ComponentFixture,
  TestBed,
  discardPeriodicTasks,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';

import { ApiStatusComponent } from './api-status.component';
import { MasterService } from '../../service/master.service';
import { IApiStatus, INotificationLogEntry } from '../../model/interface/master';
import { ToastService } from '@/app/components/ui/toast.service';

describe('ApiStatusComponent', () => {
  let fixture: ComponentFixture<ApiStatusComponent>;
  let master: MasterService;

  const status = {
    timestamp: '2026-10-10T00:00:00Z',
    overallStatus: 'operational',
    systemHealth: {
      database: { status: 'healthy', responseTime: 12, connected: true },
      api: {
        status: 'operational',
        uptime: '99.9%',
        totalRequests: 10,
        avgResponseTime: 20,
        successRate: 100,
      },
      data: { employees: 1, projects: 2, assignments: 3, departments: 4 },
    },
    endpointHealth: [],
    performanceHistory: [],
    recentActivity: [],
    metrics: {
      totalEndpoints: 5,
      activeEndpoints: 5,
      successRate: 100,
      avgResponseTime: 20,
      totalRequests: 10,
      errorRate: 0,
    },
  } as IApiStatus;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiStatusComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    master = TestBed.inject(MasterService);
  });

  function create(): HTMLElement {
    fixture = TestBed.createComponent(ApiStatusComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the shared mirror skeleton on a cold load', () => {
    spyOn(master, 'peekApiStatus').and.returnValue(null);
    spyOn(master, 'getApiStatus').and.returnValue(NEVER);
    const el = create();
    expect(el.querySelector('[data-testid="api-status-skeleton"]')).toBeTruthy();
    fixture.destroy();
  });

  it('renders the cached snapshot instantly on a warm visit', () => {
    spyOn(master, 'peekApiStatus').and.returnValue(status);
    spyOn(master, 'getApiStatus').and.returnValue(NEVER);
    const el = create();
    expect(el.querySelector('[data-testid="api-status-skeleton"]')).toBeNull();
    expect(el.textContent).toContain('Overall Status');
    fixture.destroy();
  });

  it('keeps data and shows a retry notice when a refresh fails', () => {
    spyOn(master, 'peekApiStatus').and.returnValue(status);
    const getSpy = spyOn(master, 'getApiStatus').and.returnValue(
      throwError(() => new Error('down'))
    );
    spyOn(console, 'error');
    const el = create();
    const notice = el.querySelector('[data-testid="api-status-refresh-failed"]');
    expect(notice).toBeTruthy();
    expect(el.textContent).toContain('Overall Status');

    getSpy.and.returnValue(of(status));
    (notice!.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(
      el.querySelector('[data-testid="api-status-refresh-failed"]')
    ).toBeNull();
    fixture.destroy();
  });

  it('toasts a failed manual refresh but keeps the background load silent', () => {
    spyOn(master, 'peekApiStatus').and.returnValue(status);
    spyOn(master, 'getApiStatus').and.returnValue(throwError(() => new Error('down')));
    spyOn(console, 'error');
    const toastError = spyOn(TestBed.inject(ToastService), 'error');
    create();
    expect(toastError).not.toHaveBeenCalled();

    fixture.componentInstance.loadApiStatus(true);
    expect(toastError).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('cold failure: retry shows the skeleton, then data with no error', () => {
    spyOn(master, 'peekApiStatus').and.returnValue(null);
    const getSpy = spyOn(master, 'getApiStatus').and.returnValue(
      throwError(() => new Error('down'))
    );
    spyOn(console, 'error');
    const el = create();
    expect(el.textContent).toContain('Failed to load API status');

    getSpy.and.returnValue(NEVER);
    fixture.componentInstance.loadApiStatus();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="api-status-skeleton"]')).toBeTruthy();
    expect(el.textContent).not.toContain('Failed to load API status');

    getSpy.and.returnValue(of(status));
    fixture.componentInstance.loadApiStatus();
    fixture.detectChanges();
    expect(el.textContent).toContain('Overall Status');
    expect(el.textContent).not.toContain('Failed to load API status');
    fixture.destroy();
  });

  it('auto-refreshes every 30s and stops after destroy', fakeAsync(() => {
    spyOn(master, 'peekApiStatus').and.returnValue(null);
    const getSpy = spyOn(master, 'getApiStatus').and.returnValue(of(status));
    create();
    expect(getSpy).toHaveBeenCalledTimes(1);

    tick(30_000);
    expect(getSpy).toHaveBeenCalledTimes(2);

    fixture.destroy();
    tick(60_000);
    expect(getSpy).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));
  describe('recent email deliveries', () => {
    const failed: INotificationLogEntry = {
      id: 'log-1',
      event: 'assignment_created',
      entityType: 'assignment',
      entityId: 7001,
      status: 'failed',
      provider: null,
      recipientCount: 3,
      error: 'No available email provider succeeded: SMTP down',
      createdAt: new Date().toISOString(),
    };

    function deliveries(el: HTMLElement): HTMLElement {
      return el.querySelector('[data-testid="api-status-deliveries"]') as HTMLElement;
    }

    it('shows skeleton rows while the log loads', () => {
      spyOn(master, 'peekApiStatus').and.returnValue(status);
      spyOn(master, 'getApiStatus').and.returnValue(NEVER);
      spyOn(master, 'getNotificationLog').and.returnValue(NEVER);
      const el = create();
      expect(deliveries(el).querySelectorAll('app-delivery-row-skeleton').length).toBe(3);
      fixture.destroy();
    });

    it('lists outcomes with status, entity, recipients and error', () => {
      spyOn(master, 'peekApiStatus').and.returnValue(status);
      spyOn(master, 'getApiStatus').and.returnValue(NEVER);
      spyOn(master, 'getNotificationLog').and.returnValue(of([failed]));
      const el = create();
      const row = deliveries(el).querySelector('[data-delivery-status="failed"]');
      expect(row?.textContent).toContain('Assignment Created');
      expect(row?.textContent).toContain('Assignment #7001');
      expect(row?.textContent).toContain('3 recipients');
      expect(row?.textContent).toContain('SMTP down');
      fixture.destroy();
    });

    it('shows the empty state and a retry on error', () => {
      spyOn(master, 'peekApiStatus').and.returnValue(status);
      spyOn(master, 'getApiStatus').and.returnValue(NEVER);
      const log = spyOn(master, 'getNotificationLog').and.returnValue(
        throwError(() => new Error('down'))
      );
      const el = create();
      expect(deliveries(el).textContent).toContain("Couldn't load email deliveries.");

      log.and.returnValue(of([]));
      (deliveries(el).querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(deliveries(el).textContent).toContain('No email deliveries recorded yet.');
      fixture.destroy();
    });
  });
});
