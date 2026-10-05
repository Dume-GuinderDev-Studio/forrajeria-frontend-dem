import { useState } from 'react';
import { useCartStore } from '@/infrastructure/cart_manager';
import { useCustomerStore } from '@/infrastructure/customer_manager';
import { createWhatsappLink } from '@/infrastructure/orders.service';
import { getRecaptchaToken } from '@/infrastructure/recaptcha';
import { formatKg } from '@/lib/openBag';
import { formatARS, roundToWholePeso } from '@/lib/format';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';
import { Minus, Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { extractValidationMessage } from '@/lib/validation';
import styles from './CartDrawer.module.css';

const getWhatsappError = (error: unknown): string => {
  const err = error as {
    response?: { data?: { message?: unknown } };
    message?: string;
  };
  const message = err?.response?.data?.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message)) {
    for (const item of message) {
      const extracted = extractValidationMessage(item);
      if (extracted) {
        return extracted;
      }
    }
    return 'El pedido no pudo ser validado por el servidor.';
  }

  return err?.message || 'No se pudo procesar el pedido. Intentá nuevamente.';
};

// This is a wrapper that will need to be used in HomePage or global layout
// But since the trigger is in the Navbar, we'll control the state or pass the trigger
interface CartDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CartDrawer = ({ isOpen, onOpenChange }: CartDrawerProps) => {
  const { items, updateQuantity, removeItem, getTotal } = useCartStore();
  const { customerName, customerPhone, setCustomerName, setCustomerPhone } = useCustomerStore();
  const [isSending, setIsSending] = useState(false);
  const [customerErrors, setCustomerErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});
  const total = getTotal();

  const validateCustomerInfo = (): boolean => {
    const nextErrors: { name?: string; phone?: string } = {};

    if (!customerName.trim()) {
      nextErrors.name = 'Ingresá tu nombre.';
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (!customerPhone.trim()) {
      nextErrors.phone = 'Ingresá tu teléfono.';
    } else if (phoneDigits.length < 8) {
      nextErrors.phone = 'El teléfono debe tener al menos 8 dígitos.';
    }

    setCustomerErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSendWhatsApp = async () => {
    if (items.length === 0 || isSending) return;

    if (!validateCustomerInfo()) return;

    setIsSending(true);

    // Abrimos una ventana vacía de forma síncrona (dentro del gesto del
    // click) para que el popup blocker no bloquee la apertura de WhatsApp
    // después de las llamadas async. Recién la redirigimos cuando el backend
    // devuelve el link validado.
    const whatsappWindow = window.open('', '_blank');

    try {
      // El backend solo acepta Bolsa/Kilo. Si hay un item de tipo
      // "Unidad", no podemos enviarlo y no abrimos WhatsApp.
      const cart = items.map((item) => {
        if (item.unit !== 'Bolsa' && item.unit !== 'Kilo') {
          throw new Error(`"${item.name}" se vende por unidad y no puede pedirse por WhatsApp.`);
        }

        return {
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
        };
      });

      const recaptchaToken = await getRecaptchaToken('order_whatsapp');
      const { link } = await createWhatsappLink(
        {
          cart,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
        },
        recaptchaToken,
      );

      // Recién acá, con el link generado y validado por el backend,
      // abrimos WhatsApp. Nunca armamos el link a mano en el cliente.
      if (whatsappWindow) {
        whatsappWindow.location.href = link;
      } else {
        window.open(link, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      if (whatsappWindow) {
        whatsappWindow.close();
      }
      toast.error(getWhatsappError(error));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className={styles.content}>
        <SheetHeader>
          <SheetTitle className={styles.title}>
            🛒 Tu Pedido
            <span className={styles.count}>{items.length} items</span>
          </SheetTitle>
        </SheetHeader>

        <div className={styles.list}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <span className={styles.emptyEmoji}>🦴</span>
              </div>
              <p className={styles.emptyText}>
                El carrito está vacío.
                <br />
                ¡Agregá algo rico para tu mascota!
              </p>
            </div>
          ) : (
            <div className={styles.items}>
              {items.map((item) => (
                <div key={`${item.productId}-${item.unit}`} className={styles.item}>
                  <div className={styles.thumb}>
                    {(() => {
                      const imageUrl = item.image;
                      const productName = item.name;

                      if (imageUrl) {
                        // Handle potential mixed content if site is HTTPS and image is HTTP
                        // Many browsers block HTTP images on HTTPS sites. If possible, upgrade to HTTPS.
                        const safeUrl = imageUrl.replace(/^http:\/\//i, 'https://');
                        return (
                          <img
                            src={safeUrl}
                            alt={productName}
                            className={styles.thumbImg}
                            onError={(e) => {
                              (e.target as HTMLImageElement).onerror = null;
                              (e.target as HTMLImageElement).src =
                                'https://placehold.co/400x400/f1f5f9/94a3b8?text=BAS';
                            }}
                          />
                        );
                      }
                      return <div className={styles.thumbFallback}>BAS</div>;
                    })()}
                  </div>
                  <div className={styles.itemBody}>
                    <h4 className={styles.itemName}>{item.name}</h4>
                    {item.unit === 'Kilo' && Number(item.openBagRemainingKg) > 0 && (
                      <p className={styles.openBag}>
                        Bolsa abierta: {formatKg(Number(item.openBagRemainingKg))}kg restantes
                      </p>
                    )}
                    <p className={styles.unitPrice}>
                      Precio por {item.unit}:
                      <span className={styles.unitPriceValue}>
                        {formatARS(roundToWholePeso(Number(item.price) || 0))}
                      </span>
                    </p>

                    <div className={styles.qtyRow}>
                      <div className={styles.stepper}>
                        <button
                          onClick={() => updateQuantity(item.productId, item.unit, -1)}
                          className={styles.stepBtn}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className={styles.qty}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.unit, 1)}
                          className={styles.stepBtn}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId, item.unit)}
                        className={styles.removeBtn}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <SheetFooter className={styles.footer}>
          <div className={styles.footerInner}>
            <div className={styles.totalRow}>
              <span>Total Estimado</span>
              <span>{formatARS(roundToWholePeso(Number(total) || 0))}</span>
            </div>

            {items.length > 0 && (
              <div className={styles.customerBox}>
                <div>
                  <label htmlFor="customer-name" className={styles.customerLabel}>
                    Nombre
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (customerErrors.name) {
                        setCustomerErrors((prev) => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder="Ej: María López"
                    className={styles.customerInput}
                  />
                  {customerErrors.name && (
                    <p className={styles.fieldError}>{customerErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="customer-phone" className={styles.customerLabel}>
                    Teléfono
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (customerErrors.phone) {
                        setCustomerErrors((prev) => ({ ...prev, phone: undefined }));
                      }
                    }}
                    placeholder="Ej: 11 2345 6789"
                    className={styles.customerInput}
                  />
                  {customerErrors.phone && (
                    <p className={styles.fieldError}>{customerErrors.phone}</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleSendWhatsApp}
              className={styles.sendBtn}
              disabled={items.length === 0 || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className={[styles.btnIcon, styles.spin].filter(Boolean).join(' ')} />{' '}
                  Procesando pedido...
                </>
              ) : (
                <>
                  <Send className={styles.btnIcon} /> Enviar Pedido por WhatsApp!
                </>
              )}
            </Button>
            <p className={styles.note}>
              Al enviar, se abrirá WhatsApp con el detalle de tu pedido para confirmar con nosotros.
            </p>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
