/**
 * Redondeo SOLO visual para el storefront: lleva el precio al peso entero
 * más cercano (ej. 113421.69 → 113422). NO usar para alterar cálculos
 * internos, payload de órdenes, caja ni reportes — ahí siempre el valor exacto.
 */
export const roundToWholePeso = (value: number): number => Math.round(Number(value));

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
