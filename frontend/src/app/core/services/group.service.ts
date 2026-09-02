import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Group, GroupMembership } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/groups`;

  list(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.baseUrl}/`);
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
