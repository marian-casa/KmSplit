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

  group = signal<Group | null>(null);
  vehicles = signal<Vehicle[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  leavingGroupId = signal<number | null>(null);
  codeCopied = signal(false);

  lastVehicleId: number | null = null;

  // Copia del grupo que está por abandonar, para el diálogo de confirmación
  pendingLeaveGroup = signal<Group | null>(null);

  constructor() {
    this.auth.fetchMe().subscribe({
      next: () => this.loadActiveGroup(),
      error: () => this.loadActiveGroup(),
    });

    this.lastVehicleId = this.vehicleService.getLastVehicleId();
  }

  private loadActiveGroup(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const activeGroupId = this.groupService.getActiveGroupId();

    if (activeGroupId === null) {
      // no hay grupo elegido todavía -> primero elegís el grupo
      this.router.navigate(['/grupos/selector']);
      return;
    }

    this.groupService.get(activeGroupId).subscribe({
      next: (group) => {
        this.group.set(group);
        this.loadVehicles(group.id);
      },
      error: () => {
        // el grupo activo ya no existe (nos sacaron, lo borraron...) ->
        // limpiamos la elección y volvemos al selector
        this.groupService.clearActiveGroup();
        this.router.navigate(['/grupos/selector']);
      },
    });
  }

  private loadVehicles(groupId: number): void {
    this.vehicleService.list().subscribe({
      next: (vehicles) => {
        this.vehicles.set(vehicles.filter((v) => v.group === groupId));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar tus vehículos.');
        this.loading.set(false);
      },
    });
  }

  copyInviteCode(): void {
    const code = this.group()?.invite_code;
    if (!code) return;
    navigator.clipboard?.writeText(code);
    this.codeCopied.set(true);
    setTimeout(() => this.codeCopied.set(false), 2000);
  }

  changeGroup(): void {
    this.router.navigate(['/grupos/selector']);
  }

  iAmOwner(group: Group): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    if (userId === undefined) return false;
    return group.members.some((m) => m.user === userId && m.role === 'owner');
  }

  /** True si soy dueño y además el único integrante activo del grupo. */
  iAmSoleOwner(group: Group): boolean {
    const userId = this.auth.getCurrentUser()?.id;
    if (userId === undefined) return false;
    const active = group.members.filter((m) => m.is_active);
    return (
      active.length === 1 &&
      active[0].user === userId &&
      active[0].role === 'owner'
    );
  }

  /** Abre el diálogo de confirmación dentro de la app (no window.confirm). */
  requestLeaveGroup(group: Group): void {
    this.pendingLeaveGroup.set(group);
  }

  cancelLeaveGroup(): void {
    this.pendingLeaveGroup.set(null);
  }

  confirmLeaveGroup(): void {
    const group = this.pendingLeaveGroup();
    if (!group) return;

    this.pendingLeaveGroup.set(null);
    this.leavingGroupId.set(group.id);
    this.errorMessage.set(null);

    this.groupService.leave(group.id).subscribe({
      next: () => {
        // si abandonamos el grupo en el que estábamos trabajando, volvemos
        // al selector de grupo y limpiamos la elección
        this.groupService.clearActiveGroup();
        this.router.navigate(['/grupos/selector']);
      },
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