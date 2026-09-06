import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Vehicle } from '../models/vehicle.model';

/** Cuánto vive un vehículo cacheado (evita dato stale si cambia en otro lado). */
const CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/vehicles`;

  private static readonly LAST_VEHICLE_KEY = 'kmsplit_last_vehicle';

  /** Cache en memoria: id -> { fact, expiresAt }. Comparte la misma request
   *  entre todas las pantallas que piden el mismo vehículo a la vez. */
  private cache = new Map<number, { fact: Observable<Vehicle>; expiresAt: number }>();

  list(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.baseUrl}/`);
  }

  get(id: number): Observable<Vehicle> {
    const hit = this.cache.get(id);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.fact;
    }
    const fact = this.http.get<Vehicle>(`${this.baseUrl}/${id}/`).pipe(
      tap((updated) => this.invalidateCache(updated.id)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.cache.set(id, { fact, expiresAt: Date.now() + CACHE_TTL_MS });
    return fact;
  }

  create(data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.patch<Vehicle>(`${this.baseUrl}/${id}/`, data).pipe(
      tap((updated) => this.invalidateCache(updated.id)),
    );
  }

  /** Invalida el vehículo cacheado (tras un update, p.ej. cambiar la foto). */
  private invalidateCache(id: number): void {
    this.cache.delete(id);
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
