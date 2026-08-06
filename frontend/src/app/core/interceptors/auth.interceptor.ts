import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Agrega "Authorization: Bearer <token>" a cada request (salvo login/register).
 * Si el backend responde 401 (access token vencido), intenta renovarlo UNA
 * vez con el refresh token y reintenta la request original. Si el refresh
 * también falla, cierra la sesión y manda al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/register');
  const isRefreshEndpoint = req.url.includes('/auth/refresh');
  const token = auth.accessToken;

  const authReq =
    token && !isAuthEndpoint
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const shouldTryRefresh =
        error.status === 401 && auth.refreshToken && !isAuthEndpoint && !isRefreshEndpoint;

      if (shouldTryRefresh) {
        return auth.refresh().pipe(
          switchMap(({ access }) => {
            const retryReq = req.clone({ setHeaders: { Authorization: `Bearer ${access}` } });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            auth.logout();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
