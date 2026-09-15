import api from './api';

export type SupplierPaymentMethod = 'efectivo' | 'transferencia' | 'mercado_pago';

export interface SupplierDebtSupplier {
  id: string;
  name: string;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  supplier?: SupplierDebtSupplier | null;
  supplierName: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod | string;
  paidAt: string;
  notes?: string | null;
}

export interface SupplierDebtDetail extends SupplierDebt {
  payments: SupplierPayment[];
}

export interface SupplierDebtsBySupplier {
  supplierId: string;
  supplierName: string;
  debtsCount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
}

export interface SupplierDebtsSummary {
  totalPending: number;
  bySupplier: SupplierDebtsBySupplier[];
}

export interface CreateSupplierDebtPayload {
  supplierId: string;
  description: string;
  totalAmount: number;
}

export interface CreateSupplierPaymentPayload {
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paidAt?: string;
  notes?: string;
}

const toNum = (value: unknown): number => {
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface RawDebt {
  id: string;
  supplierId: string;
  supplier?: SupplierDebtSupplier | null;
  description: string;
  totalAmount: number | string;
  paidAmount: number | string;
  pendingAmount: number | string;
  createdAt: string;
}

const normalizeDebt = (raw: RawDebt): SupplierDebt => ({
  id: raw.id,
  supplierId: raw.supplierId,
  supplier: raw.supplier ?? null,
  supplierName: raw.supplier?.name ?? 'Proveedor sin nombre',
  description: raw.description ?? '',
  totalAmount: toNum(raw.totalAmount),
  paidAmount: toNum(raw.paidAmount),
  pendingAmount: toNum(raw.pendingAmount),
  createdAt: raw.createdAt,
});

const normalizeList = (payload: unknown): SupplierDebt[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: RawDebt[] }).data
      : [];
  return (list as RawDebt[]).map(normalizeDebt);
};

/** Lista todas las deudas a proveedores. GET /supplier-debts. */
export const getSupplierDebts = async (): Promise<SupplierDebt[]> => {
  const response = await api.get('/supplier-debts');
  return normalizeList(response.data);
};

/** Resumen del total adeudado, agrupado por proveedor. GET /supplier-debts/summary. */
export const getSupplierDebtsSummary = async (): Promise<SupplierDebtsSummary> => {
  const response = await api.get('/supplier-debts/summary');
  const data = (response.data ?? {}) as Partial<SupplierDebtsSummary>;
  return {
    totalPending: toNum(data.totalPending),
    bySupplier: Array.isArray(data.bySupplier)
      ? data.bySupplier.map((entry) => ({
          supplierId: entry.supplierId,
          supplierName: entry.supplierName ?? 'Proveedor sin nombre',
          debtsCount: Number(entry.debtsCount) || 0,
          totalAmount: toNum(entry.totalAmount),
          paidAmount: toNum(entry.paidAmount),
          pendingAmount: toNum(entry.pendingAmount),
        }))
      : [],
  };
};

interface RawDebtDetail extends RawDebt {
  payments?: Array<{
    id: string;
    amount: number | string;
    paymentMethod: string;
    paidAt: string;
    notes?: string | null;
  }>;
}

/** Detalle de una deuda con su historial de pagos. GET /supplier-debts/:id. */
export const getSupplierDebt = async (id: string): Promise<SupplierDebtDetail> => {
  const response = await api.get<RawDebtDetail>(`/supplier-debts/${id}`);
  const raw = response.data;
  return {
    ...normalizeDebt(raw),
    payments: (raw.payments ?? []).map((payment) => ({
      id: payment.id,
      amount: toNum(payment.amount),
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
      notes: payment.notes ?? null,
    })),
  };
};

/** Registra una nueva deuda. POST /supplier-debts. */
export const createSupplierDebt = async (
  payload: CreateSupplierDebtPayload,
): Promise<SupplierDebt> => {
  const response = await api.post('/supplier-debts', payload);
  return normalizeDebt(response.data as RawDebt);
};

/**
 * Elimina físicamente una deuda. DELETE /supplier-debts/:id.
 * Solo funciona si paidAmount=0; con pagos el backend devuelve 409
 * (en ese caso corresponde anular con `cancelSupplierDebt`).
 */
export const deleteSupplierDebt = async (id: string): Promise<void> => {
  await api.delete(`/supplier-debts/${id}`);
};

export interface CancelSupplierDebtResult {
  cancelled: boolean;
  debt: SupplierDebt;
}

/**
 * Anula una deuda que ya tiene pagos. PATCH /supplier-debts/:id/cancel.
 * Devuelve el objeto {cancelled:true, debt}. La deuda anulada queda con
 * cancelledAt y el backend la excluye de GET /supplier-debts por default.
 */
export const cancelSupplierDebt = async (id: string): Promise<CancelSupplierDebtResult> => {
  const response = await api.patch(`/supplier-debts/${id}/cancel`);
  const data = response.data as { cancelled?: boolean; debt?: RawDebt };
  if (!data?.debt) throw new Error('Respuesta inválida del servidor al anular la deuda');
  return {
    cancelled: data.cancelled === true,
    debt: normalizeDebt(data.debt),
  };
};

/** Registra un pago parcial sobre una deuda. POST /supplier-debts/:id/payments. */
export const addSupplierPayment = async (
  id: string,
  payload: CreateSupplierPaymentPayload,
): Promise<SupplierPayment> => {
  const response = await api.post(`/supplier-debts/${id}/payments`, payload);
  const raw = response.data as SupplierPayment;
  return { ...raw, amount: toNum(raw.amount) };
};

/**
 * Extrae el mensaje de error legible del backend (string o array de
 * validación de class-validator). Se usa para mostrarlo dentro del modal
 * sin cerrarlo (ej. pago que supera el saldo pendiente).
 */
export const getSupplierDebtsErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  const message = data?.message;

  if (typeof message === 'string' && message.trim().length > 0) return message;
  if (Array.isArray(message)) {
    const first = message.find((item) => typeof item === 'string' && item.trim().length > 0);
    if (typeof first === 'string') return first;
  }
  return fallback;
};
