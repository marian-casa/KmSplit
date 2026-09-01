/**
 * Formateo de números en formato argentino (es-AR):
 * - Punto (.) como separador de miles: 183222 -> 183.222
 * - Coma (,) como separador decimal: 9483.33 -> 9.483,33
 *
 * Acá se centraliza la lógica para no depender del locale del navegador
 * (que por defecto usa el formato de EE.UU. en el pipe `number`).
 */

function formatArgNumber(value: number | string, maxDecimals: number): string {
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(numeric)) return '';

  const fixed = numeric.toFixed(maxDecimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return decPart ? `${withThousands},${decPart}` : withThousands;
}

/** Km enteros: 183222 -> "183.222" (sin decimales). */
export function formatKm(value: number | string): string {
  return formatArgNumber(value, 0);
}

/** Montos/valores decimales: 9483.33 -> "9.483,33". */
export function formatMoney(value: number | string): string {
  return formatArgNumber(value, 2);
}

/** Decimales con hasta 2 dígitos (km de reparto, porcentajes). */
export function formatDecimal(value: number | string): string {
  return formatArgNumber(value, 2);
}
