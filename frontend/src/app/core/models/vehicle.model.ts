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
