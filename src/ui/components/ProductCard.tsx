import type { Product } from '@/infrastructure/products.service';
import { formatARS, roundToWholePeso } from '@/lib/format';
import { isAllLifeStage } from '@/lib/lifeStage';
import { getOpenBagRemainingKg } from '@/lib/openBag';
import { useCartStore, type Unit } from '@/infrastructure/cart_manager';
import { ShoppingBag, Scale, Star, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';

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

  const getCategoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'PERRO':
        return 'bg-blue-600 text-white';
      case 'GATO':
        return 'bg-orange-500 text-white';
      case 'ACCESORIOS':
        return 'bg-purple-600 text-white';
      case 'OTROS':
        return 'bg-green-600 text-white';
      default:
        return 'bg-slate-700 text-white';
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
    <div className="group bg-white rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden flex flex-col h-full border border-slate-200/60 min-h-[440px]">
      {/* Context Header Area over Image */}
      <div className="h-[200px] sm:h-[240px] bg-white flex items-center justify-center relative p-4 group-hover:bg-slate-50/50 transition-colors duration-300 border-b border-slate-100">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="max-w-full max-h-full object-contain group-hover:scale-[1.04] transition-transform duration-700 ease-out drop-shadow-sm"
          />
        ) : (
          <span className="text-slate-200 font-bold text-6xl select-none tracking-tighter">
            BAS
          </span>
        )}

        {/* Categoría Badge - Top Left */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1 z-10">
          <div
            className={`text-[11px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl shadow-sm ${getCategoryColor(categoryName)}`}
          >
            {categoryName}
          </div>
        </div>

        {/* Premium Badge - Top Right */}
        {isPremium && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-sm z-10">
            <Star size={12} className="fill-white" />
            Premium
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1 relative z-20 bg-white">
        {/* Stock & Stage Row */}
        <div className="flex items-center gap-2 mb-2 font-medium">
          {isAvailable ? (
            <span className="text-[12px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Stock disponible
            </span>
          ) : (
            <span className="text-[12px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100/50">
              Agotado
            </span>
          )}

          {!isAllLifeStage(product.lifeStage) && (
            <span className="text-[12px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md capitalize border border-slate-200/50">
              {product.lifeStage}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-medium text-slate-800 text-[15px] sm:text-[16px] leading-snug line-clamp-2 md:line-clamp-3 mb-1">
          {product.name}
        </h3>

        <div className="flex-1"></div>

        {/* Main Price */}
        <div className="mt-3 mb-3">
          <div className="flex items-end gap-2">
            <span className="text-[26px] font-medium text-slate-900 tracking-tight leading-none">
              {formatPrice(currentPrice || 0)}
            </span>
          </div>

          {/* Price Per Kilo always visible if exists */}
          {pricePerKilo != null && Number(pricePerKilo) > 0 ? (
            <p className="text-[12px] text-slate-500 mt-1 font-medium">
              1 kg = {formatPrice(pricePerKilo || 0)}
            </p>
          ) : (
            <p className="text-[12px] text-transparent mt-1 select-none pointer-events-none">
              No Kilo Price
            </p>
          )}
        </div>

        {/* Unit Switcher with Dropdown */}
        <div className="mb-4">
          {hasBothOptions ? (
            <div className="space-y-2">
              {/* Unit Toggle */}
              <div className="flex p-1 bg-slate-100/80 rounded-[14px] gap-1 border border-slate-200/50 shadow-inner">
                <button
                  onClick={() => setSelectedUnit('Bolsa')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold rounded-[10px] transition-all duration-300 ${
                    unit === 'Bolsa'
                      ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-blue-700 ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <ShoppingBag size={15} /> Bolsa
                </button>
                <button
                  onClick={() => setSelectedUnit('Kilo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold rounded-[10px] transition-all duration-300 ${
                    unit === 'Kilo'
                      ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-blue-700 ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  <Scale size={15} /> Kilo
                </button>
              </div>

              {/* Dropdown for Bags */}
              {unit === 'Bolsa' && bagPresentations.length > 1 && (
                <div className="relative">
                  <select
                    value={selectedBagIndex}
                    onChange={(e) => setSelectedBagIndex(Number(e.target.value))}
                    className="w-full px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg appearance-none cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {bagPresentations.map((p, idx) => (
                      <option key={idx} value={idx}>
                        {p.weightKg ? `${formatWeight(p.weightKg)} kg` : 'Bolsa'} — {formatPrice(p.price)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}

              {/* Kilo Input */}
              {unit === 'Kilo' && kiloPresentation && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-slate-600">kg:</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={kilosInput}
                    onChange={(e) => setKilosInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-[13px] font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[13px] text-slate-500 font-semibold h-[44px] bg-slate-50 rounded-[14px] border border-slate-100">
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
        <button
          onClick={handleAddToCart}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3 sm:py-3.5 rounded-xl transition-colors duration-200 flex items-center justify-center gap-2 text-[14px]"
        >
          Agregar
        </button>
      </div>
    </div>
  );
};
