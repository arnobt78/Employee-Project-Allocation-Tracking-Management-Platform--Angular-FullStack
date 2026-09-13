import { Component } from '@angular/core';
import { HELP_URL } from '@/app/constants/primary-navigation';
import { AppIconComponent } from './app-icon.component';
import { UbButtonDirective } from './button';

@Component({
  selector: 'app-shell-footer',
  standalone: true,
  imports: [AppIconComponent, UbButtonDirective],
  template: `
    <footer class="eh-shell-footer">
      <div class="eh-shell-inner">
        <div
          class="flex w-full flex-col items-center justify-between gap-3 border-t border-white/10 py-2 text-xs text-muted-foreground sm:flex-row sm:py-2"
        >
          <p>&copy; {{ currentYear }}. All rights reserved.</p>
          <a
            [href]="helpUrl"
            target="_blank"
            rel="noreferrer noopener"
            ubButton
            size="sm"
            variant="secondary"
            class="eh-btn-icon inline-flex items-center justify-center shadow-lg shadow-primary/25"
          >
            <lucide-icon name="life-buoy" [size]="16"></lucide-icon>
            <span>Need Help</span>
          </a>
        </div>
      </div>
    </footer>
  `,
})
export class AppShellFooterComponent {
  readonly currentYear = new Date().getFullYear();
  readonly helpUrl = HELP_URL;
}
