import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { robohashUrl } from '@/app/lib/media/robohash';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (src()) {
      <img
        [src]="src()"
        [alt]="alt"
        [width]="size"
        [height]="size"
        class="rounded-full object-cover bg-white/10"
        [style.width.px]="size"
        [style.height.px]="size"
        referrerpolicy="no-referrer"
        (error)="onImageError()"
      />
    } @else {
      <span
        class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-medium uppercase text-white/80"
        [style.width.px]="size"
        [style.height.px]="size"
        aria-hidden="true"
      >
        {{ initials() }}
      </span>
    }
  `,
})
export class UserAvatarComponent implements OnChanges {
  @Input() seed = '';
  @Input() imageUrl: string | null = null;
  @Input() alt = '';
  @Input() size = 36;
  @Input() label = '';

  readonly src = signal('');
  private failedPrimary = false;

  ngOnChanges(_changes: SimpleChanges): void {
    this.failedPrimary = false;
    this.resolveSrc();
  }

  initials(): string {
    const source = (this.label || this.seed || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }

  onImageError(): void {
    if (!this.failedPrimary && this.imageUrl) {
      this.failedPrimary = true;
      this.src.set(this.seed ? robohashUrl(this.seed, this.size) : '');
      return;
    }
    this.src.set('');
  }

  private resolveSrc(): void {
    if (this.imageUrl && !this.failedPrimary) {
      this.src.set(this.imageUrl);
      return;
    }
    if (this.seed) {
      this.src.set(robohashUrl(this.seed, this.size));
      return;
    }
    this.src.set('');
  }
}
