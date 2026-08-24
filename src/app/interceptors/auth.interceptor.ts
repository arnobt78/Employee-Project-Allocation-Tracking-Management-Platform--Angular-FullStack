import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../service/auth.service';

const PUBLIC_ENDPOINTS = ['Login', 'GetDemoAccounts', 'Session'];

function isPublicApiRequest(url: string): boolean {
  const base = environment.api.baseUrl;
  if (!url.includes(base)) {
    return false;
  }
  return PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const apiBase = environment.api.baseUrl;
  const shouldAttachCredentials =
    req.url.startsWith(apiBase) || req.url.startsWith('/api/employee-management');

  const request = shouldAttachCredentials
    ? req.clone({ withCredentials: true })
    : req;

  return next(request).pipe(
    catchError((error) => {
      if (
        error?.status === 401 &&
        shouldAttachCredentials &&
        !isPublicApiRequest(req.url)
      ) {
        authService.handleUnauthorized();
      }
      return throwError(() => error);
    })
  );
};
