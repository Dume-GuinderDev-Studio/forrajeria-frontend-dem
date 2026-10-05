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
import { getDebts, markOrderAsPaid, type Debtor, type Order } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';
import styles from './DebtorsPage.module.css';

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
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Deudores</h1>
              <p className={styles.subtitle}>Clientes con ventas fiadas pendientes de pago.</p>
            </div>
            <Button variant="outline" onClick={loadDebts} disabled={loading}>
              <RefreshCw className={styles.btnIcon} data-spin={loading} />
              Actualizar
            </Button>
          </header>

          {/* Summary */}
          <section className={styles.summary}>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Total adeudado</p>
                  <p className={styles.statValue}>{formatARS(totalDebt)}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconAmber].filter(Boolean).join(' ')}>
                  <HandCoins size={22} />
                </div>
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Deudores</p>
                  <p className={styles.statValue}>{debtorsCount}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconBlue].filter(Boolean).join(' ')}>
                  <Users size={22} />
                </div>
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Órdenes fiadas pendientes</p>
                  <p className={styles.statValue}>{pendingOrdersCount}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconSlate].filter(Boolean).join(' ')}>
                  <Receipt size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Content */}
          {loading ? (
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando deudores...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadDebts} className={styles.retryBtn}>
                <RefreshCw className={styles.btnIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : debtors.length === 0 ? (
            <div className={styles.stateBox}>
              <CheckCircle2 className={[styles.stateIcon, styles.stateIconGreen].filter(Boolean).join(' ')} />
              <p>No hay deudas pendientes. Todos los clientes están al día.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <>
              {/* Mobile: una card por deudor. La tabla de desktop queda debajo. */}
              <ul className={styles.cardList}>
                {currentDebtors.map((debtor) => {
                  const isExpanded = expanded.has(debtor.customerName);
                  const orders = debtor.orders ?? [];
              
                  return (
                    <li key={debtor.customerName} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div className={styles.cardName} title={debtor.customerName}>
                          {debtor.customerName}
                        </div>
                        <div className={styles.cardActions}>
                          <DebtorRowActions
                            isExpanded={isExpanded}
                            onToggle={() => toggleExpanded(debtor.customerName)}
                          />
                        </div>
                      </div>

                      <div className={styles.cardMeta}>
                        <span>{debtor.customerPhone || 'Sin teléfono'}</span>
                        <Badge variant="warning">
                          {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
                        </Badge>
                        <span className={styles.cardDebt}>{formatARS(debtor.totalDebt)}</span>
                      </div>

                      {isExpanded && (
                        orders.length === 0 ? (
                          <p className={styles.nestedEmpty}>
                            Este cliente no tiene órdenes fiadas pendientes.
                          </p>
                        ) : (
                          <ul className={styles.cardOrderList}>
                            {orders.map((order) => {
                              const isPaying = payingIds.has(order.id);
                              return (
                                <li key={order.id} className={styles.cardOrder}>
                                  <span>{formatDate(order.createdAt)}</span>
                                  <span>{getItemCount(order)}</span>
                                  <span className={styles.cardOrderTotal}>{formatARS(order.total)}</span>
                                  <Badge variant="warning">Fiada</Badge>
                                  <div className={styles.rowActions}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedOrder(order)}
                                    >
                                      <Eye className={styles.btnIcon} />
                                      Ver
                                    </Button>
                                    <Button
                                      size="sm"
                                      disabled={isPaying}
                                      onClick={() => handleMarkAsPaid(order.id)}
                                    >
                                      {isPaying ? (
                                        <Loader2 className={styles.btnIcon} data-spin={true} />
                                      ) : (
                                        <CheckCircle2 className={styles.btnIcon} />
                                      )}
                                      Marcar como pagado
                                    </Button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className={styles.tableDesktop}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Órdenes pendientes</TableHead>
                    <TableHead>Deuda total</TableHead>
                    <TableHead className={styles.cellRight}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentDebtors.map((debtor) => {
                    const isExpanded = expanded.has(debtor.customerName);
                    const orders = debtor.orders ?? [];

                    return (
                      <Fragment key={debtor.customerName}>
                        <TableRow>
                            <TableCell className={styles.cellName}>
                              <div className={styles.cellNameText} title={debtor.customerName}>
                                {debtor.customerName}
                              </div>
                            </TableCell>
                          <TableCell>{debtor.customerPhone || 'Sin teléfono'}</TableCell>
                          <TableCell>
                            <Badge variant="warning">
                              {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
                            </Badge>
                          </TableCell>
                          <TableCell className={styles.cellBold}>
                            {formatARS(debtor.totalDebt)}
                          </TableCell>
                          <TableCell className={styles.cellRight}>
                            <DebtorRowActions
                              isExpanded={isExpanded}
                              onToggle={() => toggleExpanded(debtor.customerName)}
                            />
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className={styles.nestedCell}>
                              {orders.length === 0 ? (
                                <p className={styles.nestedEmpty}>
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
                                      <TableHead className={styles.cellRight}>Acciones</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {orders.map((order) => {
                                      const isPaying = payingIds.has(order.id);
                                      return (
                                        <TableRow key={order.id}>
                                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                                          <TableCell>{getItemCount(order)}</TableCell>
                                          <TableCell className={styles.cellBold}>
                                            {formatARS(order.total)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="warning">Fiada</Badge>
                                          </TableCell>
                                          <TableCell className={styles.cellRight}>
                                            <div className={styles.rowActions}>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSelectedOrder(order)}
                                              >
                                                <Eye className={styles.btnIcon} />
                                                Ver
                                              </Button>
                                              <Button
                                                size="sm"
                                                disabled={isPaying}
                                                onClick={() => handleMarkAsPaid(order.id)}
                                              >
                                                {isPaying ? (
                                                  <Loader2 className={styles.btnIcon} data-spin={true} />
                                                ) : (
                                                  <CheckCircle2 className={styles.btnIcon} />
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
              </div>
              </>
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
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Detalle de la orden fiada</DialogTitle>
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
                <span className={styles.detailPush}>
                  <Badge variant="warning">Fiada</Badge>
                </span>
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
            {selectedOrder && (
              <Button
                onClick={() => handleMarkAsPaid(selectedOrder.id)}
                disabled={payingIds.has(selectedOrder.id)}
              >
                {payingIds.has(selectedOrder.id) ? (
                  <Loader2 className={styles.btnIcon} data-spin={true} />
                ) : (
                  <CheckCircle2 className={styles.btnIcon} />
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

interface DebtorRowActionsProps {
  isExpanded: boolean;
  onToggle: () => void;
}

/** Expandir / ocultar el detalle. Compartido por la tabla y la card de mobile. */
const DebtorRowActions = ({ isExpanded, onToggle }: DebtorRowActionsProps) => (
  <Button variant="outline" size="sm" onClick={onToggle}>
    {isExpanded ? <ChevronUp className={styles.btnIcon} /> : <ChevronDown className={styles.btnIcon} />}
    {isExpanded ? 'Ocultar' : 'Ver detalle'}
  </Button>
);