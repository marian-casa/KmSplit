import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Vehicle } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/vehicles`;

  private static readonly LAST_VEHICLE_KEY = 'kmsplit_last_vehicle';

  list(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.baseUrl}/`);
  }

  get(id: number): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.baseUrl}/${id}/`);
  }

  create(data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.baseUrl}/${id}/`, data);
  }

  /** Último vehículo que el usuario estuvo viendo, para volver a él por defecto. */
  setLastVehicleId(id: number): void {
    localStorage.setItem(VehicleService.LAST_VEHICLE_KEY, String(id));
  }

  getLastVehicleId(): number | null {
    const raw = localStorage.getItem(VehicleService.LAST_VEHICLE_KEY);
    const value = raw === null ? NaN : Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  clearLastVehicle(): void {
    localStorage.removeItem(VehicleService.LAST_VEHICLE_KEY);
  }
}
