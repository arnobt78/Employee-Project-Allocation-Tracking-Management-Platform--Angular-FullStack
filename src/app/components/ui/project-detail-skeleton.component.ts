import { Component, Input } from '@angular/core';
import {
  PROJECT_CONTENT_HELPER_COPY,
  PROJECT_CREATE_SECTION_VALUES,
  PROJECT_DETAIL_FOOTER_COPY,
  PROJECT_DETAIL_SECTION_LABELS,
  PROJECT_DETAIL_SECTION_ORDER,
  PROJECT_DETAIL_SUBTITLE,
  PROJECT_OVERVIEW_FIELD_LABELS,
  READINESS_CHECKLIST_COPY,
  READINESS_FIELD_LABELS,
  READINESS_TASK_DEFINITIONS,
} from '@/app/constants/project-detail';
import { ProjectDetailMode } from '@/app/constants/private-page-meta';
import { AppIconComponent } from './app-icon.component';
import { UbButtonDirective } from './button';
import { PageHeaderComponent } from './page-header.component';
import { ProjectHeaderMetaComponent } from './project-header-meta.component';
import { TextStubComponent } from './text-stub.component';

/**
 * Full-page loading mirror of project-form (header, readiness checklist,
 * section accordion, footer). Rendered by both the route placeholder and the
 * page's cold-load branch so refresh shows a single skeleton layer.
 * Keep structure in sync with project-form.component.html.
 */
