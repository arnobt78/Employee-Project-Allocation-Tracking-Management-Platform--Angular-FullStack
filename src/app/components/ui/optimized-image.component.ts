import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

type OptimizeOptions = {
  width?: number;
  height?: number;
  quality?: 'auto' | number;
};

@Component({
  selector: 'app-optimized-image',
  standalone: true,
  template: `
    <img
      [src]="resolvedSrc()"
      [attr.alt]="alt()"
      [attr.width]="width() ?? null"
      [attr.height]="height() ?? null"
      [class]="class()"
      [attr.loading]="priority() ? 'eager' : 'lazy'"
      [attr.fetchpriority]="priority() ? 'high' : null"
      decoding="async"
      [attr.sizes]="sizes() ?? null"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizedImageComponent {
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly class = input<string>('');
  readonly width = input<number | null | undefined>(undefined);
  readonly height = input<number | null | undefined>(undefined);
  readonly sizes = input<string | null | undefined>(undefined);
  readonly publicAsset = input(false);
  /** Above-the-fold images (e.g. LCP): load eagerly with high fetch priority. */
  readonly priority = input(false);
  readonly optimizeOptions = input<OptimizeOptions | undefined>(undefined);

  /**
   * Placeholder for future Cloudinary/public asset optimisation.
   * Currently just returns the src, but keeps existing workflow intact.
   */
  protected readonly resolvedSrc = computed(() => {
    const source = this.src();
    if (!source) {
      return '';
    }

    if (!this.publicAsset()) {
      return source;
    }

    if (!source.startsWith('/')) {
      return source;
    }

    const params = this.optimizeOptions();
    const searchParams = new URLSearchParams();
    if (params?.width) {
      searchParams.set('width', params.width.toString());
    }
    if (params?.height) {
      searchParams.set('height', params.height.toString());
    }
    if (params?.quality) {
      searchParams.set('quality', `${params.quality}`);
    }

    const query = searchParams.toString();
    return query ? `${source}?${query}` : source;
  });
}
