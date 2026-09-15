/** Redondea a 2 decimales (moneda). */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Precio sugerido a partir de costo y margen:
 * precio = costo * (1 + margen/100)
 * Retorna null si el costo es inválido. Un margen vacío/null se trata como 0.
 */
export const calcSuggestedPrice = (
  cost: number | null | undefined,
  marginPct: number | null | undefined,
): number | null => {
  if (cost === null || cost === undefined) return null;
  const c = Number(cost);
  if (!Number.isFinite(c) || c < 0) return null;
  const m = marginPct === null || marginPct === undefined ? 0 : Number(marginPct);
  if (!Number.isFinite(m)) return null;
  return round2(c * (1 + m / 100));
};

/**
 * Precio por kilo prorrateado desde el costo de una bolsa:
 * precioPorKilo = (costoBolsa * (1 + margen/100)) / weightKg
 */
export const calcKiloPriceFromBag = (
  bagCost: number | null | undefined,
  marginPct: number | null | undefined,
  weightKg: number | null | undefined,
): number | null => {
  if (weightKg === null || weightKg === undefined) return null;
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;
  const bagPrice = calcSuggestedPrice(bagCost, marginPct);
  if (bagPrice === null) return null;
  return round2(bagPrice / w);
};

/** Parsea el valor crudo de un input de margen: vacío → null. */
export const parseMarginInput = (v: string): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
