import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { UserAvatarComponent } from './user-avatar.component';

export interface SelectMenuOption {
  value: string;
  label: string;
  subtitle?: string;
  /** Lucide icon name when no avatar is provided. */
  icon?: string;
  imageSeed?: string;
  imageUrl?: string | null;
}

@Component({
  selector: 'app-select-menu-panel',
  standalone: true,
  imports: [AppIconComponent, CommonModule, UserAvatarComponent],
  template: `
    <ul
      role="listbox"
      class="eh-scrollbar box-border flex w-full max-h-72 flex-col gap-1 overflow-auto rounded-2xl border border-white/15 bg-slate-950/95 p-2 shadow-[0_25px_70px_rgba(9,14,33,0.65)] backdrop-blur-md"
    >
      @for (option of options; track option.value; let index = $index) {
        <li
          role="option"
          [attr.aria-selected]="option.value === selectedValue"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition"
          [class.bg-white/10]="option.value === selectedValue"
          [class.text-white]="option.value === selectedValue"
          [class.text-white/80]="option.value !== selectedValue"
          [class.hover:bg-white/10]="option.value !== selectedValue"
          (click)="pick(option.value)"
          (mouseenter)="activeIndex = index"
        >
          @if (option.imageUrl || option.imageSeed) {
            <app-user-avatar
              [seed]="option.imageSeed || option.value"
              [imageUrl]="option.imageUrl ?? null"
              [label]="option.label"
              [size]="28"
              [alt]="''"
            ></app-user-avatar>
          } @else {
            <lucide-icon
              [name]="option.icon || 'circle'"
              [size]="16"
              class="shrink-0 text-white/70"
            ></lucide-icon>
          }
          <div class="min-w-0 flex-1 leading-tight">
            <p class="truncate text-sm font-medium">{{ option.label }}</p>
            @if (option.subtitle) {
              <p class="truncate text-xs text-white/50">
                {{ option.subtitle }}
              </p>
            }
          </div>
          @if (option.value === selectedValue) {
            <lucide-icon
              name="check"
              [size]="16"
              class="shrink-0 text-white/80"
            ></lucide-icon>
          }
        </li>
      }
      @if (showClear) {
        <li
          role="option"
          class="flex cursor-pointer items-center gap-1.5 rounded-xl border-t border-white/10 px-3 py-1.5 text-sm text-white/60 transition hover:bg-white/10 hover:text-white/80"
          (click)="pick('clear')"
        >
          <lucide-icon name="x" [size]="16" class="shrink-0"></lucide-icon>
          <span class="font-medium">Clear Selection</span>
        </li>
      }
    </ul>
  `,
})
class SelectMenuPanelComponent {
  options: SelectMenuOption[] = [];
  selectedValue = '';
  showClear = false;
  activeIndex = 0;
  pick = (_value: string) => {};
}

