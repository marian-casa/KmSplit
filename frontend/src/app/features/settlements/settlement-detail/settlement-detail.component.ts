import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Settlement, SettlementStatus } from '../../../core/models/settlement.model';
import { AuthService } from '../../../core/services/auth.service';
import { FuelLoadService } from '../../../core/services/fuel-load.service';
import { GroupService } from '../../../core/services/group.service';
import { SettlementService } from '../../../core/services/settlement.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';
import { ArgNumberPipe } from '../../../shared/pipes/arg-number.pipe';

@Component({
  selector: 'app-settlement-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, ArgNumberPipe],
  templateUrl: './settlement-detail.component.html',
  styleUrl: './settlement-detail.component.scss',
})
export class SettlementDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private settlementService = inject(SettlementService);
  private fuelLoadService = inject(FuelLoadService);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));
  settlementId = Number(this.route.snapshot.paramMap.get('settlementId'));

  /** Desde dónde se abrió la liquidación: 'carga' o 'historial'. */
  from = this.route.snapshot.queryParamMap.get('from') ?? 'historial';

  settlement = signal<Settlement | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  canManage = signal(false);
  updatingStatus = signal(false);
  deleting = signal(false);
  deleteDialog = signal(false);

  constructor() {
    this.settlementService.get(this.settlementId).subscribe({
      next: (settlement) => {
        this.settlement.set(settlement);

        this.auth.fetchMe().subscribe((user) => {
          this.vehicleService.get(this.vehicleId).subscribe((vehicle) => {
            this.groupService.get(vehicle.group).subscribe({
              next: (group) => {
                const membership = group.members.find((m) => m.user === user.id);
                this.canManage.set(membership?.role === 'owner' || membership?.role === 'admin');
                this.loading.set(false);
              },
              error: () => this.loading.set(false),
            });
          });
        });
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar esta liquidación.');
        this.loading.set(false);
      },
    });
  }

  toggleStatus(): void {
    const current = this.settlement();
    if (!current) return;

    const newStatus: SettlementStatus = current.status === 'pendiente' ? 'pagado' : 'pendiente';
    this.updatingStatus.set(true);

    this.settlementService.markStatus(current.id, newStatus).subscribe({
      next: (updated) => {
        this.settlement.set(updated);
        this.updatingStatus.set(false);
      },
      error: () => {
        this.updatingStatus.set(false);
        this.errorMessage.set('No pudimos actualizar el estado.');
      },
    });
  }

  editLoad(): void {
    const settlement = this.settlement();
    if (!settlement) return;
    this.router.navigate(['/vehiculo', this.vehicleId, 'carga'], {
      queryParams: { edit: settlement.fuel_load, from: this.from },
    });
  }

  confirmDelete(): void {
    const settlement = this.settlement();
    if (!settlement) return;
    this.deleteDialog.set(true);
  }

  cancelDelete(): void {
    this.deleteDialog.set(false);
  }

  doDelete(): void {
    const settlement = this.settlement();
    if (!settlement) return;
    this.deleting.set(true);
    this.fuelLoadService.delete(settlement.fuel_load).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(
          this.from === 'carga'
            ? ['/vehiculo', this.vehicleId, 'carga']
            : ['/vehiculo', this.vehicleId, 'historial'],
        );
      },
      error: () => {
        this.deleting.set(false);
        this.deleteDialog.set(false);
        this.errorMessage.set(
          'No se pudo eliminar la carga. Quizás dejó de ser la última carga del vehículo.',
        );
      },
    });
  }
}
