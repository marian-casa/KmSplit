import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Group, GroupMembership } from '../models/group.model';

/** Cuánto vive un grupo cacheado (evita dato stale si cambian miembros/roles). */
const CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class GroupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/groups`;

  private static readonly ACTIVE_GROUP_KEY = 'kmsplit_active_group';

  /** Cache en memoria: id -> { fact, expiresAt }. */
  private cache = new Map<number, { fact: Observable<Group>; expiresAt: number }>();

  list(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.baseUrl}/`);
  }

  /** El id del grupo en el que el usuario está trabajando ahora. */
  getActiveGroupId(): number | null {
    const raw = localStorage.getItem(GroupService.ACTIVE_GROUP_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  setActiveGroupId(id: number): void {
    localStorage.setItem(GroupService.ACTIVE_GROUP_KEY, String(id));
  }

  clearActiveGroup(): void {
    localStorage.removeItem(GroupService.ACTIVE_GROUP_KEY);
  }

  get(id: number): Observable<Group> {
    const hit = this.cache.get(id);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.fact;
    }
    const fact = this.http.get<Group>(`${this.baseUrl}/${id}/`).pipe(
      tap((updated) => this.invalidateCache(updated.id)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.cache.set(id, { fact, expiresAt: Date.now() + CACHE_TTL_MS });
    return fact;
  }

  create(name: string): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/`, { name });
  }

  join(inviteCode: string): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/join/`, { invite_code: inviteCode });
  }

  leave(groupId: number): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${this.baseUrl}/${groupId}/leave/`, {});
  }

  updateMember(
    groupId: number,
    userId: number,
    data: { role?: string; remove?: boolean },
  ): Observable<GroupMembership> {
    return this.http
      .patch<GroupMembership>(`${this.baseUrl}/${groupId}/members/${userId}/`, data)
      .pipe(tap(() => this.invalidateCache(groupId)));
  }

  private invalidateCache(id: number): void {
    this.cache.delete(id);
  }
}
