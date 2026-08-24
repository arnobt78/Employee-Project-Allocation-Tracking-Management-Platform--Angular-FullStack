import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { MasterService } from './master.service';
import { AuthUser, IApiResponse } from '../model/interface/master';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly masterService = inject(MasterService);
  private readonly router = inject(Router);

  private readonly sessionSignal = signal<AuthUser | null>(null);
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  private sessionCheck$: Observable<AuthUser | null> | null = null;

  ensureSession(): Observable<AuthUser | null> {
    const current = this.sessionSignal();
    if (current) {
      return of(current);
    }

    if (!this.sessionCheck$) {
      this.sessionCheck$ = this.masterService.getSession().pipe(
        map((response) => (response.result ? response.data ?? null : null)),
        tap((user) => this.sessionSignal.set(user)),
        catchError(() => {
          this.sessionSignal.set(null);
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
    return this.masterService.login({ username, password }).pipe(
      tap((response) => {
        if (response.result && response.data) {
          this.sessionSignal.set(response.data);
        }
      })
    );
  }

  logout(): Observable<IApiResponse<null>> {
    return this.masterService.logout().pipe(
      tap(() => {
        this.sessionSignal.set(null);
        this.masterService.clearAllCaches();
      }),
      catchError(() => {
        this.sessionSignal.set(null);
        this.masterService.clearAllCaches();
        return of({ result: true, message: 'Logged out', data: null });
      })
    );
  }

  handleUnauthorized(): void {
    this.sessionSignal.set(null);
    this.masterService.clearAllCaches();
    if (!this.router.url.startsWith('/login')) {
      void this.router.navigateByUrl('/login');
    }
  }
}
