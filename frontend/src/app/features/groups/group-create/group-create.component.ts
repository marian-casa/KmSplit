import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Group } from '../../../core/models/group.model';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-group-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './group-create.component.html',
  styleUrl: './group-create.component.scss',
})
export class GroupCreateComponent {
  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private router = inject(Router);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  createdGroup = signal<Group | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.groupService.create(this.form.getRawValue().name).subscribe({
      next: (group) => {
        this.loading.set(false);
        this.createdGroup.set(group);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('No pudimos crear el grupo. Probá de nuevo.');
      },
    });
  }

  continue(): void {
    this.router.navigate(['/vehiculos']);
  }
}
