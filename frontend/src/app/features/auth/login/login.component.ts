import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { interval, take } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  lockoutSeconds = signal<number | null>(null);
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.auth.fetchMe().subscribe({
          next: () => {
            this.loading.set(false);
            this.router.navigate(['/grupos/selector']);
          },
          error: () => {
            this.loading.set(false);
            this.router.navigate(['/grupos/selector']);
          },
        });
      },
      error: (err) => {
        this.loading.set(false);

        if (err.status === 429) {
          const seconds = err.error?.retry_after_seconds ?? 60;
          this.startLockoutCountdown(seconds);
        } else {
          this.errorMessage.set('Email o contraseña incorrectos.');
        }
      },
    });
  }

  formattedLockout(): string {
    const s = this.lockoutSeconds();
    if (s === null) return '';
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private startLockoutCountdown(seconds: number): void {
    this.errorMessage.set(null);
    this.lockoutSeconds.set(seconds);

    interval(1000)
      .pipe(take(seconds), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const current = this.lockoutSeconds();
          if (current !== null && current > 0) {
            this.lockoutSeconds.set(current - 1);
          }
        },
        complete: () => this.lockoutSeconds.set(null),
      });
  }
}
