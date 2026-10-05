import { useState, useEffect } from 'react';
import type { ClipboardEvent as ReactClipboardEvent } from 'react';
import { ShoppingBag, Scale } from 'lucide-react';
import { parseLocalizedNumber } from '@/lib/numbers';
import { formatARS } from '@/lib/format';
import type {
  Product,
  ProductPresentation,
  PresentationType,
} from '@/infrastructure/products.service';
import styles from './ProductPresentationsSection.module.css';

interface PresentationRow {
  id: string;
  weightKg: number | null;
  /** Kg restantes de la bolsa físicamente abierta (opcional, se envía al backend). */
  openBagRemainingKg?: number | null;
}

interface ProductPresentationsSectionProps {
  product?: Product | null;
  /**
   * Precio del formulario principal. La bolsa cerrada no tiene precio propio:
   * cada producto tiene una sola bolsa y su precio es el general.
   */
  generalPrice: number | null;
  /** Costo del formulario principal: es el costo de la bolsa cerrada. */
  generalCost: number | null;
  onPresentationsChange: (data: {
    bagRow: PresentationRow;
    kiloEnabled: boolean;
    kiloPrice: number | null;
    kiloCost: number | null;
  }) => void;
  errors?: {
    kiloRequired?: string;
    /**
     * Peso de la bolsa obligatorio. Solo lo manda el form cuando la sección de
     * bolsa está visible: si no se ve, no se puede exigir que se complete.
     */
    bagWeightRequired?: string;
  };
}

const emptyBagRow = (): PresentationRow => ({
  id: crypto.randomUUID(),
  weightKg: null,
  openBagRemainingKg: null,
});

/**
 * Detecta si la bolsa guardada tiene precio/costo distintos de los generales del
 * producto. Como ahora la bolsa toma los valores del formulario principal, al
 * guardar se alinea: avisamos acá en vez de pisar el dato viejo en silencio.
 * Compara siempre contra el producto guardado (no contra el form en vivo) para
 * que el aviso sea estable y no dependa del orden de render de los efectos.
 */
const buildBagPriceDivergence = (
  savedBagPrice: number | null | undefined,
  savedBagCost: number | null | undefined,
  product: Product,
): string | null => {
  const savedPrice = Number(savedBagPrice);
  const priceDiffers = Number.isFinite(savedPrice) && savedPrice !== Number(product.price);

  const hasSavedCost = savedBagCost !== null && savedBagCost !== undefined;
  const hasGeneralCost = product.cost !== null && product.cost !== undefined;
  // Una bolsa guardada SIN costo igual va a recibir el general al guardar: eso
  // tambien mete un dato que antes no estaba, asi que tiene que quedar avisado
  // igual que un cambio de valor. Solo se omite cuando tampoco hay costo general.
  const costDiffers = hasSavedCost
    ? Number(savedBagCost) !== Number(product.cost)
    : hasGeneralCost;

  if (!priceDiffers && !costDiffers) return null;

  const parts: string[] = [];
  if (priceDiffers) {
    parts.push(`precio ${formatARS(savedPrice)} → ${formatARS(product.price)}`);
  }
  if (costDiffers) {
    const from = hasSavedCost ? formatARS(savedBagCost) : 'sin definir';
    parts.push(`costo ${from} → ${formatARS(product.cost)}`);
  }

  return `Al guardar, la bolsa va a tomar el precio y el costo del formulario principal: ${parts.join(
    '; ',
  )}.`;
};

