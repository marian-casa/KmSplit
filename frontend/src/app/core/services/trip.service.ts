import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Trip } from '../models/trip.model';

@Injectable({ providedIn: 'root' })
export class TripService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/trips`;

  listByVehicle(vehicleId: number): Observable<Trip[]> {
    return this.http.get<Trip[]>(`${this.baseUrl}/`, { params: { vehicle: vehicleId } });
  }

  create(data: {
    vehicle: number;
    trip_date: string;
    start_km: number;
    end_km: number;
  }): Observable<Trip> {
    return this.http.post<Trip>(`${this.baseUrl}/`, data);
  }

  update(id: number, data: Partial<Trip>): Observable<Trip> {
    return this.http.patch<Trip>(`${this.baseUrl}/${id}/`, data);
  }
}
