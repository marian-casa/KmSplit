import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, RegisterRequest, TokenResponse } from '../models/auth.model';
import { User } from '../models/user.model';

const ACCESS_TOKEN_KEY = 'kmsplit_access_token';
const REFRESH_TOKEN_KEY = 'kmsplit_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  login(payload: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.baseUrl}/login/`, payload)
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  register(payload: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register/`, payload);
  }

  fetchMe(): Observable<User> {
    return this.http
      .get<User>(`${this.baseUrl}/me/`)
      .pipe(tap((user) => this.currentUserSubject.next(user)));
  }

  refresh(): Observable<{ access: string }> {
    return this.http
      .post<{ access: string }>(`${this.baseUrl}/refresh/`, { refresh: this.refreshToken })
      .pipe(tap(({ access }) => localStorage.setItem(ACCESS_TOKEN_KEY, access)));
  }

  logout(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUserSubject.next(null);
  }

  private storeTokens(tokens: TokenResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }
}
