import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Loader2,
  RefreshCw,
  Tags,
  TrendingUp,
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
import { getProfitByBrand, type BrandProfit } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

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

export const BrandProfitPage = () => {
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(() => toISODate(new Date()));
  const [rows, setRows] = useState<BrandProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfit = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getProfitByBrand({
        from: from || undefined,
        to: to || undefined,
      });
      setRows(data);
    } catch {
      setRows([]);
      setError('No se pudo cargar la ganancia por marca. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadProfit();
  }, [loadProfit]);

  const totals = useMemo(
    () => ({
      sales: rows.reduce((sum, row) => sum + (Number(row.sales) || 0), 0),
      profit: rows.reduce((sum, row) => sum + (Number(row.profit) || 0), 0),
    }),
    [rows],
  );

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Ganancia por marca
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Venta y ganancia total de cada marca en el período seleccionado.
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
                    Ganancia total del período
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
              <p>Cargando ganancia por marca...</p>
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
              <Tags className="w-10 h-10 mb-4" />
              <p>No hay ventas con marca asignada en el período seleccionado.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead className="text-right">Venta del período</TableHead>
                    <TableHead className="text-right">Ganancia del período</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.brandId || row.brandName}>
                      <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                        {row.brandName}
                      </TableCell>
                      <TableCell className="text-right">{formatARS(row.sales)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatARS(row.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50 font-semibold">
                    <TableCell className="text-slate-800 dark:text-slate-200">Total</TableCell>
                    <TableCell className="text-right">{formatARS(totals.sales)}</TableCell>
                    <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                      {formatARS(totals.profit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
