import { Component } from '@angular/core';
import {
  API_DOC_CHIP_ACTIVE_CLASS,
  API_DOC_CHIP_IDLE_CLASS,
  API_DOC_COPY,
  API_DOC_METHOD_TABS,
  API_DOC_TAB_ACTIVE_CLASS,
  API_DOC_TAB_IDLE_CLASS,
} from '@/app/constants/api-doc';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import { PageHeaderComponent } from './page-header.component';
import { TextStubComponent } from './text-stub.component';

/**
 * Full-page loading mirror of api-doc. Rendered by both the route placeholder
 * and the page's cold-load branch so refresh shows a single skeleton layer.
 * Keep in sync with api-doc.component.html.
 */
@Component({
  selector: 'app-api-doc-skeleton',
  standalone: true,
  imports: [PageHeaderComponent, TextStubComponent],
  host: { class: 'block' },
  template: `
    <div class="text-white/85" data-testid="api-doc-skeleton" aria-busy="true">
      <app-page-header
        [title]="meta.title"
        [subtitle]="meta.subtitle"
        [icon]="meta.icon"
      >
        <div
          class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2"
        >
          <span class="text-xs text-white/60">{{ copy.versionPill }}</span>
          <app-text-stub
            class="w-10 text-sm font-medium"
            [bar]="versionBar"
          ></app-text-stub>
        </div>
      </app-page-header>

      <div class="eh-content-stack">
        <div
          class="rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-md sm:p-4"
        >
          <app-text-stub
            class="mb-4 block text-xl font-medium"
            bar="inset-y-0 left-0 my-auto h-5 w-64 max-w-full rounded-full"
          ></app-text-stub>
          <app-text-stub
            class="mb-4 block text-sm"
            bar="inset-y-0 left-0 my-auto h-3 w-3/4 rounded-full"
          ></app-text-stub>
          <div class="flex flex-wrap items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/60">{{ copy.baseUrl }}</span>
              <code
                class="relative w-40 rounded bg-white/10 px-2 py-1 text-xs"
                aria-hidden="true"
                >&nbsp;<span
                  class="absolute inset-0 animate-pulse rounded bg-white/10"
                ></span
              ></code>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-white/60">{{ copy.version }}</span>
              <app-text-stub
                class="w-10 text-sm font-medium"
                [bar]="versionBar"
              ></app-text-stub>
            </div>
          </div>
        </div>

        <div
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <div class="mb-6 flex gap-2 border-b border-white/10">
            @for (method of methodTabs; track method; let first = $first) {
              <span [class]="first ? tabActiveClass : tabIdleClass">
                {{ method }}
              </span>
            }
          </div>

          <div class="mb-6 flex flex-wrap gap-2">
            <span [class]="chipActiveClass">{{ copy.allCategories }}</span>
            @for (width of chipWidths; track $index) {
              <span
                [class]="chipIdleClass + ' relative'"
                [style.width.px]="width"
                aria-hidden="true"
                >&nbsp;<span
                  class="absolute inset-0 animate-pulse rounded-full bg-white/10"
                ></span
              ></span>
            }
          </div>

          <div class="space-y-4" aria-hidden="true">
            @for (row of endpointRows; track row) {
              <div
                class="rounded-xl border border-white/10 bg-white/5 p-2 sm:p-4"
              >
                <div
                  class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div class="flex-1">
                    <div class="mb-2 flex items-center gap-3">
                      <app-text-stub
                        class="inline-flex w-12 rounded border border-white/10 px-2 py-1 text-xs"
                        bar="inset-0 rounded"
                      ></app-text-stub>
                      <app-text-stub
                        class="inline-flex w-20 rounded-full px-2 py-1 text-xs"
                      ></app-text-stub>
                    </div>
                    <app-text-stub
                      class="mb-2 block text-base font-medium sm:text-xl"
                      bar="inset-y-0 left-0 my-auto h-4 w-48 rounded-full sm:h-5"
                    ></app-text-stub>
                    <app-text-stub
                      class="block text-sm"
                      bar="inset-y-0 left-0 my-auto h-3 w-2/3 rounded-full"
                    ></app-text-stub>
                  </div>
                  <span
                    class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60"
                  >
                    {{ copy.copyUrl }}
                  </span>
                </div>
                <div class="relative rounded-lg bg-white/5 p-3">
                  <code class="text-sm">&nbsp;</code>
                  <span
                    class="absolute inset-y-0 left-3 my-auto h-3 w-1/2 animate-pulse rounded-full bg-white/10"
                  ></span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ApiDocSkeletonComponent {
  readonly meta = PRIVATE_PAGE_META['/api-doc'];
  readonly copy = API_DOC_COPY;
  readonly methodTabs = API_DOC_METHOD_TABS;
  readonly tabActiveClass = API_DOC_TAB_ACTIVE_CLASS;
  readonly tabIdleClass = API_DOC_TAB_IDLE_CLASS;
  readonly chipActiveClass = API_DOC_CHIP_ACTIVE_CLASS;
  readonly chipIdleClass = API_DOC_CHIP_IDLE_CLASS;
  readonly versionBar = 'inset-0 my-auto h-3 rounded-full';
  readonly chipWidths = [84, 72, 96, 88, 80, 72];
  readonly endpointRows = [1, 2, 3];
}
