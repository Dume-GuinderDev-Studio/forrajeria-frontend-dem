import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  HandCoins,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
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
  getOrders,
  confirmOrder,
  cancelOrder,
  exportOrders,
  type Order,
  type OrderStatus,
  type OrdersMeta,
  type PaymentMethod,
} from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';
import {
  PAYMENT_METHOD_OPTIONS,
  getPaymentMethodLabel,
} from '@/lib/paymentMethods';
import { ManualSaleDialog } from '@/ui/components/ManualSaleDialog';
import { cn } from '@/lib/utils';

type StatusFilter = 'ALL' | OrderStatus;

const PAGE_SIZE = 10;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'cancelled', label: 'Canceladas' },
];

/**
 * Confirmar una orden pendiente exige un medio de pago ya cobrado, por eso
 * este diálogo excluye 'fiado'. Las etiquetas/valores salen del catálogo
 * compartido para no duplicarlos.
 */
const PAYMENT_METHODS = PAYMENT_METHOD_OPTIONS.filter((method) => method.value !== 'fiado');

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Cantidad de líneas (productos distintos) de la orden. No se suman los
 * `quantity` porque mezclan unidades (bolsas enteras con kg fraccionarios).
 */
const getLineCount = (order: Order): number => order.lines?.length ?? 0;

const getStatusBadge = (status: OrderStatus) => {
  if (status === 'pending') return <Badge variant="warning">Pendiente</Badge>;
  if (status === 'confirmed') return <Badge variant="success">Confirmada</Badge>;
  return <Badge variant="danger">Cancelada</Badge>;
};

const getPaymentMethodIcon = (paymentMethod?: PaymentMethod | null) => {
  if (paymentMethod === 'efectivo') {
    return <Banknote className="size-4 text-emerald-600" />;
  }
  if (paymentMethod === 'transferencia') {
    return <Landmark className="size-4 text-blue-600" />;
  }
  if (paymentMethod === 'mercado_pago') {
    return <Wallet className="size-4 text-violet-600" />;
  }
  if (paymentMethod === 'fiado') {
    return <HandCoins className="size-4 text-amber-600" />;
  }
  return null;
};

const PaymentMethodCell = ({ paymentMethod }: { paymentMethod?: PaymentMethod | null }) => {
  if (!paymentMethod) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {getPaymentMethodIcon(paymentMethod)}
      <span>{getPaymentMethodLabel(paymentMethod)}</span>
    </div>
  );
};

