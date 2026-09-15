import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Plus, RefreshCw, TrendingUp } from 'lucide-react';

import { Button } from '@/ui/components/ui/button';
import { ManualSaleDialog } from '@/ui/components/ManualSaleDialog';
import { getMySalesToday, type MySalesToday } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';
import { useAuthStore } from '@/infrastructure/auth_session_manager';

const getFirstName = (name?: string): string => {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
};

/**
 * Dashboard simplificado del rol empleado: resumen de sus ventas del día y
 * un acceso directo para cargar una venta presencial.
 */
export const EmployeeDashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<MySalesToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaleOpen, setIsSaleOpen] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getMySalesToday();
      setSummary(data);
    } catch {
      setSummary(null);
      setError('No se pudieron cargar tus ventas de hoy. Reintentá en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const firstName = getFirstName(user?.name);
  const orders = summary?.orders ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {firstName ? `Hola, ${firstName} 👋` : 'Mi panel'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Registrá tus ventas del día y seguí tu avance.
        </p>
      </header>

      {/* Resumen del día */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-32 bg-slate-100 dark:bg-slate-700/60 rounded" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
            <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
            <Button variant="outline" onClick={loadSummary} className="mt-4">
              <RefreshCw className="size-4" />
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="shrink-0 p-3 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <TrendingUp size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-lg text-slate-700 dark:text-slate-200">
                Vendiste{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatARS(summary?.sales ?? 0)}
                </span>{' '}
                hoy en{' '}
                <span className="font-bold text-slate-900 dark:text-white">{orders}</span>{' '}
                {orders === 1 ? 'venta' : 'ventas'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Resumen de tus ventas confirmadas de hoy.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Cargar venta */}
      <Button
        size="lg"
        className="w-full h-20 text-xl gap-3 rounded-2xl shadow-lg"
        onClick={() => setIsSaleOpen(true)}
      >
        <Plus className="size-7" />
        Cargar venta
      </Button>

      <ManualSaleDialog
        open={isSaleOpen}
        onOpenChange={setIsSaleOpen}
        onConfirmed={() => {
          loadSummary();
        }}
      />
    </div>
  );
};
