import { useState, useEffect } from 'react';
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { ShoppingBag, Scale, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { parseLocalizedNumber } from '@/lib/numbers';
import {
  calcSuggestedPrice,
  calcKiloPriceFromBag,
  parseMarginInput,
} from './suggestedPrice';
import type {
  Product,
  ProductPresentation,
  PresentationType,
} from '@/infrastructure/products.service';

interface PresentationRow {
  id: string;
  weightKg: number | null;
  price: number | null;
  cost?: number | null;
  /** Margen % solo para cálculo en el formulario, NO se persiste al backend. */
  marginPct?: number | null;
  /** Kg restantes de la bolsa físicamente abierta (opcional, se envía al backend). */
  openBagRemainingKg?: number | null;
}

interface ProductPresentationsSectionProps {
  product?: Product | null;
  onPresentationsChange: (data: {
    bagRow: PresentationRow | null;
    kiloEnabled: boolean;
    kiloPrice: number | null;
    kiloCost: number | null;
  }) => void;
  errors?: {
    kiloRequired?: string;
  };
}

const emptyBagRow = (): PresentationRow => ({
  id: crypto.randomUUID(),
  weightKg: null,
  price: null,
  cost: null,
  marginPct: null,
  openBagRemainingKg: null,
});

export const ProductPresentationsSection = ({
  product,
  onPresentationsChange,
  errors,
}: ProductPresentationsSectionProps) => {
  const [bagRow, setBagRow] = useState<PresentationRow | null>(null);
  const [kiloEnabled, setKiloEnabled] = useState(false);
  const [kiloPrice, setKiloPrice] = useState<number | null>(null);
  const [kiloCost, setKiloCost] = useState<number | null>(null);
  // Margen % solo para cálculo en el momento (no se persiste).
  const [kiloMargin, setKiloMargin] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Cantidad de configuraciones de bolsa legacy (>1) encontradas al hidratar.
  const [legacyBagCount, setLegacyBagCount] = useState(0);

  // Cargar datos existentes al inicio
  useEffect(() => {
    if (!product) {
      // Producto nuevo
      setBagRow(emptyBagRow());
      setKiloEnabled(false);
      setKiloPrice(null);
      setKiloCost(null);
      setKiloMargin(null);
      setLegacyBagCount(0);
      setIsInitialized(true);
      return;
    }

    // Si tiene presentations con datos, usarlas
    const hasPresentations = product.presentations && product.presentations.length > 0;
    const hasBagPresentation = product.presentations?.some((p) => p.type === 'bag' && p.price);
    const hasKiloPresentation = product.presentations?.some((p) => p.type === 'kilo' && p.price);

    if (hasPresentations && (hasBagPresentation || hasKiloPresentation) && product.presentations) {
      const bags = product.presentations.filter((p) => p.type === 'bag' && p.price);

      // Decisión: el formulario solo soporta UNA bolsa. Si el producto legacy
      // trae más de una, se muestra la primera y se avisa (no bloqueante).
      // Nada se borra hasta que el usuario guarde: el backend recibe el array
      // con la única bolsa visible al momento del submit.
      if (bags.length > 1) {
        setLegacyBagCount(bags.length);
      } else {
        setLegacyBagCount(0);
      }

      const firstBag = bags[0];
      const kilo = product.presentations.find((p) => p.type === 'kilo' && p.price);

      setBagRow(
        firstBag
          ? {
              id: firstBag.id || crypto.randomUUID(),
              weightKg: firstBag.weightKg,
              price: firstBag.price,
              cost: firstBag.cost ?? null,
              marginPct: null as number | null,
              openBagRemainingKg: firstBag.openBagRemainingKg ?? null,
            }
          : emptyBagRow(),
      );
      setKiloEnabled(!!kilo);
      setKiloPrice(kilo?.price ?? null);
      setKiloCost(kilo?.cost ?? null);
      setKiloMargin(null);
    }
    // Fallback legacy: crear desde pricePerBag/Kilo
    else if (product.pricePerBag || product.pricePerKilo) {
      setBagRow(
        product.pricePerBag
          ? {
              id: crypto.randomUUID(),
              weightKg: null,
              price: product.pricePerBag,
              cost: null,
              marginPct: null as number | null,
              openBagRemainingKg: product.openBagRemainingKg ?? null,
            }
          : emptyBagRow(),
      );
      setLegacyBagCount(0);
      setKiloEnabled(!!product.pricePerKilo);
      setKiloPrice(product.pricePerKilo ?? null);
      setKiloCost(null);
      setKiloMargin(null);
    } else {
      // Producto sin presentaciones - mostrar el bloque de bolsa vacío por defecto
      setBagRow(emptyBagRow());
      setLegacyBagCount(0);
      setKiloEnabled(false);
      setKiloPrice(null);
      setKiloCost(null);
      setKiloMargin(null);
    }

    setIsInitialized(true);
  }, [product]);

  // Notify parent solo cuando está inicializado
  useEffect(() => {
    if (isInitialized) {
      onPresentationsChange({ bagRow, kiloEnabled, kiloPrice, kiloCost });
    }
  }, [bagRow, kiloEnabled, kiloPrice, kiloCost, isInitialized, onPresentationsChange]);

  const updateBagRow = (
    field: 'weightKg' | 'price' | 'cost' | 'marginPct' | 'openBagRemainingKg',
    value: string | number | null,
  ) => {
    setBagRow((prev) => {
      const row = prev ?? emptyBagRow();
      // Kg restantes admite 0 (bolsa recién terminada); negativos o NaN → null.
      if (field === 'openBagRemainingKg') {
        if (value === '' || value === null || value === undefined) {
          return { ...row, openBagRemainingKg: null };
        }
        const n = Number(value);
        return {
          ...row,
          openBagRemainingKg: Number.isFinite(n) && n >= 0 ? n : null,
        };
      }
      const parsed =
        field === 'marginPct'
          ? typeof value === 'string'
            ? parseMarginInput(value)
            : value
          : value === ''
            ? null
            : typeof value === 'string'
              ? field === 'price' || field === 'cost'
                ? parseLocalizedNumber(value)
                : parseFloat(value) || null
              : value;
      return { ...row, [field]: parsed };
    });
  };

  /**
   * Al pegar con separadores de miles en un campo controlado type="number",
   * el change llegaría vacío (el navegador descarta el texto inválido): se
   * intercepta el paste y se setea el número ya normalizado. El input
   * muestra el valor limpio al re-renderizar (ej. "72,666.00" → 72666).
   */
  const handleMoneyPaste = (
    e: ReactClipboardEvent<HTMLInputElement>,
    apply: (n: number | null) => void,
  ) => {
    const pasted = e.clipboardData.getData('text');
    if (!/[.,]/.test(pasted)) return; // número plano: comportamiento default
    e.preventDefault();
    apply(parseLocalizedNumber(pasted));
  };

  /** Calcula el precio sugerido de la bolsa: precio = costo * (1 + margen/100). */
  const calcBagPrice = () => {
    if (!bagRow || bagRow.cost === null || bagRow.cost === undefined) {
      toast.error('Cargá el costo de la bolsa para calcular el precio');
      return;
    }
    const suggested = calcSuggestedPrice(bagRow.cost, bagRow.marginPct);
    if (suggested === null) {
      toast.error('Costo o margen inválido');
      return;
    }
    updateBagRow('price', suggested);
    toast.success(`Precio sugerido: $${suggested}`);
  };

  /** Calcula el precio por kilo desde su propio costo por kg. */
  const calcKiloPriceFromOwnCost = () => {
    if (kiloCost === null || kiloCost === undefined) {
      toast.error('Cargá el costo por kilo para calcular el precio');
      return;
    }
    const suggested = calcSuggestedPrice(kiloCost, kiloMargin);
    if (suggested === null) {
      toast.error('Costo o margen inválido');
      return;
    }
    setKiloPrice(suggested);
    toast.success(`Precio por kilo sugerido: $${suggested}`);
  };

  /** Prorratea el precio por kilo desde el costo de la bolsa única. */
  const calcKiloPriceFromBagCost = () => {
    if (!bagRow) {
      toast.error('Cargá primero la bolsa para prorratear el precio');
      return;
    }
    if (bagRow.cost === null || bagRow.cost === undefined) {
      toast.error('La bolsa no tiene costo cargado');
      return;
    }
    if (!bagRow.weightKg || bagRow.weightKg <= 0) {
      toast.error('La bolsa no tiene un peso válido');
      return;
    }
    const suggested = calcKiloPriceFromBag(bagRow.cost, kiloMargin, bagRow.weightKg);
    if (suggested === null) {
      toast.error('Costo, margen o peso inválido');
      return;
    }
    setKiloPrice(suggested);
    toast.success(`Precio por kilo prorrateado: $${suggested}`);
  };

  const bagHasCost =
    bagRow?.cost !== null &&
    bagRow?.cost !== undefined &&
    bagRow?.weightKg !== null &&
    (bagRow?.weightKg ?? 0) > 0;

  const row = bagRow ?? emptyBagRow();

  return (
    <div className="space-y-6">
      {/* Sección Venta por Bolsa */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <ShoppingBag size={16} /> Venta por Bolsa
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Definí cómo se ofrece la bolsa cerrada en la tienda online.
        </p>

        {legacyBagCount > 1 && (
          <p
            role="alert"
            className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2"
          >
            Este producto tenía {legacyBagCount} configuraciones de bolsa; se muestra la primera.
            Revisalo antes de guardar.
          </p>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <div className="space-y-1">
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="Peso (kg)"
                value={row.weightKg ?? ''}
                onChange={(e) => updateBagRow('weightKg', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio ($)"
                value={row.price ?? ''}
                onChange={(e) => updateBagRow('price', e.target.value)}
                onPaste={(e) => handleMoneyPaste(e, (n) => updateBagRow('price', n))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo ($)"
                value={row.cost ?? ''}
                onChange={(e) => updateBagRow('cost', e.target.value)}
                onPaste={(e) => handleMoneyPaste(e, (n) => updateBagRow('cost', n))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="Margen (%)"
              title="Margen % (solo cálculo, no se guarda)"
              value={row.marginPct ?? ''}
              onChange={(e) => updateBagRow('marginPct', e.target.value)}
              className="w-28 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
            />
            <button
              type="button"
              onClick={calcBagPrice}
              title="Precio = costo × (1 + margen/100). El precio sigue siendo editable."
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Calculator size={13} />
              Calcular precio
            </button>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Bolsa abierta (kg restantes){' '}
              <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej. 4.5"
              title="Kg que quedan en la bolsa físicamente abierta"
              value={row.openBagRemainingKg ?? ''}
              onChange={(e) => updateBagRow('openBagRemainingKg', e.target.value)}
              className="w-full max-w-[220px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Dejalo vacío si no hay bolsa abierta.
            </p>
          </div>
        </div>
      </div>

      {/* Sección Venta por Kilo */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Scale size={16} /> Venta por Kilo
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Definí cómo se ofrece el kilo suelto en la tienda online.
        </p>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={kiloEnabled}
              onChange={(e) => setKiloEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-500 peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">
              Habilitar venta por kilo
            </span>
          </label>
        </div>

        {kiloEnabled && (
          <div className="space-y-2 max-w-xl">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio por kg ($)"
                value={kiloPrice ?? ''}
                onChange={(e) => setKiloPrice(parseLocalizedNumber(e.target.value))}
                onPaste={(e) => handleMoneyPaste(e, setKiloPrice)}
                className={`w-full px-3 py-2 rounded-lg border ${errors?.kiloRequired && !kiloPrice ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo por kg ($)"
                value={kiloCost ?? ''}
                onChange={(e) => setKiloCost(parseLocalizedNumber(e.target.value))}
                onPaste={(e) => handleMoneyPaste(e, setKiloCost)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Margen (%)"
                title="Margen % (solo cálculo, no se guarda)"
                value={kiloMargin ?? ''}
                onChange={(e) =>
                  setKiloMargin(
                    e.target.value === '' ? null : parseMarginInput(e.target.value),
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {errors?.kiloRequired && !kiloPrice && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                El precio por kilo es obligatorio
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={calcKiloPriceFromOwnCost}
                title="Precio = costo por kg × (1 + margen/100). El precio sigue siendo editable."
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Calculator size={13} />
                Calcular desde costo/kg
              </button>
              {bagHasCost && (
                <button
                  type="button"
                  onClick={calcKiloPriceFromBagCost}
                  title="Precio/kg = (costo bolsa × (1 + margen/100)) / peso kg. El precio sigue siendo editable."
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Calculator size={13} />
                  Prorratear desde bolsa
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Normaliza un costo opcional: número válido >= 0 o null (nunca 0 forzado).
const normalizeCost = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Normaliza los kg restantes de bolsa abierta: número válido >= 0 (0 vale:
// bolsa recién terminada) o null cuando no hay bolsa abierta.
const normalizeOpenBag = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Construye el payload de presentations desde la bolsa ÚNICA del formulario.
// El backend requiere un array: se serializa como máx 1 bag + 0/1 kilo.
// Las filas incompletas (sin peso o precio) se filtran y no viajan.
export const buildPresentationsPayload = (
  bagRow: PresentationRow | null | undefined,
  kiloEnabled: boolean,
  kiloPrice: number | null,
  kiloCost: number | null = null,
): ProductPresentation[] => {
  // openBagRemainingKg solo viaja explícito cuando hay un valor >= 0.
  const bags: ProductPresentation[] =
    bagRow && bagRow.weightKg && bagRow.weightKg > 0 && bagRow.price && bagRow.price > 0
      ? [
          {
            type: 'bag' as PresentationType,
            weightKg: Number(bagRow.weightKg),
            price: Number(bagRow.price),
            cost: normalizeCost(bagRow.cost),
            ...(normalizeOpenBag(bagRow.openBagRemainingKg) !== null
              ? { openBagRemainingKg: normalizeOpenBag(bagRow.openBagRemainingKg) as number }
              : {}),
          },
        ]
      : [];

  const kilo: ProductPresentation[] =
    kiloEnabled && kiloPrice && kiloPrice > 0
      ? [
          {
            type: 'kilo' as PresentationType,
            weightKg: null,
            price: Number(kiloPrice),
            cost: normalizeCost(kiloCost),
          },
        ]
      : [];

  return [...bags, ...kilo];
};
