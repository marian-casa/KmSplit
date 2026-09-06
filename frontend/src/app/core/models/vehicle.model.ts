import { FuelLoad } from './fuel-load.model';
import { Group } from './group.model';
import { Settlement } from './settlement.model';
import { Trip } from './trip.model';

export type FuelType = 'nafta' | 'diesel' | 'gnc' | 'electrico' | '';

export interface Vehicle {
  id: number;
  group: number;
  name: string;
  fuel_type: FuelType;
  photo_url: string;
  current_km: number;
  split_unassigned_km_all_members: boolean;
  created_at: string;
}

/** Payload consolidado de GET /api/vehicles/{id}/dashboard/
 *  Reemplaza 5 round-trips (vehicle + group + trips + fuelLoads + settlements)
 *  por 1 sola request, eliminando la serialización del backend. */
export interface Dashboard {
  vehicle: Vehicle;
  group: Group;
  trips: Trip[];
  fuel_loads: FuelLoad[];
  settlements: Settlement[];
}
