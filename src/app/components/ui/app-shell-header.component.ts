import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  HELP_URL,
  PRIMARY_NAVIGATION_ITEMS,
} from '@/app/constants/primary-navigation';
import { AuthService } from '@/app/service/auth.service';
import { AppIconComponent } from './app-icon.component';
import { UbButtonDirective } from './button';
import { ProfileDropdownComponent } from './profile-dropdown.component';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    AppIconComponent,
    UbButtonDirective,
    ProfileDropdownComponent,
  ],
  template: `
    <header
      class="eh-shell-header sticky top-0 z-30 transition-[background-color,backdrop-filter,box-shadow] duration-200"
      [class.eh-shell-header--scrolled]="scrolled()"
    >
      <div class="eh-shell-inner">
        <div
          class="flex w-full items-center justify-between gap-3 border-b border-white/10 py-2"
        >
          <a
            routerLink="/dashboard"
            class="group flex shrink-0 items-center gap-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Go to dashboard"
          >
            <span
              class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-primary/30 backdrop-blur"
            >
              <img
                src="/favicon.ico"
                alt="EmpowerHub logo"
                class="h-9 w-9 object-contain"
              />
            </span>
            <span
              class="text-base font-medium tracking-tight text-foreground"
              data-testid="app-brand"
            >
              EmpowerHub
            </span>
          </a>

          <nav
            class="hidden items-center gap-1 text-sm font-medium text-muted-foreground xl:flex"
            aria-label="Primary"
            data-testid="primary-nav"
          >
            @for (item of navItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="eh-nav-link-active"
                [routerLinkActiveOptions]="
                  item.exact ? { exact: true } : { exact: false }
                "
                class="eh-nav-link whitespace-nowrap transition-colors hover:text-foreground"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 xl:hidden"
              (click)="openMobileMenu()"
              aria-label="Open navigation menu"
            >
              <lucide-icon name="menu" [size]="18"></lucide-icon>
            </button>

            @if (authService.isAuthenticated()) {
              <app-profile-dropdown></app-profile-dropdown>
            } @else if (!authService.sessionResolved()) {
              <span
                class="size-10 animate-pulse rounded-full border border-white/15 bg-white/10"
                aria-hidden="true"
              ></span>
            }
          </div>
        </div>
      </div>
    </header>

    @if (mobileOpen()) {
      <div class="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true">
        <button
          type="button"
          class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          aria-label="Close navigation menu"
          (click)="closeMobileMenu()"
        ></button>
        <aside
          class="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-white/10 bg-slate-950/95 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-md"
        >
          <div
            class="flex items-center justify-between border-b border-white/10 px-4 py-3"
          >
            <p class="text-sm font-medium text-white">Menu</p>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/80"
              (click)="closeMobileMenu()"
              aria-label="Close menu"
            >
              <lucide-icon name="x" [size]="16"></lucide-icon>
            </button>
          </div>
          <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Mobile">
            @for (item of navItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="eh-mobile-nav-active"
                [routerLinkActiveOptions]="
                  item.exact ? { exact: true } : { exact: false }
                "
                class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                (click)="closeMobileMenu()"
              >
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 shadow-inner shadow-primary/20"
                >
                  <lucide-icon [name]="item.iconName" [size]="16"></lucide-icon>
                </span>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
          <div class="border-t border-white/10 p-3">
            <a
              [href]="helpUrl"
              target="_blank"
              rel="noreferrer noopener"
              ubButton
              size="sm"
              variant="secondary"
              class="eh-btn-icon w-full justify-center shadow-lg shadow-primary/25"
              (click)="closeMobileMenu()"
            >
              <lucide-icon name="life-buoy" [size]="16"></lucide-icon>
              <span>Need Help</span>
            </a>
          </div>
        </aside>
      </div>
    }
  `,
})
export class AppShellHeaderComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly navItems = PRIMARY_NAVIGATION_ITEMS;
  readonly helpUrl = HELP_URL;
  readonly scrolled = signal(false);
  readonly mobileOpen = signal(false);

  ngOnInit(): void {
    this.syncScroll();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.closeMobileMenu());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.syncScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileOpen()) {
      this.closeMobileMenu();
    }
  }

  openMobileMenu(): void {
    this.mobileOpen.set(true);
  }

  closeMobileMenu(): void {
    this.mobileOpen.set(false);
  }

  private syncScroll(): void {
    this.scrolled.set(
      typeof window !== 'undefined' ? window.scrollY > 12 : false
    );
  }
}
