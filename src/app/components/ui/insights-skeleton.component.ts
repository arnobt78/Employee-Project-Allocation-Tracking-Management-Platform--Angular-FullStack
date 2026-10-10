import { Component } from '@angular/core';
import {
  INSIGHTS_DEFAULT_FILTER_DISPLAY,
  INSIGHTS_FILTER_LABELS,
  INSIGHTS_KPI_LABELS,
  INSIGHTS_READINESS_DISTRIBUTION_TITLE,
  INSIGHTS_READINESS_RANGES,
  INSIGHTS_STATUS_DISTRIBUTION_TITLE,
  INSIGHTS_STATUS_ITEMS,
  INSIGHTS_TABS,
} from '@/app/constants/business-insights';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import { AppIconComponent } from './app-icon.component';
import { UbButtonDirective } from './button';
import { PageHeaderComponent } from './page-header.component';
import { SelectTriggerPreviewComponent } from './select-trigger-preview.component';
import { TextStubComponent } from './text-stub.component';

/**
 * Full-page loading mirror of business-insights (header, filters, tabs,
 * overview KPIs, breakdown chips, status distribution). Rendered by both the
 * route placeholder and the page's cold-load branch.
 * Keep structure in sync with business-insights.component.html.
 */
@Component({
  selector: 'app-insights-skeleton',
  standalone: true,
  imports: [
    AppIconComponent,
    PageHeaderComponent,
    SelectTriggerPreviewComponent,
    TextStubComponent,
    UbButtonDirective,
  ],
  host: { class: 'block' },
  template: `
    <div
      class="text-white/85"
      data-testid="insights-skeleton"
      aria-busy="true"
    >
      <app-page-header
        [title]="meta.title"
        [subtitle]="meta.subtitle"
        [icon]="meta.icon"
      >
        <button
          ubButton
          size="sm"
          variant="secondary"
          class="eh-btn-icon border border-white/20 bg-white/5 hover:bg-white/10"
          disabled
        >
          <lucide-icon name="download" [size]="16"></lucide-icon>
          <span>Export CSV</span>
        </button>
        <button
          ubButton
          size="sm"
          variant="secondary"
          class="eh-btn-icon border border-white/20 bg-white/5 hover:bg-white/10"
          disabled
        >
          <lucide-icon name="file-down" [size]="16"></lucide-icon>
          <span>Export PDF</span>
        </button>
      </app-page-header>

      <div class="eh-content-stack">
        <div
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span class="mb-2 block text-xs text-white/60 sm:text-sm">
                {{ filterLabels.dateRange }}
              </span>
              <app-select-trigger-preview
                [label]="filterDefaults.dateRange.label"
                [icon]="filterDefaults.dateRange.icon"
              ></app-select-trigger-preview>
            </div>
            <div>
              <span class="mb-2 block text-xs text-white/60 sm:text-sm">
                {{ filterLabels.department }}
              </span>
              <app-select-trigger-preview
                [label]="filterDefaults.department.label"
                [icon]="filterDefaults.department.icon"
              ></app-select-trigger-preview>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="flex gap-2 border-b border-white/10">
            @for (tab of tabs; track tab.id; let first = $first) {
              <span
                [class]="
                  first
                    ? 'border-b-2 border-primary px-4 py-2 text-sm font-medium text-white'
                    : 'px-4 py-2 text-sm font-medium text-white/60'
                "
              >
                {{ tab.label }}
              </span>
            }
          </div>

          <div class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              @for (label of kpiLabels; track label) {
                <div
                  class="rounded-2xl border border-white/10 bg-white/5 px-2 py-2 backdrop-blur-md sm:px-4 sm:py-4"
                >
                  <p class="text-sm text-white/45">{{ label }}</p>
                  <app-text-stub
                    class="mt-2 block text-xl leading-none font-medium sm:text-2xl"
                    bar="inset-y-0 left-0 my-auto h-5 w-14 rounded-full sm:h-6"
                  ></app-text-stub>
                </div>
              }
            </div>

            <div
              class="rounded-2xl border border-white/10 bg-white/5 px-2 py-2 backdrop-blur-md sm:px-4 sm:py-4"
              aria-hidden="true"
            >
              <div class="flex flex-wrap items-center gap-2">
                @for (chip of chipWidths; track $index) {
                  <span
                    class="inline-flex animate-pulse items-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs font-medium sm:text-sm"
                    [style.width.px]="chip"
                    >&nbsp;</span
                  >
                }
              </div>
            </div>

            <div
              class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
            >
              <h2 class="mb-4 text-base font-medium text-white sm:text-xl">
                {{ statusTitle }}
              </h2>
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                @for (item of statusItems; track item.key) {
                  <div
                    class="rounded-2xl border border-white/10 bg-white/5 px-2 py-2 backdrop-blur-md sm:px-4 sm:py-4"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-sm text-white/60">{{ item.label }}</p>
                        <app-text-stub
                          class="block text-xl leading-none font-medium sm:text-2xl"
                          bar="inset-y-0 left-0 my-auto h-5 w-8 rounded-full sm:h-6"
                        ></app-text-stub>
                      </div>
                      <div
                        [class]="'h-12 w-12 rounded-full opacity-20 ' + item.color"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div
              class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
            >
              <h2 class="mb-4 text-base font-medium text-white sm:text-xl">
                {{ readinessTitle }}
              </h2>
              <div class="space-y-3">
                @for (range of readinessRanges; track range) {
                  <div class="flex items-center gap-4">
                    <div class="w-24 text-sm text-white/60">{{ range }}</div>
                    <div class="flex-1">
                      <div class="h-6 animate-pulse rounded-full bg-white/10"></div>
                    </div>
                    <app-text-stub
                      class="block w-12 text-sm"
                      bar="inset-y-0 right-0 my-auto h-4 w-6 rounded-full"
                    ></app-text-stub>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InsightsSkeletonComponent {
  readonly meta = PRIVATE_PAGE_META['/business-insights'];
  readonly filterLabels = INSIGHTS_FILTER_LABELS;
  readonly filterDefaults = INSIGHTS_DEFAULT_FILTER_DISPLAY;
  readonly tabs = INSIGHTS_TABS;
  readonly kpiLabels = INSIGHTS_KPI_LABELS;
  readonly statusTitle = INSIGHTS_STATUS_DISTRIBUTION_TITLE;
  readonly statusItems = INSIGHTS_STATUS_ITEMS;
  readonly readinessTitle = INSIGHTS_READINESS_DISTRIBUTION_TITLE;
  readonly readinessRanges = INSIGHTS_READINESS_RANGES;
  readonly chipWidths = [112, 92, 76, 84, 92, 96, 120];
}
