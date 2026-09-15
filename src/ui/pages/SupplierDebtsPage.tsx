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
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                A pagar
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Deudas con proveedores y pagos parciales.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={loadData} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button onClick={openCreateDebt}>
                <Plus className="size-4" />
                Nueva deuda
              </Button>
            </div>
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
                    {formatARS(totalPending)}
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
                    Proveedores con deuda
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {suppliersWithDebt}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-blue-100 text-blue-600">
                  <Truck size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Deudas pendientes
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {pendingDebtsCount}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-slate-100 text-slate-600">
                  <Receipt size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown by supplier */}
          {!loading && !error && summary && summary.bySupplier.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Agrupado por proveedor
                </h2>
              </div>
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
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        {entry.supplierName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">
                          {entry.debtsCount} {entry.debtsCount === 1 ? 'deuda' : 'deudas'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatARS(entry.paidAmount)}</TableCell>
                      <TableCell className="font-semibold">{formatARS(entry.pendingAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando deudas a proveedores...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadData} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : debts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <CheckCircle2 className="w-10 h-10 mb-4 text-emerald-500" />
              <p>No hay deudas con proveedores. Todo al día.</p>
              <Button onClick={openCreateDebt} className="mt-4">
                <Plus className="size-4" />
                Nueva deuda
              </Button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto total</TableHead>
                    <TableHead>Pagado</TableHead>
                    <TableHead>Saldo pendiente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
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
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                            {debt.supplierName}
                          </TableCell>
                          <TableCell className="max-w-56 truncate" title={debt.description}>
                            {debt.description}
                          </TableCell>
                          <TableCell>{formatARS(debt.totalAmount)}</TableCell>
                          <TableCell>{formatARS(debt.paidAmount)}</TableCell>
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              <span>{formatARS(debt.pendingAmount)}</span>
                              <Badge variant={isPending ? 'warning' : 'success'}>
                                {isPending ? 'Pendiente' : 'Pagada'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(debt.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => toggleExpanded(debt)}>
                                {isExpanded ? (
                                  <ChevronUp className="size-4" />
                                ) : (
                                  <ChevronDown className="size-4" />
                                )}
                                {isExpanded ? 'Ocultar' : 'Ver detalle'}
                              </Button>
                              {isPending && (
                                <Button size="sm" onClick={() => openPayment(debt)}>
                                  <HandCoins className="size-4" />
                                  Registrar pago
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDeleteTarget(debt);
                                  setConfirmingCancel(false);
                                }}
                                aria-label={`Eliminar deuda ${debt.description}`}
                              >
                                <Trash2 className="size-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-slate-50 dark:bg-slate-900/50">
                              {isDetailLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                                  <Loader2 className="size-4 animate-spin" />
                                  Cargando historial de pagos...
                                </div>
                              ) : !detail || detail.payments.length === 0 ? (
                                <p className="text-sm text-slate-400 py-2">
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
                                        <TableCell className="font-semibold">
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
                                          className="max-w-56 truncate"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              {payTarget?.supplierName} · {payTarget?.description} · Saldo pendiente:{' '}
              {formatARS(payTarget?.pendingAmount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Monto *
              </label>
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
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Método de pago *
              </label>
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
                <SelectTrigger className="w-full">
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

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Fecha (opcional)
              </label>
              <input
                type="date"
                value={paymentForm.paidAt}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPaymentForm((current) => ({ ...current, paidAt: e.target.value }))}
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!paymentForm.paidAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Si no elegís fecha se usa la actual ({formatDateOnly(new Date().toISOString())}).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Notas (opcional)
              </label>
              <textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm((current) => ({ ...current, notes: e.target.value }))}
                placeholder="Ej: Pago parcial en efectivo"
                rows={2}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {paymentFormError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {paymentFormError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayTarget(null)} disabled={savingPayment}>
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={savingPayment}>
              {savingPayment && <Loader2 className="size-4 animate-spin" />}
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
