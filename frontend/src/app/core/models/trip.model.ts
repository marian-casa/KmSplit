export interface Trip {
  id: number;
  vehicle: number;
  user: number;
  settlement: number | null;
  trip_date: string;
  start_km: number;
  end_km: number;
  km_traveled: number;
  edited_by: number | null;
  created_at: string;
  updated_at: string;
}
