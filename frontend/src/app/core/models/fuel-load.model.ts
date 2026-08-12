export interface FuelLoad {
  id: number;
  vehicle: number;
  loaded_by: number;
  load_date: string;
  odometer_km: number;
  amount: number;
  liters: number | null;
  created_at: string;
}
