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
import { MasterService } from '../../service/master.service';
import {
  ApiHttpMethod,
  IApiDocumentation,
} from '../../model/interface/master';
import { PageHeaderComponent } from '@/app/components/ui/page-header.component';
import { ApiDocSkeletonComponent } from '@/app/components/ui/api-doc-skeleton.component';
import { ActionButtonComponent } from '@/app/components/ui/action-button.component';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { ToastService } from '@/app/components/ui/toast.service';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import {
  API_DOC_CATEGORY_META,
  API_DOC_CHIP_ACTIVE_CLASS,
  API_DOC_CHIP_IDLE_CLASS,
  API_DOC_COPY,
  API_DOC_DEFAULT_CATEGORY,
  API_DOC_METHOD_ICONS,
  API_DOC_METHOD_TABS,
  API_DOC_SECTION_ICONS,
  API_DOC_TAB_ACTIVE_CLASS,
  API_DOC_TAB_IDLE_CLASS,
} from '@/app/constants/api-doc';
import { httpMethodTone, httpStatusTone } from '@/app/lib/status/api-badges';
import { BADGE_TONE_CLASS, type StatusTone } from '@/app/lib/status/project-status';

@Component({
  selector: 'app-api-doc',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ApiDocSkeletonComponent,
    ActionButtonComponent,
    AppIconComponent,
  ],
  templateUrl: './api-doc.component.html',
  styleUrls: ['./api-doc.component.css'],
})
export class ApiDocComponent implements OnInit {
  private readonly masterService = inject(MasterService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly pageMeta = PRIVATE_PAGE_META['/api-doc'];
  readonly copy = API_DOC_COPY;
  readonly methodTabs = API_DOC_METHOD_TABS;
  readonly tabActiveClass = API_DOC_TAB_ACTIVE_CLASS;
  readonly tabIdleClass = API_DOC_TAB_IDLE_CLASS;
  readonly chipActiveClass = API_DOC_CHIP_ACTIVE_CLASS;
  readonly chipIdleClass = API_DOC_CHIP_IDLE_CLASS;
  readonly methodIcons = API_DOC_METHOD_ICONS;
  readonly sectionIcons = API_DOC_SECTION_ICONS;
  readonly badgeTone = BADGE_TONE_CLASS;
  readonly methodTone = httpMethodTone;
  readonly httpStatusTone = httpStatusTone;
  readonly apiDocSignal = signal<IApiDocumentation | null>(
    this.masterService.peekApiDocumentation()
  );
  readonly apiDoc = this.apiDocSignal.asReadonly();
  readonly loadingSignal = signal<boolean>(false);
  readonly loading = this.loadingSignal.asReadonly();
  readonly errorSignal = signal<string | null>(null);
  readonly error = this.errorSignal.asReadonly();

  readonly activeTabSignal = signal<ApiHttpMethod>('GET');
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
    if (this.apiDoc()) {
      return;
    }
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.masterService
      .getApiDocumentation()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  setActiveTab(tab: ApiHttpMethod): void {
    this.activeTabSignal.set(tab);
    this.activeCategorySignal.set(null);
  }

  setActiveCategory(category: string | null): void {
    this.activeCategorySignal.set(category);
  }

  methodIcon(method: string): string {
    return API_DOC_METHOD_ICONS[method as ApiHttpMethod] ?? 'code';
  }

  categoryMeta(category: string): { icon: string; tone: StatusTone } {
    return API_DOC_CATEGORY_META[category] ?? API_DOC_DEFAULT_CATEGORY;
  }

  formatSchema(schema: unknown): string {
    if (typeof schema === 'string') return schema;
    if (Array.isArray(schema)) return 'Array';
    if (schema && typeof schema === 'object') {
      const keys = Object.keys(schema);
      if (keys.length === 0) return 'object';
      return `{ ${keys.join(', ')} }`;
    }
    return String(schema);
  }

  errorMessage(body: unknown): string | null {
    const message = (body as { message?: unknown } | null)?.message;
    return typeof message === 'string' ? message : null;
  }

  copyToClipboard(text: string): Promise<void> {
    if (!navigator.clipboard) {
      this.copyFailed();
      return Promise.resolve();
    }
    return navigator.clipboard.writeText(text).then(
      () => this.toast.success({ title: this.copy.copiedTitle, description: text }),
      () => this.copyFailed()
    );
  }

  private copyFailed(): void {
    this.toast.error({
      title: this.copy.copyFailedTitle,
      description: this.copy.copyFailedDescription,
    });
  }
}