export const ProductPresentationsSection = ({
  product,
  generalPrice,
  generalCost,
  onPresentationsChange,
  errors,
}: ProductPresentationsSectionProps) => {
  const [bagRow, setBagRow] = useState<PresentationRow>(emptyBagRow);
  // Defensive N>1 case: the UI only edits a single bag. If the backend sends
  // 2+ bag presentations (legacy data we could not audit), we show the first
  // one editable plus a non-blocking notice instead of dropping data silently
  // or breaking the form.
  const [extraBagsCount, setExtraBagsCount] = useState(0);
  // Aviso de alineación: la bolsa guardada difiere de los valores generales.
  const [bagPriceDivergence, setBagPriceDivergence] = useState<string | null>(null);
  const [kiloEnabled, setKiloEnabled] = useState(false);
  const [kiloPrice, setKiloPrice] = useState<number | null>(null);
  const [kiloCost, setKiloCost] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Cargar datos existentes al inicio
  useEffect(() => {
    if (!product) {
      // Producto nuevo
      setBagRow(emptyBagRow());
      setExtraBagsCount(0);
      setBagPriceDivergence(null);
      setKiloEnabled(false);
      setKiloPrice(null);
      setKiloCost(null);
      setIsInitialized(true);
      return;
    }

    // La bolsa guardada se usa solo para precargar el peso y detectar divergencia:
    // su precio y su costo ya no son editables acá.
    const savedBags = (product.presentations ?? []).filter((p) => p.type === 'bag' && p.price);
    const kilo = product.presentations?.find((p) => p.type === 'kilo' && p.price);
    const savedBag = savedBags[0];

    if (savedBag || kilo) {
      setBagRow(
        savedBag
          ? {
              id: savedBag.id || crypto.randomUUID(),
              weightKg: savedBag.weightKg,
              openBagRemainingKg: savedBag.openBagRemainingKg ?? null,
            }
          : emptyBagRow(),
      );
      setExtraBagsCount(savedBags.length > 1 ? savedBags.length - 1 : 0);
      setBagPriceDivergence(
        savedBag ? buildBagPriceDivergence(savedBag.price, savedBag.cost, product) : null,
      );
      setKiloEnabled(!!kilo);
      setKiloPrice(kilo?.price ?? null);
      setKiloCost(kilo?.cost ?? null);
    }
    // Fallback legacy: crear desde pricePerBag/Kilo
    else if (product.pricePerBag || product.pricePerKilo) {
      setBagRow(
        product.pricePerBag
          ? {
              id: crypto.randomUUID(),
              weightKg: null,
              openBagRemainingKg: product.openBagRemainingKg ?? null,
            }
          : emptyBagRow(),
      );
      setExtraBagsCount(0);
      setBagPriceDivergence(
        product.pricePerBag ? buildBagPriceDivergence(product.pricePerBag, null, product) : null,
      );
      setKiloEnabled(!!product.pricePerKilo);
      setKiloPrice(product.pricePerKilo ?? null);
      setKiloCost(null);
    } else {
      // Producto sin presentaciones - mostrar la bolsa vacía por defecto
      setBagRow(emptyBagRow());
      setExtraBagsCount(0);
      setBagPriceDivergence(null);
      setKiloEnabled(false);
      setKiloPrice(null);
      setKiloCost(null);
    }

    setIsInitialized(true);
  }, [product]);

  // Notify parent solo cuando está inicializado
  useEffect(() => {
    if (isInitialized) {
      onPresentationsChange({ bagRow, kiloEnabled, kiloPrice, kiloCost });
    }
  }, [bagRow, kiloEnabled, kiloPrice, kiloCost, isInitialized, onPresentationsChange]);

  const updateBag = (
    field: 'weightKg' | 'openBagRemainingKg',
    value: string | number | null,
  ) => {
    setBagRow((row) => {
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
        value === ''
          ? null
          : typeof value === 'string'
            ? parseFloat(value) || null
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

  return (
    <div className={styles.root}>
      {/* Sección Venta por Bolsa */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>
          <ShoppingBag size={16} /> Venta por Bolsa
        </label>
        <p className={styles.hint}>
          Definí el peso de la bolsa cerrada y cuántos kilos quedan abiertos.
        </p>

        {extraBagsCount > 0 && (
          <p role="alert" className={styles.alert}>
            Este producto tiene {extraBagsCount + 1} configuraciones de bolsa; se muestra la
            primera. Contactá al equipo para auditarlo antes de guardar.
          </p>
        )}

        {bagPriceDivergence && (
          <p role="alert" className={styles.alert}>
            {bagPriceDivergence}
          </p>
        )}

        <div className={styles.card}>
          <p className={styles.priceEcho}>
            {`Precio ${formatARS(generalPrice)} · Costo ${formatARS(generalCost)}`}
          </p>
          <p className={styles.microHint}>
            El precio y el costo salen del formulario principal: cada producto tiene una sola
            bolsa.
          </p>
          <div className={styles.stack1}>
            <label className={styles.subLabel}>
              Peso de la bolsa cerrada (kg)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              placeholder="Peso (kg)"
              value={bagRow.weightKg ?? ''}
              onChange={(e) => updateBag('weightKg', e.target.value)}
              className={[
                styles.input,
                styles.weightInput,
                errors?.bagWeightRequired && !bagRow.weightKg ? styles.inputError : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
            {errors?.bagWeightRequired && !bagRow.weightKg && (
              <p className={styles.kiloError}>{errors.bagWeightRequired}</p>
            )}
          </div>
          <div className={styles.stack1}>
            <label className={styles.subLabel}>
              Bolsa abierta (kg restantes){' '}
              <span className={styles.optional}>(opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Ej. 4.5"
              title="Kg que quedan en la bolsa físicamente abierta"
              value={bagRow.openBagRemainingKg ?? ''}
              onChange={(e) => updateBag('openBagRemainingKg', e.target.value)}
              className={[styles.input, styles.openBagInput].filter(Boolean).join(' ')}
            />
            <p className={styles.microHint}>Dejalo vacío si no hay bolsa abierta.</p>
          </div>
        </div>
      </div>

      {/* Sección Venta por Kilo */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>
          <Scale size={16} /> Venta por Kilo
        </label>
        <p className={styles.hint}>
          Definí si este producto también se vende por kilo suelto en la tienda.
        </p>

        <div className={styles.switchRow}>
          <label className={styles.switch}>
            <input
              type="checkbox"
              checked={kiloEnabled}
              onChange={(e) => setKiloEnabled(e.target.checked)}
              className={styles.toggle}
            />
            <div className={styles.track}></div>
            <span className={styles.switchLabel}>Habilitar venta por kilo</span>
          </label>
        </div>

        {kiloEnabled && (
          <div className={styles.kiloWrap}>
            <div className={styles.gridKilo}>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Precio por kg ($)"
                value={kiloPrice ?? ''}
                onChange={(e) => setKiloPrice(parseLocalizedNumber(e.target.value))}
                onPaste={(e) => handleMoneyPaste(e, setKiloPrice)}
                className={[styles.input, errors?.kiloRequired && !kiloPrice ? styles.inputError : '']
                  .filter(Boolean)
                  .join(' ')}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Costo por kg ($)"
                value={kiloCost ?? ''}
                onChange={(e) => setKiloCost(parseLocalizedNumber(e.target.value))}
                onPaste={(e) => handleMoneyPaste(e, setKiloCost)}
                className={styles.input}
              />
            </div>
            {errors?.kiloRequired && !kiloPrice && (
              <p className={styles.kiloError}>El precio por kilo es obligatorio</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Normaliza un precio obligatorio: número finito > 0 o null (nunca 0 forzado).
const normalizePrice = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
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

// Función helper para construir el payload de presentations.
// La UI maneja una única bolsa: el backend sigue recibiendo `presentations`
// como ARRAY con un solo elemento bag (+ kilo opcional). Acepta un array por
// compatibilidad con el contrato del backend, no porque la UI sea multi-bolsa.
export interface PresentationsPayloadInput {
  bagRows: PresentationRow[];
  kiloEnabled: boolean;
  kiloPrice: number | null;
  kiloCost?: number | null;
  /** Precio del formulario principal: es el precio de la bolsa cerrada. */
  generalPrice: number | null;
  /** Costo del formulario principal: es el costo de la bolsa cerrada. */
  generalCost?: number | null;
}

// Función helper para construir el payload de presentations.
// La UI maneja una única bolsa: el backend sigue recibiendo `presentations`
// como ARRAY con un solo elemento bag (+ kilo opcional). Acepta un array por
// compatibilidad con el contrato del backend, no porque la UI sea multi-bolsa.
//
// El precio y el costo de la bolsa NO vienen de la fila: se toman de los campos
// generales del formulario, que son la única fuente (una sola bolsa por producto).
// Por eso se pasan en un objeto y no posicionales: con seis argumentos
// posicionales era fácil cruzar precio y costo sin que el tipo lo detectara.
export const buildPresentationsPayload = ({
  bagRows,
  kiloEnabled,
  kiloPrice,
  kiloCost = null,
  generalPrice,
  generalCost = null,
}: PresentationsPayloadInput): ProductPresentation[] => {
  const bagPrice = normalizePrice(generalPrice);
  const bagCost = normalizeCost(generalCost);

  // Sin precio general válido no hay bolsa: se filtra por peso y se necesita
  // un precio > 0 para armar la presentación.
  const bags: ProductPresentation[] =
    bagPrice === null
      ? []
      : bagRows
          .filter((r) => r.weightKg && r.weightKg > 0)
          .map((r) => {
            const openBag = normalizeOpenBag(r.openBagRemainingKg);
            return {
              type: 'bag' as PresentationType,
              weightKg: Number(r.weightKg), // ← convertir a número
              price: bagPrice,
              cost: bagCost,
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
