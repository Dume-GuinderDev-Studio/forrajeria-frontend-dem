import type { Product } from '@/infrastructure/products.service';

/**
 * Devuelve los kg restantes de la bolsa abierta de un producto, o `null`
 * si no corresponde mostrarla.
 *
 * El backend guarda el remanente en la presentación de tipo `bag` (la bolsa
 * física que se abre para fraccionar y vender por kilo), no en la de tipo
 * `kilo` ni a nivel de producto.
 *
 * Solo aplica a productos que se venden por kilo (presentación Kilo activa,
 * o campo legacy pricePerKilo) y cuya bolsa abierta tiene más de 0 kg.
 */
export const getOpenBagRemainingKg = (
  product: Product | null | undefined,
): number | null => {
  if (!product) return null;

  const presentations = product.presentations ?? [];

  // Condición 1: el producto debe poder venderse por kilo.
  const hasKiloPresentation = presentations.some(
    (presentation) =>
      presentation.type === 'kilo' &&
      presentation.isActive !== false &&
      Number(presentation.price) > 0,
  );
  const hasLegacyKilo = product.pricePerKilo != null && Number(product.pricePerKilo) > 0;

  if (!hasKiloPresentation && !hasLegacyKilo) return null;

  // Condición 2: el remanente vive en la presentación `bag`, la bolsa física
  // que se abre (no en la presentación `kilo`, que solo define precio).
  const openBag = presentations.find(
    (presentation) =>
      presentation.type === 'bag' &&
      presentation.isActive !== false &&
      Number(presentation.openBagRemainingKg) > 0,
  );
  const remaining = Number(openBag?.openBagRemainingKg);
  if (Number.isFinite(remaining) && remaining > 0) return remaining;

  // Legacy: durante la migración algunos productos sin presentaciones todavía
  // exponen el campo a nivel de producto (junto con pricePerKilo).
  if (presentations.length === 0) {
    const legacyRemaining = Number(product.openBagRemainingKg);
    if (Number.isFinite(legacyRemaining) && legacyRemaining > 0) return legacyRemaining;
  }

  return null;
};

/** Formatea kg sin ceros innecesarios: 7 -> "7", 7.5 -> "7.5", 7.25 -> "7.25". */
export const formatKg = (kg: number): string => {
  const value = Number(kg);
  if (!Number.isFinite(value)) return '';
  return parseFloat(value.toFixed(2)).toString();
};

/** Etiqueta lista para mostrar: "Bolsa abierta: 7kg restantes". */
export const getOpenBagLabel = (product: Product | null | undefined): string | null => {
  const remaining = getOpenBagRemainingKg(product);
  if (remaining === null) return null;
  return `Sobrante abierto: ${formatKg(remaining)} kg`;
};
