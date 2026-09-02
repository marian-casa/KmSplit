import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Group } from '../../../core/models/group.model';
import { Vehicle } from '../../../core/models/vehicle.model';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { ArgNumberPipe } from '../../../shared/pipes/arg-number.pipe';

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [CommonModule, RouterLink, ArgNumberPipe],
  templateUrl: './vehicle-select.component.html',
  styleUrl: './vehicle-select.component.scss',
})
export class VehicleSelectComponent {
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private router = inject(Router);

  groups = signal<Group[]>([]);
  vehicles = signal<Vehicle[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  leavingGroupId = signal<number | null>(null);

  constructor() {
    // fetchMe deja disponible el id del usuario (para el mensaje de owner) y
    // valida que la sesión siga viva; el guard ya cubre el caso no logueado.
    this.auth.fetchMe().subscribe({
      next: () => this.loadAll(),
      error: () => this.loadAll(),
    });
  }

  private loadAll(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.groupService.list().subscribe({
      next: (groups) => {
        if (groups.length === 0) {
          // usuario sin grupo todavía no puede ver/crear vehículos ->
          // lo mandamos primero a crear o unirse a un grupo
          this.router.navigate(['/grupos/nuevo']);
          return;
        }
        this.groups.set(groups);
        this.vehicleService.list().subscribe({
          next: (vehicles) => {
            this.vehicles.set(vehicles);
            this.loading.set(false);
            this.goToLastVehicle(vehicles);
          },
          error: () => {
            this.errorMessage.set('No pudimos cargar tus vehículos.');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar tus grupos.');
        this.loading.set(false);
      },
    });
  }

  /** Si el usuario ya venía trabajando con un vehículo, volvemos a él por defecto. */
  private goToLastVehicle(vehicles: Vehicle[]): void {
    const lastId = this.vehicleService.getLastVehicleId();
    if (lastId !== null && vehicles.some((v) => v.id === lastId)) {
      this.vehicleService.clearLastVehicle();
      this.router.navigate(['/vehiculo', lastId]);
    }
  }

  groupName(groupId: number): string {
    return this.groups().find((g) => g.id === groupId)?.name ?? 'Grupo';
  }

  vehiclesByGroup(groupId: number): Vehicle[] {
    return this.vehicles().filter((v) => v.group === groupId);
  }

  iAmOwner(group: Group): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    if (userId === undefined) return false;
    return group.members.some((m) => m.user === userId && m.role === 'owner');
  }

  askLeaveGroup(group: Group): void {
    const message = this.iAmOwner(group)
      ? `Vas a abandonar "${group.name}". Como sos el dueño, el grupo quedará a cargo del integrante más antiguo. ¿Continuar?`
      : `¿Estás seguro de que querés abandonar el grupo "${group.name}"?`;
    if (!window.confirm(message)) return;

    this.leavingGroupId.set(group.id);
    this.errorMessage.set(null);

    this.groupService.leave(group.id).subscribe({
      next: () => this.loadAll(),
      error: (err) => {
        this.leavingGroupId.set(null);
        this.errorMessage.set(err.error?.detail ?? 'No pudimos abandonar el grupo.');
      },
    });
  }

  logout(): void {
    // logout() ahora llama al backend (para invalidar la cookie httpOnly
    // del refresh token), así que hay que esperar la respuesta antes de
    // navegar -- ya no es una limpieza sincrónica de localStorage nomás.
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}