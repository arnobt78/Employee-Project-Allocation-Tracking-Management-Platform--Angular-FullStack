import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Component, computed, signal } from '@angular/core';
import { Location } from '@angular/common';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './service/auth.service';
import { AuthUser } from './model/interface/master';

@Component({
  standalone: true,
  template: '<p>dashboard stub</p>',
})
class DashboardStubComponent {}

class AuthServiceStub {
  private readonly sessionSignal = signal<AuthUser | null>(null);
  private readonly sessionResolvedSignal = signal(false);
  readonly session = this.sessionSignal.asReadonly();
  readonly sessionResolved = this.sessionResolvedSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  ensureSession() {
    return of(this.sessionSignal());
  }

  setSessionState(user: AuthUser | null, resolved = true): void {
    this.sessionSignal.set(user);
    this.sessionResolvedSignal.set(resolved);
  }
}

describe('AppComponent', () => {
  let authStub: AuthServiceStub;

  beforeEach(async () => {
    authStub = new AuthServiceStub();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'dashboard',
            component: DashboardStubComponent,
            data: { layout: 'private' },
          },
          {
            path: 'login',
            component: DashboardStubComponent,
            data: { layout: 'auth' },
          },
        ]),
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'Employee Management' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Employee Management');
  });

  it('should paint private chrome for private URLs before navigation settles', async () => {
    authStub.setSessionState(null, false);
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('[data-testid="app-brand"]')?.textContent
    ).toContain('EmpowerHub');
    expect(compiled.querySelector('app-shell-footer')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="primary-nav"]')).toBeTruthy();
  });

  it('should prefer private shell for known private path even before NavigationEnd', () => {
    authStub.setSessionState(null, false);
    const location = TestBed.inject(Location);
    spyOn(location, 'path').and.returnValue('/employee');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled.querySelector('[data-testid="app-brand"]')?.textContent
    ).toContain('EmpowerHub');
    expect(compiled.querySelector('[data-testid="primary-nav"]')).toBeTruthy();
    expect(
      compiled.querySelector('[data-testid="early-route-placeholder"]')
    ).toBeTruthy();
    expect(
      compiled.querySelector('[data-testid="route-content-placeholder"]')
    ).toBeTruthy();
  });

  it('should highlight active nav from Location before session resolves', () => {
    authStub.setSessionState(null, false);
    const location = TestBed.inject(Location);
    spyOn(location, 'path').and.returnValue('/project-employee');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const active = compiled.querySelector(
      '[data-testid="primary-nav"] a.eh-nav-link-active'
    );
    expect(active?.textContent?.trim()).toBe('Project Team');
  });

  it('should show primary nav when authenticated on private shell', async () => {
    authStub.setSessionState(
      {
        username: 'admin',
        role: 'admin',
        displayName: 'Admin',
      },
      true
    );
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="primary-nav"]')).toBeTruthy();
  });

  it('should drop private chrome when session resolves unauthenticated', () => {
    authStub.setSessionState(null, true);
    const location = TestBed.inject(Location);
    spyOn(location, 'path').and.returnValue('/dashboard');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="app-brand"]')).toBeNull();
  });

  it('should keep auth layout on login', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/login');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="app-brand"]')).toBeNull();
  });
});
