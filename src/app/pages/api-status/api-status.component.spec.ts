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
import { IApiStatus } from '../../model/interface/master';

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
});
