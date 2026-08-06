import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Vehicle } from '../../../core/models/vehicle.model';
import { AuthService } from '../../../core/services/auth.service';
import { VehicleService } from '../../../core/services/vehicle.service';

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-select.component.html',
  styleUrl: './vehicle-select.component.scss',
})
export class VehicleSelectComponent {
  private vehicleService = inject(VehicleService);
  private auth = inject(AuthService);
  private router = inject(Router);

  vehicles = signal<Vehicle[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  constructor() {
    this.vehicleService.list().subscribe({
      next: (vehicles) => {
        this.vehicles.set(vehicles);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar tus vehículos.');
        this.loading.set(false);
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
