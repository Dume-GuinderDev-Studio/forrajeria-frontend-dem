import { useState, useEffect } from 'react';
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { ShoppingBag, Scale, X, Plus, Calculator } from 'lucide-react';
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
    bagRows: PresentationRow[];
    kiloEnabled: boolean;
    kiloPrice: number | null;
    kiloCost: number | null;
  }) => void;
  errors?: {
    duplicateWeight?: string;
    kiloRequired?: string;
  };
}

export const ProductPresentationsSection = ({
  product,
  onPresentationsChange,
  errors,
}: ProductPresentationsSectionProps) => {
  const [bagRows, setBagRows] = useState<PresentationRow[]>([]);
  const [kiloEnabled, setKiloEnabled] = useState(false);
  const [kiloPrice, setKiloPrice] = useState<number | null>(null);
  const [kiloCost, setKiloCost] = useState<number | null>(null);
  // Margen % solo para cálculo en el momento (no se persiste).
  const [kiloMargin, setKiloMargin] = useState<number | null>(null);
  const [kiloSourceBagId, setKiloSourceBagId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Cargar datos existentes al inicio
  useEffect(() => {
    if (!product) {
      // Producto nuevo
      setBagRows([
        { id: crypto.randomUUID(), weightKg: null, price: null, cost: null, marginPct: null, openBagRemainingKg: null },
      ]);
      setKiloEnabled(false);
      setKiloPrice(null);
      setKiloCost(null);
      setKiloMargin(null);
      setKiloSourceBagId('');
      setIsInitialized(true);
      return;
    }

    // Si tiene presentations con datos, usarlas
    const hasPresentations = product.presentations && product.presentations.length > 0;
    const hasBagPresentation = product.presentations?.some((p) => p.type === 'bag' && p.price);
    const hasKiloPresentation = product.presentations?.some((p) => p.type === 'kilo' && p.price);

    if (hasPresentations && (hasBagPresentation || hasKiloPresentation) && product.presentations) {
      const bags = product.presentations
        .filter((p) => p.type === 'bag' && p.price)
        .map((p) => ({
          id: p.id || crypto.randomUUID(),
          weightKg: p.weightKg,
          price: p.price,
          cost: p.cost ?? null,
          marginPct: null as number | null,
          openBagRemainingKg: p.openBagRemainingKg ?? null,
        }));

      const kilo = product.presentations.find((p) => p.type === 'kilo' && p.price);

      setBagRows(
        bags.length > 0
          ? bags
          : [
              {
                id: crypto.randomUUID(),
                weightKg: null,
                price: null,
                cost: null,
                marginPct: null,
                openBagRemainingKg: null,
              },
            ],
      );
      setKiloEnabled(!!kilo);
      setKiloPrice(kilo?.price ?? null);
      setKiloCost(kilo?.cost ?? null);
      setKiloMargin(null);
    }
    // Fallback legacy: crear desde pricePerBag/Kilo
    else if (product.pricePerBag || product.pricePerKilo) {
      const bags = product.pricePerBag
        ? [
            {
              id: crypto.randomUUID(),
              weightKg: null,
              price: product.pricePerBag,
              cost: null,
              marginPct: null as number | null,
              openBagRemainingKg: product.openBagRemainingKg ?? null,
            },
          ]
        : [];
      setBagRows(
        bags.length > 0
          ? bags
          : [
              {
                id: crypto.randomUUID(),
                weightKg: null,
                price: null,
                cost: null,
                marginPct: null,
                openBagRemainingKg: null,
              },
            ],
      );
      setKiloEnabled(!!product.pricePerKilo);
      setKiloPrice(product.pricePerKilo ?? null);
      setKiloCost(null);
      setKiloMargin(null);
    } else {
      // Producto sin presentaciones - mostrar una fila vacía por defecto
      setBagRows([
        { id: crypto.randomUUID(), weightKg: null, price: null, cost: null, marginPct: null, openBagRemainingKg: null },
      ]);
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
      onPresentationsChange({ bagRows, kiloEnabled, kiloPrice, kiloCost });
    }
  }, [bagRows, kiloEnabled, kiloPrice, kiloCost, isInitialized, onPresentationsChange]);

  const addBagRow = () => {
    setBagRows([
      ...bagRows,
      { id: crypto.randomUUID(), weightKg: null, price: null, cost: null, marginPct: null, openBagRemainingKg: null },
    ]);
  };

  const removeBagRow = (id: string) => {
    if (bagRows.length > 1) {
      setBagRows(bagRows.filter((row) => row.id !== id));
    }
  };

  const updateBagRow = (
    id: string,
    field: 'weightKg' | 'price' | 'cost' | 'marginPct' | 'openBagRemainingKg',
    value: string | number | null,
  ) => {
    setBagRows(
      bagRows.map((row) => {
        if (row.id === id) {
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
        }
        return row;
      }),
    );
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

  /** Calcula el precio sugerido de una bolsa: precio = costo * (1 + margen/100). */
  const calcBagPrice = (id: string) => {
    const row = bagRows.find((r) => r.id === id);
    if (!row || row.cost === null || row.cost === undefined) {
      toast.error('Cargá el costo de la bolsa para calcular el precio');
      return;
    }
    const suggested = calcSuggestedPrice(row.cost, row.marginPct);
    if (suggested === null) {
      toast.error('Costo o margen inválido');
      return;
    }
    updateBagRow(id, 'price', suggested);
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

  /** Prorratea el precio por kilo desde el costo de una bolsa. */
  const calcKiloPriceFromSelectedBag = () => {
    const bag = bagRows.find((r) => r.id === kiloSourceBagId);
    if (!bag) {
      toast.error('Elegí una bolsa como base del cálculo');
      return;
    }
    if (bag.cost === null || bag.cost === undefined) {
      toast.error('La bolsa elegida no tiene costo cargado');
      return;
    }
    if (!bag.weightKg || bag.weightKg <= 0) {
      toast.error('La bolsa elegida no tiene un peso válido');
      return;
    }
    const suggested = calcKiloPriceFromBag(bag.cost, kiloMargin, bag.weightKg);
    if (suggested === null) {
      toast.error('Costo, margen o peso inválido');
      return;
    }
    setKiloPrice(suggested);
    toast.success(`Precio por kilo prorrateado: $${suggested}`);
  };

  const bagsWithCost = bagRows.filter(
    (r) => r.cost !== null && r.cost !== undefined && r.weightKg !== null && r.weightKg > 0,
  );

  // Check for duplicate weights
  const weights = bagRows.map((r) => r.weightKg).filter((w) => w !== null && w > 0);
  const hasDuplicateWeight = weights.length !== new Set(weights).size;
  const duplicateWeightError = hasDuplicateWeight
    ? 'No puedes tener dos bolsas con el mismo peso'
    : '';

  return (
    <div className="space-y-6">
      {/* Sección Venta por Bolsa */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <ShoppingBag size={16} /> Venta por Bolsa
        </label>

        {bagRows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-slate-200 dark:border-slate-600 p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/30"
          >
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-start">
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Peso (kg)"
                  value={row.weightKg ?? ''}
                  onChange={(e) => updateBagRow(row.id, 'weightKg', e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border ${hasDuplicateWeight && row.weightKg ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm`}
                />
              </div>
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Precio ($)"
                  value={row.price ?? ''}
                  onChange={(e) => updateBagRow(row.id, 'price', e.target.value)}
                  onPaste={(e) =>
                    handleMoneyPaste(e, (n) => updateBagRow(row.id, 'price', n))
                  }
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
                  onChange={(e) => updateBagRow(row.id, 'cost', e.target.value)}
                  onPaste={(e) =>
                    handleMoneyPaste(e, (n) => updateBagRow(row.id, 'cost', n))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeBagRow(row.id)}
                disabled={bagRows.length === 1}
                className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="Margen (%)"
                title="Margen % (solo cálculo, no se guarda)"
                value={row.marginPct ?? ''}
                onChange={(e) => updateBagRow(row.id, 'marginPct', e.target.value)}
                className="w-28 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
              <button
                type="button"
                onClick={() => calcBagPrice(row.id)}
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
                onChange={(e) => updateBagRow(row.id, 'openBagRemainingKg', e.target.value)}
                className="w-full max-w-[220px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Dejalo vacío si no hay bolsa abierta.
              </p>
            </div>
          </div>
        ))}

        {duplicateWeightError && (
          <p className="text-red-500 text-xs font-medium">{duplicateWeightError}</p>
        )}

        <button
          type="button"
          onClick={addBagRow}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          <Plus size={16} />
          Agregar bolsa
        </button>
      </div>

      {/* Sección Venta por Kilo */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Scale size={16} /> Venta por Kilo
        </label>

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
              {bagsWithCost.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>o desde bolsa:</span>
                  <select
                    value={kiloSourceBagId}
                    onChange={(e) => setKiloSourceBagId(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Elegir bolsa…</option>
                    {bagsWithCost.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.weightKg}kg · costo ${b.cost}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={calcKiloPriceFromSelectedBag}
                    title="Precio/kg = (costo bolsa × (1 + margen/100)) / peso kg. El precio sigue siendo editable."
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Calculator size={13} />
                    Prorratear
                  </button>
                </div>
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

// Función helper para construir el payload de presentations
export const buildPresentationsPayload = (
  bagRows: PresentationRow[],
  kiloEnabled: boolean,
  kiloPrice: number | null,
  kiloCost: number | null = null,
): ProductPresentation[] => {
  // Filtrar filas incompletas (sin peso o precio) y convertir a números.
  // openBagRemainingKg solo viaja explícito cuando hay un valor >= 0.
  const bags: ProductPresentation[] = bagRows
    .filter((r) => r.weightKg && r.weightKg > 0 && r.price && r.price > 0)
    .map((r) => {
      const openBag = normalizeOpenBag(r.openBagRemainingKg);
      return {
        type: 'bag' as PresentationType,
        weightKg: Number(r.weightKg), // ← convertir a número
        price: Number(r.price), // ← convertir a número
        cost: normalizeCost(r.cost),
        ...(openBag !== null ? { openBagRemainingKg: openBag } : {}),
      };
    });

  const kilo: ProductPresentation[] =
    kiloEnabled && kiloPrice && kiloPrice > 0
      ? [
          {
            type: 'kilo' as PresentationType,
            weightKg: null,
            price: Number(kiloPrice), // ← convertir a número
            cost: normalizeCost(kiloCost),
          },
        ]
      : [];

  return [...bags, ...kilo];
};
