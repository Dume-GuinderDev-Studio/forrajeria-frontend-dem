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
import styles from './ManualSaleDialog.module.css';
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

/**
 * Máximo de productos renderizados en la lista del buscador.
 * El filtro por texto se aplica SIEMPRE sobre el catálogo completo y recién
 * después se recorta lo que se muestra.
 */
const PRODUCT_RESULT_LIMIT = 30;

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

/** Cantidad del ítem tal como se muestra en la tabla y en la card de mobile. */
const cartItemQuantity = (item: ManualCartItem): string | number =>
  item.unit === 'Kilo' ? formatKg(item.quantity) : item.quantity;

/** Subtotal del ítem. Compartido por la tabla y la card de mobile. */
const cartItemSubtotal = (item: ManualCartItem): string =>
  formatARS(item.unitPrice * item.quantity);

/** Badge de presentación del ítem. Compartido por la tabla y la card de mobile. */
const CartPresentationBadge = ({ item }: { item: ManualCartItem }) => (
  <Badge variant="secondary" className={styles.nowrap}>
    {item.unit === 'Bolsa' && item.weightKg ? `Bolsa ${Number(item.weightKg)} kg` : item.unit}
  </Badge>
);

/** Botón de quitar ítem. Compartido por la tabla y la card de mobile. */
const RemoveCartItemButton = ({
  index,
  onRemove,
}: {
  index: number;
  onRemove: (index: number) => void;
}) => (
  <Button
    variant="ghost"
    size="icon-sm"
    type="button"
    onClick={() => onRemove(index)}
    aria-label="Quitar producto"
    className={styles.removeBtn}
  >
    <Trash2 className={styles.trashIcon} />
  </Button>
);

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

  // Filtro sobre la lista completa: el recorte de visibles va después.
  const filteredManualProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearch.trim().toLowerCase()),
  );
  const visibleManualProducts = filteredManualProducts.slice(0, PRODUCT_RESULT_LIMIT);
  const hasHiddenManualProducts = filteredManualProducts.length > PRODUCT_RESULT_LIMIT;

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
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>Nueva venta presencial</DialogTitle>
          <DialogDescription>
            Cargá los productos vendidos y confirmá la venta. La orden quedará confirmada de
            inmediato.
          </DialogDescription>
        </DialogHeader>

        <div className={styles.body}>
          {/* Product search */}
          <div className={styles.section}>
            <label className={styles.label}>Buscar producto</label>
            <div className={styles.searchWrap}>
              <Search className={styles.searchIcon} />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Escribí el nombre del producto..."
                className={[styles.input, styles.searchInput].filter(Boolean).join(' ')}
              />
            </div>

            {productsLoading ? (
              <div className={styles.loadingRow}>
                <Loader2 className={styles.spin} />
                Cargando productos...
              </div>
            ) : filteredManualProducts.length === 0 ? (
              <p className={styles.emptyText}>
                {productSearch.trim()
                  ? 'No hay productos que coincidan con la búsqueda.'
                  : 'No hay productos cargados todavía.'}
              </p>
            ) : (
              <div className={styles.results}>
                {visibleManualProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectManualProduct(product)}
                    data-selected={selectedProduct?.id === product.id}
                    className={styles.resultBtn}
                  >
                    <span className={styles.resultMain}>
                      <span className={styles.resultName}>{product.name}</span>
                      <OpenBagBadge product={product} className={styles.badgeGap} />
                    </span>
                    <span className={styles.resultStock}>Stock: {product.stock}</span>
                  </button>
                ))}
                {hasHiddenManualProducts && (
                  <p className={styles.resultFooter}>
                    Mostrando {visibleManualProducts.length} de {filteredManualProducts.length}.
                    Escribí para filtrar.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Selected product configurator */}
          {selectedProduct && (
            <div className={styles.configCard}>
              <div className={styles.configHead}>
                <span className={styles.configName}>{selectedProduct.name}</span>
                <span className={styles.configStock}>Stock: {selectedProduct.stock}</span>
              </div>

              {/* El sobrante de la bolsa abierta solo tiene sentido cuando se
                  vende el fraccionado: con 'Bolsa' se vende la bolsa cerrada. */}
              <OpenBagBadge product={selectedProduct} unit={selectedUnit} />

              {selectedProductUnits.length > 1 ? (
                <div className={styles.sectionTight}>
                  <label className={styles.label}>Presentación</label>
                  <Select value={selectedUnit} onValueChange={handleManualUnitChange}>
                    <SelectTrigger className={styles.trigger}>
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
                <div className={styles.plainText}>Presentación: {selectedUnit}</div>
              )}

              {selectedUnit === 'Bolsa' && selectedProductBags.length > 1 && (
                <div className={styles.sectionTight}>
                  <label className={styles.label}>Bolsa</label>
                  <Select
                    value={String(selectedBagIndex)}
                    onValueChange={(value) => {
                      setSelectedBagIndex(Number(value));
                      setManualError('');
                    }}
                  >
                    <SelectTrigger className={styles.trigger}>
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
                <div className={styles.kiloToggle}>
                  <Button
                    type="button"
                    variant={kiloInputMode === 'kg' ? 'default' : 'ghost'}
                    size="sm"
                    className={styles.kiloBtn}
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
                    className={styles.kiloBtn}
                    onClick={() => {
                      setKiloInputMode('amount');
                      setManualError('');
                    }}
                  >
                    Por monto ($)
                  </Button>
                </div>
              )}

              <div className={styles.grid2}>
                {isKiloUnit && kiloInputMode === 'amount' ? (
                  <div className={styles.sectionTight}>
                    <label className={styles.label}>Monto ($)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      placeholder="Ej: 2000"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className={styles.input}
                    />
                    {kiloQuantityFromAmount > 0 && Number.isFinite(kiloQuantityFromAmount) && (
                      <p className={styles.hint}>≈ {formatKg(kiloQuantityFromAmount)} kg</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.sectionTight}>
                    <label className={styles.label}>Cantidad{isKiloUnit ? ' (kg)' : ''}</label>
                    <input
                      type="number"
                      inputMode={isKiloUnit ? 'decimal' : 'numeric'}
                      min={isKiloUnit ? '0.01' : '1'}
                      step={isKiloUnit ? 'any' : '1'}
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                )}
                <div className={styles.priceCol}>
                  <div>
                    <p className={styles.priceLabel}>Precio unitario</p>
                    <p className={styles.priceValue}>
                      {formatARS(selectedUnitPrice)}
                      {isKiloUnit ? ' / kg' : ''}
                    </p>
                    {previewSubtotal > 0 && (
                      <p className={styles.subtotal}>
                        Subtotal:{' '}
                        <span className={styles.subtotalValue}>
                          {formatARS(previewSubtotal)}
                        </span>
                      </p>
                    )}
                  </div>
                  <Button type="button" onClick={handleAddToManualCart} className={styles.addBtn}>
                    <Plus className={styles.addIcon} />
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Cart */}
          <div className={styles.section}>
            <div className={styles.cartHead}>
              <h3 className={styles.cartTitle}>Carrito</h3>
              <span className={styles.cartCount}>
                {manualCart.length} {manualCart.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {manualCart.length === 0 ? (
              <p className={styles.cartEmpty}>Todavía no agregaste productos a la venta.</p>
            ) : (
  <>
                {/* Mobile: una fila por item. La tabla de desktop queda debajo. */}
                <ul className={styles.cartList}>
                  {manualCart.map((item, index) => (
                    <li
                      key={`${item.productId}-${item.unit}-${item.presentationId ?? index}`}
                      className={styles.cartItem}
                    >
                      <div className={styles.cartItemTop}>
                        <div className={styles.cartItemInfo}>
                          <div className={styles.cartItemName}>
                            {item.name}
                          </div>
                        </div>
                        <RemoveCartItemButton index={index} onRemove={handleRemoveManualCartItem} />
                      </div>

                      <div className={styles.cartItemMeta}>
                        <CartPresentationBadge item={item} />
                      </div>

                      <div className={styles.cartItemBottom}>
                        <span className={styles.cartItemUnit}>
                          Cant. {cartItemQuantity(item)} × {formatARS(item.unitPrice)} c/u
                        </span>
                        <span className={styles.cartItemSubtotal}>
                          <span className={styles.cartItemSubtotalLabel}>Subtotal</span>
                          <span
                            className={[styles.moneyCell, styles.moneyCellBold]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {cartItemSubtotal(item)}
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

              <div className={styles.cartDesktop}>
              <div className={styles.cartScroll}>
                <Table className={styles.cartTable}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={styles.minWidth}>Producto</TableHead>
                      <TableHead className={styles.nowrap}>Presentación</TableHead>
                      <TableHead className={[styles.qtyCell].filter(Boolean).join(' ')}>Cant.</TableHead>
                      <TableHead className={styles.moneyCell}>P. unitario</TableHead>
                      <TableHead className={styles.moneyCell}>Subtotal</TableHead>
                      <TableHead className={styles.actionCell}>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualCart.map((item, index) => (
                      <TableRow
                        key={`${item.productId}-${item.unit}-${item.presentationId ?? index}`}
                      >
                        <TableCell className={styles.nameCell}>
                          {item.name}
                        </TableCell>
                        <TableCell className={styles.badgeCell}>
                          <CartPresentationBadge item={item} />
                        </TableCell>
                        <TableCell className={styles.qtyCell}>
                          {cartItemQuantity(item)}
                        </TableCell>
                        <TableCell className={styles.moneyCell}>
                          {formatARS(item.unitPrice)}
                        </TableCell>
                        <TableCell
                          className={[styles.moneyCell, styles.moneyCellBold]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {cartItemSubtotal(item)}
                        </TableCell>
                        <TableCell className={styles.actionCell}>
                          <RemoveCartItemButton
                            index={index}
                            onRemove={handleRemoveManualCartItem}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
                </div>
              </>
            )}

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>{formatARS(manualTotal)}</span>
            </div>
          </div>

          {/* Customer info */}
          <div className={styles.grid2}>
            <div className={styles.sectionTight}>
              <label className={styles.label}>
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
                className={[styles.input, fiadoNameMissing ? styles.inputError : '']
                  .filter(Boolean)
                  .join(' ')}
              />
              {fiadoNameMissing && (
                <p className={styles.fieldError}>
                  El nombre del cliente es obligatorio para ventas fiadas.
                </p>
              )}
            </div>
            <div className={styles.sectionTight}>
              <label className={styles.label}>Teléfono del cliente (opcional)</label>
              <input
                type="tel"
                value={manualCustomerPhone}
                onChange={(e) => setManualCustomerPhone(e.target.value)}
                placeholder="Ej: 11 2345 6789"
                className={styles.input}
              />
            </div>
          </div>

          {/* Payment method */}
          <div className={styles.sectionTight}>
            <label className={styles.label}>Método de pago</label>
            <Select
              value={manualPaymentMethod}
              onValueChange={(value) => {
                setManualPaymentMethod(value as PaymentMethod);
                setManualError('');
              }}
            >
              <SelectTrigger className={styles.trigger}>
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
              <p className={styles.hint}>
                La venta quedará registrada como deuda del cliente hasta que se marque como pagada.
              </p>
            )}
          </div>

          {manualError && <div className={styles.formError}>{manualError}</div>}

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
                <Loader2 className={styles.spin} />
              ) : (
                <CheckCircle2 className={styles.addIcon} />
              )}
              Confirmar venta
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
