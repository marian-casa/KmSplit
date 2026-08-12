import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Settlement, SettlementStatus } from '../../../core/models/settlement.model';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { SettlementService } from '../../../core/services/settlement.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-settlement-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './settlement-detail.component.html',
  styleUrl: './settlement-detail.component.scss',
})
export class SettlementDetailComponent {
  private route = inject(ActivatedRoute);
  private settlementService = inject(SettlementService);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));
  settlementId = Number(this.route.snapshot.paramMap.get('settlementId'));

  settlement = signal<Settlement | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  canManage = signal(false);
  updatingStatus = signal(false);

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
}
