import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/ui/button';
import { Badge } from '@/ui/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog';
import {
  createManualOrder,
  type Order,
  type PaymentMethod,
} from '@/infrastructure/orders.service';
import {
  getProducts,
  type Product,
  type ProductPresentation,
} from '@/infrastructure/products.service';
import { formatARS } from '@/lib/format';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/paymentMethods';
import { extractValidationMessage } from '@/lib/validation';
import { OpenBagBadge } from '@/ui/components/OpenBagBadge';

type SaleUnit = 'Bolsa' | 'Kilo' | 'Unidad';

type KiloInputMode = 'kg' | 'amount';

interface ManualCartItem {
  productId: string;
  name: string;
  unit: SaleUnit;
  quantity: number;
  unitPrice: number;
  presentationId?: string;
  weightKg?: number | null;
}

const getBagPresentations = (product: Product): ProductPresentation[] =>
  (product.presentations ?? []).filter(
    (presentation) =>
      presentation.type === 'bag' &&
      presentation.isActive !== false &&
      Number(presentation.price) > 0,
  );

const getKiloPresentation = (product: Product): ProductPresentation | undefined =>
  (product.presentations ?? []).find(
    (presentation) =>
      presentation.type === 'kilo' &&
      presentation.isActive !== false &&
      Number(presentation.price) > 0,
  );

const getAvailableSaleUnits = (product: Product): SaleUnit[] => {
  const bags = getBagPresentations(product);
  const kilo = getKiloPresentation(product);
  const legacyHasBag = product.pricePerBag != null && Number(product.pricePerBag) > 0;
  const legacyHasKilo = product.pricePerKilo != null && Number(product.pricePerKilo) > 0;

  const hasBag = bags.length > 0 || legacyHasBag;
  const hasKilo = Boolean(kilo) || legacyHasKilo;

  if (hasBag && hasKilo) return ['Bolsa', 'Kilo'];
  if (hasBag) return ['Bolsa'];
  if (hasKilo) return ['Kilo'];
  return ['Unidad'];
};

const getSaleUnitPrice = (product: Product, unit: SaleUnit, bagIndex: number): number => {
  if (unit === 'Bolsa') {
    const bags = getBagPresentations(product);
    if (bags.length > 0) {
      const bag = bags[Math.min(bagIndex, bags.length - 1)];
      return Number(bag?.price) || 0;
    }
    return Number(product.pricePerBag) || 0;
  }

  if (unit === 'Kilo') {
    const kilo = getKiloPresentation(product);
    if (kilo) return Number(kilo.price) || 0;
    return Number(product.pricePerKilo) || 0;
  }

  return Number(product.price) || 0;
};

const getManualErrorMessage = (error: unknown): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  const message = data?.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message)) {
    for (const item of message) {
      const extracted = extractValidationMessage(item);
      if (extracted) return extracted;
    }
    return 'El servidor rechazó la venta. Revisá el carrito e intentá nuevamente.';
  }

  return 'No se pudo confirmar la venta. Revisá el carrito e intentá nuevamente.';
};

/** Formatea kg eliminando ceros innecesarios, hasta 3 decimales (gramo). */
const formatKg = (kg: number): string => {
  if (!Number.isFinite(kg)) return '0';
  return parseFloat(kg.toFixed(3)).toString();
};

interface ManualSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se invoca con la Order confirmada para que el padre refresque sus datos. */
  onConfirmed?: (order: Order) => void;
}

/**
 * Modal de venta manual (presencial), compartido por el panel de admin
 * (Gestión de Ventas) y el dashboard del empleado.
 *
 * Solo muestra precios de venta; nunca expone costos ni ganancias.
 */
