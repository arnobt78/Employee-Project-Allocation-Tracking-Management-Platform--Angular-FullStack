import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FloatingBackgroundComponent } from '@/app/components/ui/floating-background.component';
import { UbButtonDirective } from '@/app/components/ui/button';
import {
  SelectMenuComponent,
  SelectMenuOption,
} from '@/app/components/ui/select-menu.component';
import { environment } from '@/environments/environment';
import { ToastService } from '@/app/components/ui/toast.service';
import { AuthService } from '@/app/service/auth.service';
import { MasterService } from '@/app/service/master.service';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { DemoAccount } from '@/app/model/interface/master';
import { parseLoginCredentials } from '@/app/lib/validation/auth.schema';

type FeatureTone = 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';

interface FeatureHighlight {
  title: string;
  description: string;
  icon: string;
  tone: FeatureTone;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    FormsModule,
    FloatingBackgroundComponent,
    UbButtonDirective,
    SelectMenuComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnDestroy {
  loginObj = {
    username: '',
    password: '',
  };

  selectedTestAccount = '';
  isSubmitting = false;
  copiedField: 'username' | 'password' | null = null;
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  readonly demoCredentials = environment.demoLogin;
  private demoAccounts: DemoAccount[] = [];
  readonly accountOptions = signal<SelectMenuOption[]>([
    {
      value: 'admin',
      label: 'Admin Account',
      subtitle: 'admin',
      icon: 'shield-user',
      imageSeed: 'admin',
    },
  ]);

  private readonly authService = inject(AuthService);
  private readonly masterService = inject(MasterService);
  private readonly toast = inject(ToastService);
  readonly router = inject(Router);

  readonly featureHighlights: FeatureHighlight[] = [
    {
      title: 'Smart Dashboards',
      description:
        'Monitor people, projects & assignments in a single view with real-time insight.',
      icon: 'layout-dashboard',
      tone: 'sky',
    },
    {
      title: 'Lightning Onboarding',
      description:
        'Invite new teammates, provision access & share documentation in a few clicks.',
      icon: 'user-plus',
      tone: 'emerald',
    },
    {
      title: 'Predictive Analytics',
      description:
        'Anticipate resourcing needs with automated forecasting and talent signals.',
      icon: 'chart-column',
      tone: 'violet',
    },
    {
      title: 'Calendar & Timeline',
      description:
        'Track milestones, due dates, and delivery windows across every active project.',
      icon: 'calendar-range',
      tone: 'amber',
    },
    {
      title: 'Gantt Planning',
      description:
        'Visualize schedules, dependencies, and capacity with a clear planning view.',
      icon: 'folder-kanban',
      tone: 'rose',
    },
  ];

  readonly featureToneClasses: Record<FeatureTone, string> = {
    sky: 'border-sky-400/30 from-sky-500/25 via-sky-500/10 to-sky-500/5 hover:border-sky-300/50 shadow-[0_30px_80px_rgba(2,132,199,0.25)]',
    emerald:
      'border-emerald-400/30 from-emerald-500/25 via-emerald-500/10 to-emerald-500/5 hover:border-emerald-300/50 shadow-[0_30px_80px_rgba(16,185,129,0.25)]',
    violet:
      'border-violet-400/30 from-violet-500/25 via-violet-500/10 to-violet-500/5 hover:border-violet-300/50 shadow-[0_30px_80px_rgba(139,92,246,0.25)]',
    amber:
      'border-amber-400/30 from-amber-500/25 via-amber-500/10 to-amber-500/5 hover:border-amber-300/50 shadow-[0_30px_80px_rgba(245,158,11,0.25)]',
    rose: 'border-rose-400/30 from-rose-500/25 via-rose-500/10 to-rose-500/5 hover:border-rose-300/50 shadow-[0_30px_80px_rgba(244,63,94,0.25)]',
  };

  constructor() {
    this.loadDemoAccounts();
  }

  ngOnDestroy(): void {
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = null;
    }
  }

  loadDemoAccounts(): void {
    this.masterService.getDemoAccounts().subscribe({
      next: (response) => {
        if (
          response.result &&
          Array.isArray(response.data) &&
          response.data.length
        ) {
          this.demoAccounts = response.data;
          this.accountOptions.set(
            response.data.map((account) => ({
              value: account.id,
              label: account.label,
              subtitle: account.username,
              icon: account.role === 'admin' ? 'shield-user' : 'user',
              imageSeed: account.username,
            }))
          );
        }
      },
      error: () => {
        this.demoAccounts = [
          {
            id: 'admin',
            label: 'Admin Account',
            username: this.demoCredentials.username,
            role: 'admin',
          },
        ];
        this.accountOptions.set([
          {
            value: 'admin',
            label: 'Admin Account',
            subtitle: this.demoCredentials.username,
            icon: 'shield-user',
            imageSeed: this.demoCredentials.username,
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
    const account =
      this.demoAccounts.find((item) => item.id === value) ||
      this.demoAccounts.find((item) => item.username === value);

    this.loginObj.username =
      account?.username || this.demoCredentials.username;
    this.loginObj.password = this.demoCredentials.password;
  }

  async copyCredential(
    field: 'username' | 'password',
    value: string
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copiedField = field;
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = setTimeout(() => {
        this.copiedField = null;
        this.copyResetTimer = null;
      }, 1500);
    } catch {
      this.copiedField = null;
    }
  }

  onLogin(): void {
    if (this.isSubmitting) {
      return;
    }

    const parsed = parseLoginCredentials(this.loginObj);
    if (!parsed.success) {
      this.toast.error({
        title: 'Missing Credentials',
        description: parsed.message,
      });
      return;
    }

    const { username, password } = parsed.data;
    this.isSubmitting = true;
    this.authService.login(username, password).subscribe({
      next: (response) => {
        if (response.result) {
          this.toast.success({
            title: 'Welcome Back!',
            description: 'You have been signed in successfully.',
          });
          void this.router.navigateByUrl('dashboard').finally(() => {
            this.isSubmitting = false;
          });
          return;
        }
        this.isSubmitting = false;
        this.toast.error({
          title: 'Invalid Credentials',
          description:
            response.message ||
            'Please double check your username and password.',
        });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.toast.error({
          title: 'Sign In Failed',
          description:
            error?.error?.message ||
            'Unable to sign in. Please verify your credentials and try again.',
        });
      },
    });
  }
}
