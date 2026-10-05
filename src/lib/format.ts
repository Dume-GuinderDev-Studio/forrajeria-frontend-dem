/**
 * Redondeo SOLO visual para el storefront: lleva el precio al peso entero
 * más cercano (ej. 113421.69 → 113422). NO usar para alterar cálculos
 * internos, payload de órdenes, caja ni reportes — ahí siempre el valor exacto.
 */
export const roundToWholePeso = (value: number): number => Math.round(Number(value));

/**
 * Redondea un monto a 2 decimales (centavos), sin arrastrar el error de coma
 * flotante: `11465.5 - 6879.3` da `4586.200000000001` en IEEE-754, y eso es un
 * número que el backend rechaza (`totalAmount` es `@IsNumber({maxDecimalPlaces: 2})`).
 *
 * Se usa la misma fórmula que el backend (`roundTo2` en orders.service): sumar
 * Number.EPSILON antes de multiplicar corrige el caso en que el valor real es un
 * .005 exacto pero el double quedó apenas por debajo (ej. 1.005 → 1.00 sin el
 * EPSILON, 1.01 con él). Ojo: sesga levemente hacia arriba; para montos positivos,
 * que es el caso de uso, es lo que se quiere.
 *
 * NO confundir con roundToWholePeso, que es solo visual.
 */
export const roundToCents = (value: number): number =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Formatea un monto en pesos argentinos sin centavos (peso entero).
 * Devuelve "—" para `null`/`undefined`.
 */
export const formatARS = (value?: number | null): string => {
  if (value === null || value === undefined) return '—';

  return Number(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};
