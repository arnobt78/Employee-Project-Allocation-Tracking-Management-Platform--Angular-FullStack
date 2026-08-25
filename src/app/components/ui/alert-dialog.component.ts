import { Overlay, OverlayModule, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';

/**
 * Viewport-centered alert dialog via CDK Overlay on document.body
 * (escapes layout backdrop-filter containing blocks).
 * Parent controls open/close; does not auto-close on confirm.
 */
@Component({
  selector: 'app-alert-dialog',
  standalone: true,
  imports: [CommonModule, OverlayModule, AppIconComponent],
  template: `
    <ng-template #dialogTpl>
      <div
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="descId"
        class="w-[min(100vw-2rem,28rem)] rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-900/95 p-4 text-sm text-white shadow-[0_40px_120px_rgba(9,9,16,0.75)] backdrop-blur-xl sm:p-6"
        (click)="$event.stopPropagation()"
      >
        <h2 [id]="titleId" class="text-lg font-medium text-white">
          {{ title }}
        </h2>
        @if (description) {
          <p [id]="descId" class="mt-2 text-white/70">{{ description }}</p>
        }
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            [disabled]="busy"
            class="rounded-xl border border-white/20 px-4 py-2 text-xs text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            (click)="onCancel()"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            [disabled]="busy"
            class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            [ngClass]="
              variant === 'destructive'
                ? 'border border-rose-500/40 bg-rose-500/20 text-rose-100 shadow-[0_20px_45px_rgba(244,63,94,0.35)] hover:border-rose-400/60 hover:bg-rose-500/30'
                : 'border border-primary/40 bg-gradient-to-r from-primary/70 via-primary/50 to-primary/30 text-white shadow-[0_15px_35px_rgba(59,130,246,0.35)] hover:border-primary/50'
            "
            (click)="onConfirm()"
          >
            @if (busy) {
              <lucide-icon
                name="loader-circle"
                [size]="16"
                class="animate-spin"
              ></lucide-icon>
              <span>{{ busyLabel }}</span>
            } @else {
              @if (variant === 'destructive') {
                <lucide-icon name="trash-2" [size]="16"></lucide-icon>
              } @else {
                <lucide-icon name="save" [size]="16"></lucide-icon>
              }
              <span>{{ confirmLabel }}</span>
            }
          </button>
        </div>
      </div>
    </ng-template>
  `,
})
export class AlertDialogComponent implements OnChanges, OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly vcr = inject(ViewContainerRef);

  @ViewChild('dialogTpl', { static: true })
  dialogTpl!: TemplateRef<unknown>;

  @Input() open = false;
  @Input() title = 'Confirm';
  @Input() description = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'default' | 'destructive' = 'default';
  @Input() busy = false;
  @Input() busyLabel = 'Working...';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly titleId = `eh-alert-title-${Math.random().toString(36).slice(2, 9)}`;
  readonly descId = `eh-alert-desc-${Math.random().toString(36).slice(2, 9)}`;

  private overlayRef: OverlayRef | null = null;
  private keydownSub: { unsubscribe: () => void } | null = null;
  private backdropSub: { unsubscribe: () => void } | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.attach();
      } else {
        this.detach();
      }
    }
  }

  ngOnDestroy(): void {
    this.detach();
  }

  onConfirm(): void {
    if (this.busy) {
      return;
    }
    this.confirmed.emit();
  }

  onCancel(): void {
    if (this.busy) {
      return;
    }
    this.cancelled.emit();
  }

  private attach(): void {
    if (this.overlayRef) {
      return;
    }

    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'eh-alert-dialog-backdrop',
      panelClass: 'eh-alert-dialog-panel',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay
        .position()
        .global()
        .centerHorizontally()
        .centerVertically(),
    });

    this.overlayRef.attach(new TemplatePortal(this.dialogTpl, this.vcr));

    this.backdropSub = this.overlayRef.backdropClick().subscribe(() => {
      if (!this.busy) {
        this.cancelled.emit();
      }
    });

    this.keydownSub = this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape' && !this.busy) {
        event.preventDefault();
        this.cancelled.emit();
      }
    });
  }

  private detach(): void {
    this.keydownSub?.unsubscribe();
    this.backdropSub?.unsubscribe();
    this.keydownSub = null;
    this.backdropSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
