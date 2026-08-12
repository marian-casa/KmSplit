import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Group, GroupMembership, GroupRole } from '../../core/models/group.model';
import { Vehicle } from '../../core/models/vehicle.model';
import { AuthService } from '../../core/services/auth.service';
import { GroupService } from '../../core/services/group.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { BottomNavComponent } from '../../shared/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink, BottomNavComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  private route = inject(ActivatedRoute);
  private vehicleService = inject(VehicleService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  vehicle = signal<Vehicle | null>(null);
  group = signal<Group | null>(null);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  savingToggle = signal(false);
  toggleSaved = signal(false);
  codeCopied = signal(false);
  memberActionError = signal<string | null>(null);

  currentUserId = 0;
  myRole = signal<GroupRole | null>(null);

  constructor() {
    this.auth.fetchMe().subscribe((user) => {
      this.currentUserId = user.id;

      this.vehicleService.get(this.vehicleId).subscribe({
        next: (vehicle) => {
          this.vehicle.set(vehicle);
          this.loadGroup(vehicle.group);
        },
        error: () => {
          this.errorMessage.set('No pudimos cargar este vehículo.');
          this.loading.set(false);
        },
      });
    });
  }

  private loadGroup(groupId: number): void {
    this.groupService.get(groupId).subscribe({
      next: (group) => {
        this.group.set(group);
        const membership = group.members.find((m) => m.user === this.currentUserId);
        this.myRole.set(membership?.role ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar el grupo.');
        this.loading.set(false);
      },
    });
  }

  toggleSplit(): void {
    const vehicle = this.vehicle();
    if (!vehicle) return;

    this.savingToggle.set(true);
    this.toggleSaved.set(false);

    this.vehicleService
      .update(vehicle.id, {
        split_unassigned_km_all_members: !vehicle.split_unassigned_km_all_members,
      })
      .subscribe({
        next: (updated) => {
          this.vehicle.set(updated);
          this.savingToggle.set(false);
          this.toggleSaved.set(true);
        },
        error: () => {
          this.savingToggle.set(false);
          this.errorMessage.set('No pudimos guardar el cambio.');
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

  canModify(member: GroupMembership): boolean {
    const role = this.myRole();
    if (member.user === this.currentUserId) return false;
    if (role === 'owner') return true;
    if (role === 'admin') return member.role === 'member';
    return false;
  }

  canPromote(member: GroupMembership): boolean {
    return this.canModify(member) && member.role === 'member';
  }

  canDemote(member: GroupMembership): boolean {
    return this.myRole() === 'owner' && member.role === 'admin';
  }

  canRemove(member: GroupMembership): boolean {
    return this.canModify(member);
  }

  changeRole(member: GroupMembership, newRole: 'admin' | 'member'): void {
    const group = this.group();
    if (!group) return;

    this.memberActionError.set(null);

    this.groupService.updateMember(group.id, member.user, { role: newRole }).subscribe({
      next: () => this.loadGroup(group.id),
      error: (err) => {
        this.memberActionError.set(err.error?.detail ?? 'No pudimos cambiar el rol.');
      },
    });
  }

  removeMember(member: GroupMembership): void {
    const group = this.group();
    if (!group) return;

    if (!confirm(`¿Dar de baja a ${member.user_name} del grupo?`)) return;

    this.memberActionError.set(null);

    this.groupService.updateMember(group.id, member.user, { remove: true }).subscribe({
      next: () => this.loadGroup(group.id),
      error: (err) => {
        this.memberActionError.set(err.error?.detail ?? 'No pudimos dar de baja al integrante.');
      },
    });
  }

  roleLabel(role: GroupRole): string {
    if (role === 'owner') return 'Owner';
    if (role === 'admin') return 'Admin';
    return 'Member';
  }
}
