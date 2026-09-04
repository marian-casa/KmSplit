import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, Observable, throwError, timer } from 'rxjs';
import { mergeMap, retryWhen } from 'rxjs/operators';

function isTransient(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    // status 0 = error de red / conexión (típico al reanudar la PWA en iOS)
    // 502/503/504 = el backend aún no terminó de responder (cold start)
    return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
  }
  return true;
}

/**
 * Reintenta la fuente hasta `attempts` veces si falla por un error transitorio
 * (red / 502 / 503 / 504). No reintenta errores "permanentes" como 401, 403,
 * 404, porque reintentarlos no sirve. Entre intentos espera `delayMs`.
 */
export function retryTransient<T>(attempts = 3, delayMs = 700): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>): Observable<T> =>
    source.pipe(
      retryWhen((errors) =>
        errors.pipe(
          mergeMap((error: unknown, attempt: number) => {
            if (attempt >= attempts - 1 || !isTransient(error)) {
              return throwError(() => error);
            }
            return timer(delayMs * (attempt + 1));
          }),
        ),
      ),
    );
}