import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppIconComponent } from './app-icon.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from './select-menu.component';

/** @deprecated Prefer ListToolbarMenuFilter + SelectMenu options. */
export interface ListToolbarFilterOption {
  value: string;
  label: string;
}

export interface ListToolbarMenuFilter {
  id: string;
  label: string;
  emptyIcon: string;
  value: string;
  options: SelectMenuOption[];
}

export interface ListToolbarMenuFilterChange {
  id: string;
  value: string;
}

@Component({
  selector: 'app-list-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, SelectMenuComponent],
  template: `
    <section
      class="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/5/70 px-2 py-2 shadow-[0_35px_90px_rgba(9,14,33,0.55)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
    >
      <div class="relative w-full min-w-0 sm:max-w-sm">
        <label [attr.for]="searchId" class="sr-only">{{ searchLabel }}</label>
        <span
          class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/50"
          aria-hidden="true"
        >
          <lucide-icon name="search" [size]="16"></lucide-icon>
        </span>
        <input
          [id]="searchId"
          type="search"
          [placeholder]="searchPlaceholder"
          class="w-full rounded-2xl border border-white/15 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white/80 shadow-inner shadow-slate-950/30 outline-none transition placeholder:text-white/40 focus:border-primary/60 focus:bg-white/10 focus:text-white focus:shadow-[0_10px_30px_rgba(59,130,246,0.25)]"
          [ngModel]="searchValue"
          (ngModelChange)="searchChange.emit($event)"
        />
      </div>

      <div
        class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
      >
        @if (hasActiveFilters) {
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-medium text-sky-300/90 transition hover:text-sky-200 sm:self-center"
            (click)="clearFilters.emit()"
          >
            <lucide-icon name="x" [size]="14"></lucide-icon>
            <span>Clear</span>
          </button>
        }

        @for (filter of menuFilters; track filter.id) {
          <div class="w-full min-w-0 sm:w-44">
            <app-select-menu
              [options]="filter.options"
              [placeholder]="filter.label + ': All'"
              [emptyIcon]="filter.emptyIcon"
              [clearable]="false"
              [ngModel]="matchedMenuValue(filter)"
              (ngModelChange)="onMenuFilter(filter.id, $event)"
              (selectionChange)="onMenuFilter(filter.id, $event)"
            ></app-select-menu>
          </div>
        }

        @if (!menuFilters.length && filterOptions.length) {
          <div class="relative w-full sm:w-52">
            <label [attr.for]="filterId" class="sr-only">{{ filterLabel }}</label>
            <span
              class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-white/50"
              aria-hidden="true"
            >
              <lucide-icon [name]="filterIcon" [size]="14"></lucide-icon>
            </span>
            <select
              [id]="filterId"
              class="w-full appearance-none rounded-2xl border border-white/15 bg-white/5 py-2.5 pl-9 pr-8 text-sm text-white/80 outline-none transition focus:border-primary/60 focus:bg-white/10 focus:text-white"
              [ngModel]="matchedFilterValue"
              (ngModelChange)="filterChange.emit($event)"
            >
              <option [ngValue]="''" class="bg-slate-950 text-white">
                {{ filterLabel }}: All
              </option>
              @for (opt of filterOptions; track opt.value) {
                <option [ngValue]="opt.value" class="bg-slate-950 text-white">
                  {{ filterLabel }}: {{ opt.label }}
                </option>
              }
            </select>
            <span
              class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/40"
              aria-hidden="true"
            >
              <lucide-icon name="chevron-down" [size]="14"></lucide-icon>
            </span>
          </div>
        }

        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <ng-content></ng-content>
        </div>
      </div>
    </section>
  `,
})
export class ListToolbarComponent {
  @Input() searchId = 'list-search';
  @Input() searchLabel = 'Search';
  @Input() searchPlaceholder = 'Search…';
  @Input() searchValue = '';
  @Input() filterId = 'list-filter';
  @Input() filterLabel = 'Filter';
  @Input() filterIcon = 'list-filter';
  @Input() filterValue = '';
  @Input() filterOptions: ListToolbarFilterOption[] = [];
  @Input() menuFilters: ListToolbarMenuFilter[] = [];
  @Input() hasActiveFilters = false;

  @Output() readonly searchChange = new EventEmitter<string>();
  @Output() readonly filterChange = new EventEmitter<string>();
  @Output() readonly menuFilterChange =
    new EventEmitter<ListToolbarMenuFilterChange>();
  @Output() readonly clearFilters = new EventEmitter<void>();

  get matchedFilterValue(): string {
    const raw = this.filterValue?.trim() ?? '';
    if (!raw) {
      return '';
    }
    const hit = this.filterOptions.find(
      (opt) => opt.value.toLowerCase() === raw.toLowerCase()
    );
    return hit?.value ?? raw;
  }

  matchedMenuValue(filter: ListToolbarMenuFilter): string {
    const raw = filter.value?.trim() ?? '';
    if (!raw) {
      return '';
    }
    const hit = filter.options.find(
      (opt) => opt.value.toLowerCase() === raw.toLowerCase()
    );
    return hit?.value ?? raw;
  }

  onMenuFilter(id: string, value: string | number | null): void {
    const next =
      value === null || value === undefined || value === 'clear'
        ? ''
        : String(value);
    this.menuFilterChange.emit({ id, value: next });
  }
}
