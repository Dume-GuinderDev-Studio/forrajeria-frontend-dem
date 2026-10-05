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
import styles from './AdminOrdersPage.module.css';

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
    return <Banknote className={styles.payIcon} data-method="efectivo" />;
  }
  if (paymentMethod === 'transferencia') {
    return <Landmark className={styles.payIcon} data-method="transferencia" />;
  }
  if (paymentMethod === 'mercado_pago') {
    return <Wallet className={styles.payIcon} data-method="mercado_pago" />;
  }
  if (paymentMethod === 'fiado') {
    return <HandCoins className={styles.payIcon} data-method="fiado" />;
  }
  return null;
};

const PaymentMethodCell = ({ paymentMethod }: { paymentMethod?: PaymentMethod | null }) => {
  if (!paymentMethod) {
    return <span className={styles.muted}>—</span>;
  }

  return (
    <div className={styles.payCell}>
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
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Gestión de Ventas</h1>
              <p className={styles.subtitle}>
                Revisá las órdenes recibidas y confirmá las ventas pendientes.
              </p>
            </div>
          </header>

          {/* Filters */}
          <section className={styles.filters}>
            <div className={[styles.filterField, styles.filterFieldStatus].filter(Boolean).join(' ')}>
              <label className={styles.filterLabel}>Estado</label>
              <Select
                value={statusFilter}
                onValueChange={(value) => handleStatusChange(value as StatusFilter)}
              >
                <SelectTrigger className={styles.trigger}>
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

            <div className={[styles.filterField, styles.filterFieldDate].filter(Boolean).join(' ')}>
              <label className={styles.filterLabel}>Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className={styles.dateInput}
              />
            </div>

            <div className={[styles.filterField, styles.filterFieldDate].filter(Boolean).join(' ')}>
              <label className={styles.filterLabel}>Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className={styles.dateInput}
              />
            </div>

            <Button variant="outline" onClick={handleExportReport} disabled={exporting}>
              {exporting ? (
                <Loader2 className={styles.btnIcon} data-spin={true} />
              ) : (
                <Download className={styles.btnIcon} />
              )}
              {exporting ? 'Exportando...' : 'Exportar reporte'}
            </Button>

            <Button onClick={() => setIsManualSaleOpen(true)} className={styles.newSaleBtn}>
              <Plus className={styles.btnIcon} />
              Nueva venta
            </Button>

            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </section>

          {/* Content */}
          {loading ? (
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando ventas...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadOrders} className={styles.retryBtn}>
                <RefreshCw className={styles.btnIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className={styles.stateBox}>
              <Receipt className={styles.stateIcon} />
              <p>No hay órdenes para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              {/* Mobile: cards. La tabla de desktop se oculta con el media query. */}
              <ul className={styles.cardList}>
                {orders.map((order) => {
                  const isCancelled = order.status === 'cancelled';
                  return (
                    <li
                      key={order.id}
                      className={styles.card}
                      data-cancelled={isCancelled}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedOrder(order)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedOrder(order);
                        }
                      }}
                    >
                      <div className={styles.cardTop}>
                        <div className={styles.cardInfo}>
                          <div className={styles.dateCell} data-cancelled={isCancelled}>
                            {formatDate(order.createdAt)}
                          </div>
                          <div className={styles.customerName} data-cancelled={isCancelled}>
                            {order.customerName || 'Cliente sin nombre'}
                          </div>
                          <div className={styles.customerPhone}>
                            {order.customerPhone || 'Sin teléfono'}
                          </div>
                        </div>
                        {getStatusBadge(order.status)}
                      </div>

                      <div className={styles.cardMeta}>
                        <span>
                          {(() => {
                            const lines = getLineCount(order);
                            return `${lines} ${lines === 1 ? 'item' : 'items'}`;
                          })()}
                        </span>
                        <PaymentMethodCell paymentMethod={order.paymentMethod} />
                        <span className={styles.total} data-cancelled={isCancelled}>
                          {formatARS(order.total)}
                        </span>
                      </div>

                      <div className={styles.cardBottom}>
                        <div className={styles.cardBottomGroup}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            <Eye className={styles.btnIcon} />
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
                              <CheckCircle2 className={styles.btnIcon} />
                              Confirmar venta
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className={styles.tableDesktop}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método de pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className={styles.cellRight}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const isCancelled = order.status === 'cancelled';
                    return (
                    <TableRow
                      key={order.id}
                      className={styles.orderRow}
                      data-cancelled={isCancelled}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <TableCell data-cancelled={isCancelled} className={styles.dateCell}>{formatDate(order.createdAt)}</TableCell>
                      <TableCell
                        className={styles.customerCell}
                        data-cancelled={isCancelled}
                        title={order.customerName || undefined}
                      >
                        <div
                          className={[styles.customerName, styles.customerNameTrunc]
                            .filter(Boolean)
                            .join(' ')}
                          data-cancelled={isCancelled}
                        >
                          {order.customerName || 'Cliente sin nombre'}
                        </div>
                        <div className={styles.customerPhone}>
                          {order.customerPhone || 'Sin teléfono'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const lines = getLineCount(order);
                          return `${lines} ${lines === 1 ? 'item' : 'items'}`;
                        })()}
                      </TableCell>
                      <TableCell className={styles.total} data-cancelled={isCancelled}>{formatARS(order.total)}</TableCell>
                      <TableCell>
                        <PaymentMethodCell paymentMethod={order.paymentMethod} />
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className={styles.cellRight}>
                        <div className={styles.rowActions}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                          >
                            <Eye className={styles.btnIcon} />
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
                              <CheckCircle2 className={styles.btnIcon} />
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
            </div>

              {/* Pagination */}
              <div className={styles.pager}>
                <p className={styles.pagerCount}>
                  {meta.total} {meta.total === 1 ? 'orden' : 'órdenes'}
                </p>
                <div className={styles.pagerNav}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft className={styles.btnIcon} />
                    Anterior
                  </Button>
                  <span className={styles.pagerPage}>
                    Página {meta.page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Siguiente
                    <ChevronRight className={styles.btnIcon} />
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
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Detalle de la orden</DialogTitle>
            <DialogDescription>
              {selectedOrder?.customerName || 'Cliente sin nombre'} ·{' '}
              {selectedOrder?.customerPhone || 'Sin teléfono'}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className={styles.dialogBody}>
              <div className={styles.detailMeta}>
                <span className={styles.detailLabel}>Fecha:</span>
                <span className={styles.detailValue}>{formatDate(selectedOrder.createdAt)}</span>
                <span className={styles.detailPush}>{getStatusBadge(selectedOrder.status)}</span>
              </div>

              <div className={styles.linesBox}>
                <div className={styles.linesHead}>
                  <div className={styles.col6}>Producto</div>
                  <div className={styles.colCenter}>Cant.</div>
                  <div className={styles.colRight}>P. unitario</div>
                  <div className={styles.colRight}>Subtotal</div>
                </div>
                {selectedOrder.lines?.length ? (
                  selectedOrder.lines.map((line) => (
                    <div key={line.id} className={styles.lineRow}>
                      <div className={styles.lineName}>
                        {line.product?.name ?? 'Producto'}
                      </div>
                      <div className={styles.lineQty}>{line.quantity}</div>
                      <div className={styles.lineMoney}>{formatARS(line.unitPrice)}</div>
                      <div className={styles.lineTotal}>{formatARS(line.subtotal)}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.linesEmpty}>Esta orden no tiene líneas.</div>
                )}
              </div>

              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total</span>
                <span className={styles.totalValue}>{formatARS(selectedOrder.total)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedOrder && selectedOrder.status === 'confirmed' && (
              <Button variant="destructive" onClick={() => openCancelDialog(selectedOrder)}>
                <XCircle className={styles.btnIcon} />
                Cancelar venta
              </Button>
            )}
            {selectedOrder && selectedOrder.status === 'pending' && (
              <Button onClick={() => openConfirmDialog(selectedOrder)}>
                <CheckCircle2 className={styles.btnIcon} />
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
        <DialogContent className={styles.dialogContentSmall}>
          <DialogHeader>
            <DialogTitle>Confirmar venta</DialogTitle>
            <DialogDescription>
              Seleccioná el método de pago para la orden de{' '}
              {confirmTarget?.customerName || 'cliente'}.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogField}>
            <label className={styles.filterLabel}>Método de pago</label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            >
              <SelectTrigger className={styles.trigger}>
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
                <Loader2 className={styles.btnIcon} data-spin={true} />
              ) : (
                <CheckCircle2 className={styles.btnIcon} />
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
        <DialogContent className={styles.dialogContentSmall}>
          <DialogHeader>
            <DialogTitle>Cancelar venta</DialogTitle>
            <DialogDescription>
              Se cancelará la venta confirmada de {cancelTarget?.customerName || 'cliente'} por{' '}
              {cancelTarget ? formatARS(cancelTarget.total) : ''}. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogField}>
            <label htmlFor="cancel-reason" className={styles.filterLabel}>
              Motivo (opcional)
            </label>
            <textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej. el cliente pidió la devolución..."
              rows={3}
              disabled={cancelling}
              className={styles.cancelArea}
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
                <Loader2 className={styles.btnIcon} data-spin={true} />
              ) : (
                <XCircle className={styles.btnIcon} />
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
