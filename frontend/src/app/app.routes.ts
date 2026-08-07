import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'recuperar-contrasena',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },

  {
    path: 'grupos/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/groups/group-onboarding/group-onboarding.component').then(
        (m) => m.GroupOnboardingComponent,
      ),
  },
  {
    path: 'grupos/crear',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/groups/group-create/group-create.component').then(
        (m) => m.GroupCreateComponent,
      ),
  },
  {
    path: 'grupos/unirse',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/groups/group-join/group-join.component').then(
        (m) => m.GroupJoinComponent,
      ),
  },

  {
    path: 'vehiculos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vehicles/vehicle-select/vehicle-select.component').then(
        (m) => m.VehicleSelectComponent,
      ),
  },
  {
    path: 'vehiculos/nuevo',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/vehicles/vehicle-create/vehicle-create.component').then(
        (m) => m.VehicleCreateComponent,
      ),
  },

  // lo que falta -> menú del vehículo, registrar viaje, registrar carga, resumen, historial, admin del grupo.

  { path: '**', redirectTo: 'login' },
];
