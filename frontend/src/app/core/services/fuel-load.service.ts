import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { FuelLoad } from '../models/fuel-load.model';

export interface UpdateFuelLoadPayload {
  amount?: number;
  liters?: number | null;
  load_date?: string;
  odometer_km?: number;
}

@Injectable({ providedIn: 'root' })
export class FuelLoadService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/fuel-loads`;

  listByVehicle(vehicleId: number): Observable<FuelLoad[]> {
    return this.http.get<FuelLoad[]>(`${this.baseUrl}/`, { params: { vehicle: vehicleId } });
  }

  get(id: number): Observable<FuelLoad> {
    return this.http.get<FuelLoad>(`${this.baseUrl}/${id}/`);
  }

  create(data: {
    vehicle: number;
    load_date: string;
    odometer_km: number;
    amount: number;
    liters?: number;
  }): Observable<FuelLoad> {
    return this.http.post<FuelLoad>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: UpdateFuelLoadPayload): Observable<FuelLoad> {
    return this.http.patch<FuelLoad>(`${this.baseUrl}/${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/`);
  }
}
