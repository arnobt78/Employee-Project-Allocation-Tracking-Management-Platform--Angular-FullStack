import { Component, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '@/app/service/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
})
export class LayoutComponent {
  router = inject(Router);
  private readonly authService = inject(AuthService);

  logOff(): void {
    this.authService.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('login');
      },
      error: () => {
        void this.router.navigateByUrl('login');
      },
    });
  }
}
