import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

/**
 * OJO: el backend todavía NO tiene un endpoint de recuperación de contraseña
 * (accounts/urls.py solo expone register/login/refresh/me). Esta pantalla
 * simula el envío para no romper el flujo visual, pero no manda ningún
 * email real todavía. Falta agregar en el backend algo como
 * POST /api/auth/password-reset/ (con django.contrib.auth.tokens o una
 * librería como djoser) antes de que esto funcione de verdad.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);

  sent = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sent.set(true);
  }
}
