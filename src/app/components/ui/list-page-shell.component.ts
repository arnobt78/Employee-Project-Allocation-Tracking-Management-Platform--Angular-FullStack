import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PageHeaderComponent } from './page-header.component';

@Component({
  selector: 'app-list-page-shell',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <div class="space-y-6 text-white/85 sm:space-y-8">
      <app-page-header [title]="title" [subtitle]="subtitle" [icon]="icon">
        <ng-content select="[listShellActions]"></ng-content>
      </app-page-header>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ng-content select="[listShellKpis]"></ng-content>
      </div>

      <ng-content select="[listShellToolbar]"></ng-content>

      <div>
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class ListPageShellComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() icon = '';
}
