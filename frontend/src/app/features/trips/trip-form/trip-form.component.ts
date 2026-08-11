import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Trip } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { TripService } from '../../../core/services/trip.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { BottomNavComponent } from '../../../shared/bottom-nav/bottom-nav.component';

/**
 * Generaliza el atajo de "últimos N dígitos" a 1, 2 o 3 dígitos. La cantidad
 * de dígitos que el usuario tipeó define el "módulo" contra el que se
 * resuelve el cruce de decena/centena/millar.
 */
function calcularKmFinal(kmReferencia: number, digitos: string): number {
  const cantidadDigitos = digitos.length;
  const modulo = Math.pow(10, cantidadDigitos);
  const base = Math.floor(kmReferencia / modulo) * modulo;
  let candidato = base + parseInt(digitos, 10);
  if (candidato <= kmReferencia) {
    candidato += modulo;
  }
  return candidato;
}

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BottomNavComponent],
  templateUrl: './trip-form.component.html',
  styleUrl: './trip-form.component.scss',
})
export class TripFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tripService = inject(TripService);
  private vehicleService = inject(VehicleService);
  private auth = inject(AuthService);

  vehicleId = Number(this.route.snapshot.paramMap.get('id'));

  loading = signal(false);
  loadingContext = signal(true);
  errorMessage = signal<string | null>(null);

  useShortcut = signal(true);
  userName = signal('');
  editingTripId = signal<number | null>(null);
  lastOwnTrip = signal<Trip | null>(null);

  form = this.fb.nonNullable.group({
    trip_date: [this.today(), Validators.required],
    start_km: [0, [Validators.required, Validators.min(0)]],
    end_km_shortcut: ['', [Validators.pattern(/^\d{1,3}$/)]],
    end_km_full: [null as number | null],
  });

  constructor() {
    // si venimos desde el historial a editar un viaje puntual (propio o
    // ajeno, según permisos), viene marcado en la URL: ?tripId=123
    const tripIdToEdit = this.route.snapshot.queryParamMap.get('tripId');

    this.auth.fetchMe().subscribe((user) => {
      this.userName.set(user.name);

      this.vehicleService.get(this.vehicleId).subscribe((vehicle) => {
        this.tripService.listByVehicle(this.vehicleId).subscribe({
          next: (trips) => {
            const lastRegisteredTrip = trips.reduce<Trip | null>(
              (latest, t) => (!latest || t.id > latest.id ? t : latest),
              null,
            );
            const defaultStartKm = lastRegisteredTrip
              ? lastRegisteredTrip.end_km
              : vehicle.current_km;
            this.form.patchValue({ start_km: defaultStartKm });

            const ownTrips = trips
              .filter((t) => t.user === user.id)
              .sort((a, b) =>
                a.trip_date === b.trip_date ? b.id - a.id : a.trip_date < b.trip_date ? 1 : -1,
              );
            this.lastOwnTrip.set(ownTrips[0] ?? null);

            if (tripIdToEdit) {
              const trip = trips.find((t) => t.id === Number(tripIdToEdit));
              if (trip) {
                this.applyTripToForm(trip);
              }
            }

            this.loadingContext.set(false);
          },
          error: () => this.loadingContext.set(false),
        });
      });
    });
  }

  get computedEndKm(): number | null {
    const startKm = this.form.controls.start_km.value;

    if (this.useShortcut()) {
      const raw = this.form.controls.end_km_shortcut.value;
      if (!raw || !/^\d{1,3}$/.test(raw)) return null;
      return calcularKmFinal(startKm, raw);
    }
    return this.form.controls.end_km_full.value;
  }

  get kmTraveled(): number | null {
    const end = this.computedEndKm;
    const start = this.form.controls.start_km.value;
    if (end === null) return null;
    const traveled = end - start;
    return traveled > 0 ? traveled : null;
  }

  toggleShortcut(): void {
    this.useShortcut.update((v) => !v);
    this.form.patchValue({ end_km_shortcut: '', end_km_full: null });
  }

  editLastTrip(): void {
    const trip = this.lastOwnTrip();
    if (!trip) return;
    this.applyTripToForm(trip);
  }

  private applyTripToForm(trip: Trip): void {
    this.editingTripId.set(trip.id);
    this.useShortcut.set(false);
    this.form.patchValue({
      trip_date: trip.trip_date,
      start_km: trip.start_km,
      end_km_full: trip.end_km,
    });
  }

  submit(): void {
    const startKm = this.form.controls.start_km.value;
    const endKm = this.computedEndKm;
    const tripDate = this.form.controls.trip_date.value;

    if (this.form.controls.start_km.invalid || !endKm || !tripDate) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Completá la fecha, el km inicial y el km final.');
      return;
    }

    if (endKm <= startKm) {
      this.errorMessage.set('El km final tiene que ser mayor al km inicial.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const payload = { trip_date: tripDate, start_km: startKm, end_km: endKm };
    const editingId = this.editingTripId();

    const request$ = editingId
      ? this.tripService.update(editingId, payload)
      : this.tripService.create({ vehicle: this.vehicleId, ...payload });

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/vehiculo', this.vehicleId]);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(
          err.error?.non_field_errors?.[0] ??
            err.error?.end_km?.[0] ??
            'No pudimos guardar el viaje. Revisá los datos. Si el error persiste, puede ser que no tengas permiso para editar este viaje.',
        );
      },
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
