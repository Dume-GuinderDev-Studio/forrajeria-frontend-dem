import type { Product } from '@/infrastructure/products.service';
import { formatARS, roundToWholePeso } from '@/lib/format';
import { isAllLifeStage } from '@/lib/lifeStage';
import { getOpenBagRemainingKg } from '@/lib/openBag';
import { useCartStore, type Unit } from '@/infrastructure/cart_manager';
import { ShoppingBag, Scale, Star, ChevronDown } from 'lucide-react';
import { useState, useMemo, useId } from 'react';
import styles from './ProductCard.module.css';

type CategoryTheme = 'dog' | 'cat' | 'accessories' | 'other' | 'default';

interface ProductCardProps {
  product: Product;
  isPremium?: boolean;
}

export const ProductCard = ({ product, isPremium = false }: ProductCardProps) => {
  const addItem = useCartStore((state) => state.addItem);

  // Get presentations
  const presentations = product.presentations || [];
  const bagPresentations = presentations.filter((p) => p.type === 'bag' && p.isActive !== false);
  const kiloPresentation = presentations.find((p) => p.type === 'kilo' && p.isActive !== false);

  const hasBag = bagPresentations.length > 0;
  const hasKilo = !!kiloPresentation;
  const hasBothOptions = hasBag && hasKilo;

  // Legacy fallback: check old fields if no presentations
  const legacyHasBag = product.pricePerBag != null && Number(product.pricePerBag) > 0;
  const legacyHasKilo = product.pricePerKilo != null && Number(product.pricePerKilo) > 0;
  const useLegacy = !hasBag && !hasKilo && (legacyHasBag || legacyHasKilo);

  // Determine available unit
  const availableUnit =
    hasBag || legacyHasBag ? 'Bolsa' : hasKilo || legacyHasKilo ? 'Kilo' : 'General';
  const [selectedUnit, setSelectedUnit] = useState<'Bolsa' | 'Kilo' | 'General'>(availableUnit);
  const [selectedBagIndex, setSelectedBagIndex] = useState(0);
  const [kilosInput, setKilosInput] = useState('1');
  // ProductCard se renderiza N veces en la misma página: los ids deben ser
  // únicos por instancia o el nombre accesible se pierde al repetirse.
  const instanceId = useId();

  const unit = hasBothOptions ? selectedUnit : availableUnit;

  // Calculate current price based on selection
  const currentPrice = useMemo(() => {
    if (useLegacy) {
      // Legacy fallback
      return unit === 'Bolsa'
        ? product.pricePerBag
        : unit === 'Kilo'
          ? product.pricePerKilo
          : product.price;
    }

    if (unit === 'Bolsa' && bagPresentations.length > 0) {
      return bagPresentations[selectedBagIndex]?.price || product.price;
    }
    if (unit === 'Kilo' && kiloPresentation) {
      const kilos = parseFloat(kilosInput) || 0;
      return kiloPresentation.price * kilos;
    }
    return product.price;
  }, [
    unit,
    bagPresentations,
    selectedBagIndex,
    kiloPresentation,
    kilosInput,
    product.price,
    product.pricePerBag,
    product.pricePerKilo,
    useLegacy,
  ]);

  // Get price per kilo for display
  const pricePerKilo = useMemo(() => {
    if (useLegacy) {
      return product.pricePerKilo;
    }
    return kiloPresentation?.price || null;
  }, [kiloPresentation, product.pricePerKilo, useLegacy]);

  const handleAddToCart = () => {
    let finalUnit: Unit = unit === 'General' ? 'Unidad' : unit;
    let finalPrice = Number(currentPrice) || 0;

    // Add presentation info to cart item
    if (unit === 'Bolsa' && bagPresentations.length > 0) {
      const bag = bagPresentations[selectedBagIndex];
      finalUnit = 'Bolsa';
      finalPrice = bag.price;
      addItem({
        productId: product.id,
        name: product.name,
        unit: finalUnit,
        price: finalPrice,
        image: product.image,
        presentationId: bag.id,
        presentationType: 'bag',
        weightKg: bag.weightKg,
        openBagRemainingKg: getOpenBagRemainingKg(product),
      });
    } else if (unit === 'Kilo' && kiloPresentation) {
      const kilos = parseFloat(kilosInput) || 1;
      finalUnit = 'Kilo';
      finalPrice = kiloPresentation.price * kilos;
      addItem({
        productId: product.id,
        name: product.name,
        unit: finalUnit,
        price: finalPrice,
        image: product.image,
        presentationId: kiloPresentation.id,
        presentationType: 'kilo',
        weightKg: kilos,
        openBagRemainingKg: getOpenBagRemainingKg(product),
      });
    } else {
      addItem({
        productId: product.id,
        name: product.name,
        unit: finalUnit,
        price: finalPrice,
        image: product.image,
        openBagRemainingKg: getOpenBagRemainingKg(product),
      });
    }
  };

  const getCategoryTheme = (cat: string): CategoryTheme => {
    switch (cat.toUpperCase()) {
      case 'PERRO':
        return 'dog';
      case 'GATO':
        return 'cat';
      case 'ACCESORIOS':
        return 'accessories';
      case 'OTROS':
        return 'other';
      default:
        return 'default';
    }
  };

  const categoryName = product.category?.name || 'Varios';
  const isAvailable = product.stock > 0 || product.isActive;

  // Formatear peso: 21.00 → "21", 3.50 → "3.5"
  const formatWeight = (kg: number | null | undefined) => {
    if (!kg) return '';
    return parseFloat(String(kg)).toString();
  };

  // Precio SOLO visual del storefront: peso entero sin centavos, con
  // separador de miles (ej. 113421.69 → "$ 113.422"). El valor real
  // (carrito, backend, cálculos) sigue exacto.
  const formatPrice = (price: number) =>
    formatARS(roundToWholePeso(Number(price) || 0));

  return (
    <div className={styles.card}>
      {/* Context Header Area over Image */}
      <div className={styles.imageArea}>
        {/* El placeholder "BAS" es decorativo: cuando hay imagen, el nombre
            real ya viaja en su alt, así que no debe anunciarse dos veces. */}
        {product.image ? (
          <img src={product.image} alt={product.name} className={styles.productImg} />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            BAS
          </span>
        )}

        {/* Categoría Badge - Top Left */}
        <div className={styles.badgePos}>
          <div className={styles.categoryBadge} data-theme={getCategoryTheme(categoryName)}>
            {categoryName}
          </div>
        </div>

        {/* Premium Badge - Top Right */}
        {isPremium && (
          <div className={styles.premiumBadge}>
            <Star size={12} className={styles.premiumIcon} />
            Premium
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* Stock & Stage Row */}
        <div className={styles.stockRow}>
          {isAvailable ? (
            <span className={styles.inStock}>
              <span className={styles.pulseWrap}>
                <span className={styles.ping}></span>
                <span className={styles.dot}></span>
              </span>
              Stock disponible
            </span>
          ) : (
            <span className={styles.outOfStock}>Agotado</span>
          )}

          {!isAllLifeStage(product.lifeStage) && (
            <span className={styles.stage}>{product.lifeStage}</span>
          )}
        </div>

        {/* Title */}
        <h3 className={styles.title}>{product.name}</h3>

        <div className={styles.spacer}></div>

        {/* Main Price */}
        <div className={styles.priceBlock}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(currentPrice || 0)}</span>
          </div>

          {/* Price Per Kilo always visible if exists */}
          {pricePerKilo != null && Number(pricePerKilo) > 0 ? (
            <p className={styles.perKilo}>1 kg = {formatPrice(pricePerKilo || 0)}</p>
          ) : (
            <p className={styles.perKiloHidden}>No Kilo Price</p>
          )}
        </div>

        {/* Unit Switcher with Dropdown */}
        <div className={styles.unitBlock}>
          {hasBothOptions ? (
            <div className={styles.unitStack}>
              {/* Unit Toggle */}
              <div className={styles.toggle}>
                <button
                  onClick={() => setSelectedUnit('Bolsa')}
                  data-active={unit === 'Bolsa'}
                  className={styles.toggleBtn}
                >
                  <ShoppingBag size={15} /> Bolsa
                </button>
                <button
                  onClick={() => setSelectedUnit('Kilo')}
                  data-active={unit === 'Kilo'}
                  className={styles.toggleBtn}
                >
                  <Scale size={15} /> Kilo
                </button>
              </div>

              {/* Dropdown for Bags */}
              {unit === 'Bolsa' && bagPresentations.length > 1 && (
                <div className={styles.bagSelectWrap}>
                  <select
                    id={`${instanceId}-bag`}
                    aria-label="Presentación de bolsa"
                    value={selectedBagIndex}
                    onChange={(e) => setSelectedBagIndex(Number(e.target.value))}
                    className={styles.bagSelect}
                  >
                    {bagPresentations.map((p, idx) => (
                      <option key={idx} value={idx}>
                        {p.weightKg ? `${formatWeight(p.weightKg)} kg` : 'Bolsa'} — {formatPrice(p.price)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={styles.chevron} />
                </div>
              )}

              {/* Kilo Input */}
              {unit === 'Kilo' && kiloPresentation && (
                <div className={styles.kiloRow}>
                  <span className={styles.kiloLabel}>kg:</span>
                  <input
                    id={`${instanceId}-kilos`}
                    aria-label="Cantidad en kilos"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={kilosInput}
                    onChange={(e) => setKilosInput(e.target.value)}
                    className={styles.kiloInput}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={styles.singleUnit}>
              {unit !== 'General' && (
                <>
                  {unit === 'Bolsa' ? <ShoppingBag size={15} /> : <Scale size={15} />}
                  {unit === 'Bolsa' && bagPresentations.length === 1
                    ? `Bolsa ${bagPresentations[0].weightKg || ''}kg`.trim()
                    : `Se vende por ${unit.toLowerCase()}`}
                </>
              )}
            </div>
          )}
        </div>

        {/* Add Button */}
        <button onClick={handleAddToCart} className={styles.addBtn}>
          Agregar
        </button>
      </div>
    </div>
  );
};
