import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Settlement } from '../../../core/models/settlement.model';
import { FuelLoadService } from '../../../core/services/fuel-load.service';
import { SettlementService } from '../../../core/services/settlement.service';
import { formatKm } from '../../../core/utils/format-args';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-fuel-load-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BottomNavComponent],
  templateUrl: './fuel-load-form.component.html',
  styleUrl: './fuel-load-form.component.scss',
})
export class FuelLoadFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fuelLoadService = inject(FuelLoadService);
  private settlementService = inject(SettlementService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  readonly settlementPageSize = 5;
  settlements = signal<Settlement[]>([]);
  settlementsVisible = signal(3);
  settlementsLoading = signal(true);

  constructor() {
    this.settlementService.listByVehicle(this.vehicleId).subscribe({
      next: (list) => {
        const sorted = list
          .slice()
          .sort((a, b) => b.id - a.id)
          .slice(0, 3 + this.settlementPageSize);
        this.settlements.set(sorted);
        this.settlementsLoading.set(false);
      },
      error: () => {
        this.settlementsLoading.set(false);
      },
    });
  }

  get visibleSettlements(): Settlement[] {
    return this.settlements().slice(0, this.settlementsVisible());
  }

  get hasMoreSettlements(): boolean {
    return this.settlementsVisible() < this.settlements().length;
  }

  loadMoreSettlements(): void {
    this.settlementsVisible.update((v) => v + this.settlementPageSize);
  }

  settlementLabel(s: Settlement): string {
    return `${formatKm(s.period_start_km)} → ${formatKm(s.period_end_km)} km · $${s.total_amount}`;
  }

  goToSettlement(id: number): void {
    this.router.navigate(['/vehiculo', this.vehicleId, 'liquidacion', id]);
  }

  form = this.fb.nonNullable.group({
    load_date: [this.today(), Validators.required],
    odometer_km: [null as number | null, [Validators.required, Validators.min(0)]],
    amount: [null as number | null, [Validators.required, Validators.min(0)]],
    liters: [null as number | null],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { load_date, odometer_km, amount, liters } = this.form.getRawValue();

    this.fuelLoadService
      .create({
        vehicle: this.vehicleId,
        load_date,
        odometer_km: odometer_km!,
        amount: amount!,
        liters: liters ?? undefined,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/vehiculo', this.vehicleId]);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(
            err.error?.odometer_km?.[0] ?? 'No pudimos guardar la carga. Revisá los datos.',
          );
        },
      });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