@Component({
  selector: 'app-project-detail-skeleton',
  standalone: true,
  imports: [
    AppIconComponent,
    UbButtonDirective,
    PageHeaderComponent,
    ProjectHeaderMetaComponent,
    TextStubComponent,
  ],
  host: { class: 'block' },
  template: `
    <div
      class="text-white/85"
      data-testid="project-detail-skeleton"
      aria-busy="true"
    >
      <app-page-header
        [title]="mode === 'edit' ? '' : 'Untitled project'"
        [titlePending]="mode === 'edit'"
        [subtitle]="subtitle"
        [icon]="mode === 'edit' ? 'pencil' : 'folder-kanban'"
      >
        <app-project-header-meta
          [modeLabel]="mode === 'edit' ? 'Editing' : 'Draft'"
          [progress]="null"
        ></app-project-header-meta>
      </app-page-header>

      <div class="eh-content-stack">
        <section
          class="rounded-[28px] border border-white/10 bg-white/5/80 p-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:p-4"
        >
          <header
            class="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <h2 class="text-base font-medium text-white sm:text-xl">
                {{ checklistCopy.title }}
              </h2>
              <p class="text-xs text-white/55 sm:text-sm">
                {{ checklistCopy.subtitle }}
              </p>
            </div>
            <div
              class="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/65 sm:text-sm"
            >
              <app-text-stub
                class="w-12 text-2xl font-medium"
                bar="inset-0 my-auto h-7 rounded-full"
              ></app-text-stub>
              <span class="flex flex-col text-xs sm:text-sm">
                <span>Complete</span>
                <app-text-stub
                  class="w-10"
                  bar="inset-0 my-auto h-3 rounded-full"
                ></app-text-stub>
              </span>
            </div>
          </header>

          <div class="grid gap-4">
            @for (task of tasks; track task.id) {
              <div
                class="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left"
              >
                <div
                  class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-medium text-white">
                        {{ task.title }}
                      </span>
                      <span
                        class="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-white/50 sm:text-sm"
                      >
                        {{ task.category }}
                      </span>
                      <span
                        class="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/45 sm:text-sm"
                      >
                        {{ task.weight }} Pts
                      </span>
                    </div>
                    <p class="text-xs text-white/65 sm:text-sm">
                      {{ task.description }}
                    </p>
                  </div>
                  <span
                    class="h-7 w-24 shrink-0 animate-pulse rounded-full bg-white/10"
                    aria-hidden="true"
                  ></span>
                </div>

                <div class="grid gap-3 md:grid-cols-3">
                  @for (label of fieldRow; track label) {
                    <div class="flex flex-col gap-1">
                      <span class="text-xs text-white/50 sm:text-sm">{{
                        label
                      }}</span>
                      <div
                        class="h-11 animate-pulse rounded-2xl border border-white/15 bg-white/5"
                        aria-hidden="true"
                      ></div>
                    </div>
                  }
                </div>
                <div>
                  <span class="text-xs text-white/50 sm:text-sm">{{
                    fieldLabels.notes
                  }}</span>
                  <span
                    class="inline-block h-[58px] w-full animate-pulse rounded-2xl border border-white/15 bg-white/5"
                    aria-hidden="true"
                  ></span>
                </div>
              </div>
            }
          </div>
        </section>

        <section class="space-y-4">
          @for (section of sections; track section; let first = $first) {
            <div
              class="overflow-hidden rounded-[28px] border border-white/10 bg-white/5/75 shadow-[0_35px_90px_rgba(8,12,32,0.55)] backdrop-blur-md"
            >
              <div
                class="flex w-full items-center justify-between gap-4 px-2 py-2 text-left text-sm text-white/80 sm:px-4 sm:py-4"
              >
                <div class="flex flex-col gap-1">
                  <span class="text-sm font-medium text-white/55">{{
                    sectionLabels[section]
                  }}</span>
                  @if (mode === 'create') {
                    <span class="text-base font-medium text-white">
                      {{ createValues[section] }}
                    </span>
                  } @else {
                    <span
                      class="my-0.5 h-5 w-40 animate-pulse rounded-full bg-white/10"
                      aria-hidden="true"
                    ></span>
                  }
                </div>
                <span
                  class="text-xs text-white/40 sm:text-sm"
                  [class.text-white]="first"
                >
                  {{ first ? 'Hide' : 'Expand' }}
                </span>
              </div>
              @if (first) {
                <div
                  class="border-t border-white/10 px-2 py-2 text-sm text-white/75 sm:px-4 sm:py-4"
                >
                  @if (mode === 'create') {
                    <div class="grid gap-4 md:grid-cols-2">
                      @for (field of createFields; track field.label) {
                        <div>
                          <span class="text-xs text-white/50 sm:text-sm">{{
                            field.label
                          }}</span>
                          <span
                            class="block w-full animate-pulse rounded-2xl border border-white/15 bg-white/5"
                            [style.height.px]="field.height"
                            aria-hidden="true"
                          ></span>
                        </div>
                      }
                    </div>
                    <div class="mt-6 grid gap-4 md:grid-cols-2">
                      @for (area of createAreas; track area.label) {
                        <div [class]="area.wide ? 'md:col-span-2' : ''">
                          <span class="text-xs text-white/50 sm:text-sm">{{
                            area.label
                          }}</span>
                          <span
                            class="inline-block w-full animate-pulse rounded-2xl border border-white/15 bg-white/5"
                            [style.height.px]="area.height"
                            aria-hidden="true"
                          ></span>
                        </div>
                      }
                    </div>
                    <div class="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        disabled
                        class="eh-action-btn eh-action-btn-outline"
                      >
                        <lucide-icon name="x" [size]="14"></lucide-icon>
                        <span>Cancel</span>
                      </button>
                      <button
                        type="button"
                        disabled
                        class="eh-action-btn eh-action-btn-primary"
                      >
                        <lucide-icon name="plus" [size]="16"></lucide-icon>
                        <span>Create Project</span>
                      </button>
                    </div>
                  } @else {
                    <div class="grid gap-4 md:grid-cols-2" aria-hidden="true">
                      @for (cell of [1, 2, 3, 4]; track cell) {
                        <div
                          class="h-[70px] animate-pulse rounded-2xl border border-white/10 bg-white/5"
                        ></div>
                      }
                    </div>
                    @for (block of overviewBlocks; track $index) {
                      <div
                        class="animate-pulse rounded-2xl border border-white/10 bg-white/5"
                        [style.margin-top.px]="block.marginTop"
                        [style.height.px]="block.height"
                        aria-hidden="true"
                      ></div>
                    }
                    <div class="mt-6 flex justify-end" aria-hidden="true">
                      <div
                        class="h-[34px] w-32 animate-pulse rounded-xl bg-white/10"
                      ></div>
                    </div>
                  }
                  <div
                    class="mt-8 rounded-2xl border border-white/15 bg-white/5 px-2 py-2 sm:px-4 sm:py-4"
                  >
                    <div
                      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <p class="text-xs text-white/45 sm:text-sm">
                          {{ contentHelper.title }}
                        </p>
                        <p class="text-sm text-white/65">
                          {{ contentHelper.description }}
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled
                          class="rounded-xl border border-white/20 px-3 py-2 text-xs text-white/70"
                        >
                          {{ contentHelper.fetchContentful }}
                        </button>
                        <button
                          type="button"
                          ubButton
                          size="sm"
                          disabled
                          class="gap-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-[0_20px_45px_rgba(251,191,36,0.35)]"
                        >
                          <lucide-icon
                            name="wand-sparkles"
                            [size]="16"
                          ></lucide-icon>
                          <span>{{ contentHelper.generateAiDraft }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <footer
          class="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/5/70 px-2 py-2 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4"
        >
          <div class="space-y-1 text-xs text-white/60 sm:text-sm">
            <p>{{ footerCopy.autosave }}</p>
            @if (mode === 'edit') {
              <p class="text-white/50">{{ footerCopy.archive }}</p>
            }
          </div>
          <div class="flex flex-wrap items-center gap-3">
            @if (mode === 'edit') {
              <button
                type="button"
                disabled
                class="eh-btn-icon rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-xs text-rose-100 opacity-60 sm:text-sm"
              >
                <lucide-icon name="trash-2" [size]="16"></lucide-icon>
                <span>Archive Project</span>
              </button>
            }
            <button
              type="button"
              disabled
              class="eh-action-btn eh-action-btn-primary"
            >
              <lucide-icon
                [name]="mode === 'edit' ? 'save' : 'plus'"
                [size]="16"
              ></lucide-icon>
              <span>{{
                mode === 'edit' ? 'Save All Changes' : 'Create Project'
              }}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class ProjectDetailSkeletonComponent {
  @Input() mode: ProjectDetailMode = 'edit';

  readonly subtitle = PROJECT_DETAIL_SUBTITLE;
  readonly tasks = READINESS_TASK_DEFINITIONS;
  readonly checklistCopy = READINESS_CHECKLIST_COPY;
  readonly fieldLabels = READINESS_FIELD_LABELS;
  readonly fieldRow = [
    READINESS_FIELD_LABELS.status,
    READINESS_FIELD_LABELS.owner,
    READINESS_FIELD_LABELS.dueDate,
  ];
  readonly sections = PROJECT_DETAIL_SECTION_ORDER;
  readonly sectionLabels = PROJECT_DETAIL_SECTION_LABELS;
  readonly footerCopy = PROJECT_DETAIL_FOOTER_COPY;
  readonly contentHelper = PROJECT_CONTENT_HELPER_COPY;
  readonly createValues = PROJECT_CREATE_SECTION_VALUES;
  /** Create-mode overview inputs; the date input and select-menu row renders 2px taller. */
  readonly createFields = [
    { label: PROJECT_OVERVIEW_FIELD_LABELS.projectName, height: 46 },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.clientName, height: 46 },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.startDate, height: 48 },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.health, height: 48 },
  ];
  /** Create-mode overview textareas (rows=4 / rows=3). */
  readonly createAreas = [
    { label: PROJECT_OVERVIEW_FIELD_LABELS.summary, height: 106, wide: true },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.objectives, height: 106, wide: false },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.successCriteria, height: 106, wide: false },
    { label: PROJECT_OVERVIEW_FIELD_LABELS.stakeholderNotes, height: 86, wide: true },
  ];
  /** Overview preview cards (summary, objectives, success criteria, notes, stakeholders). */
  readonly overviewBlocks = [
    { marginTop: 24, height: 82 },
    { marginTop: 16, height: 130 },
    { marginTop: 16, height: 130 },
    { marginTop: 16, height: 82 },
  ];
}
