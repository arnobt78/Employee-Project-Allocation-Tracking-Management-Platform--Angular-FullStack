import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FloatingBackgroundComponent } from '@/app/components/ui/floating-background.component';
import { UbButtonDirective } from '@/app/components/ui/button';
import {
  SelectMenuComponent,
  SelectMenuOption } from '@/app/components/ui/select-menu.component';
import { environment } from '@/environments/environment';
import { ToastService } from '@/app/components/ui/toast.service';
import { AuthService } from '@/app/service/auth.service';
import { MasterService } from '@/app/service/master.service';
import { AppIconComponent } from '@/app/components/ui/app-icon.component';
import { DemoAccount } from '@/app/model/interface/master';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    AppIconComponent,
    CommonModule,
    FormsModule,
    FloatingBackgroundComponent,
    UbButtonDirective,
    SelectMenuComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css' })
export class LoginComponent {
  loginObj = {
    username: '',
    password: '' };

  selectedTestAccount = '';
  isSubmitting = false;

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

  readonly featureHighlights = [
    {
      title: 'Smart Dashboards',
      description:
        'Monitor people, projects & assignments in a single view with real-time insight.' },
    {
      title: 'Lightning Onboarding',
      description:
        'Invite new teammates, provision access & share documentation in a few clicks.' },
    {
      title: 'Predictive Analytics',
      description:
        'Anticipate resourcing needs with automated forecasting and talent signals.' }];

  constructor() {
    this.loadDemoAccounts();
  }

  loadDemoAccounts(): void {
    this.masterService.getDemoAccounts().subscribe({
      next: (response) => {
        if (response.result && Array.isArray(response.data) && response.data.length) {
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
            role: 'admin' }];
        this.accountOptions.set([
          {
            value: 'admin',
            label: 'Admin Account',
            subtitle: this.demoCredentials.username,
            icon: 'shield-user',
            imageSeed: this.demoCredentials.username,
          },
        ]);
      } });
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

  onLogin(): void {
    if (this.isSubmitting) {
      return;
    }

    const username = this.loginObj.username.trim();
    const password = this.loginObj.password;
    if (!username || !password) {
      this.toast.error({
        title: 'Missing Credentials',
        description: 'Enter both username and password.' });
      return;
    }

    this.isSubmitting = true;
    this.authService.login(username, password).subscribe({
      next: (response) => {
        if (response.result) {
          this.toast.success({
            title: 'Welcome Back!',
            description: 'You have been signed in successfully.' });
          void this.router.navigateByUrl('dashboard').finally(() => {
            // Keep spinner until navigation finishes; then reset if still on login.
            this.isSubmitting = false;
          });
          return;
        }
        this.isSubmitting = false;
        this.toast.error({
          title: 'Invalid Credentials',
          description:
            response.message ||
            'Please double check your username and password.' });
      },
      error: (error) => {
        this.isSubmitting = false;
        this.toast.error({
          title: 'Sign In Failed',
          description:
            error?.error?.message ||
            'Unable to sign in. Please verify your credentials and try again.' });
      } });
  }
}
