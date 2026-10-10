import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  retry,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { MasterService } from './master.service';
import { ToastService } from '../components/ui/toast.service';
import { AuthUser, IApiResponse } from '../model/interface/master';

const LOGOUT_RETRIES = 2;
const LOGOUT_RETRY_DELAY_MS = 1500;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly masterService = inject(MasterService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private readonly sessionSignal = signal<AuthUser | null>(null);
  private readonly sessionResolvedSignal = signal(false);
  readonly session = this.sessionSignal.asReadonly();
  readonly sessionResolved = this.sessionResolvedSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  private sessionCheck$: Observable<AuthUser | null> | null = null;
  private pendingLogout$: Observable<null> | null = null;
  private authEpochValue = 0;

  ensureSession(): Observable<AuthUser | null> {
    const current = this.sessionSignal();
    if (current) {
      this.sessionResolvedSignal.set(true);
      return of(current);
    }

    if (this.sessionResolvedSignal() && !this.sessionCheck$) {
      return of(null);
    }

    if (!this.sessionCheck$) {
      this.sessionCheck$ = this.masterService.getSession().pipe(
        map((response) => (response.result ? response.data ?? null : null)),
        tap((user) => {
          this.sessionSignal.set(user);
          this.sessionResolvedSignal.set(true);
        }),
        catchError(() => {
          this.sessionSignal.set(null);
          this.sessionResolvedSignal.set(true);
          return of(null);
        }),
        finalize(() => {
          this.sessionCheck$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }

    return this.sessionCheck$;
  }

  login(username: string, password: string): Observable<IApiResponse<AuthUser>> {
    // A pending logout's response clears the cookie; let it land before the new one is set.
    return (this.pendingLogout$ ?? of(null)).pipe(
      switchMap(() => this.masterService.login({ username, password })),
      tap((response) => {
        if (response.result && response.data) {
          this.authEpochValue += 1;
          this.masterService.clearAllCaches();
          this.sessionSignal.set(response.data);
          this.sessionResolvedSignal.set(true);
        }
      })
    );
  }

  /**
   * Signs out locally at once so the caller can navigate immediately; the
   * server session is revoked in the background (retried, then reported).
   */
  logout(): void {
    this.authEpochValue += 1;
    this.sessionSignal.set(null);
    this.sessionResolvedSignal.set(true);
    this.masterService.clearAllCaches();

    const request$ = this.masterService.logout().pipe(
      retry({ count: LOGOUT_RETRIES, delay: LOGOUT_RETRY_DELAY_MS }),
      map(() => null),
      catchError(() => {
        this.toast.error({
          title: 'Sign-out not confirmed',
          description:
            'Could not reach the server to end your session. Sign in and out again when back online.',
          duration: 8000,
        });
        return of(null);
      }),
      finalize(() => {
        if (this.pendingLogout$ === request$) {
          this.pendingLogout$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.pendingLogout$ = request$;
    request$.subscribe();
  }

  /**
   * Changes on every sign-in/sign-out. A 401 for a request issued under an
   * older epoch belongs to an ended session and must not sign out the current one.
   */
  get authEpoch(): number {
    return this.authEpochValue;
  }

  handleUnauthorized(): void {
    this.authEpochValue += 1;
    this.sessionSignal.set(null);
    this.sessionResolvedSignal.set(true);
    this.masterService.clearAllCaches();
    if (!this.router.url.startsWith('/login')) {
      void this.router.navigateByUrl('/login');
    }
  }
}
