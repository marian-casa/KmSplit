import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { FuelLoad } from '../../core/models/fuel-load.model';
import { Group, GroupRole } from '../../core/models/group.model';
import { Trip } from '../../core/models/trip.model';
import { Vehicle } from '../../core/models/vehicle.model';
import { AuthService } from '../../core/services/auth.service';
import { FuelLoadService } from '../../core/services/fuel-load.service';
import { GroupService } from '../../core/services/group.service';
import { SettlementService } from '../../core/services/settlement.service';
import { TripService } from '../../core/services/trip.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';

type FilterKey = 'todos' | 'viajes' | 'cargas';

interface HistoryRecord {
  id: string;
  date: string;
  sortKey: string;
  type: 'trip' | 'fuel';
  userName: string;
  userId: number;
  label: string;
  tripId?: number;
  settlementId?: number;
  clickable: boolean;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private tripService = inject(TripService);
  private fuelLoadService = inject(FuelLoadService);
  private settlementService = inject(SettlementService);
  private auth = inject(AuthService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));
  scope: 'week' | 'full' = (this.route.snapshot.data['scope'] as 'week' | 'full') ?? 'full';

  vehicle = signal<Vehicle | null>(null);
  group = signal<Group | null>(null);
  trips = signal<Trip[]>([]);
  fuelLoads = signal<FuelLoad[]>([]);
  fuelLoadToSettlement = signal<Map<number, number>>(new Map());
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  filter = signal<FilterKey>('todos');

  private currentUserId = 0;
  private currentUserRole = signal<GroupRole | null>(null);

  constructor() {
    this.auth.fetchMe().subscribe((user) => {
      this.currentUserId = user.id;

      this.vehicleService.get(this.vehicleId).subscribe((vehicle) => {
        this.vehicle.set(vehicle);

        this.groupService.get(vehicle.group).subscribe((group) => {
          this.group.set(group);
          const membership = group.members.find((m) => m.user === user.id);
          this.currentUserRole.set(membership?.role ?? null);

          forkJoin({
            trips: this.tripService.listByVehicle(this.vehicleId),
            fuelLoads: this.fuelLoadService.listByVehicle(this.vehicleId),
            settlements: this.settlementService.listByVehicle(this.vehicleId),
          }).subscribe({
            next: ({ trips, fuelLoads, settlements }) => {
              this.trips.set(trips);
              this.fuelLoads.set(fuelLoads);

              const map = new Map<number, number>();
              settlements.forEach((s) => map.set(s.fuel_load, s.id));
              this.fuelLoadToSettlement.set(map);

              this.loading.set(false);
            },
            error: () => {
              this.errorMessage.set('No pudimos cargar el historial.');
              this.loading.set(false);
            },
          });
        });
      });
    });
  }

  get title(): string {
    return this.scope === 'week' ? 'Últimos 7 días' : 'Historial completo';
  }

  get records(): HistoryRecord[] {
    const cutoffStr = this.scope === 'week' ? this.sevenDaysAgo() : null;
    const canEditAny = this.currentUserRole() === 'owner' || this.currentUserRole() === 'admin';

    const tripRecords: HistoryRecord[] = this.trips()
      .filter((t) => !cutoffStr || t.trip_date >= cutoffStr)
      .map((t) => ({
        id: `trip-${t.id}`,
        date: t.trip_date,
        sortKey: `${t.trip_date}-${String(t.id).padStart(6, '0')}`,
        type: 'trip' as const,
        userName: this.memberName(t.user),
        userId: t.user,
        label: `${t.km_traveled} km`,
        tripId: t.id,
        clickable: canEditAny || t.user === this.currentUserId,
      }));

    const fuelRecords: HistoryRecord[] = this.fuelLoads()
      .filter((f) => !cutoffStr || f.load_date >= cutoffStr)
      .map((f) => {
        const settlementId = this.fuelLoadToSettlement().get(f.id);
        return {
          id: `fuel-${f.id}`,
          date: f.load_date,
          sortKey: `${f.load_date}-${String(f.id).padStart(6, '0')}`,
          type: 'fuel' as const,
          userName: this.memberName(f.loaded_by),
          userId: f.loaded_by,
          label: `$${f.amount}`,
          settlementId,
          clickable: !!settlementId,
        };
      });

    const all = [...tripRecords, ...fuelRecords].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));

    if (this.filter() === 'viajes') return all.filter((r) => r.type === 'trip');
    if (this.filter() === 'cargas') return all.filter((r) => r.type === 'fuel');
    return all;
  }

  memberName(userId: number): string {
    return this.group()?.members.find((m) => m.user === userId)?.user_name ?? 'Usuario';
  }

  onRecordClick(record: HistoryRecord): void {
    if (!record.clickable) return;

    if (record.type === 'trip' && record.tripId) {
      this.router.navigate(['/vehiculo', this.vehicleId, 'viaje'], {
        queryParams: { tripId: record.tripId },
      });
    } else if (record.type === 'fuel' && record.settlementId) {
      this.router.navigate(['/vehiculo', this.vehicleId, 'liquidacion', record.settlementId]);
    }
  }

  private sevenDaysAgo(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
}
