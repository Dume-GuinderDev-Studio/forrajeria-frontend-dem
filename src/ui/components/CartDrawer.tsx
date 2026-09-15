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
      <SheetContent className="flex flex-col h-full w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold flex items-center gap-2">
            🛒 Tu Pedido
            <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {items.length} items
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-6 -mx-6 px-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">🦴</span>
              </div>
              <p className="text-center font-medium">
                El carrito está vacío.
                <br />
                ¡Agregá algo rico para tu mascota!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <div key={`${item.productId}-${item.unit}`} className="flex gap-4">
                  <div className="h-20 w-20 bg-slate-100 rounded-md flex-shrink-0 overflow-hidden border border-slate-200">
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
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).onerror = null;
                              (e.target as HTMLImageElement).src =
                                'https://placehold.co/400x400/f1f5f9/94a3b8?text=BAS';
                            }}
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                          BAS
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 line-clamp-2 leading-tight">
                      {item.name}
                    </h4>
                    {item.unit === 'Kilo' && Number(item.openBagRemainingKg) > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-600">
                        Bolsa abierta: {formatKg(Number(item.openBagRemainingKg))}kg restantes
                      </p>
                    )}
                    <p className="text-sm text-slate-500 mb-2 font-medium">
                      Precio por {item.unit}:
                      <span className="text-blue-600 ml-1">
                        {formatARS(roundToWholePeso(Number(item.price) || 0))}
                      </span>
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.unit, -1)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.unit, 1)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.productId, item.unit)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
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

        <SheetFooter className="border-t border-slate-200 pt-6 mt-auto">
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between text-lg font-bold text-slate-800">
              <span>Total Estimado</span>
              <span>{formatARS(roundToWholePeso(Number(total) || 0))}</span>
            </div>

            {items.length > 0 && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <div>
                  <label
                    htmlFor="customer-name"
                    className="text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
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
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {customerErrors.name && (
                    <p className="mt-1 text-xs font-medium text-red-500">{customerErrors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="customer-phone"
                    className="text-xs font-bold uppercase tracking-wide text-slate-500"
                  >
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
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {customerErrors.phone && (
                    <p className="mt-1 text-xs font-medium text-red-500">{customerErrors.phone}</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleSendWhatsApp}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-lg shadow-green-200 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={items.length === 0 || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando pedido...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-5 w-5" /> Enviar Pedido por WhatsApp!
                </>
              )}
            </Button>
            <p className="text-xs text-center text-slate-400">
              Al enviar, se abrirá WhatsApp con el detalle de tu pedido para confirmar con nosotros.
            </p>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
