import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Group } from '../../../core/models/group.model';
import { Vehicle } from '../../../core/models/vehicle.model';
import { GroupService } from '../../../core/services/group.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';
import { ArgNumberPipe } from '../../../shared/pipes/arg-number.pipe';
import { fileToCompressedDataUri } from '../../../shared/utils/image.util';

@Component({
  selector: 'app-vehicle-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent, ArgNumberPipe],
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
  photoSaving = signal(false);
  photoMessage = signal<string | null>(null);

  constructor() {
    this.vehicleService.get(this.vehicleId).subscribe({
      next: (vehicle) => {
        this.vehicleService.setLastVehicleId(vehicle.id);
        // el grupo del vehículo pasa a ser el "activo" para que el botón
        // volver (‹) te devuelva siempre a la lista de su grupo
        this.groupService.setActiveGroupId(vehicle.group);
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

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // resetemos el input para poder elegir la misma foto de nuevo
    input.value = '';

    this.photoSaving.set(true);
    this.photoMessage.set(null);
    this.errorMessage.set(null);

    fileToCompressedDataUri(file)
      .then((dataUri) => this.savePhoto(dataUri))
      .catch((err: Error) => {
        this.photoSaving.set(false);
        this.photoMessage.set(err.message);
      });
  }

  removePhoto(): void {
    const current = this.vehicle();
    if (!current) return;
    this.photoSaving.set(true);
    this.photoMessage.set(null);
    this.savePhoto('');
  }

  private savePhoto(photoUrl: string): void {
    const current = this.vehicle();
    if (!current) return;

    this.vehicleService.update(current.id, { photo_url: photoUrl }).subscribe({
      next: (updated) => {
        this.vehicle.set(updated);
        this.photoSaving.set(false);
        this.photoMessage.set(
          photoUrl ? 'Foto actualizada.' : 'Foto quitada.',
        );
      },
      error: (err) => {
        this.photoSaving.set(false);
        this.photoMessage.set(
          err.error?.photo_url?.[0] ?? 'No pudimos guardar la foto.',
        );
      },
    });
  }
}