export const AdminOrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<OrdersMeta>({ page: 1, limit: PAGE_SIZE, total: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [confirming, setConfirming] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Manual (presencial) sale dialog
  const [isManualSaleOpen, setIsManualSaleOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getOrders({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setOrders(result.data);
      setMeta(result.meta);
    } catch {
      setOrders([]);
      setError('No se pudieron cargar las órdenes. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, from, to, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleFromChange = (value: string) => {
    setFrom(value);
    setPage(1);
  };

  const handleToChange = (value: string) => {
    setTo(value);
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilter('ALL');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const handleExportReport = async () => {
    if (exporting) return;

    setExporting(true);

    try {
      const blob = await exportOrders({
        from: from || undefined,
        to: to || undefined,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const today = new Date();
      const dateStamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      link.download = `reporte-ventas-${dateStamp}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('No se pudo exportar el reporte. Intentá nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const openConfirmDialog = (order: Order) => {
    setPaymentMethod('efectivo');
    setSelectedOrder(null);
    setConfirmTarget(order);
  };

  const openCancelDialog = (order: Order) => {
    setCancelReason('');
    setSelectedOrder(null);
    setCancelTarget(order);
  };

  const getBackendErrorMessage = (err: unknown, fallback: string): string => {
    const response = (err as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data;
    const message = response?.message;

    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
    return fallback;
  };

  const handleConfirmOrder = async () => {
    if (!confirmTarget) return;

    setConfirming(true);
    try {
      const updated = await confirmOrder(confirmTarget.id, paymentMethod);
      const mergedOrder: Order = { ...confirmTarget, ...updated };

      setOrders((current) =>
        current.map((order) => (order.id === mergedOrder.id ? mergedOrder : order)),
      );
      setSelectedOrder((current) =>
        current && current.id === mergedOrder.id ? mergedOrder : current,
      );

      toast.success('Venta confirmada correctamente');
      setConfirmTarget(null);
    } catch (err) {
      toast.error(getBackendErrorMessage(err, 'No se pudo confirmar la venta. Intentá nuevamente.'));
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelTarget || cancelling) return;

    setCancelling(true);
    try {
      const updated = await cancelOrder(cancelTarget.id, cancelReason);
      const mergedOrder: Order = { ...cancelTarget, ...updated };

      setOrders((current) =>
        current.map((order) => (order.id === mergedOrder.id ? mergedOrder : order)),
      );
      setSelectedOrder((current) =>
        current && current.id === mergedOrder.id ? mergedOrder : current,
      );

      toast.success('Venta cancelada correctamente');
      setCancelTarget(null);
      setCancelReason('');
    } catch (err) {
      toast.error(getBackendErrorMessage(err, 'No se pudo cancelar la venta. Intentá nuevamente.'));
    } finally {
      setCancelling(false);
    }
  };

  const totalPages = meta.total === 0 ? 1 : Math.ceil(meta.total / meta.limit);

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Gestión de Ventas
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Revisá las órdenes recibidas y confirmá las ventas pendientes.
              </p>
            </div>
          </header>

          {/* Filters */}
          <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="w-full lg:w-56">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Estado
              </label>
              <Select
                value={statusFilter}
                onValueChange={(value) => handleStatusChange(value as StatusFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full lg:w-48">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Desde
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full lg:w-48">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Hasta
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button variant="outline" onClick={handleExportReport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? 'Exportando...' : 'Exportar reporte'}
            </Button>

            <Button onClick={() => setIsManualSaleOpen(true)} className="lg:ml-auto">
              <Plus className="size-4" />
              Nueva venta
            </Button>

            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </section>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando ventas...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadOrders} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Receipt className="w-10 h-10 mb-4" />
              <p>No hay órdenes para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método de pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const isCancelled = order.status === 'cancelled';
                    return (
                    <TableRow
                      key={order.id}
                      className={cn(
                        'cursor-pointer',
                        isCancelled &&
                          'bg-slate-100/70 opacity-80 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800',
                      )}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell className={cn(isCancelled && 'text-slate-400 dark:text-slate-500')}>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            'font-medium text-slate-800 dark:text-slate-200',
                            isCancelled && 'text-slate-400 line-through dark:text-slate-500',
                          )}
                        >
                          {order.customerName || 'Cliente sin nombre'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {order.customerPhone || 'Sin teléfono'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const lines = getLineCount(order);
                          return `${lines} ${lines === 1 ? 'item' : 'items'}`;
                        })()}
                      </TableCell>
                      <TableCell className={cn('font-semibold', isCancelled && 'text-slate-400 line-through dark:text-slate-500')}>{formatARS(order.total)}</TableCell>
                      <TableCell>
                        <PaymentMethodCell paymentMethod={order.paymentMethod} />
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            <Eye className="size-4" />
                            Ver
                          </Button>
                          {order.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openConfirmDialog(order);
                              }}
                            >
                              <CheckCircle2 className="size-4" />
                              Confirmar venta
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {meta.total} {meta.total === 1 ? 'orden' : 'órdenes'}
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Página {meta.page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Order detail dialog */}
      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de la orden</DialogTitle>
            <DialogDescription>
              {selectedOrder?.customerName || 'Cliente sin nombre'} ·{' '}
              {selectedOrder?.customerPhone || 'Sin teléfono'}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Fecha:</span>
                <span className="font-medium">{formatDate(selectedOrder.createdAt)}</span>
                <span className="ml-auto">{getStatusBadge(selectedOrder.status)}</span>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <div className="col-span-6">Producto</div>
                  <div className="col-span-2 text-center">Cant.</div>
                  <div className="col-span-2 text-right">P. unitario</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>
                {selectedOrder.lines?.length ? (
                  selectedOrder.lines.map((line) => (
                    <div
                      key={line.id}
                      className="grid grid-cols-12 gap-2 px-3 py-3 text-sm border-t border-slate-100 dark:border-slate-700/60"
                    >
                      <div className="col-span-6 font-medium text-slate-800 dark:text-slate-200">
                        {line.product?.name ?? 'Producto'}
                      </div>
                      <div className="col-span-2 text-center text-slate-600 dark:text-slate-300">
                        {line.quantity}
                      </div>
                      <div className="col-span-2 text-right text-slate-600 dark:text-slate-300">
                        {formatARS(line.unitPrice)}
                      </div>
                      <div className="col-span-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {formatARS(line.subtotal)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                    Esta orden no tiene líneas.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
                <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatARS(selectedOrder.total)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedOrder && selectedOrder.status === 'confirmed' && (
              <Button variant="destructive" onClick={() => openCancelDialog(selectedOrder)}>
                <XCircle className="size-4" />
                Cancelar venta
              </Button>
            )}
            {selectedOrder && selectedOrder.status === 'pending' && (
              <Button onClick={() => openConfirmDialog(selectedOrder)}>
                <CheckCircle2 className="size-4" />
                Confirmar venta
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm order dialog */}
      <Dialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar venta</DialogTitle>
            <DialogDescription>
              Seleccioná el método de pago para la orden de{' '}
              {confirmTarget?.customerName || 'cliente'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Método de pago
            </label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccioná un método de pago" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={confirming}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmOrder} disabled={confirming}>
              {confirming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel order dialog */}
      <Dialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setCancelTarget(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar venta</DialogTitle>
            <DialogDescription>
              Se cancelará la venta confirmada de {cancelTarget?.customerName || 'cliente'} por{' '}
              {cancelTarget ? formatARS(cancelTarget.total) : ''}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label
              htmlFor="cancel-reason"
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
            >
              Motivo (opcional)
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej. el cliente pidió la devolución..."
              rows={3}
              disabled={cancelling}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason('');
              }}
              disabled={cancelling}
            >
              Volver
            </Button>
            <Button variant="destructive" onClick={handleCancelOrder} disabled={cancelling}>
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              {cancelling ? 'Cancelando...' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualSaleDialog
        open={isManualSaleOpen}
        onOpenChange={setIsManualSaleOpen}
        onConfirmed={loadOrders}
      />
    </div>
  );
};
