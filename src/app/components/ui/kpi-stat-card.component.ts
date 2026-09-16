import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

export type KpiStatTone =
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'violet'
  | 'rose'
  | 'slate';

@Component({
  selector: 'app-kpi-stat-card',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <article
      class="flex items-center justify-between gap-3 rounded-[24px] border bg-gradient-to-br p-3 sm:p-4 transition hover:brightness-110"
      [ngClass]="[toneClasses, glowClass]"
    >
      <div class="min-w-0">
        <p class="text-xs text-white/60 sm:text-sm">{{ label }}</p>
        <p class="mt-1 text-xl font-medium leading-none text-white sm:text-2xl">
          {{ value }}
        </p>
        @if (hint) {
          <p class="mt-2 text-xs text-white/55 sm:text-sm">{{ hint }}</p>
        }
      </div>
      @if (icon) {
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white/90"
          aria-hidden="true"
        >
          <lucide-icon [name]="icon" [size]="18"></lucide-icon>
        </span>
      }
    </article>
  `,
})
export class KpiStatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() hint = '';
  @Input() icon = '';
  @Input() tone: KpiStatTone = 'slate';

  get toneClasses(): string {
    switch (this.tone) {
      case 'sky':
        return 'border-sky-400/30 from-sky-500/25 via-sky-500/10 to-sky-500/5';
      case 'emerald':
        return 'border-emerald-400/30 from-emerald-500/25 via-emerald-500/10 to-emerald-500/5';
      case 'amber':
        return 'border-amber-400/30 from-amber-500/30 via-amber-500/15 to-amber-500/5';
      case 'violet':
        return 'border-violet-400/30 from-violet-500/25 via-violet-500/10 to-violet-500/5';
      case 'rose':
        return 'border-rose-400/30 from-rose-500/25 via-rose-500/10 to-rose-500/5';
      default:
        return 'border-white/10 from-white/10 via-white/5 to-transparent';
    }
  }

  get glowClass(): string {
    switch (this.tone) {
      case 'sky':
        return 'shadow-[0_30px_80px_rgba(2,132,199,0.35)]';
      case 'emerald':
        return 'shadow-[0_30px_80px_rgba(16,185,129,0.3)]';
      case 'amber':
        return 'shadow-[0_30px_80px_rgba(245,158,11,0.28)]';
      case 'violet':
        return 'shadow-[0_30px_80px_rgba(139,92,246,0.32)]';
      case 'rose':
        return 'shadow-[0_30px_80px_rgba(244,63,94,0.28)]';
      default:
        return 'shadow-[0_20px_50px_rgba(0,0,0,0.25)]';
    }
  }
}
