import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';
import {
  addSupplierPayment,
  cancelSupplierDebt,
  deleteSupplierDebt,
  getSupplierDebt,
  getSupplierDebts,
  getSupplierDebtsSummary,
  getSupplierDebtsErrorMessage,
  type SupplierDebt,
  type SupplierDebtDetail,
  type SupplierDebtsSummary,
  type SupplierPaymentMethod,
} from '@/infrastructure/supplier-debts.service';
import {
  SupplierDebtDialog,
  EMPTY_DEBT_INITIALS,
  type SupplierDebtInitials,
} from '@/ui/components/SupplierDebtDialog';
import { getSuppliers, type Supplier } from '@/infrastructure/suppliers.service';
import { formatARS } from '@/lib/format';
import { getPaymentMethodLabel } from '@/lib/paymentMethods';
import styles from './SupplierDebtsPage.module.css';

const SUPPLIER_PAYMENT_OPTIONS: Array<{ value: SupplierPaymentMethod; label: string }> = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
];

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

const formatDateOnly = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface PaymentFormState {
  amount: string;
  paymentMethod: SupplierPaymentMethod | '';
  paidAt: string;
  notes: string;
}

const EMPTY_PAYMENT_FORM: PaymentFormState = {
  amount: '',
  paymentMethod: '',
  paidAt: '',
  notes: '',
};

