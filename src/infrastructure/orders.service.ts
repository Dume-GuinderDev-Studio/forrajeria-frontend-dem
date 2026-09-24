import api from './api';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'mercado_pago' | 'fiado';

export interface OrderProduct {
  id: string;
  name: string;
}

export interface OrderLine {
  id: string;
  orderId?: string;
  productId: string;
  product: OrderProduct;
  presentationId?: string | null;
  presentation?: {
    id: string;
    type: 'bag' | 'kilo';
    weightKg: number | null;
    price: number;
  } | null;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  subtotal: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: PaymentMethod | null;
  total: number | null;
  createdAt: string;
  confirmedAt: string | null;
  lines: OrderLine[];
}

export interface OrdersMeta {
  page: number;
  limit: number;
  total: number;
}

export interface OrdersResponse {
  data: Order[];
  meta: OrdersMeta;
}

export interface OrderMetricsBucket {
  sales: number;
  orders: number;
}

export interface OrderMetrics {
  today: OrderMetricsBucket;
  week: OrderMetricsBucket;
  month: OrderMetricsBucket;
  avgTicket: number;
  profitMonth: number;
}

export interface GetOrdersParams {
  status?: OrderStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const getOrders = async (params: GetOrdersParams = {}): Promise<OrdersResponse> => {
  const query: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    limit: params.limit ?? 20,
  };

  if (params.status) query.status = params.status;
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;

  const response = await api.get<OrdersResponse>('/orders', { params: query });
  return response.data;
};

export interface ExportOrdersParams {
  from?: string;
  to?: string;
}

/**
 * Descarga el reporte de ventas en formato Excel. Si no se envían fechas,
 * el backend usa su rango por defecto (mes actual).
 */
export const exportOrders = async (params: ExportOrdersParams = {}): Promise<Blob> => {
  const query: Record<string, string | undefined> = {};
  if (params.from) query.from = params.from;
  if (params.to) query.to = params.to;

  const response = await api.get<Blob>('/orders/export', {
    params: Object.keys(query).length > 0 ? query : undefined,
    responseType: 'blob',
  });

  return response.data;
};

export const getOrdersMetrics = async (): Promise<OrderMetrics> => {
  const response = await api.get<OrderMetrics>('/orders/metrics');
  return response.data;
};

export interface MySalesToday {
  sales: number;
  orders: number;
}

interface MySalesTodayResponse {
  sales?: number;
  orders?: number;
  // Nombres alternativos, por si el backend usa otra convención.
  total?: number;
  count?: number;
}

/**
 * Resumen de ventas del día del usuario autenticado (usado por el rol
 * empleado). GET /orders/my-sales-today.
 */
export const getMySalesToday = async (): Promise<MySalesToday> => {
  const response = await api.get<MySalesTodayResponse>('/orders/my-sales-today');
  const data = response.data ?? {};

  return {
    sales: Number(data.sales ?? data.total ?? 0),
    orders: Number(data.orders ?? data.count ?? 0),
  };
};

export interface CashSummary {
  date: string;
  byPaymentMethod: Record<PaymentMethod, number>;
  total: number;
  orders: number;
  /** Ganancia del día (ventas menos costo de productos). */
  profit: number;
}

export const getCashSummary = async (date?: string): Promise<CashSummary> => {
  const response = await api.get<CashSummary>('/orders/cash-summary', {
    params: date ? { date } : undefined,
  });
  return response.data;
};

export interface SupplierProfit {
  supplierId: string;
  supplierName: string;
  sales: number;
  profit: number;
  orders?: number;
  /** Monto ya registrado como deuda para el período (viene del backend). */
  alreadyRegistered: number;
  /** Lo que falta registrar para el período (viene del backend). */
  pendingToRegister: number;
}

interface SupplierProfitRaw {
  supplierId?: string;
  supplier?: { id?: string; name?: string } | string;
  supplierName?: string;
  name?: string;
  totalSales?: number;
  sales?: number;
  total?: number;
  revenue?: number;
  totalProfit?: number;
  profit?: number;
  gain?: number;
  orders?: number;
  alreadyRegistered?: number;
  pendingToRegister?: number;
}

type ProfitBySupplierResponse =
  | SupplierProfit[]
  | SupplierProfitRaw[]
  | { data?: SupplierProfit[] | SupplierProfitRaw[] };

