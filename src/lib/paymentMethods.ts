import type { PaymentMethod } from '@/infrastructure/orders.service';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
}

/**
 * Catálogo único de métodos de pago.
 *
 * Tanto la venta manual del admin como la del empleado usan el mismo
 * `ManualSaleDialog`, que consume esta lista: agregar un método acá lo
 * refleja en ambos flujos sin duplicar arreglos.
 */
export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'fiado', label: 'Fiado' },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercado_pago: 'Mercado Pago',
  fiado: 'Fiado',
};

export const getPaymentMethodLabel = (paymentMethod?: PaymentMethod | null): string => {
  if (!paymentMethod) return '—';
  return PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
};