export const SupplierDebtsPage = () => {
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [summary, setSummary] = useState<SupplierDebtsSummary | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, SupplierDebtDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Set<string>>(new Set());

  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [debtInitials, setDebtInitials] = useState<SupplierDebtInitials>(EMPTY_DEBT_INITIALS);

  const [payTarget, setPayTarget] = useState<SupplierDebt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierDebt | null>(null);
  const [deleting, setDeleting] = useState(false);
  // true cuando el modal de borrado muestra el flujo de anulación: porque la
  // deuda ya tenía pagos (paidAmount > 0) o porque DELETE devolvió 409.
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = DEFAULT_ITEMS_PER_PAGE;
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM);
  const [paymentFormError, setPaymentFormError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [debtsData, summaryData, suppliersData] = await Promise.all([
        getSupplierDebts(),
        getSupplierDebtsSummary(),
        getSuppliers(),
      ]);
      setDebts(debtsData);
      setSummary(summaryData);
      setSuppliers(suppliersData.filter((supplier) => supplier.isActive !== false));
    } catch {
      setDebts([]);
      setSummary(null);
      setError('No se pudieron cargar las deudas a proveedores. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpanded = async (debt: SupplierDebt) => {
    const isExpanded = expanded.has(debt.id);

    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(debt.id)) {
        next.delete(debt.id);
      } else {
        next.add(debt.id);
      }
      return next;
    });

    if (!isExpanded && !details[debt.id] && !detailLoading.has(debt.id)) {
      setDetailLoading((current) => new Set(current).add(debt.id));
      try {
        const detail = await getSupplierDebt(debt.id);
        setDetails((current) => ({ ...current, [debt.id]: detail }));
      } catch {
        toast.error('No se pudo cargar el historial de pagos. Intentá nuevamente.');
        setExpanded((current) => {
          const next = new Set(current);
          next.delete(debt.id);
          return next;
        });
      } finally {
        setDetailLoading((current) => {
          const next = new Set(current);
          next.delete(debt.id);
          return next;
        });
      }
    }
  };

  const refreshDetail = async (debtId: string) => {
    try {
      const detail = await getSupplierDebt(debtId);
      setDetails((current) => ({ ...current, [debtId]: detail }));
    } catch {
      // El listado ya se refrescó; el detalle se recargará al re-expandir.
    }
  };

  const openCreateDebt = () => {
    setDebtInitials(EMPTY_DEBT_INITIALS);
    setIsDebtDialogOpen(true);
  };

  const openPayment = (debt: SupplierDebt) => {
    setPayTarget(debt);
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      amount: debt.pendingAmount > 0 ? String(debt.pendingAmount) : '',
    });
    setPaymentFormError('');
  };

  const handleSavePayment = async () => {
    if (!payTarget || savingPayment) return;

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentFormError('El monto debe ser mayor a 0.');
      return;
    }
    if (!paymentForm.paymentMethod) {
      setPaymentFormError('Seleccioná un método de pago.');
      return;
    }

    setSavingPayment(true);
    setPaymentFormError('');

    try {
      await addSupplierPayment(payTarget.id, {
        amount,
        paymentMethod: paymentForm.paymentMethod,
        paidAt: paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : undefined,
        notes: paymentForm.notes.trim() || undefined,
      });
      toast.success('Pago registrado correctamente');
      const paidDebtId = payTarget.id;
      setPayTarget(null);
      await loadData();
      await refreshDetail(paidDebtId);
    } catch (err) {
      // No se cierra el modal: se muestra el mensaje del backend (ej. supera el saldo).
      setPaymentFormError(
        getSupplierDebtsErrorMessage(err, 'No se pudo registrar el pago. Intentá nuevamente.'),
      );
    } finally {
      setSavingPayment(false);
    }
  };

  // Limpia el detalle expandido de una deuda que se eliminó/anuló y
  // refresca lista + totales (mismo patrón que tras registrar un pago).
  const afterDebtRemoved = async (debtId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.delete(debtId);
      return next;
    });
    setDetails((current) => {
      const next = { ...current };
      delete next[debtId];
      return next;
    });
    await loadData();
  };


  // Abre el modal de borrado/anulación en su estado inicial. Se extrajo para
  // que la tabla de desktop y la card de mobile compartan el mismo handler.
  const requestDelete = (debt: SupplierDebt) => {
    setDeleteTarget(debt);
    setConfirmingCancel(false);
  };

  const isConflictError = (err: unknown): boolean =>
    (err as { response?: { status?: number } })?.response?.status === 409;

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;

    setDeleting(true);
    try {
      if (!confirmingCancel && target.paidAmount === 0) {
        try {
          await deleteSupplierDebt(target.id);
        } catch (err) {
          if (isConflictError(err)) {
            // El frontend tenía paidAmount desactualizado: la deuda ya tiene
            // pagos. Reabrir el modal en modo anulación en vez de error genérico.
            // (El ConfirmModal auto-cierra al confirmar; por eso se reabre acá.)
            setConfirmingCancel(true);
            setDeleteTarget(target);
            return;
          }
          throw err;
        }
        toast.success('Deuda eliminada correctamente');
      } else {
        await cancelSupplierDebt(target.id);
        toast.success('Deuda anulada correctamente');
      }
      setDeleteTarget(null);
      setConfirmingCancel(false);
      await afterDebtRemoved(target.id);
    } catch {
      toast.error('No se pudo completar la acción. Intentá nuevamente.');
    } finally {
      setDeleting(false);
    }
  };

  // Paginación client-side sobre la lista completa (igual que marcas:
  // /supplier-debts no soporta page/limit en el backend). Sin buscador en
  // esta vista, no hay filtro que resetee la página. El expandido se
  // referencia por id, así que sobrevive al cambio de página.
  const currentDebts = debts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const { totalPending, suppliersWithDebt, pendingDebtsCount } = useMemo(() => {
    const pending = summary?.totalPending ?? debts.reduce((sum, debt) => sum + debt.pendingAmount, 0);
    return {
      totalPending: pending,
      suppliersWithDebt: summary?.bySupplier.length ?? 0,
      pendingDebtsCount: debts.filter((debt) => debt.pendingAmount > 0).length,
    };
  }, [debts, summary]);

  return (
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>A pagar</h1>
              <p className={styles.subtitle}>Deudas con proveedores y pagos parciales.</p>
            </div>
            <div className={styles.headerActions}>
              <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={styles.btnIcon} data-spin={loading} />
                Actualizar
              </Button>
              <Button onClick={openCreateDebt}>
                <Plus className={styles.btnIcon} />
                Nueva deuda
              </Button>
            </div>
          </header>

          {/* Summary */}
          <section className={styles.summary}>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Total adeudado</p>
                  <p className={styles.statValue}>{formatARS(totalPending)}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconAmber].filter(Boolean).join(' ')}>
                  <HandCoins size={22} />
                </div>
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Proveedores con deuda</p>
                  <p className={styles.statValue}>{suppliersWithDebt}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconBlue].filter(Boolean).join(' ')}>
                  <Truck size={22} />
                </div>
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div>
                  <p className={styles.statLabel}>Deudas pendientes</p>
                  <p className={styles.statValue}>{formatARS(pendingDebtsCount)}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconSlate].filter(Boolean).join(' ')}>
                  <Receipt size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown by supplier */}
          {!loading && !error && summary && summary.bySupplier.length > 0 && (
            <section className={styles.groupBox}>

              <div className={styles.groupTitle}>
                <h2 className={styles.statLabel}>Agrupado por proveedor</h2>
              </div>
              
              <ul className={styles.groupCardList}>
                {summary.bySupplier.map((entry) => (
                  <li key={entry.supplierId} className={styles.groupCard}>
                    <div className={styles.groupCardTop}>
                      <div className={styles.groupCardName} title={entry.supplierName}>
                        {entry.supplierName}
                      </div>
                      <Badge variant="warning">
                        {entry.debtsCount} {entry.debtsCount === 1 ? 'deuda' : 'deudas'}
                      </Badge>
                    </div>
                    <div className={styles.groupCardTotals}>
                      <span className={styles.groupCardLabel}>Pagado</span>
                      <span className={styles.groupCardValue}>{formatARS(entry.paidAmount)}</span>
                      <span className={styles.groupCardLabel}>Saldo pendiente</span>
                      <span className={[styles.groupCardValue, styles.cellBold].filter(Boolean).join(' ')}>
                        {formatARS(entry.pendingAmount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              
              <div className={styles.groupTableDesktop}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Deudas</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Saldo pendiente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.bySupplier.map((entry) => (
                      <TableRow key={entry.supplierId}>
                        <TableCell className={styles.cellName}>
                          <div className={styles.cellNameText} title={entry.supplierName}>
                            {entry.supplierName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="warning">
                            {entry.debtsCount} {entry.debtsCount === 1 ? 'deuda' : 'deudas'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatARS(entry.paidAmount)}</TableCell>
                        <TableCell className={styles.cellBold}>{formatARS(entry.pendingAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Content */}
          {loading ? (
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando deudas a proveedores...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadData} className={styles.retryBtn}>
                <RefreshCw className={styles.btnIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : debts.length === 0 ? (
            <div className={styles.stateBox}>
              <CheckCircle2 className={[styles.stateIcon, styles.stateIconGreen].filter(Boolean).join(' ')} />
              <p>No hay deudas con proveedores. Todo al día.</p>
              <Button onClick={openCreateDebt} className={styles.ctaBtn}>
                <Plus className={styles.btnIcon} />
                Nueva deuda
              </Button>
            </div>
          ) : (

            <div className={styles.tableWrap}>
              <ul className={styles.debtCardList}>
                {currentDebts.map((debt) => {
                  const isExpanded = expanded.has(debt.id);
                  const isPending = debt.pendingAmount > 0;
                  const detail = details[debt.id];
                  const isDetailLoading = detailLoading.has(debt.id);
            
                  return (
                    <li key={debt.id} className={styles.debtCard}>
                      <div className={styles.debtCardTop}>
                        <div className={styles.debtCardName} title={debt.supplierName}>
                          {debt.supplierName}
                        </div>
                        <div className={styles.debtCardActions}>
                          <DebtRowActions
                            debt={debt}
                            isExpanded={isExpanded}
                            isPending={isPending}
                            onToggleExpanded={toggleExpanded}
                            onOpenPayment={openPayment}
                            onDelete={requestDelete}
                          />
                        </div>
                      </div>
            
                      <div className={styles.debtCardMeta}>
                        <span className={styles.debtCardDesc} title={debt.description}>
                          {debt.description}
                        </span>
                        <span className={styles.debtCardField}>
                          <span className={styles.debtCardLabel}>Total</span>
                          {formatARS(debt.totalAmount)}
                        </span>
                        <span className={styles.debtCardField}>
                          <span className={styles.debtCardLabel}>Pagado</span>
                          {formatARS(debt.paidAmount)}
                        </span>
                        <span className={styles.debtCardField}>
                          <span className={styles.debtCardLabel}>Fecha</span>
                          {formatDate(debt.createdAt)}
                        </span>
                        <span className={styles.debtCardField}>
                          <span className={styles.debtCardLabel}>Saldo pendiente</span>
                          <span className={styles.pendingInline}>
                            <span className={styles.cellBold}>{formatARS(debt.pendingAmount)}</span>
                            <Badge variant={isPending ? 'warning' : 'success'}>
                              {isPending ? 'Pendiente' : 'Pagada'}
                            </Badge>
                          </span>
                        </span>
                      </div>
            
                      {isExpanded && (
                        <div className={styles.debtCardDetail}>
                          {isDetailLoading ? (
                            <div className={styles.nestedLoading}>
                              <Loader2 className={styles.btnIcon} data-spin={true} />
                              Cargando historial de pagos...
                            </div>
                          ) : !detail || detail.payments.length === 0 ? (
                            <p className={styles.nestedEmpty}>
                              Todavía no se registraron pagos para esta deuda.
                            </p>
                          ) : (
                            <ul className={styles.debtCardPayments}>
                              {detail.payments.map((payment) => (
                                <li key={payment.id} className={styles.debtCardPayment}>
                                  <span className={styles.debtCardPaymentDate}>
                                    {formatDate(payment.paidAt)}
                                  </span>
                                  <span className={styles.cellBold}>
                                    {formatARS(payment.amount)}
                                  </span>
                                  <Badge variant="secondary">
                                    {getPaymentMethodLabel(
                                      payment.paymentMethod as
                                        | 'efectivo'
                                        | 'transferencia'
                                        | 'mercado_pago'
                                        | 'fiado',
                                    )}
                                  </Badge>
                                  <span
                                    className={styles.debtCardPaymentNotes}
                                    title={payment.notes ?? undefined}
                                  >
                                    {payment.notes || '—'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            
              <div className={styles.debtTableDesktop}>
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Saldo pendiente</TableHead>
                          <TableHead className={styles.cellRight}>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                            <TableBody>
                    {currentDebts.map((debt) => {
                      const isExpanded = expanded.has(debt.id);
                      const isPending = debt.pendingAmount > 0;
                      const detail = details[debt.id];
                      const isDetailLoading = detailLoading.has(debt.id);

                      return (
                        <Fragment key={debt.id}>
                          <TableRow>
                            <TableCell className={styles.cellName}>
                              <div className={styles.cellNameText} title={debt.supplierName}>
                                {debt.supplierName}
                              </div>
                            </TableCell>
                            <TableCell className={styles.cellDesc}>
                              <div className={styles.cellDescText} title={debt.description}>
                                {debt.description}
                              </div>
                              {/* Linea secundaria: los montos y la fecha bajan desde la fila principal
                                  para que la tabla entre completa sin scroll en pantallas de 1024px. */}
                              <div className={styles.rowMeta}>
                                <span>
                                  <span className={styles.rowMetaLabel}>Total</span>
                                  {formatARS(debt.totalAmount)}
                                </span>
                                <span>
                                  <span className={styles.rowMetaLabel}>Pagado</span>
                                  {formatARS(debt.paidAmount)}
                                </span>
                                <span>
                                  <span className={styles.rowMetaLabel}>Fecha</span>
                                  {formatDate(debt.createdAt)}
                                </span>
                              </div>
                            </TableCell>
                      <TableCell className={styles.cellBold}>
                        <div className={styles.pendingInline}>
                          <span>{formatARS(debt.pendingAmount)}</span>
                          <Badge variant={isPending ? 'warning' : 'success'}>
                            {isPending ? 'Pendiente' : 'Pagada'}
                          </Badge>
                        </div>
                      </TableCell>

                            <TableCell className={styles.cellRight}>
                              <DebtRowActions
                                debt={debt}
                                isExpanded={isExpanded}
                                isPending={isPending}
                                onToggleExpanded={toggleExpanded}
                                onOpenPayment={openPayment}
                                onDelete={requestDelete}
                              />
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={7} className={styles.nestedCell}>
                                {isDetailLoading ? (
                                  <div className={styles.nestedLoading}>
                                    <Loader2 className={styles.btnIcon} data-spin={true} />
                                    Cargando historial de pagos...
                                  </div>
                                ) : !detail || detail.payments.length === 0 ? (
                                  <p className={styles.nestedEmpty}>
                                    Todavía no se registraron pagos para esta deuda.
                                  </p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Monto</TableHead>
                                        <TableHead>Método</TableHead>
                                        <TableHead>Notas</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {detail.payments.map((payment) => (
                                        <TableRow key={payment.id}>
                                          <TableCell>{formatDate(payment.paidAt)}</TableCell>
                                          <TableCell className={styles.cellBold}>
                                            {formatARS(payment.amount)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="secondary">
                                              {getPaymentMethodLabel(
                                                payment.paymentMethod as 'efectivo' | 'transferencia' | 'mercado_pago' | 'fiado',
                                              )}
                                            </Badge>
                                          </TableCell>
                                          <TableCell
                                            className={styles.cellDesc}
                                            title={payment.notes ?? undefined}
                                          >
                                            {payment.notes || '—'}
                                          </TableCell>
                                        </TableRow>
                                      ))}
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
              <Pagination
                currentPage={currentPage}
                totalItems={debts.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
                itemLabel="deudas"
              />
            </div>
          )}
        </div>
      </main>

      {/* New debt dialog (componente compartido, también usado desde Rendición por proveedor) */}
      <SupplierDebtDialog
        open={isDebtDialogOpen}
        onOpenChange={setIsDebtDialogOpen}
        suppliers={suppliers}
        initials={debtInitials}
        onCreated={loadData}
      />

      {/* Register payment dialog */}
      <Dialog
        open={Boolean(payTarget)}
        onOpenChange={(open) => {
          if (!open && !savingPayment) setPayTarget(null);
        }}
      >
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {payTarget?.supplierName} · {payTarget?.description} · Saldo pendiente:{' '}
              {formatARS(payTarget?.pendingAmount)}
            </DialogDescription>
          </DialogHeader>

          <div className={styles.dialogForm}>
            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Monto *</label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => {
                  setPaymentForm((current) => ({ ...current, amount: e.target.value }));
                  if (paymentFormError) setPaymentFormError('');
                }}
                placeholder="Ej: 20000"
                className={styles.dialogInput}
              />
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Método de pago *</label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(value) => {
                  setPaymentForm((current) => ({
                    ...current,
                    paymentMethod: value as SupplierPaymentMethod,
                  }));
                  if (paymentFormError) setPaymentFormError('');
                }}
              >
                <SelectTrigger className={styles.trigger}>
                  <SelectValue placeholder="Seleccioná un método de pago" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_PAYMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Fecha (opcional)</label>
              <input
                type="date"
                value={paymentForm.paidAt}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPaymentForm((current) => ({ ...current, paidAt: e.target.value }))}
                className={styles.dialogInput}
              />
              {!paymentForm.paidAt && (
                <p className={styles.dialogHint}>
                  Si no elegís fecha se usa la actual ({formatDateOnly(new Date().toISOString())}).
                </p>
              )}
            </div>

            <div className={styles.dialogField}>
              <label className={styles.dialogLabel}>Notas (opcional)</label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Ej: Pago parcial en efectivo"
                rows={2}
                className={styles.dialogArea}
              />
            </div>

            {paymentFormError && <div className={styles.dialogError}>{paymentFormError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)} disabled={savingPayment}>
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={savingPayment}>
              {savingPayment && <Loader2 className={styles.btnIcon} data-spin={true} />}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / cancel confirmation. Si la deuda ya tiene pagos no se puede
          eliminar: se ofrece anularla (queda cancelada y no suma al total). */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={
          confirmingCancel || (deleteTarget?.paidAmount ?? 0) > 0
            ? 'Anular deuda'
            : 'Eliminar deuda'
        }
        description={
          confirmingCancel || (deleteTarget?.paidAmount ?? 0) > 0
            ? `Esta deuda ya tiene pagos por ${formatARS(deleteTarget?.paidAmount)}. No se puede eliminar, pero se puede anular — quedará marcada como cancelada y no sumará al total adeudado.`
            : '¿Eliminar esta deuda? No se puede deshacer.'
        }
        confirmLabel={
          deleting
            ? 'Procesando...'
            : confirmingCancel || (deleteTarget?.paidAmount ?? 0) > 0
              ? 'Anular deuda'
              : 'Eliminar'
        }
        variant={confirmingCancel || (deleteTarget?.paidAmount ?? 0) > 0 ? 'warning' : 'danger'}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setConfirmingCancel(false);
          }
        }}
      />
    </div>
  );
};



/**
 * Acciones de una fila de deuda. Compartidas por la tabla de desktop y la
 * card de mobile. Son botones solo-ícono con `title` + `aria-label` nativos
 * porque el repo no tiene componente Tooltip.
 *
 * Va DESPUÉS de `SupplierDebtsPage` a propósito: su JSX contiene
 * `styles.rowActions` y, si estuviera antes, una búsqueda de texto posterior
 * encontraría esta copia primero.
 */
interface DebtRowActionsProps {
  debt: SupplierDebt;
  isExpanded: boolean;
  isPending: boolean;
  onToggleExpanded: (debt: SupplierDebt) => void;
  onOpenPayment: (debt: SupplierDebt) => void;
  onDelete: (debt: SupplierDebt) => void;
}

const DebtRowActions = ({
  debt,
  isExpanded,
  isPending,
  onToggleExpanded,
  onOpenPayment,
  onDelete,
}: DebtRowActionsProps) => (
  <div className={styles.rowActions}>
    <Button
      variant="outline"
      size="icon-sm"
      onClick={() => onToggleExpanded(debt)}
      title={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
      aria-label={isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
    >
      {isExpanded ? (
        <ChevronUp className={styles.btnIcon} />
      ) : (
        <ChevronDown className={styles.btnIcon} />
      )}
    </Button>
    {isPending && (
      <Button
        size="icon-sm"
        onClick={() => onOpenPayment(debt)}
        title="Registrar pago"
        aria-label="Registrar pago"
      >
        <HandCoins className={styles.btnIcon} />
      </Button>
    )}
    <Button
      variant="outline"
      size="icon-sm"
      onClick={() => onDelete(debt)}
      title={`Eliminar deuda ${debt.description}`}
      aria-label={`Eliminar deuda ${debt.description}`}
    >
      <Trash2 className={styles.trashIcon} />
    </Button>
  </div>
);

