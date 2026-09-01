import { Pipe, PipeTransform } from '@angular/core';

import { formatDecimal, formatKm, formatMoney } from '../../core/utils/format-args';

/**
 * Pipe para formatear números en formato argentino (es-AR):
 * punto para miles y coma para decimales.
 *
 * Uso:
 *   {{ 183222 | argNumber }}            -> 183.222   (km enteros)
 *   {{ 9483.33 | argNumber: 'money' }}  -> 9.483,33  (montos)
 *   {{ 3.33 | argNumber: 'decimal' }}   -> 3,33      (decimales)
 */
@Pipe({ name: 'argNumber', standalone: true })
export class ArgNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined, type: 'int' | 'money' | 'decimal' = 'int'): string {
    if (value === null || value === undefined || value === '') return '';
    switch (type) {
      case 'money':
        return formatMoney(value);
      case 'decimal':
        return formatDecimal(value);
      default:
        return formatKm(value);
    }
  }
}
