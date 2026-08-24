import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-hover-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      #trigger
      (mouseenter)="onTriggerMouseEnter($event)"
      (mouseleave)="onTriggerMouseLeave()"
      (mousemove)="onTriggerMouseMove($event)"
      style="display: inline;"
    >
      <ng-content />
    </span>
    @if (isOpen()) {
    <div
      class="fixed z-[99999] min-w-[280px] max-w-[320px] rounded-2xl border-2 border-white/30 bg-gray-900 p-4 shadow-2xl"
      [style.left.px]="position().x"
      [style.top.px]="position().y"
      [style.background-color]="'rgba(17, 24, 39, 0.98)'"
      [@tooltipAnimation]
      (mouseenter)="onTooltipMouseEnter()"
      (mouseleave)="onTooltipMouseLeave()"
      #tooltip
    >
      <ng-content select="[tooltipContent]" />
    </div>
    }
  `,
  animations: [
    trigger('tooltipAnimation', [
      transition(':enter', [
        style({
          opacity: 0,
          transform: 'translateY(-8px) scale(0.95)',
        }),
        animate(
          '150ms ease-out',
          style({
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          })
        ),
      ]),
      transition(':leave', [
        animate(
          '100ms ease-in',
          style({
            opacity: 0,
            transform: 'translateY(-4px) scale(0.98)',
          })
        ),
      ]),
    ]),
  ],
})
export class HoverTooltipComponent {
  readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  readonly tooltip = viewChild<ElementRef<HTMLElement>>('tooltip');

  readonly side = input<'top' | 'bottom'>('bottom');
  readonly sideOffset = input<number>(8);
  readonly alignOffset = input<number>(0);

  readonly isOpenSignal = signal<boolean>(false);
  readonly isOpen = this.isOpenSignal.asReadonly();

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly closeDelay = 100;

  readonly position = signal<{ x: number; y: number }>({ x: 0, y: 0 });

  private isTooltipHovered = false;
  private lastMouseEvent: MouseEvent | null = null;

  onTriggerMouseMove(event: MouseEvent): void {
    // This helps ensure events are being captured
    if (!this.isOpen()) {
      this.onTriggerMouseEnter(event);
    }
  }

  onTriggerMouseEnter(event: MouseEvent): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    this.lastMouseEvent = event;
    this.isOpenSignal.set(true);
    // Calculate position immediately after opening
    setTimeout(() => this.calculatePosition(event), 0);
  }

  onTriggerMouseLeave(): void {
    this.hoverTimeout = setTimeout(() => {
      if (!this.isTooltipHovered) {
        this.isOpenSignal.set(false);
      }
      this.hoverTimeout = null;
    }, this.closeDelay);
  }

  onTooltipMouseEnter(): void {
    this.isTooltipHovered = true;
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  onTooltipMouseLeave(): void {
    this.isTooltipHovered = false;
    this.isOpenSignal.set(false);
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  private calculatePosition(event: MouseEvent): void {
    const triggerEl = this.trigger()?.nativeElement;
    const tooltipEl = this.tooltip()?.nativeElement;

    if (!triggerEl || !tooltipEl) {
      // Retry if elements aren't ready
      setTimeout(() => this.calculatePosition(event), 10);
      return;
    }

    // Simple approach: go up the DOM tree to find the date cell
    // Structure: trigger span -> app-hover-tooltip host -> div.space-y-1 -> date cell div
    let dateCell: HTMLElement = triggerEl;

    // Go up 3 levels: trigger -> component host -> space-y-1 div -> date cell
    if (triggerEl.parentElement) {
      const level1 = triggerEl.parentElement; // app-hover-tooltip host
      if (level1.parentElement) {
        const level2 = level1.parentElement; // div.space-y-1
        if (level2.parentElement) {
          dateCell = level2.parentElement; // date cell div
        } else {
          dateCell = level2;
        }
      } else {
        dateCell = level1;
      }
    }

    // Position tooltip at (0,0) first so we can measure it
    this.position.set({ x: 0, y: 0 });

    // Force a reflow to ensure the tooltip is rendered and measured
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dateCellRect = dateCell.getBoundingClientRect();
        const tooltipRect = tooltipEl.getBoundingClientRect();

        if (tooltipRect.width > 0 && tooltipRect.height > 0) {
          this.calculateAndSetPosition(dateCellRect, tooltipRect);
        }
      });
    });
  }

  private calculateAndSetPosition(
    dateCellRect: DOMRect,
    tooltipRect: DOMRect
  ): void {
    const sideOffset = this.sideOffset();

    // Simple positioning: align tooltip exactly at the top-left of the date cell
    // Horizontal: align left edge of tooltip with left edge of date cell
    const x = dateCellRect.left;

    // Vertical: position tooltip exactly at the top edge of the date cell (above it)
    const y = dateCellRect.top - tooltipRect.height - sideOffset;

    this.position.set({ x, y });
  }
}
