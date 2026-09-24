import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Check,
  Loader2,
  RefreshCw,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
import { Button } from '@/ui/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/ui/components/ui/table';
import { getProfitBySupplier, type SupplierProfit } from '@/infrastructure/orders.service';
import { getSuppliers, type Supplier } from '@/infrastructure/suppliers.service';
import { formatARS } from '@/lib/format';
import { CopyAmountButton } from '@/ui/components/CopyAmountButton';
import {
  SupplierDebtDialog,
  type SupplierDebtInitials,
} from '@/ui/components/SupplierDebtDialog';

/**
 * A pagar al proveedor = venta del período − ganancia del período.
 * Ej. venta $60.000 y ganancia $10.000 → a pagar $50.000.
 */
export const calcPayableToSupplier = (sales: number, profit: number): number =>
  (Number(sales) || 0) - (Number(profit) || 0);

/**
 * Lo que falta registrar para una fila, leído directo del backend.
 * Con fallback a venta − ganancia cuando el campo aún no viene.
 */
export const getPendingToRegister = (row: SupplierProfit): number => {
  const pending = Number(row.pendingToRegister);
  if (Number.isFinite(pending)) return pending;
  return calcPayableToSupplier(row.sales, row.profit);
};

/**
 * Lo ya registrado para una fila, leído directo del backend.
 */
export const getAlreadyRegistered = (row: SupplierProfit): number => {
  const already = Number(row.alreadyRegistered ?? 0);
  return Number.isFinite(already) ? already : 0;
};

const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const firstDayOfMonth = (): string => {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
};

export const SupplierProfitPage = () => {
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [rows, setRows] = useState<SupplierProfit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debtInitials, setDebtInitials] = useState<SupplierDebtInitials | null>(null);

  const loadProfit = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [profitData, suppliersData] = await Promise.all([
        getProfitBySupplier({ from: from || undefined, to: to || undefined }),
        getSuppliers(),
      ]);
      setRows(profitData);
      setSuppliers(suppliersData.filter((supplier) => supplier.isActive !== false));
    } catch {
      setRows([]);
      setError('No se pudo cargar la rendición por proveedor. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadProfit();
  }, [loadProfit]);

  const totals = useMemo(() => {
    const sales = rows.reduce((sum, row) => sum + (Number(row.sales) || 0), 0);
    const profit = rows.reduce((sum, row) => sum + (Number(row.profit) || 0), 0);
    const pending = rows.reduce((sum, row) => sum + getPendingToRegister(row), 0);
    return { sales, profit, payable: pending };
  }, [rows]);

  // Resuelve el supplierId real de la fila (por id, con fallback por nombre).
  const resolveRowSupplierId = (row: SupplierProfit): string =>
    suppliers.some((supplier) => supplier.id === row.supplierId)
      ? row.supplierId
      : (suppliers.find((supplier) => supplier.name === row.supplierName)?.id ?? '');

  // Abre el modal de Nueva deuda pre-cargado con el proveedor de la fila y
  // lo que falta registrar (pendingToRegister). El usuario revisa y confirma.
  const openDebtForRow = (row: SupplierProfit) => {
    const pending = getPendingToRegister(row);
    setDebtInitials({
      supplierId: resolveRowSupplierId(row),
      description: `Saldo ${row.supplierName} (${from} al ${to})`,
      totalAmount: String(pending),
    });
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Rendición por proveedor
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Venta y ganancia total de cada proveedor en el período seleccionado.
              </p>
            </div>
            <Button variant="outline" onClick={loadProfit} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </header>

          {/* Summary */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Venta total del período
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {formatARS(totals.sales)}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-blue-100 text-blue-600">
                  <Wallet size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Mi ganancia del período
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {formatARS(totals.profit)}
                  </p>
                </div>
                <div className="shrink-0 p-3 rounded-xl bg-emerald-100 text-emerald-600">
                  <TrendingUp size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Date range filter */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-full sm:w-56 space-y-1.5">
              <label
                htmlFor="profit-from"
                className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
              >
                <CalendarDays className="size-4" />
                Desde
              </label>
              <input
                id="profit-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-full sm:w-56 space-y-1.5">
              <label
                htmlFor="profit-to"
                className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
              >
                <CalendarDays className="size-4" />
                Hasta
              </label>
              <input
                id="profit-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFrom(firstDayOfMonth());
                setTo(toISODate(new Date()));
              }}
            >
              Mes actual
            </Button>
          </section>

          {/* Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p>Cargando rendición por proveedor...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadProfit} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Truck className="w-10 h-10 mb-4" />
              <p>No hay ventas con proveedor asignado en el período seleccionado.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Venta del período</TableHead>
                    <TableHead className="text-right">Mi ganancia</TableHead>
                    <TableHead className="text-right">A pagar al proveedor</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const pending = getPendingToRegister(row);
                    const already = getAlreadyRegistered(row);
                    const isFullyRegistered = pending === 0;
                    return (
                      <TableRow key={row.supplierId || row.supplierName}>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                          {row.supplierName}
                        </TableCell>
                        <TableCell className="text-right">{formatARS(row.sales)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatARS(row.profit)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span className="inline-flex items-center justify-end gap-1">
                            {formatARS(pending)}
                            <CopyAmountButton
                              value={formatARS(pending)}
                              label={`Copiar monto a pagar a ${row.supplierName}`}
                            />
                          </span>
                          {already > 0 && (
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                              {`Ya registrado: ${formatARS(already)}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isFullyRegistered ? (
                            <Button variant="outline" size="sm" disabled>
                              <Check className="size-4 text-emerald-600" />
                              Todo registrado
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDebtForRow(row)}
                            >
                              Registrar deuda
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50 font-semibold">
                    <TableCell className="text-slate-800 dark:text-slate-200">Total</TableCell>
                    <TableCell className="text-right">{formatARS(totals.sales)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                      {formatARS(totals.profit)}
                    </TableCell>
                    <TableCell className="text-right">{formatARS(totals.payable)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Nueva deuda pre-cargada desde la fila (el usuario confirma en el formulario) */}
      <SupplierDebtDialog
        open={debtInitials !== null}
        onOpenChange={(open) => {
          if (!open) setDebtInitials(null);
        }}
        suppliers={suppliers}
        initials={debtInitials ?? undefined}
        onCreated={loadProfit}
      />
    </div>
  );
};
