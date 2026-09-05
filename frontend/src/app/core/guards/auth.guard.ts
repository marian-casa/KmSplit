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

  // Si el access token todavía tiene vida (~30 min o más), dejamos pasar
  // directo. Refrescar en cada navegación era contraproducente: cada refresh
  // rota el token (y sobreescribe la cookie), y en mobile una ráfaga de
  // refreshes simultáneos podía invalidar tokens entre sí y cerrar la sesión.
  if (auth.isAccessTokenFresh()) {
    return true;
  }

  // El token está por expirar o ya expiró: renovamos en silencio con la
  // cookie httpOnly del refresh token antes de dejar pasar.
  return auth.refresh().pipe(
    map(() => true),
    catchError(() => {
      auth.logout().subscribe();
      router.navigate(['/login']);
      return of(false);
    }),
  );
};
