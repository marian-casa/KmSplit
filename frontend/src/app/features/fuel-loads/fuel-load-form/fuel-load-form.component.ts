import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { FuelLoadService } from '../../../core/services/fuel-load.service';
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

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  loading = signal(false);
  errorMessage = signal<string | null>(null);

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
