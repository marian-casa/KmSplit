import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  @Input({ required: true }) vehicleId!: number;
  private router = inject(Router);
  isResumenActive(): boolean {
    const url = this.router.url;
    const segments = ['/resumen', '/historial', '/historial/semana'];
    return segments.some((s) => url.includes(s));
  }

  /**
   * El ítem "Carga" también engloba las liquidaciones, porque desde el form de
   * carga se accede a ellas. Marcamos activo en azul /carga y /liquidacion/:id.
   */
  isCargaActive(): boolean {
    const url = this.router.url;
    return url.includes('/carga') || url.includes('/liquidacion');
  }
}