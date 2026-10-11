import { Component } from '@angular/core';
import {
  INSIGHTS_DEFAULT_FILTER_DISPLAY,
  INSIGHTS_FILTER_ICONS,
  INSIGHTS_FILTER_LABELS,
  INSIGHTS_KPIS,
  INSIGHTS_READINESS_DISTRIBUTION_TITLE,
  INSIGHTS_READINESS_RANGES,
  INSIGHTS_SECTION_ICONS,
  INSIGHTS_STATUS_DISTRIBUTION_TITLE,
  INSIGHTS_STATUS_ITEMS,
  INSIGHTS_TAB_ACTIVE_CLASS,
  INSIGHTS_TAB_IDLE_CLASS,
  INSIGHTS_TABS,
} from '@/app/constants/business-insights';
import { PRIVATE_PAGE_META } from '@/app/constants/private-page-meta';
import { AppIconComponent } from './app-icon.component';
import { FieldLabelComponent } from './field-label.component';
import { KpiStatCardComponent } from './kpi-stat-card.component';
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
    FieldLabelComponent,
    KpiStatCardComponent,
    PageHeaderComponent,
    SelectTriggerPreviewComponent,
    TextStubComponent,
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
        <button type="button" class="eh-action-btn eh-action-btn-outline" disabled>
          <lucide-icon name="download" [size]="16"></lucide-icon>
          <span>Export CSV</span>
        </button>
        <button type="button" class="eh-action-btn eh-action-btn-outline" disabled>
          <lucide-icon name="file-down" [size]="16"></lucide-icon>
          <span>Export PDF</span>
        </button>
      </app-page-header>

      <div class="eh-content-stack">
        <div class="eh-section-card">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <app-field-label
                [text]="filterLabels.dateRange"
                [icon]="filterIcons.dateRange"
                [aboveControl]="true"
              ></app-field-label>
              <app-select-trigger-preview
                [label]="filterDefaults.dateRange.label"
                [icon]="filterDefaults.dateRange.icon"
              ></app-select-trigger-preview>
            </div>
            <div>
              <app-field-label
                [text]="filterLabels.department"
                [icon]="filterIcons.department"
                [aboveControl]="true"
              ></app-field-label>
              <app-select-trigger-preview
                [label]="filterDefaults.department.label"
                [icon]="filterDefaults.department.icon"
              ></app-select-trigger-preview>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="flex gap-2 overflow-x-auto border-b border-white/10">
            @for (tab of tabs; track tab.id; let first = $first) {
              <span [class]="first ? tabActiveClass : tabIdleClass">
                <lucide-icon [name]="tab.icon" [size]="14"></lucide-icon>
                {{ tab.label }}
              </span>
            }
          </div>

          <div class="space-y-6">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              @for (kpi of kpis; track kpi.label) {
                <app-kpi-stat-card
                  [label]="kpi.label"
                  value=""
                  [icon]="kpi.icon"
                  [tone]="kpi.tone"
                  [loading]="true"
                ></app-kpi-stat-card>
              }
            </div>

            <div class="eh-panel" aria-hidden="true">
              <div class="flex flex-wrap items-center gap-2">
                @for (chip of chipWidths; track $index) {
                  <span
                    class="eh-badge eh-badge-neutral animate-pulse"
                    [style.width.px]="chip"
                    >&nbsp;</span
                  >
                }
              </div>
            </div>

            <section class="eh-section-card">
              <h2 class="eh-section-heading">
                <lucide-icon [name]="sectionIcons.status" [size]="18"></lucide-icon>
                <span>{{ statusTitle }}</span>
              </h2>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                @for (item of statusItems; track item.key) {
                  <app-kpi-stat-card
                    [label]="item.label"
                    value=""
                    [icon]="item.icon"
                    [tone]="item.tone"
                    [loading]="true"
                  ></app-kpi-stat-card>
                }
              </div>
            </section>

            <section class="eh-section-card">
              <h2 class="eh-section-heading">
                <lucide-icon [name]="sectionIcons.readiness" [size]="18"></lucide-icon>
                <span>{{ readinessTitle }}</span>
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
            </section>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class InsightsSkeletonComponent {
  readonly meta = PRIVATE_PAGE_META['/business-insights'];
  readonly filterLabels = INSIGHTS_FILTER_LABELS;
  readonly filterIcons = INSIGHTS_FILTER_ICONS;
  readonly filterDefaults = INSIGHTS_DEFAULT_FILTER_DISPLAY;
  readonly tabs = INSIGHTS_TABS;
  readonly tabActiveClass = INSIGHTS_TAB_ACTIVE_CLASS;
  readonly tabIdleClass = INSIGHTS_TAB_IDLE_CLASS;
  readonly kpis = INSIGHTS_KPIS;
  readonly sectionIcons = INSIGHTS_SECTION_ICONS;
  readonly statusTitle = INSIGHTS_STATUS_DISTRIBUTION_TITLE;
  readonly statusItems = INSIGHTS_STATUS_ITEMS;
  readonly readinessTitle = INSIGHTS_READINESS_DISTRIBUTION_TITLE;
  readonly readinessRanges = INSIGHTS_READINESS_RANGES;
  readonly chipWidths = [136, 104, 88, 96, 104, 108, 132];
}
