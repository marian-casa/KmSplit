import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';

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

const ACCESS_TOKEN_KEY = 'kmsplit_access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'kmsplit_refresh_token'; // ya no se usa, ver constructor

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Limpieza de una sola vez: versiones anteriores de la app guardaban
    // el refresh token en localStorage bajo esta clave. Ahora vive en una
    // cookie httpOnly (ver core/interceptors/auth.interceptor.ts), así que
    // si quedó un valor viejo dando vueltas de antes de este cambio, lo
    // borramos apenas arranca el servicio.
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  }

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  login(payload: LoginRequest): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(`${this.baseUrl}/login/`, payload)
      .pipe(tap(({ access }) => localStorage.setItem(ACCESS_TOKEN_KEY, access)));
  }

  register(payload: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register/`, payload);
  }

  fetchMe(): Observable<User> {
    return this.http
      .get<User>(`${this.baseUrl}/me/`)
      .pipe(tap((user) => this.currentUserSubject.next(user)));
  }

  refresh(): Observable<AccessTokenResponse> {
    return this.http
      .post<AccessTokenResponse>(`${this.baseUrl}/refresh/`, {})
      .pipe(tap(({ access }) => localStorage.setItem(ACCESS_TOKEN_KEY, access)));
  }

  logout(): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/logout/`, {}).pipe(
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
    this.currentUserSubject.next(null);
  }
}