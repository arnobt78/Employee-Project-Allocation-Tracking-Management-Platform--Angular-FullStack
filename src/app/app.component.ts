import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith, tap } from 'rxjs/operators';
import { UbButtonDirective } from '@/app/components/ui/button';
import { ToastContainerComponent } from '@/app/components/ui/toast-container.component';
import { ProfileDropdownComponent } from '@/app/components/ui/profile-dropdown.component';
import { AuthService } from '@/app/service/auth.service';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    RouterOutlet,
    RouterLink,
    UbButtonDirective,
    ToastContainerComponent,
    ProfileDropdownComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css' })
export class AppComponent {
  title = 'Employee Management';
  readonly currentYear = new Date().getFullYear();
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  /** False until first NavigationEnd — avoids painting private chrome while Session resolves. */
  private navigationSettled = false;

  readonly layout = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      tap(() => {
        this.navigationSettled = true;
      }),
      startWith(null),
      map(() => this.resolveLayout(this.activatedRoute))
    ),
    { initialValue: this.resolveLayout(this.activatedRoute) }
  );

  private resolveLayout(route: ActivatedRoute): string {
    const url = this.router.url.split('?')[0];
    if (!this.navigationSettled || url === '/' || url.startsWith('/login')) {
      return 'auth';
    }

    let current: ActivatedRoute = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current.snapshot.data['layout'] ?? 'default';
  }
}
