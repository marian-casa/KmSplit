import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Group, GroupMembership } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/groups`;

  private static readonly ACTIVE_GROUP_KEY = 'kmsplit_active_group';

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
    return this.http.get<Group>(`${this.baseUrl}/${id}/`);
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
    return this.http.patch<GroupMembership>(`${this.baseUrl}/${groupId}/members/${userId}/`, data);
  }
}
