import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AccessTokenResponse,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetVerifyRequest,
  RegisterRequest,
} from '../models/auth.model';
import { User } from '../models/user.model';
import { retryTransient } from '../../shared/utils/retry-transient.util';

const ACCESS_TOKEN_KEY = 'kmsplit_access_token';
const REFRESH_TOKEN_KEY = 'kmsplit_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  /** Refresco compartido: si ya hay uno en vuelo, todos los llamadores
   *  (interceptor ante varios 401 paralelos, guard, etc.) esperan el mismo.
   *  Evita que la rotación invalide tokens entre sí y cierre la sesión. */
  private refreshRequest: Observable<AccessTokenResponse> | null = null;

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /** True si el access token sigue vigente por al menos ~30 min.
   *  Sirve para evitar refrescar en cada navegación (el refresh rota el
   *  token y dispara escrituras de cookie). */
  isAccessTokenFresh(): boolean {
    const token = this.accessToken;
    if (!token) return false;
    try {
      const payload = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      );
      const expiresInMs = (payload.exp as number) * 1000 - Date.now();
      return expiresInMs > 30 * 60 * 1000;
    } catch {
      return false;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.getValue();
  }

  login(payload: LoginRequest): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(`${this.baseUrl}/login/`, payload)
      .pipe(
        tap(({ access, refresh }) => {
          localStorage.setItem(ACCESS_TOKEN_KEY, access);
          if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
        }),
      );
  }

  register(payload: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register/`, payload);
  }

  fetchMe(): Observable<User> {
    return this.http
      .get<User>(`${this.baseUrl}/me/`)
      .pipe(tap((user) => this.currentUserSubject.next(user)));
  }

  /** Renueva la sesión.  Intenta: cookie httpOnly (primario) → body
   *  (respaldo para iOS PWA donde la cookie se limpia al relanzar la app).
   *  El refresh token nuevo se almacena en AMBOS (cookie + localStorage). */
  refresh(): Observable<AccessTokenResponse> {
    if (!this.refreshRequest) {
      // El body solo se usa si la cookie falta (backend lo ignora si la cookie existe).
      const body: Record<string, string> = {};
      const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (stored) body['refresh'] = stored;

      this.refreshRequest = this.http
        .post<AccessTokenResponse>(`${this.baseUrl}/refresh/`, body)
        .pipe(
          retryTransient(3),
          tap(({ access, refresh }) => {
            localStorage.setItem(ACCESS_TOKEN_KEY, access);
            if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
          }),
          finalize(() => (this.refreshRequest = null)),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }
    return this.refreshRequest;
  }

  logout(): Observable<unknown> {
    // Enviar refresh en el body para que el backend lo invalide (blacklist)
    // incluso si la cookie httpOnly fue limpiada (iOS PWA).
    const body: Record<string, string> = {};
    const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (stored) body['refresh'] = stored;

    return this.http.post(`${this.baseUrl}/logout/`, body).pipe(
      tap(() => this.clearLocalSession()),
      catchError(() => {
        this.clearLocalSession();
        return of(null);
      }),
    );
  }

  requestPasswordReset(payload: PasswordResetRequest): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.baseUrl}/password-reset/request/`, payload);
  }

  verifyPasswordResetCode(payload: PasswordResetVerifyRequest): Observable<{ valid: boolean }> {
    return this.http.post<{ valid: boolean }>(`${this.baseUrl}/password-reset/verify/`, payload);
  }

  confirmPasswordReset(payload: PasswordResetConfirmRequest): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.baseUrl}/password-reset/confirm/`, payload);
  }

  private clearLocalSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
  }
}