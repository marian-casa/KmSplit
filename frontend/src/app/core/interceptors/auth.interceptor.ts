import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Agrega "Authorization: Bearer <token>" a cada request (salvo
 * login/register), y "withCredentials: true" a TODOS -- esto último es lo
 * que hace que el navegador mande la cookie httpOnly del refresh token en
 * /auth/refresh y /auth/logout (en el resto de los endpoints la cookie
 * tiene path=/api/auth/, así que ni se manda).
 *
 * Si el backend responde 401 (access token vencido), intenta renovarlo con
 * /auth/refresh (que usa la cookie, no necesita nada de acá) y reintenta
 * la request original. Si el refresh también falla, cierra la sesión y
 * manda al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/register');
  const isRefreshEndpoint = req.url.includes('/auth/refresh');
  const token = auth.accessToken;

  let authReq = req.clone({ withCredentials: true });
  if (token && !isAuthEndpoint) {
    authReq = authReq.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const shouldTryRefresh = error.status === 401 && !isAuthEndpoint && !isRefreshEndpoint;

      if (shouldTryRefresh) {
        return auth.refresh().pipe(
          switchMap(({ access }) => {
            const retryReq = req.clone({
              withCredentials: true,
              setHeaders: { Authorization: `Bearer ${access}` },
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            auth.logout().subscribe();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
