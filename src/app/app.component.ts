import { CommonModule, Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { filter, map, startWith, tap } from 'rxjs/operators';
import { isPrivateShellUrl } from '@/app/constants/primary-navigation';
import { ToastContainerComponent } from '@/app/components/ui/toast-container.component';
import { AppShellHeaderComponent } from '@/app/components/ui/app-shell-header.component';
import { AppShellFooterComponent } from '@/app/components/ui/app-shell-footer.component';
import { AuthService } from '@/app/service/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    AppShellHeaderComponent,
    AppShellFooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'Employee Management';
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  /** True after first NavigationEnd (guards finished for that navigation). */
  private navigationSettled = false;

  readonly layout = toSignal(
    combineLatest([
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        tap(() => {
          this.navigationSettled = true;
        }),
        startWith(null)
      ),
      toObservable(this.authService.sessionResolved),
      toObservable(this.authService.isAuthenticated),
    ]).pipe(map(() => this.resolveLayout(this.activatedRoute))),
    { initialValue: this.resolveLayout(this.activatedRoute) }
  );

  private resolveLayout(route: ActivatedRoute): string {
    const url = this.currentPath();

    if (url.startsWith('/login')) {
      return 'auth';
    }

    // Instant private chrome on known private URLs — avoids blank-shell flash on refresh.
    // Prefer browser/Location path: during bootstrap router.url can still be "/" while
    // authGuard awaits ensureSession() for the real URL (e.g. /dashboard).
    if (isPrivateShellUrl(url)) {
      // Guest after session resolve: drop private chrome before NavigationEnd redirect.
      if (
        this.authService.sessionResolved() &&
        !this.authService.isAuthenticated()
      ) {
        return 'auth';
      }
      return 'private';
    }

    if (url === '/') {
      return 'auth';
    }

    if (!this.navigationSettled) {
      return 'auth';
    }

    let current: ActivatedRoute = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current.snapshot.data['layout'] ?? 'default';
  }

  /** Pathname usable before NavigationEnd (hard refresh). */
  private currentPath(): string {
    const fromLocation = this.location.path().split('?')[0];
    if (fromLocation) {
      return fromLocation.startsWith('/') ? fromLocation : `/${fromLocation}`;
    }

    const fromRouter = this.router.url.split('?')[0];
    if (fromRouter && fromRouter !== '/') {
      return fromRouter;
    }

    if (typeof window !== 'undefined' && window.location?.pathname) {
      return window.location.pathname;
    }

    return '/';
  }
}
