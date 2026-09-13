import { CommonModule, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { filter, map, startWith, tap } from 'rxjs/operators';
import { isPrivateShellUrl, resolveBrowserPath } from '@/app/constants/primary-navigation';
import { ToastContainerComponent } from '@/app/components/ui/toast-container.component';
import { AppShellHeaderComponent } from '@/app/components/ui/app-shell-header.component';
import { AppShellFooterComponent } from '@/app/components/ui/app-shell-footer.component';
import { RouteContentPlaceholderComponent } from '@/app/components/ui/route-content-placeholder.component';
import { AuthService } from '@/app/service/auth.service';
import { ShellContentState } from '@/app/service/shell-content.state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    AppShellHeaderComponent,
    AppShellFooterComponent,
    RouteContentPlaceholderComponent,
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
  private readonly shellContent = inject(ShellContentState);

  private navigationSettled = false;
  readonly rootOutletActive = signal(false);

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
      toObservable(this.shellContent.childActive),
    ]).pipe(map(() => this.resolveLayout(this.activatedRoute))),
    { initialValue: this.resolveLayout(this.activatedRoute) }
  );

  readonly showContentPlaceholder = computed(
    () => this.layout() === 'private' && !this.shellContent.childActive()
  );

  onRootActivate(): void {
    this.rootOutletActive.set(true);
  }

  onRootDeactivate(): void {
    this.rootOutletActive.set(false);
    this.shellContent.childActive.set(false);
  }

  private resolveLayout(route: ActivatedRoute): string {
    const url = this.currentPath();

    if (url.startsWith('/login')) {
      return 'auth';
    }

    if (isPrivateShellUrl(url)) {
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

  private currentPath(): string {
    return resolveBrowserPath(this.location.path(), this.router.url);
  }
}
