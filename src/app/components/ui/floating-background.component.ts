import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OptimizedImageComponent } from './optimized-image.component';

@Component({
  selector: 'app-floating-background',
  standalone: true,
  imports: [CommonModule, OptimizedImageComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      [ngClass]="baseBackgroundClass()"
      aria-hidden="true"
    >
      <ng-container *ngFor="let overlayClass of overlayLayers()">
        <div [class]="overlayClass"></div>
      </ng-container>

      <ng-container *ngIf="primarySrc() as primary">
        <div [class]="primaryWrapperClass()">
          <app-optimized-image
            [src]="primary"
            [alt]="primaryAlt()"
            [publicAsset]="primaryPublicAsset()"
            [class]="primaryImageClass()"
          />
        </div>
      </ng-container>

      <ng-container *ngIf="secondarySrc() as secondary">
        <div [class]="secondaryWrapperClass()">
          <app-optimized-image
            [src]="secondary"
            [alt]="secondaryAlt()"
            [publicAsset]="secondaryPublicAsset()"
            [class]="secondaryImageClass()"
          />
        </div>
      </ng-container>

      <ng-container *ngIf="accentLayerClass() as accentClass">
        <div [class]="accentClass"></div>
      </ng-container>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloatingBackgroundComponent {
  readonly primarySrc = input<string>('/employees.svg');
  readonly primaryAlt = input<string>('Decorative background illustration');
  readonly secondarySrc = input<string | null | undefined>(null);
  readonly secondaryAlt = input<string>(
    'Complementary background illustration'
  );
  readonly primaryPublicAsset = input<boolean>(true);
  readonly secondaryPublicAsset = input<boolean>(true);

  readonly baseBackgroundClass = input<string>('bg-[#020817]');
  readonly overlayLayers = input<string[]>([
    'absolute inset-0 bg-[#020817]',
    'absolute inset-0 bg-gradient-to-br from-[#0b1753]/80 via-[#020817] to-[#320a72]/70 opacity-95',
    'absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(58,130,246,0.25),transparent_60%)]',
    'absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.22),transparent_65%)]',
  ]);

  readonly primaryWrapperClass = input<string>(
    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-[110%] opacity-45'
  );
  readonly primaryImageClass = input<string>(
    'h-full w-full object-contain animate-float'
  );

  readonly secondaryWrapperClass = input<string>(
    'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-[120%] opacity-28'
  );
  readonly secondaryImageClass = input<string>(
    'h-full w-full object-contain animate-float-slow'
  );

  readonly accentLayerClass = input<string | null>(
    'absolute inset-x-[12%] top-1/3 h-[55%] rounded-full bg-gradient-to-r from-blue-500/25 via-transparent to-fuchsia-500/25 blur-[130px]'
  );
}