const normalizeSupplierProfit = (raw: SupplierProfit | SupplierProfitRaw): SupplierProfit => {
  const record = raw as SupplierProfitRaw;
  const nested = typeof record.supplier === 'object' ? record.supplier : undefined;
  const sales = Number(record.totalSales ?? record.sales ?? record.total ?? record.revenue ?? 0);
  const profit = Number(record.totalProfit ?? record.profit ?? record.gain ?? 0);
  const alreadyRegistered = Number(record.alreadyRegistered ?? 0);
  const pendingRaw = record.pendingToRegister;
  const pendingFallback = (Number.isFinite(sales) ? sales : 0) - (Number.isFinite(profit) ? profit : 0);
  const pendingToRegister = Number(pendingRaw ?? pendingFallback);
  return {
    supplierId: record.supplierId ?? nested?.id ?? record.supplierName ?? '',
    supplierName:
      record.supplierName ??
      record.name ??
      nested?.name ??
      (typeof record.supplier === 'string' ? record.supplier : 'Proveedor sin nombre'),
    sales: Number.isFinite(sales) ? sales : 0,
    profit: Number.isFinite(profit) ? profit : 0,
    orders: typeof record.orders === 'number' ? record.orders : undefined,
    alreadyRegistered: Number.isFinite(alreadyRegistered) ? alreadyRegistered : 0,
    pendingToRegister: Number.isFinite(pendingToRegister) ? pendingToRegister : 0,
  };
};

export interface ProfitBySupplierParams {
  from?: string;
  to?: string;
}

/**
 * Ganancia agregada por proveedor en un período.
 * GET /orders/profit-by-supplier?from&to.
 */
export const getProfitBySupplier = async (
  params: ProfitBySupplierParams = {},
): Promise<SupplierProfit[]> => {
  const response = await api.get<ProfitBySupplierResponse>('/orders/profit-by-supplier', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  const payload = response.data;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: Array<SupplierProfit | SupplierProfitRaw> }).data
      : [];
  return list.map(normalizeSupplierProfit);
};

export interface BrandProfit {
  brandId: string;
  brandName: string;
  sales: number;
  profit: number;
  orders?: number;
}

interface BrandProfitRaw {
  brandId?: string;
  brand?: { id?: string; name?: string } | string;
  brandName?: string;
  name?: string;
  totalSales?: number;
  sales?: number;
  total?: number;
  revenue?: number;
  totalProfit?: number;
  profit?: number;
  gain?: number;
  orders?: number;
}

type ProfitByBrandResponse =
  | BrandProfit[]
  | BrandProfitRaw[]
  | { data?: BrandProfit[] | BrandProfitRaw[] };

const normalizeBrandProfit = (raw: BrandProfit | BrandProfitRaw): BrandProfit => {
  const record = raw as BrandProfitRaw;
  const nested = typeof record.brand === 'object' ? record.brand : undefined;
  const sales = Number(record.totalSales ?? record.sales ?? record.total ?? record.revenue ?? 0);
  const profit = Number(record.totalProfit ?? record.profit ?? record.gain ?? 0);
  return {
    brandId: record.brandId ?? nested?.id ?? record.brandName ?? '',
    brandName:
      record.brandName ??
      record.name ??
      nested?.name ??
      (typeof record.brand === 'string' ? record.brand : 'Marca sin nombre'),
    sales: Number.isFinite(sales) ? sales : 0,
    profit: Number.isFinite(profit) ? profit : 0,
    orders: typeof record.orders === 'number' ? record.orders : undefined,
  };
};

export interface ProfitByBrandParams {
  from?: string;
  to?: string;
}

/**
 * Ganancia agregada por marca en un período.
 * GET /orders/profit-by-brand?from&to.
 */
export const getProfitByBrand = async (
  params: ProfitByBrandParams = {},
): Promise<BrandProfit[]> => {
  const response = await api.get<ProfitByBrandResponse>('/orders/profit-by-brand', {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  const payload = response.data;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: Array<BrandProfit | BrandProfitRaw> }).data
      : [];
  return list.map(normalizeBrandProfit);
};

export const confirmOrder = async (id: string, paymentMethod: PaymentMethod): Promise<Order> => {
  const response = await api.patch<Order>(`/orders/${id}/confirm`, { paymentMethod });
  return response.data;
};

/**
 * Cancela una venta ya confirmada. PATCH /orders/:id/cancel.
 * El motivo es opcional y viaja como `cancelReason` en el body.
 */
export const cancelOrder = async (id: string, cancelReason?: string): Promise<Order> => {
  const trimmed = cancelReason?.trim();
  const body = trimmed ? { cancelReason: trimmed } : {};
  const response = await api.patch<Order>(`/orders/${id}/cancel`, body);
  return response.data;
};

