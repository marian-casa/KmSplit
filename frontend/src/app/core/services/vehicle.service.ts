import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Dashboard, Vehicle } from '../models/vehicle.model';

/** Cuánto vive un vehículo cacheado (evita dato stale si cambia en otro lado). */
const CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/vehicles`;

  private static readonly LAST_VEHICLE_KEY = 'kmsplit_last_vehicle';

  /** Cache simple en memoria: id -> { vehicle, fetchedAt }. Evita requests
   *  repetidas del mismo vehículo entre pantallas de una misma sesión. */
  private cache = new Map<number, { vehicle: Vehicle; fetchedAt: number }>();

  list(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.baseUrl}/`);
  }

  get(id: number): Observable<Vehicle> {
    const hit = this.cache.get(id);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
      return of(hit.vehicle);
    }
    return this.http.get<Vehicle>(`${this.baseUrl}/${id}/`).pipe(
      tap((vehicle) => this.cache.set(id, { vehicle, fetchedAt: Date.now() })),
    );
  }

  /** Endpoint consolidado: vehicle + group + trips + fuelLoads + settlements
   *  en 1 sola request. Reemplaza los forkJoin de 4-5 round-trips. */
  dashboard(id: number): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.baseUrl}/${id}/dashboard/`);
  }

  create(data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.baseUrl}/${id}/`, data).pipe(
      tap((updated) => this.cache.set(id, { vehicle: updated, fetchedAt: Date.now() })),
    );
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
