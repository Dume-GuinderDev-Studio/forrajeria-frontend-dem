import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Plus, RefreshCw, TrendingUp } from 'lucide-react';

import { Button } from '@/ui/components/ui/button';
import { ManualSaleDialog } from '@/ui/components/ManualSaleDialog';
import { getMySalesToday, type MySalesToday } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';
import { useAuthStore } from '@/infrastructure/auth_session_manager';
import styles from './EmployeeDashboardPage.module.css';

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
    <div className={styles.root}>
      {/* Header */}
      <header>
        <h1 className={styles.title}>{firstName ? `Hola, ${firstName} 👋` : 'Mi panel'}</h1>
        <p className={styles.subtitle}>Registrá tus ventas del día y seguí tu avance.</p>
      </header>

      {/* Resumen del día */}
      <section className={styles.card}>
        {loading ? (
          <div className={styles.skeleton}>
            <div className={[styles.bar, styles.barShort].filter(Boolean).join(' ')} />
            <div className={[styles.bar, styles.barLong].filter(Boolean).join(' ')} />
            <div className={[styles.bar, styles.barMid].filter(Boolean).join(' ')} />
          </div>
        ) : error ? (
          <div className={styles.errorBox}>
            <AlertCircle className={styles.errorIcon} />
            <p className={styles.errorText}>{error}</p>
            <Button variant="outline" onClick={loadSummary} className={styles.retryBtn}>
              <RefreshCw className={styles.retryIcon} />
              Reintentar
            </Button>
          </div>
        ) : (
          <div className={styles.summary}>
            <div className={styles.iconBox}>
              <TrendingUp size={24} />
            </div>
            <div className={styles.summaryBody}>
              <p className={styles.summaryText}>
                Vendiste <span className={styles.strong}>{formatARS(summary?.sales ?? 0)}</span>{' '}
                hoy en <span className={styles.strong}>{orders}</span>{' '}
                {orders === 1 ? 'venta' : 'ventas'}
              </p>
              <p className={styles.summarySub}>Resumen de tus ventas confirmadas de hoy.</p>
            </div>
          </div>
        )}
      </section>

      {/* Cargar venta */}
      <Button size="lg" className={styles.saleBtn} onClick={() => setIsSaleOpen(true)}>
        <Plus className={styles.saleIcon} />
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
