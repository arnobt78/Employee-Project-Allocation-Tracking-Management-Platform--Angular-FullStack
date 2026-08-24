import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FloatingBackgroundComponent } from '@/app/components/ui/floating-background.component';
import { UbButtonDirective } from '@/app/components/ui/button';
import { OptimizedImageComponent } from '@/app/components/ui/optimized-image.component';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { environment } from '@/environments/environment';
import { ToastService } from '@/app/components/ui/toast.service';
import { AuthService } from '@/app/service/auth.service';
import { MasterService } from '@/app/service/master.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FloatingBackgroundComponent,
    UbButtonDirective,
    OptimizedImageComponent,
    SelectMenuComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  loginObj = {
    username: '',
    password: '',
  };

  selectedTestAccount = '';
  isSubmitting = false;

  readonly demoCredentials = environment.demoLogin;
  readonly accountOptions = signal<SelectMenuOption[]>([
    {
      value: 'admin',
      label: 'Admin Account',
    },
  ]);

  private readonly authService = inject(AuthService);
  private readonly masterService = inject(MasterService);
  private readonly toast = inject(ToastService);
  readonly router = inject(Router);

  readonly featureHighlights = [
    {
      title: 'Smart Dashboards',
      description:
        'Monitor people, projects & assignments in a single view with real-time insight.',
    },
    {
      title: 'Lightning Onboarding',
      description:
        'Invite new teammates, provision access & share documentation in a few clicks.',
    },
    {
      title: 'Predictive Analytics',
      description:
        'Anticipate resourcing needs with automated forecasting and talent signals.',
    },
  ];

  constructor() {
    this.loadDemoAccounts();
  }

  loadDemoAccounts(): void {
    this.masterService.getDemoAccounts().subscribe({
      next: (response) => {
        if (response.result && Array.isArray(response.data) && response.data.length) {
          this.accountOptions.set(
            response.data.map((account) => ({
              value: account.id,
              label: account.label,
            }))
          );
        }
      },
      error: () => {
        this.accountOptions.set([
          {
            value: 'admin',
            label: 'Admin Account',
          },
        ]);
      },
    });
  }

  onTestAccountSelect(value: string): void {
    if (!value || value === 'clear') {
      this.selectedTestAccount = '';
      this.loginObj.username = '';
      this.loginObj.password = '';
      return;
    }

    this.selectedTestAccount = value;
    this.loginObj.username = this.demoCredentials.username;
    this.loginObj.password = this.demoCredentials.password;
  }

  onLogin(): void {
    if (this.isSubmitting) {
      return;
    }

    const username = this.loginObj.username.trim();
    const password = this.loginObj.password;
    if (!username || !password) {
      this.toast.error({
        title: 'Missing credentials',
        description: 'Enter both username and password.',
      });
      return;
    }

    this.isSubmitting = true;
    this.authService
      .login(username, password)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (response) => {
          if (response.result) {
            void this.router.navigateByUrl('dashboard');
            this.toast.success({
              title: 'Welcome back!',
              description: 'You have been signed in successfully.',
            });
            return;
          }
          this.toast.error({
            title: 'Invalid credentials',
            description: response.message || 'Please double check your username and password.',
          });
        },
        error: (error) => {
          this.toast.error({
            title: 'Sign in failed',
            description:
              error?.error?.message ||
              'Unable to sign in. Please verify your credentials and try again.',
          });
        },
      });
  }
}
