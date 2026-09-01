import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { FuelLoad } from '../../core/models/fuel-load.model';
import { Group } from '../../core/models/group.model';
import { Settlement } from '../../core/models/settlement.model';
import { Trip } from '../../core/models/trip.model';
import { Vehicle } from '../../core/models/vehicle.model';
import { FuelLoadService } from '../../core/services/fuel-load.service';
import { GroupService } from '../../core/services/group.service';
import { SettlementService } from '../../core/services/settlement.service';
import { TripService } from '../../core/services/trip.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';
import { ArgNumberPipe } from '../../shared/pipes/arg-number.pipe';
import { formatKm, formatMoney } from '../../core/utils/format-args';

type PeriodKey = 'semana' | 'mes' | '3meses';

interface RecentRecord {
  id: string;
  date: string;
  sortKey: string;
  userName: string;
  userId: number;
  label: string;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, ArgNumberPipe],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss',
})
export class SummaryComponent {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private tripService = inject(TripService);
  private fuelLoadService = inject(FuelLoadService);
  private settlementService = inject(SettlementService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  vehicle = signal<Vehicle | null>(null);
  group = signal<Group | null>(null);
  trips = signal<Trip[]>([]);
  fuelLoads = signal<FuelLoad[]>([]);
  settlements = signal<Settlement[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  selectedPeriod = signal<PeriodKey>('semana');

  private periodDays: Record<PeriodKey, number> = { semana: 7, mes: 30, '3meses': 90 };
  private colors = [
    'var(--blue-500)',
    'var(--green)',
    'var(--amber)',
    'var(--blue-400)',
    '#9b6fd6',
    '#e0637a',
  ];

  constructor() {
    this.vehicleService.get(this.vehicleId).subscribe((vehicle) => {
      this.vehicle.set(vehicle);

      this.groupService.get(vehicle.group).subscribe((group) => {
        this.group.set(group);

        forkJoin({
          trips: this.tripService.listByVehicle(this.vehicleId),
          fuelLoads: this.fuelLoadService.listByVehicle(this.vehicleId),
          settlements: this.settlementService.listByVehicle(this.vehicleId),
        }).subscribe({
          next: ({ trips, fuelLoads, settlements }) => {
            this.trips.set(trips);
            this.fuelLoads.set(fuelLoads);
            this.settlements.set(settlements);
            this.loading.set(false);
          },
          error: () => {
            this.errorMessage.set('No pudimos cargar el resumen.');
            this.loading.set(false);
          },
        });
      });
    });
  }

  // El backend ya devuelve los settlements ordenados por -created_at,
  // así que el primero de la lista es siempre el más reciente.
  get latestSettlement(): Settlement | null {
    return this.settlements()[0] ?? null;
  }

  get recentRecords(): RecentRecord[] {
    const tripRecords: RecentRecord[] = this.trips().map((t) => ({
      id: `trip-${t.id}`,
      date: t.trip_date,
      sortKey: `${t.trip_date}-${String(t.id).padStart(6, '0')}`,
      userName: this.memberName(t.user),
      userId: t.user,
      label: `${formatKm(t.km_traveled)} km`,
    }));

    const fuelRecords: RecentRecord[] = this.fuelLoads().map((f) => ({
      id: `fuel-${f.id}`,
      date: f.load_date,
      sortKey: `${f.load_date}-${String(f.id).padStart(6, '0')}`,
      userName: this.memberName(f.loaded_by),
      userId: f.loaded_by,
      label: `$${formatMoney(f.amount)}`,
    }));

    return [...tripRecords, ...fuelRecords]
      .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
      .slice(0, 5);
  }

  get usageByMember() {
    const days = this.periodDays[this.selectedPeriod()];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const members = (this.group()?.members ?? []).filter((m) => m.is_active);
    const kmByUser = new Map<number, number>();

    for (const trip of this.trips()) {
      if (trip.trip_date >= cutoffStr) {
        kmByUser.set(trip.user, (kmByUser.get(trip.user) ?? 0) + trip.km_traveled);
      }
    }

    const total = Array.from(kmByUser.values()).reduce((sum, km) => sum + km, 0);

    return members.map((m, index) => {
      const km = kmByUser.get(m.user) ?? 0;
      return {
        userId: m.user,
        name: m.user_name,
        km,
        percentage: total > 0 ? Math.round((km / total) * 100) : 0,
        color: this.colors[index % this.colors.length],
      };
    });
  }

  memberName(userId: number): string {
    return this.group()?.members.find((m) => m.user === userId)?.user_name ?? 'Usuario';
  }

  initials(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  avatarColor(userId: number): string {
    const index = this.group()?.members.findIndex((m) => m.user === userId) ?? -1;
    return this.colors[Math.max(index, 0) % this.colors.length];
  }

  barHeight(percentage: number): number {
    return Math.max(4, (percentage / 100) * 80);
  }
}