@Component({
  selector: 'app-select-menu',
  standalone: true,
  imports: [AppIconComponent, CommonModule, OverlayModule, UserAvatarComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectMenuComponent),
      multi: true,
    },
  ],
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
    `,
  ],
  template: `
    <button
      #trigger
      type="button"
      class="eh-select-trigger"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
      [disabled]="disabled"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <span class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        @if (selectedOption(); as selected) {
          @if (selected.imageUrl || selected.imageSeed) {
            <app-user-avatar
              [seed]="selected.imageSeed || selected.value"
              [imageUrl]="selected.imageUrl ?? null"
              [label]="selected.label"
              [size]="20"
              [alt]="''"
            ></app-user-avatar>
          } @else if (selected.icon) {
            <lucide-icon
              [name]="selected.icon"
              [size]="20"
              class="shrink-0 text-white/70"
            ></lucide-icon>
          }
          <span
            class="min-w-0 flex-1 truncate whitespace-nowrap text-left text-sm font-normal leading-none"
          >
            <span class="text-white">{{ selected.label }}</span>
            @if (selected.subtitle) {
              <span class="text-white/50"> · {{ selected.subtitle }}</span>
            }
          </span>
        } @else {
          @if (emptyIcon) {
            <lucide-icon
              [name]="emptyIcon"
              [size]="20"
              class="shrink-0 text-white/50"
            ></lucide-icon>
          }
          <span
            class="truncate whitespace-nowrap text-sm font-normal leading-none text-white/40"
            >{{ placeholder }}</span
          >
        }
      </span>
      <lucide-icon
        name="chevron-down"
        [size]="16"
        class="shrink-0 text-white/60 transition"
        [class.rotate-180]="isOpen()"
      ></lucide-icon>
    </button>
  `,
})
export class SelectMenuComponent
  implements ControlValueAccessor, OnChanges, OnDestroy
{
  private readonly overlay = inject(Overlay);

  @ViewChild('trigger', { static: true })
  trigger!: ElementRef<HTMLButtonElement>;

  @Input() options: SelectMenuOption[] = [];
  @Input() placeholder = 'Select An Option';
  /** Lucide icon on the left when empty (e.g. `users` on login). */
  @Input() emptyIcon = '';
  @Input() disabled = false;
  /** When false, hide Clear Selection (filters / required fields). */
  @Input() clearable = true;
  /** Emit `number | null` via CVA (empty → null). */
  @Input() numeric = false;

  @Output() selectionChange = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly selectedOption = signal<SelectMenuOption | null>(null);

  private value = '';
  private overlayRef: OverlayRef | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options']) {
      this.syncSelection();
    }
  }

  ngOnDestroy(): void {
    this.teardownResizeSync();
    this.close();
  }

  writeValue(value: string | number | null): void {
    this.value =
      value === null || value === undefined || value === ''
        ? ''
        : String(value);
    this.syncSelection();
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.open();
  }

  open(): void {
    if (this.overlayRef) {
      return;
    }

    const triggerEl = this.trigger.nativeElement;
    const paneWidth = this.measurePaneWidth();

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.trigger)
      .withFlexibleDimensions(false)
      .withGrowAfterOpen(false)
      .withPositions([
        {
          originX: 'start',
          originY: 'bottom',
          overlayX: 'start',
          overlayY: 'top',
          offsetY: 8,
        },
        {
          originX: 'start',
          originY: 'top',
          overlayX: 'start',
          overlayY: 'bottom',
          offsetY: -8,
        },
      ])
      .withPush(true);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      panelClass: 'eh-select-menu-pane',
      width: paneWidth,
      minWidth: paneWidth,
      maxWidth: paneWidth,
    });

    this.applyPaneWidth(paneWidth);

    const portal = new ComponentPortal(SelectMenuPanelComponent);
    const componentRef = this.overlayRef.attach(portal);
    componentRef.instance.options = this.options;
    componentRef.instance.selectedValue = this.value;
    componentRef.instance.showClear =
      this.clearable && !!this.value && this.value !== 'clear';
    componentRef.instance.pick = (nextValue: string) => {
      this.selectValue(nextValue);
      this.close();
    };

    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });

    this.setupResizeSync(triggerEl);
    this.isOpen.set(true);
  }

  close(): void {
    this.teardownResizeSync();
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.isOpen.set(false);
    this.onTouched();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
    if (event.key === 'ArrowDown' && !this.isOpen()) {
      event.preventDefault();
      this.open();
    }
  }

  private selectValue(nextValue: string): void {
    this.value = nextValue === 'clear' ? '' : nextValue;
    this.syncSelection();
    const emitted: string | number | null = this.numeric
      ? this.value === ''
        ? null
        : Number(this.value)
      : this.value;
    this.onChange(emitted);
    this.selectionChange.emit(nextValue === 'clear' ? 'clear' : this.value);
  }

  private syncSelection(): void {
    const match = this.options.find((option) => option.value === this.value);
    this.selectedOption.set(match ?? null);
  }

  /** Pane at least trigger width and at least 16rem; cap only by viewport. */
  private measurePaneWidth(): number {
    const triggerWidth = this.measureTriggerWidth();
    const minRem = 16 * this.rootFontSize();
    const viewportCap =
      typeof window !== 'undefined'
        ? Math.max(minRem, window.innerWidth - 32)
        : triggerWidth;
    return Math.ceil(Math.min(viewportCap, Math.max(triggerWidth, minRem)));
  }

  private rootFontSize(): number {
    if (typeof window === 'undefined' || !document.documentElement) {
      return 16;
    }
    const raw = getComputedStyle(document.documentElement).fontSize;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 16;
  }

  /** Match overlay pane to the live trigger width (responsive screens). */
  private measureTriggerWidth(): number {
    return Math.ceil(this.trigger.nativeElement.getBoundingClientRect().width);
  }

  private applyPaneWidth(width: number): void {
    if (!this.overlayRef) {
      return;
    }
    const pane = this.overlayRef.overlayElement;
    pane.style.setProperty('--eh-select-trigger-width', `${width}px`);
    this.overlayRef.updateSize({
      width,
      minWidth: width,
      maxWidth: width,
    });
  }

  private setupResizeSync(triggerEl: HTMLElement): void {
    this.teardownResizeSync();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.overlayRef) {
        return;
      }
      this.applyPaneWidth(this.measurePaneWidth());
    });
    this.resizeObserver.observe(triggerEl);
  }

  private teardownResizeSync(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
