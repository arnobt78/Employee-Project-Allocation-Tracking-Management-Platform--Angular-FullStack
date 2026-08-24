import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MasterService } from '../../service/master.service';

export interface IApiEndpoint {
  path: string;
  method: string;
  description: string;
  url: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBody?: {
    contentType: string;
    schema: any;
  };
  response: {
    status: number;
    body: any;
  };
  errorResponses?: Array<{
    status: number;
    body: any;
  }>;
  category: string;
}

export interface IApiDocumentation {
  info: {
    title: string;
    version: string;
    description: string;
    baseUrl: string;
  };
  endpoints: {
    GET: IApiEndpoint[];
    POST: IApiEndpoint[];
    PUT: IApiEndpoint[];
    DELETE: IApiEndpoint[];
  };
}

@Component({
  selector: 'app-api-doc',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './api-doc.component.html',
  styleUrls: ['./api-doc.component.css'],
})
export class ApiDocComponent implements OnInit {
  private readonly masterService = inject(MasterService);

  readonly apiDocSignal = signal<IApiDocumentation | null>(null);
  readonly apiDoc = this.apiDocSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();
  readonly errorSignal = signal<string | null>(null);
  readonly error = this.errorSignal.asReadonly();

  readonly activeTabSignal = signal<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  readonly activeTab = this.activeTabSignal.asReadonly();

  readonly activeCategorySignal = signal<string | null>(null);
  readonly activeCategory = this.activeCategorySignal.asReadonly();

  readonly categories = computed(() => {
    const doc = this.apiDoc();
    if (!doc) return [];
    const allEndpoints = [
      ...doc.endpoints.GET,
      ...doc.endpoints.POST,
      ...doc.endpoints.PUT,
      ...doc.endpoints.DELETE,
    ];
    const cats = new Set<string>();
    allEndpoints.forEach((ep) => cats.add(ep.category));
    return Array.from(cats).sort();
  });

  readonly filteredEndpoints = computed(() => {
    const doc = this.apiDoc();
    const tab = this.activeTab();
    const category = this.activeCategory();
    if (!doc) return [];

    const endpoints = doc.endpoints[tab] || [];
    if (!category) return endpoints;
    return endpoints.filter((ep) => ep.category === category);
  });

  ngOnInit(): void {
    this.loadApiDocumentation();
  }

  loadApiDocumentation(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.masterService.getApiDocumentation().subscribe({
      next: (data) => {
        this.apiDocSignal.set(data);
        this.loadingSignal.set(false);
      },
      error: (error) => {
        console.error('Error loading API documentation:', error);
        this.errorSignal.set(
          error?.message || 'Failed to load API documentation'
        );
        this.loadingSignal.set(false);
      },
    });
  }

  setActiveTab(tab: 'GET' | 'POST' | 'PUT' | 'DELETE'): void {
    this.activeTabSignal.set(tab);
    this.activeCategorySignal.set(null);
  }

  setActiveCategory(category: string | null): void {
    this.activeCategorySignal.set(category);
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

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      Employees: 'bg-blue-500/20 text-blue-400',
      Projects: 'bg-purple-500/20 text-purple-400',
      Assignments: 'bg-indigo-500/20 text-indigo-400',
      Departments: 'bg-cyan-500/20 text-cyan-400',
      Approvals: 'bg-orange-500/20 text-orange-400',
      Dashboard: 'bg-pink-500/20 text-pink-400',
      Schedule: 'bg-teal-500/20 text-teal-400',
      Content: 'bg-amber-500/20 text-amber-400',
      AI: 'bg-violet-500/20 text-violet-400',
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400';
  }

  formatSchema(schema: any): string {
    if (typeof schema === 'string') return schema;
    if (Array.isArray(schema)) return 'Array';
    if (typeof schema === 'object') {
      const keys = Object.keys(schema);
      if (keys.length === 0) return 'object';
      return `{ ${keys.join(', ')} }`;
    }
    return String(schema);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Clipboard write succeeded; toast can be added here if needed.
    });
  }
}

