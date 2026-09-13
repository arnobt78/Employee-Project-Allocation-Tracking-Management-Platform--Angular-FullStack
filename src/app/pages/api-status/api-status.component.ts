import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasterService } from '../../service/master.service';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ListSkeletonComponent } from '@/app/components/ui/list-skeleton.component';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';

export interface IApiStatus {
  timestamp: string;
  overallStatus: 'operational' | 'degraded' | 'down';
  systemHealth: {
    database: {
      status: string;
      responseTime: number;
      connected: boolean;
    };
    api: {
      status: string;
      uptime: string;
      totalRequests: number;
      avgResponseTime: number;
      successRate: number;
    };
    data: {
      employees: number;
      projects: number;
      assignments: number;
      departments: number;
    };
  };
  endpointHealth: Array<{
    category: string;
    total: number;
    healthy: number;
    avgResponseTime: number;
    status: string;
  }>;
  performanceHistory: Array<{
    date: string;
    day: string;
    avgResponseTime: number;
    requests: number;
    successRate: number;
    errors: number;
  }>;
  recentActivity: Array<{
    timestamp: string;
    endpoint: string;
    method: string;
    status: number;
    responseTime: number;
  }>;
  metrics: {
    totalEndpoints: number;
    activeEndpoints: number;
    successRate: number;
    avgResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
}

@Component({
  selector: 'app-api-status',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, ListSkeletonComponent],
  templateUrl: './api-status.component.html',
  styleUrls: ['./api-status.component.css'],
})
export class ApiStatusComponent implements OnInit {
  private readonly masterService = inject(MasterService);

  readonly pageMeta = PRIVATE_PAGE_META['/api-status'];
  readonly statusSignal = signal<IApiStatus | null>(null);
  readonly status = this.statusSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();
  readonly errorSignal = signal<string | null>(null);
  readonly error = this.errorSignal.asReadonly();

  readonly activeTabSignal = signal<'overview' | 'endpoints' | 'performance' | 'activity'>('overview');
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

  ngOnInit(): void {
    this.loadApiStatus();
    // Auto-refresh every 30 seconds
    setInterval(() => this.loadApiStatus(), 30000);
  }

  loadApiStatus(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.masterService.getApiStatus().subscribe({
      next: (data: IApiStatus) => {
        this.statusSignal.set(data);
        this.loadingSignal.set(false);
      },
      error: (err) => {
        console.error('Failed to load API status', err);
        this.errorSignal.set('Failed to load API status. Please try again later.');
        this.loadingSignal.set(false);
      },
    });
  }

  setActiveTab(tab: 'overview' | 'endpoints' | 'performance' | 'activity'): void {
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