export interface Debtor {
  customerName: string;
  customerPhone?: string | null;
  totalDebt: number;
  orders: Order[];
}

type DebtsRawOrder = Partial<Order> & {
  id: string;
  total?: number | null;
};

interface DebtsRawDebtor {
  customerName?: string;
  name?: string;
  customer?: string;
  customerPhone?: string | null;
  phone?: string | null;
  totalDebt?: number;
  total?: number;
  debt?: number;
  orders?: DebtsRawOrder[];
  pendingOrders?: DebtsRawOrder[];
}

type DebtsResponse = Debtor[] | { data?: Debtor[] | DebtsRawDebtor[] } | { debtors?: Debtor[] | DebtsRawDebtor[] } | DebtsRawDebtor[];

const normalizeDebtOrder = (raw: DebtsRawOrder): Order => ({
  id: raw.id,
  status: raw.status ?? 'confirmed',
  customerName: raw.customerName ?? null,
  customerPhone: raw.customerPhone ?? null,
  paymentMethod: (raw.paymentMethod as Order['paymentMethod']) ?? 'fiado',
  total: raw.total ?? null,
  createdAt: raw.createdAt ?? '',
  confirmedAt: raw.confirmedAt ?? null,
  lines: raw.lines ?? [],
});

const normalizeDebtor = (raw: Debtor | DebtsRawDebtor): Debtor => {
  const record = raw as DebtsRawDebtor;
  const orders = (record.orders ?? record.pendingOrders ?? []).map(normalizeDebtOrder);
  const totalDebt = Number(
    record.totalDebt ?? record.total ?? record.debt ??
      orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  );
  return {
    customerName: record.customerName ?? record.name ?? record.customer ?? 'Cliente sin nombre',
    customerPhone: record.customerPhone ?? record.phone ?? null,
    totalDebt: Number.isFinite(totalDebt) ? totalDebt : 0,
    orders,
  };
};

/**
 * Lista de clientes con deuda pendiente por ventas fiadas.
 * GET /orders/debts. Acepta tanto un arreglo directo como un objeto
 * envuelto (`{ data }` / `{ debtors }`) y normaliza cada deudor.
 */
export const getDebts = async (): Promise<Debtor[]> => {
  const response = await api.get<DebtsResponse>('/orders/debts');
  const payload = response.data;
  const list: Array<Debtor | DebtsRawDebtor> = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: Array<Debtor | DebtsRawDebtor> }).data
      : Array.isArray((payload as { debtors?: unknown })?.debtors)
        ? (payload as { debtors: Array<Debtor | DebtsRawDebtor> }).debtors
        : [];
  return list.map(normalizeDebtor);
};

/**
 * Marca una orden fiada como pagada. PATCH /orders/:id/mark-paid.
 */
export const markOrderAsPaid = async (id: string): Promise<Order> => {
  const response = await api.patch<Order>(`/orders/${id}/mark-paid`);
  return response.data;
};

export type ManualOrderCartUnit = 'Bolsa' | 'Kilo' | 'Unidad';

export interface ManualOrderCartItem {
  productId: string;
  quantity: number;
  unit: ManualOrderCartUnit;
}

export interface ManualOrderPayload {
  cart: ManualOrderCartItem[];
  customerName?: string;
  customerPhone?: string;
  paymentMethod: PaymentMethod;
}

/**
 * Crea una venta presencial ya confirmada. El backend valida stock y
 * devuelve la Order creada en estado CONFIRMED.
 */
export const createManualOrder = async (payload: ManualOrderPayload): Promise<Order> => {
  const response = await api.post<Order>('/orders/manual', payload);
  return response.data;
};

export interface CreateWhatsappLinkCartItem {
  productId: string;
  quantity: number;
  unit: 'Bolsa' | 'Kilo';
}

export interface CreateWhatsappLinkPayload {
  cart: CreateWhatsappLinkCartItem[];
  customerName?: string;
  customerPhone?: string;
}

export interface WhatsappLinkResponse {
  orderId: string;
  link: string;
}

/**
 * Llama a POST /orders/whatsapp-link para que el backend valide el carrito,
 * cree la Order en estado PENDING y devuelva el link de WhatsApp.
 */
export const createWhatsappLink = async (
  payload: CreateWhatsappLinkPayload,
): Promise<WhatsappLinkResponse> => {
  const response = await api.post<WhatsappLinkResponse>('/orders/whatsapp-link', payload);
  return response.data;
};
