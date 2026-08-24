import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface SelectMenuOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select-menu-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul
      role="listbox"
      class="max-h-60 overflow-auto rounded-2xl border border-white/15 bg-slate-950/95 p-2 shadow-[0_25px_70px_rgba(9,14,33,0.65)] backdrop-blur-xl"
    >
      <li
        *ngFor="let option of options; let index = index"
        role="option"
        [attr.aria-selected]="option.value === selectedValue"
        class="cursor-pointer rounded-xl px-4 py-2.5 text-sm transition"
        [class.bg-white/10]="option.value === selectedValue"
        [class.text-white]="option.value === selectedValue"
        [class.text-white/80]="option.value !== selectedValue"
        [class.hover:bg-white/10]="option.value !== selectedValue"
        (click)="pick(option.value)"
        (mouseenter)="activeIndex = index"
      >
        {{ option.label }}
      </li>
    </ul>
  `,
})
class SelectMenuPanelComponent {
  options: SelectMenuOption[] = [];
  selectedValue = '';
  activeIndex = 0;
  pick = (_value: string) => {};
}

@Component({
  selector: 'app-select-menu',
  standalone: true,
  imports: [CommonModule, OverlayModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectMenuComponent),
      multi: true,
    },
  ],
  template: `
    <button
      #trigger
      type="button"
      class="flex w-full items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm text-white/85 outline-none backdrop-blur-sm transition focus:border-amber-400/60 focus:bg-white/10 focus:text-white disabled:cursor-not-allowed disabled:opacity-60"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
      [disabled]="disabled"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <span [class.text-white/40]="!selectedLabel()">{{ selectedLabel() || placeholder }}</span>
      <svg
        class="h-4 w-4 text-white/60 transition"
        [class.rotate-180]="isOpen()"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  `,
})
export class SelectMenuComponent implements ControlValueAccessor {
  private readonly overlay = inject(Overlay);

  @ViewChild('trigger', { static: true }) trigger!: ElementRef<HTMLButtonElement>;

  @Input() options: SelectMenuOption[] = [];
  @Input() placeholder = 'Select an option';
  @Input() disabled = false;

  @Output() selectionChange = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly selectedLabel = signal('');

  private value = '';
  private overlayRef: OverlayRef | null = null;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.syncLabel();
  }

  registerOnChange(fn: (value: string) => void): void {
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

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.trigger)
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
      width: this.trigger.nativeElement.offsetWidth,
    });

    const portal = new ComponentPortal(SelectMenuPanelComponent);
    const componentRef = this.overlayRef.attach(portal);
    componentRef.instance.options = this.options;
    componentRef.instance.selectedValue = this.value;
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

    this.isOpen.set(true);
  }

  close(): void {
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
    this.value = nextValue;
    this.syncLabel();
    this.onChange(nextValue);
    this.selectionChange.emit(nextValue);
  }

  private syncLabel(): void {
    const match = this.options.find((option) => option.value === this.value);
    this.selectedLabel.set(match?.label ?? '');
  }
}
