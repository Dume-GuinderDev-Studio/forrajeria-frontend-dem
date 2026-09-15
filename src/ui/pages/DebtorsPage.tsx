import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  HandCoins,
  Loader2,
  Receipt,
  RefreshCw,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/ui/components/Pagination';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/ui/dialog';
import {
  getDebts,
  markOrderAsPaid,
  type Debtor,
  type Order,
} from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

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

const getItemCount = (order: Order): number =>
  order.lines?.reduce((sum, line) => sum + (line.quantity || 0), 0) ?? 0;

export const DebtorsPage = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = DEFAULT_ITEMS_PER_PAGE;

  const loadDebts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getDebts();
      setDebtors(data);
    } catch {
      setDebtors([]);
      setError('No se pudieron cargar los deudores. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDebts();
  }, [loadDebts]);

  const toggleExpanded = (customerName: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(customerName)) {
        next.delete(customerName);
      } else {
        next.add(customerName);
      }
      return next;
    });
  };

  const handleMarkAsPaid = async (orderId: string) => {
    if (payingIds.has(orderId)) return;

    setPayingIds((current) => new Set(current).add(orderId));

    try {
      await markOrderAsPaid(orderId);
      toast.success('Orden marcada como pagada');
      setSelectedOrder((current) => (current?.id === orderId ? null : current));
      await loadDebts();
    } catch {
      toast.error('No se pudo marcar la orden como pagada. Intentá nuevamente.');
    } finally {
      setPayingIds((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Paginación client-side sobre la lista completa (igual que marcas:
  // /orders/debts no soporta page/limit en el backend). Sin buscador en
  // esta vista, no hay filtro que resetee la página. El expandido se
  // referencia por nombre de cliente, así que sobrevive al cambio de página.
  const currentDebtors = debtors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const { totalDebt, debtorsCount, pendingOrdersCount } = useMemo(() => {
    const orders = debtors.flatMap((debtor) => debtor.orders ?? []);
    return {
      totalDebt: debtors.reduce((sum, debtor) => sum + (Number(debtor.totalDebt) || 0), 0),
      debtorsCount: debtors.length,
      pendingOrdersCount: orders.length,
    };
  }, [debtors]);

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Deudores
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Clientes con ventas fiadas pendientes de pago.
              </p>
            </div>
            <Button variant="outline" onClick={loadDebts} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </header>

          {/* Summary */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Total adeudado
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {formatARS(totalDebt)}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-amber-100 text-amber-600">
                  <HandCoins size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Deudores
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {debtorsCount}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-blue-100 text-blue-600">
                  <Users size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Órdenes fiadas pendientes
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {pendingOrdersCount}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-slate-100 text-slate-600">
                  <Receipt size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando deudores...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadDebts} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : debtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-10 h-10 mb-4 text-emerald-500" />
              <p>No hay deudas pendientes. Todos los clientes están al día.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Órdenes pendientes</TableHead>
                    <TableHead>Deuda total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDebtors.map((debtor) => {
                    const isExpanded = expanded.has(debtor.customerName);
                    const orders = debtor.orders ?? [];

                    return (
                      <Fragment key={debtor.customerName}>
                        <TableRow>
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {debtor.customerName}
                          </TableCell>
                          <TableCell>{debtor.customerPhone || 'Sin teléfono'}</TableCell>
                          <TableCell>
                            <Badge variant="warning">
                              {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatARS(debtor.totalDebt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpanded(debtor.customerName)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-4" />
                              ) : (
                                <ChevronDown className="size-4" />
                              )}
                              {isExpanded ? 'Ocultar' : 'Ver detalle'}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-slate-50 dark:bg-slate-900/50">
                              {orders.length === 0 ? (
                                <p className="text-sm text-slate-400 py-2">
                                  Este cliente no tiene órdenes fiadas pendientes.
                                </p>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Fecha</TableHead>
                                      <TableHead>Items</TableHead>
                                      <TableHead>Total</TableHead>
                                      <TableHead>Estado</TableHead>
                                      <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orders.map((order) => {
                                      const isPaying = payingIds.has(order.id);
                                      return (
                                        <TableRow key={order.id}>
                                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                                          <TableCell>{getItemCount(order)}</TableCell>
                                          <TableCell className="font-semibold">
                                            {formatARS(order.total)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="warning">Fiada</Badge>
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedOrder(order)}
                                              >
                                                <Eye className="size-4" />
                                                Ver
                                              </Button>
                                              <Button
                                                size="sm"
                                                disabled={isPaying}
                                                onClick={() => handleMarkAsPaid(order.id)}
                                              >
                                                {isPaying ? (
                                                  <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                  <CheckCircle2 className="size-4" />
                                                )}
                                                Marcar como pagado
                                              </Button>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                currentPage={currentPage}
                totalItems={debtors.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="deudores"
              />
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
            <DialogTitle>Detalle de la orden fiada</DialogTitle>
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
                <span className="ml-auto">
                  <Badge variant="warning">Fiada</Badge>
                </span>
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
            {selectedOrder && (
              <Button
                onClick={() => handleMarkAsPaid(selectedOrder.id)}
                disabled={payingIds.has(selectedOrder.id)}
              >
                {payingIds.has(selectedOrder.id) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Marcar como pagado
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
