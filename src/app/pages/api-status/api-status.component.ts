import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { MasterService } from '../../service/master.service';
import { IApiStatus, INotificationLogEntry } from '../../model/interface/master';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ApiStatusSkeletonComponent } from '@/app/components/ui/api-status-skeleton.component';
import { DeliveryRowSkeletonComponent } from '@/app/components/ui/delivery-row-skeleton.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  API_STATUS_COPY,
  API_STATUS_DATA_CARDS,
  API_STATUS_DELIVERY_SKELETON_ROWS,
  API_STATUS_METRIC_CARDS,
  API_STATUS_SECTION_ICONS,
  API_STATUS_TABS,
  API_STATUS_TAB_ACTIVE_CLASS,
  API_STATUS_TAB_IDLE_CLASS,
  ApiStatusTabId,
} from '@/app/constants/api-status';
import { ActionButtonComponent } from '@/app/components/ui/action-button.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { KpiStatCardComponent } from '@/app/components/ui/kpi-stat-card.component';
import { ToastService } from '@/app/components/ui/toast.service';
import { titleCaseLabel } from '@/app/lib/format/labels';
import {
  deliveryMeta,
  healthMeta,
  httpMethodTone,
  httpStatusTone,
} from '@/app/lib/status/api-badges';
import { BADGE_TONE_CLASS } from '@/app/lib/status/project-status';

const AUTO_REFRESH_MS = 30_000;
const DELIVERY_LOG_LIMIT = 10;

@Component({
  selector: 'app-api-status',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ApiStatusSkeletonComponent,
    DeliveryRowSkeletonComponent,
    ActionButtonComponent,
    AppIconComponent,
    KpiStatCardComponent,
  ],
  templateUrl: './api-status.component.html',
  styleUrls: ['./api-status.component.css'],
})
export class ApiStatusComponent implements OnInit {
  private readonly masterService = inject(MasterService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly pageMeta = PRIVATE_PAGE_META['/api-status'];
  readonly copy = API_STATUS_COPY;
  readonly tabs = API_STATUS_TABS;
  readonly activeTabClass = API_STATUS_TAB_ACTIVE_CLASS;
  readonly idleTabClass = API_STATUS_TAB_IDLE_CLASS;
  readonly statusSignal = signal<IApiStatus | null>(
    this.masterService.peekApiStatus()
  );
  readonly status = this.statusSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();
  readonly errorSignal = signal<string | null>(null);
  readonly error = this.errorSignal.asReadonly();

  readonly deliverySkeletonRows = API_STATUS_DELIVERY_SKELETON_ROWS;
  readonly deliveries = signal<INotificationLogEntry[] | null>(null);
  readonly deliveriesLoading = signal(false);
  readonly deliveriesError = signal(false);

  readonly activeTabSignal = signal<ApiStatusTabId>('overview');
  readonly activeTab = this.activeTabSignal.asReadonly();

  readonly sectionIcons = API_STATUS_SECTION_ICONS;
  readonly badgeTone = BADGE_TONE_CLASS;
  readonly healthMeta = healthMeta;
  readonly deliveryMeta = deliveryMeta;
  readonly methodTone = httpMethodTone;
  readonly httpStatusTone = httpStatusTone;

  readonly overallHealth = computed(() => healthMeta(this.status()?.overallStatus));

  readonly metricKpis = computed(() => {
    const metrics = this.status()?.metrics;
    const values = [
      metrics?.totalEndpoints ?? 0,
      `${metrics?.avgResponseTime ?? 0}ms`,
      (metrics?.totalRequests ?? 0).toLocaleString('en-US'),
      `${metrics?.errorRate ?? 0}%`,
    ];
    return API_STATUS_METRIC_CARDS.map((card, i) => ({
      ...card,
      value: values[i],
      hint: card.hint ?? `${metrics?.activeEndpoints ?? 0} Active`,
    }));
  });

  readonly dataStatistics = computed(() => {
    const data = this.status()?.systemHealth.data;
    const values = [
      data?.employees,
      data?.projects,
      data?.assignments,
      data?.departments,
    ];
    return API_STATUS_DATA_CARDS.map((card, i) => ({
      ...card,
      value: values[i] ?? 0,
    }));
  });

  ngOnInit(): void {
    this.loadApiStatus();
    interval(AUTO_REFRESH_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.loading()) {
          this.loadApiStatus();
        }
      });
  }

  /** `manual` refreshes (Refresh / Retry) report failures with a toast; the 30s poll stays silent. */
  loadApiStatus(manual = false): void {
    this.loadDeliveries();
    this.loadingSignal.set(true);
    this.masterService
      .getApiStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.statusSignal.set(data);
          this.errorSignal.set(null);
          this.loadingSignal.set(false);
        },
        error: (err) => {
          console.error('Failed to load API status', err);
          this.errorSignal.set(
            'Failed to load API status. Please try again later.'
          );
          this.loadingSignal.set(false);
          if (manual) {
            this.toast.error({
              title: "Couldn't Refresh API Status",
              description: 'Showing the last known data. Please try again shortly.',
            });
          }
        },
      });
  }

  loadDeliveries(): void {
    if (this.deliveriesLoading()) {
      return;
    }
    this.deliveriesLoading.set(true);
    this.masterService
      .getNotificationLog(DELIVERY_LOG_LIMIT)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.deliveries.set(entries);
          this.deliveriesError.set(false);
          this.deliveriesLoading.set(false);
        },
        error: () => {
          this.deliveriesError.set(true);
          this.deliveriesLoading.set(false);
        },
      });
  }

  /** `assignment_created` → `Assignment Created`. */
  deliveryEventLabel(event: string): string {
    return titleCaseLabel(event);
  }

  deliveryEntityLabel(entry: INotificationLogEntry): string {
    if (!entry.entityType || entry.entityId == null) {
      return '';
    }
    return `${titleCaseLabel(entry.entityType)} #${entry.entityId}`;
  }

  setActiveTab(tab: ApiStatusTabId): void {
    this.activeTabSignal.set(tab);
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatTimeAgo(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

