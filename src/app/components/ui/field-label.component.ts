import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AppIconComponent } from './app-icon.component';

/** Shared form label with optional Lucide icon and required asterisk. */
@Component({
  selector: 'app-field-label',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <label
      class="flex items-center gap-1.5 text-xs font-medium text-white/70 sm:text-sm"
      [attr.for]="forId || null"
    >
      @if (icon) {
        <lucide-icon
          [name]="icon"
          [size]="14"
          class="shrink-0 text-white/55"
        ></lucide-icon>
      }
      <span>{{ text }}</span>
      @if (required) {
        <span class="text-rose-300" aria-hidden="true">*</span>
      }
    </label>
  `,
})
export class FieldLabelComponent {
  @Input() text = '';
  @Input() icon = '';
  @Input() forId = '';
  @Input() required = false;
}
