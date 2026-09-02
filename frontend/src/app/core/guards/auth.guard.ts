import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../services/auth.service';

/**
 * Si hay un access token guardado, primero intentamos un refresh silencioso
 * (usa la cookie httpOnly del refresh token). Esto:
 *   - valida que la sesión siga viva al entrar a la app,
 *   - renueva el access y (por la rotación) reinicia el reloj deslizante de
 *     7 días con la última actividad (feature "recordarme").
 *
 * Si el refresh falla, la sesión realmente expiró o la cookie se perdió:
 * cerramos sesión y mandamos al login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Ya tenemos un token guardado de un arranque anterior. Intentamos renovar
  // la sesión en silencio antes de dejar pasar, para no caer en una cadena de
  // 401 en cuanto arranquen las llamadas de datos.
  return auth.refresh().pipe(
    map(() => true),
    catchError(() => {
      auth.logout().subscribe();
      router.navigate(['/login']);
      return of(false);
    }),
  );
};
