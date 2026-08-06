import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Settlement, SettlementStatus } from '../models/settlement.model';

@Injectable({ providedIn: 'root' })
export class SettlementService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/settlements`;

  listByVehicle(vehicleId: number): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(`${this.baseUrl}/`, { params: { vehicle: vehicleId } });
  }

  markStatus(id: number, status: SettlementStatus): Observable<Settlement> {
    return this.http.patch<Settlement>(`${this.baseUrl}/${id}/mark_status/`, { status });
  }
}
