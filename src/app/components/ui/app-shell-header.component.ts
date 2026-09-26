import { CommonModule, Location } from '@angular/common';
import {
  Component,
  HostListener,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import {
  isPrimaryNavActive,
  PRIMARY_NAVIGATION_ITEMS,
  type PrimaryNavItem,
  resolveBrowserPath,
} from '@/app/constants/primary-navigation';
import { AuthService } from '@/app/service/auth.service';
import { AppIconComponent } from './app-icon.component';
import { ProfileDropdownComponent } from './profile-dropdown.component';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  host: {
    class:
      'eh-shell-header sticky top-0 z-30 block transition-[background-color,backdrop-filter,box-shadow] duration-200',
    '[class.eh-shell-header--scrolled]': 'scrolled()',
  },
  imports: [
    CommonModule,
    RouterLink,
    AppIconComponent,
    ProfileDropdownComponent,
  ],
  template: `
    <header>
      <div class="eh-shell-inner">
        <div class="flex w-full items-center justify-between gap-3 py-2">
          <a
            routerLink="/dashboard"
            class="group flex shrink-0 items-center gap-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Go to dashboard"
          >
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner shadow-primary/30 backdrop-blur"
            >
              <lucide-icon
                name="folder-git-2"
                [size]="22"
                class="text-sky-200"
                data-testid="app-brand-icon"
              ></lucide-icon>
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
                class="eh-nav-link whitespace-nowrap transition-colors hover:text-foreground"
                [class.eh-nav-link-active]="isNavActive(item)"
                [attr.aria-current]="isNavActive(item) ? 'page' : null"
              >
                {{ item.label }}
              </a>
            }
          </nav>

          <div class="flex items-center gap-2 sm:gap-3">
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
  `,
})
export class AppShellHeaderComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly navItems = PRIMARY_NAVIGATION_ITEMS;
  readonly scrolled = signal(false);

  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.resolvePath()),
    ),
    { initialValue: this.resolvePath() },
  );

  ngOnInit(): void {
    this.syncScroll();
  }

  isNavActive(item: PrimaryNavItem): boolean {
    return isPrimaryNavActive(this.currentPath(), item);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.syncScroll();
  }

  private resolvePath(): string {
    return resolveBrowserPath(this.location.path(), this.router.url);
  }

  private syncScroll(): void {
    this.scrolled.set(
      typeof window !== 'undefined' ? window.scrollY > 12 : false,
    );
  }
}
