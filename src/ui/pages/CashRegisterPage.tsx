import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  HandCoins,
  Landmark,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
import { Button } from '@/ui/components/ui/button';
import {
  getCashSummary,
  type CashSummary,
  type PaymentMethod,
} from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface CashCardConfig {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent: string;
}

const CashCard = ({ title, value, sub, icon: Icon, accent }: CashCardConfig) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
      </div>
      <div className={`shrink-0 p-3 rounded-xl ${accent}`}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);

const CashCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
    <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-700/60 rounded" />
  </div>
);

const PAYMENT_METHOD_CARDS: {
  method: PaymentMethod;
  label: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    method: 'efectivo',
    label: 'Efectivo',
    icon: Banknote,
    accent: 'bg-emerald-100 text-emerald-600',
  },
  {
    method: 'transferencia',
    label: 'Transferencia',
    icon: Landmark,
    accent: 'bg-blue-100 text-blue-600',
  },
  {
    method: 'mercado_pago',
    label: 'Mercado Pago',
    icon: Wallet,
    accent: 'bg-violet-100 text-violet-600',
  },
  {
    method: 'fiado',
    label: 'Fiado',
    icon: HandCoins,
    accent: 'bg-amber-100 text-amber-600',
  },
];

export const CashRegisterPage = () => {
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getCashSummary(date);
      setSummary(data);
    } catch {
      setSummary(null);
      setError('No se pudo cargar el resumen de caja. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Caja
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Resumen diario de ingresos por método de pago.
              </p>
            </div>
          </header>

          {/* Date selector */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              htmlFor="cash-date"
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400"
            >
              <CalendarDays className="size-4" />
              Fecha
            </label>
            <input
              id="cash-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full sm:w-56 h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </section>

          {/* Content */}
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse"
                  >
                    <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                    <div className="h-10 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                    <div className="h-3 w-24 bg-slate-100 dark:bg-slate-700/60 rounded" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <CashCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadSummary} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {/* Total + profit cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Total del día
                      </p>
                      <p className="mt-2 text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {formatARS(summary.total)}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {summary.orders} {summary.orders === 1 ? 'ticket' : 'tickets'}
                      </p>
                    </div>
                    <div className="shrink-0 p-4 rounded-2xl bg-blue-100 text-blue-600">
                      <Receipt size={28} />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                        Ganancia del día
                      </p>
                      <p className="mt-2 text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {formatARS(summary.profit ?? 0)}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Ventas menos costo de productos
                      </p>
                    </div>
                    <div className="shrink-0 p-4 rounded-2xl bg-emerald-100 text-emerald-600">
                      <TrendingUp size={28} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment methods + tickets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                {PAYMENT_METHOD_CARDS.map((config) => (
                  <CashCard
                    key={config.method}
                    title={config.label}
                    value={formatARS(summary.byPaymentMethod[config.method] ?? 0)}
                    icon={config.icon}
                    accent={config.accent}
                  />
                ))}

                <CashCard
                  title="Tickets del día"
                  value={summary.orders.toLocaleString('es-AR')}
                  sub="Ventas confirmadas"
                  icon={Receipt}
                  accent="bg-slate-100 text-slate-600"
                />
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
