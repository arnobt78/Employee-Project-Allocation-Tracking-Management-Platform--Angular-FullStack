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
import {
  IApiStatus,
  INotificationLogEntry,
  NotificationDeliveryStatus,
} from '../../model/interface/master';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ApiStatusSkeletonComponent } from '@/app/components/ui/api-status-skeleton.component';
import { DeliveryRowSkeletonComponent } from '@/app/components/ui/delivery-row-skeleton.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  API_STATUS_COPY,
  API_STATUS_DATA_LABELS,
  API_STATUS_DELIVERY_SKELETON_ROWS,
  API_STATUS_METRIC_CARDS,
  API_STATUS_TABS,
  API_STATUS_TAB_ACTIVE_CLASS,
  API_STATUS_TAB_IDLE_CLASS,
  ApiStatusTabId,
} from '@/app/constants/api-status';

const AUTO_REFRESH_MS = 30_000;
const DELIVERY_LOG_LIMIT = 10;

const DELIVERY_STATUS_CLASS: Record<NotificationDeliveryStatus, string> = {
  sent: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  skipped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

@Component({
  selector: 'app-api-status',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ApiStatusSkeletonComponent,
    DeliveryRowSkeletonComponent,
  ],
  templateUrl: './api-status.component.html',
  styleUrls: ['./api-status.component.css'],
})
export class ApiStatusComponent implements OnInit {
  private readonly masterService = inject(MasterService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageMeta = PRIVATE_PAGE_META['/api-status'];
  readonly copy = API_STATUS_COPY;
  readonly tabs = API_STATUS_TABS;
  readonly activeTabClass = API_STATUS_TAB_ACTIVE_CLASS;
  readonly idleTabClass = API_STATUS_TAB_IDLE_CLASS;
  readonly metricCards = API_STATUS_METRIC_CARDS;
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

  readonly overallHealthColor = computed(() => {
    const status = this.status()?.overallStatus;
    if (status === 'operational') return 'text-green-400';
    if (status === 'degraded') return 'text-yellow-400';
    return 'text-red-400';
  });

  readonly overallHealthBg = computed(() => {
    const status = this.status()?.overallStatus;
    if (status === 'operational') return 'bg-green-500/20 border-green-500/30';
    if (status === 'degraded') return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-red-500/20 border-red-500/30';
  });

  readonly dataStatistics = computed(() => {
    const data = this.status()?.systemHealth.data;
    const values = [
      data?.employees,
      data?.projects,
      data?.assignments,
      data?.departments,
    ];
    return API_STATUS_DATA_LABELS.map((label, i) => ({
      label,
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

  loadApiStatus(): void {
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

  deliveryStatusClass(status: NotificationDeliveryStatus): string {
    return DELIVERY_STATUS_CLASS[status] ?? DELIVERY_STATUS_CLASS.skipped;
  }

  /** `assignment_created` → `Assignment created`. */
  deliveryEventLabel(event: string): string {
    const words = event.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  deliveryEntityLabel(entry: INotificationLogEntry): string {
    if (!entry.entityType || entry.entityId == null) {
      return '';
    }
    const type = entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1);
    return `${type} #${entry.entityId}`;
  }

  setActiveTab(tab: ApiStatusTabId): void {
    this.activeTabSignal.set(tab);
  }

  getStatusColor(status: string): string {
    if (status === 'operational' || status === 'healthy') {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    if (status === 'degraded') {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }

  getMethodColor(method: string): string {
    switch (method) {
      case 'GET':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'POST':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PUT':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'DELETE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  getStatusBadgeColor(status: number): string {
    if (status >= 200 && status < 300) {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    if (status >= 400 && status < 500) {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
    if (status >= 500) {
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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

