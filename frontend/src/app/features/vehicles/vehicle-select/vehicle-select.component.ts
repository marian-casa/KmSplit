import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Vehicle } from '../../../core/models/vehicle.model';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { VehicleService } from '../../../core/services/vehicle.service';

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vehicle-select.component.html',
  styleUrl: './vehicle-select.component.scss',
})
export class VehicleSelectComponent {
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private router = inject(Router);

  vehicles = signal<Vehicle[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  constructor() {
    // un usuario nuevo sin grupo todavía no puede ver/crear vehículos -> se lo manda primero a crear o unirse a un grupo
    this.groupService.list().subscribe({
      next: (groups) => {
        if (groups.length === 0) {
          this.router.navigate(['/grupos/nuevo']);
          return;
        }
        this.loadVehicles();
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar tus grupos.');
        this.loading.set(false);
      },
    });
  }

  private loadVehicles(): void {
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
