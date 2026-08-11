import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Group } from '../../../core/models/group.model';
import { Vehicle } from '../../../core/models/vehicle.model';
import { GroupService } from '../../../core/services/group.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-vehicle-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './vehicle-home.component.html',
  styleUrl: './vehicle-home.component.scss',
})
export class VehicleHomeComponent {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  vehicle = signal<Vehicle | null>(null);
  group = signal<Group | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);

  constructor() {
    this.vehicleService.get(this.vehicleId).subscribe({
      next: (vehicle) => {
        this.vehicle.set(vehicle);
        this.groupService.get(vehicle.group).subscribe({
          next: (group) => {
            this.group.set(group);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar este vehículo.');
        this.loading.set(false);
      },
    });
  }
}