export const ManualSaleDialog = ({ open, onOpenChange, onConfirmed }: ManualSaleDialogProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<SaleUnit>('Unidad');
  const [selectedBagIndex, setSelectedBagIndex] = useState(0);
  const [manualQuantity, setManualQuantity] = useState('1');
  const [kiloInputMode, setKiloInputMode] = useState<KiloInputMode>('kg');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCart, setManualCart] = useState<ManualCartItem[]>([]);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');

  useEffect(() => {
    if (!open) return;

    setManualError('');
    setManualCart([]);
    setSelectedProduct(null);
    setProductSearch('');
    setSelectedUnit('Unidad');
    setSelectedBagIndex(0);
    setManualQuantity('1');
    setKiloInputMode('kg');
    setManualAmount('');
    setManualCustomerName('');
    setManualCustomerPhone('');
    setManualPaymentMethod('efectivo');

    setProductsLoading(true);
    getProducts(undefined, undefined, true)
      .then((data) => setProducts(data))
      .catch(() => setManualError('No se pudieron cargar los productos. Reintentá en unos segundos.'))
      .finally(() => setProductsLoading(false));
  }, [open]);

  const filteredManualProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );

  const selectedProductUnits = selectedProduct ? getAvailableSaleUnits(selectedProduct) : [];
  const selectedProductBags = selectedProduct ? getBagPresentations(selectedProduct) : [];
  const selectedUnitPrice = selectedProduct
    ? getSaleUnitPrice(selectedProduct, selectedUnit, selectedBagIndex)
    : 0;

  const manualTotal = manualCart.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

  const isKiloUnit = selectedUnit === 'Kilo';

  const kiloAmountNumber = Number(manualAmount);
  const kiloQuantityFromAmount =
    isKiloUnit && kiloInputMode === 'amount' && Number.isFinite(kiloAmountNumber) && kiloAmountNumber > 0 && selectedUnitPrice > 0
      ? kiloAmountNumber / selectedUnitPrice
      : 0;

  const parsedManualQuantity = Number(manualQuantity);
  const previewQuantity =
    isKiloUnit && kiloInputMode === 'amount' ? kiloQuantityFromAmount : parsedManualQuantity;

  const previewSubtotal = (() => {
    if (!Number.isFinite(previewQuantity) || previewQuantity <= 0) return 0;
    if (!Number.isFinite(selectedUnitPrice) || selectedUnitPrice <= 0) return 0;
    if (isKiloUnit && kiloInputMode === 'amount') {
      // En modo monto el subtotal es el monto ingresado (evita error de coma flotante).
      return kiloAmountNumber;
    }
    return previewQuantity * selectedUnitPrice;
  })();

  const handleSelectManualProduct = (product: Product) => {
    setSelectedProduct(product);
    const units = getAvailableSaleUnits(product);
    setSelectedUnit(units[0] ?? 'Unidad');
    setSelectedBagIndex(0);
    setManualQuantity('1');
    setKiloInputMode('kg');
    setManualAmount('');
    setManualError('');
  };

  const handleManualUnitChange = (value: string) => {
    setSelectedUnit(value as SaleUnit);
    setManualQuantity('1');
    setKiloInputMode('kg');
    setManualAmount('');
    setManualError('');
  };

  const handleAddToManualCart = () => {
    if (!selectedProduct) return;

    let quantity: number;

    if (isKiloUnit && kiloInputMode === 'amount') {
      const amount = Number(manualAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setManualError('Ingresá un monto válido.');
        return;
      }
      if (!Number.isFinite(selectedUnitPrice) || selectedUnitPrice <= 0) {
        setManualError('Precio por kilo no disponible.');
        return;
      }
      quantity = amount / selectedUnitPrice;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setManualError('No se pudo calcular la cantidad.');
        return;
      }
    } else {
      quantity = Number(manualQuantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setManualError('Ingresá una cantidad válida.');
        return;
      }
      if (selectedUnit !== 'Kilo' && !Number.isInteger(quantity)) {
        setManualError('La cantidad debe ser un número entero.');
        return;
      }
    }

    const bag =
      selectedUnit === 'Bolsa'
        ? selectedProductBags[Math.min(selectedBagIndex, selectedProductBags.length - 1)]
        : undefined;

    const cartItem: ManualCartItem = {
      productId: selectedProduct.id,
      name: selectedProduct.name,
      unit: selectedUnit,
      quantity,
      unitPrice: selectedUnitPrice,
      presentationId: bag?.id,
      weightKg: bag?.weightKg,
    };

    setManualCart((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.productId === cartItem.productId &&
          item.unit === cartItem.unit &&
          (item.presentationId ?? '') === (cartItem.presentationId ?? ''),
      );

      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [...current, cartItem];
    });

    setManualQuantity('1');
    setManualAmount('');
    setManualError('');
  };

  const handleRemoveManualCartItem = (index: number) => {
    setManualCart((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const isFiado = manualPaymentMethod === 'fiado';
  const fiadoNameMissing = isFiado && manualCustomerName.trim().length === 0;

  const handleManualSubmit = async () => {
    if (manualCart.length === 0 || manualSubmitting) return;

    if (manualPaymentMethod === 'fiado' && manualCustomerName.trim().length === 0) {
      setManualError('El nombre del cliente es obligatorio para ventas fiadas.');
      return;
    }

    setManualSubmitting(true);
    setManualError('');

    try {
      const order = await createManualOrder({
        cart: manualCart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
        })),
        customerName: manualCustomerName.trim() || undefined,
        customerPhone: manualCustomerPhone.trim() || undefined,
        paymentMethod: manualPaymentMethod,
      });

      toast.success('Venta confirmada correctamente');
      onOpenChange(false);
      onConfirmed?.(order);
    } catch (error) {
      setManualError(getManualErrorMessage(error));
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !manualSubmitting) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Nueva venta presencial</DialogTitle>
          <DialogDescription>
            Cargá los productos vendidos y confirmá la venta. La orden quedará confirmada de
            inmediato.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          {/* Product search */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Buscar producto
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Escribí el nombre del producto..."
                className="w-full pl-9 h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {productsLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                <Loader2 className="size-4 animate-spin" />
                Cargando productos...
              </div>
            ) : filteredManualProducts.length === 0 ? (
              <p className="text-sm text-slate-400 py-3">
                {productSearch.trim()
                  ? 'No hay productos que coincidan con la búsqueda.'
                  : 'No hay productos cargados todavía.'}
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredManualProducts.slice(0, 30).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectManualProduct(product)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      selectedProduct?.id === product.id
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="min-w-0 flex flex-col items-start">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {product.name}
                      </span>
                      <OpenBagBadge product={product} className="mt-1" />
                    </span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                      Stock: {product.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected product configurator */}
          {selectedProduct && (
            <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedProduct.name}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Stock: {selectedProduct.stock}
                </span>
              </div>

              <OpenBagBadge product={selectedProduct} />

              {selectedProductUnits.length > 1 ? (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Presentación
                  </label>
                  <Select value={selectedUnit} onValueChange={handleManualUnitChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná una presentación" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProductUnits.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  Presentación: {selectedUnit}
                </div>
              )}

              {selectedUnit === 'Bolsa' && selectedProductBags.length > 1 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Bolsa
                  </label>
                  <Select
                    value={String(selectedBagIndex)}
                    onValueChange={(value) => {
                      setSelectedBagIndex(Number(value));
                      setManualError('');
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná una bolsa" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProductBags.map((bag, index) => (
                        <SelectItem key={bag.id ?? index} value={String(index)}>
                          {bag.weightKg ? `${Number(bag.weightKg)} kg` : 'Bolsa'} —{' '}
                          {formatARS(bag.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isKiloUnit && (
                <div className="flex gap-2 p-1 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                  <Button
                    type="button"
                    variant={kiloInputMode === 'kg' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setKiloInputMode('kg');
                      setManualError('');
                    }}
                  >
                    Por kg
                  </Button>
                  <Button
                    type="button"
                    variant={kiloInputMode === 'amount' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => {
                      setKiloInputMode('amount');
                      setManualError('');
                    }}
                  >
                    Por monto ($)
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {isKiloUnit && kiloInputMode === 'amount' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Monto ($)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      placeholder="Ej: 2000"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {kiloQuantityFromAmount > 0 && Number.isFinite(kiloQuantityFromAmount) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ≈ {formatKg(kiloQuantityFromAmount)} kg
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      Cantidad{isKiloUnit ? ' (kg)' : ''}
                    </label>
                    <input
                      type="number"
                      inputMode={isKiloUnit ? 'decimal' : 'numeric'}
                      min={isKiloUnit ? '0.01' : '1'}
                      step={isKiloUnit ? 'any' : '1'}
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(e.target.value)}
                      className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div className="flex flex-col justify-end gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                      Precio unitario
                    </p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {formatARS(selectedUnitPrice)}
                      {isKiloUnit ? ' / kg' : ''}
                    </p>
                    {previewSubtotal > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        Subtotal:{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {formatARS(previewSubtotal)}
                        </span>
                      </p>
                    )}
                  </div>
                  <Button type="button" onClick={handleAddToManualCart} className="w-full sm:w-auto">
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Cart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Carrito
              </h3>
              <span className="text-xs text-slate-400">
                {manualCart.length} {manualCart.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {manualCart.length === 0 ? (
              <p className="text-sm text-slate-400 py-3">
                Todavía no agregaste productos a la venta.
              </p>
            ) : (
              <div className="max-w-full rounded-md border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-0">Producto</TableHead>
                      <TableHead className="whitespace-nowrap">Presentación</TableHead>
                      <TableHead className="px-2 text-center whitespace-nowrap">Cant.</TableHead>
                      <TableHead className="px-2 text-right whitespace-nowrap">
                        P. unitario
                      </TableHead>
                      <TableHead className="px-2 text-right whitespace-nowrap">Subtotal</TableHead>
                      <TableHead className="w-12 px-2 text-right whitespace-nowrap">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualCart.map((item, index) => (
                      <TableRow
                        key={`${item.productId}-${item.unit}-${item.presentationId ?? index}`}
                      >
                        <TableCell className="min-w-0 max-w-[180px] sm:max-w-[260px] font-medium text-slate-800 dark:text-slate-200 whitespace-normal break-words">
                          {item.name}
                          <OpenBagBadge
                            product={products.find((product) => product.id === item.productId)}
                            className="mt-1"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="secondary" className="whitespace-nowrap">
                            {item.unit === 'Bolsa' && item.weightKg
                              ? `Bolsa ${Number(item.weightKg)} kg`
                              : item.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 text-center whitespace-nowrap tabular-nums">
                          {item.unit === 'Kilo' ? formatKg(item.quantity) : item.quantity}
                        </TableCell>
                        <TableCell className="px-2 text-right whitespace-nowrap tabular-nums">
                          {formatARS(item.unitPrice)}
                        </TableCell>
                        <TableCell className="px-2 text-right font-semibold whitespace-nowrap tabular-nums">
                          {formatARS(item.unitPrice * item.quantity)}
                        </TableCell>
                        <TableCell className="px-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            type="button"
                            onClick={() => handleRemoveManualCartItem(index)}
                            aria-label="Quitar producto"
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {formatARS(manualTotal)}
              </span>
            </div>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Nombre del cliente{isFiado ? ' *' : ' (opcional)'}
              </label>
              <input
                type="text"
                value={manualCustomerName}
                onChange={(e) => {
                  setManualCustomerName(e.target.value);
                  if (manualError) setManualError('');
                }}
                placeholder="Ej: María López"
                aria-invalid={fiadoNameMissing}
                className={`w-full h-9 rounded-md border bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  fiadoNameMissing
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              />
              {fiadoNameMissing && (
                <p className="text-xs text-red-600">
                  El nombre del cliente es obligatorio para ventas fiadas.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Teléfono del cliente (opcional)
              </label>
              <input
                type="tel"
                value={manualCustomerPhone}
                onChange={(e) => setManualCustomerPhone(e.target.value)}
                placeholder="Ej: 11 2345 6789"
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Método de pago
            </label>
            <Select
              value={manualPaymentMethod}
              onValueChange={(value) => {
                setManualPaymentMethod(value as PaymentMethod);
                setManualError('');
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un método de pago" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFiado && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                La venta quedará registrada como deuda del cliente hasta que se marque como pagada.
              </p>
            )}
          </div>

          {manualError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {manualError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={manualSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleManualSubmit}
              disabled={manualSubmitting || manualCart.length === 0 || fiadoNameMissing}
            >
              {manualSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirmar venta
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
