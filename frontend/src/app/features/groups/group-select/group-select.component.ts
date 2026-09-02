import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Group } from '../../../core/models/group.model';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-group-select',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './group-select.component.html',
  styleUrl: './group-select.component.scss',
})
export class GroupSelectComponent {
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private router = inject(Router);

  groups = signal<Group[]>([]);
  loading = signal(true);
  errorMessage = signal<string | null>(null);
  selectingId = signal<number | null>(null);

  constructor() {
    this.auth.fetchMe().subscribe({
      next: () => this.load(),
      error: () => this.load(),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.groupService.list().subscribe({
      next: (groups) => {
        if (groups.length === 0) {
          // sin grupos todavía -> onboarding para crear o unirse
          this.router.navigate(['/grupos/nuevo']);
          return;
        }
        this.groups.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar tus grupos.');
        this.loading.set(false);
      },
    });
  }

  isActive(group: Group): boolean {
    return group.id === this.groupService.getActiveGroupId();
  }

  /** Elige el grupo, lo deja como activo y va a la lista de sus vehículos. */
  selectGroup(group: Group): void {
    this.selectingId.set(group.id);
    this.errorMessage.set(null);
    this.groupService.setActiveGroupId(group.id);
    this.router.navigate(['/vehiculos']);
  }

  memberCount(group: Group): number {
    return group.members.filter((m) => m.is_active).length;
  }

  myRole(group: Group): string {
    const userId = this.auth.getCurrentUser()?.id;
    const membership = group.members.find((m) => m.user === userId);
    if (!membership) return '';
    if (membership.role === 'owner') return 'Owner';
    if (membership.role === 'admin') return 'Admin';
    return 'Member';
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }
}