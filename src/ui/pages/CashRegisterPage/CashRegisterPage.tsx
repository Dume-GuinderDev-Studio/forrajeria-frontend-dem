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
import { getCashSummary, type CashSummary, type PaymentMethod } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';
import styles from './CashRegisterPage.module.css';

const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type CardAccent = 'emerald' | 'blue' | 'violet' | 'amber' | 'slate';

interface CashCardConfig {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent: CardAccent;
}

const CashCard = ({ title, value, sub, icon: Icon, accent }: CashCardConfig) => (
  <div className={styles.card}>
    <div className={styles.cardRow}>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{title}</p>
        <p className={styles.cardValue}>{value}</p>
        {sub && <p className={styles.cardSub}>{sub}</p>}
      </div>
      <div className={styles.iconBox} data-accent={accent}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);

const CashCardSkeleton = () => (
  <div className={styles.skeletonCard}>
    <div className={[styles.bar, styles.barTitle, styles.barTitleSmall].filter(Boolean).join(' ')} />
    <div className={[styles.bar, styles.barValue, styles.barValueSmall].filter(Boolean).join(' ')} />
    <div className={[styles.bar, styles.barSub, styles.barSubSmall].filter(Boolean).join(' ')} />
  </div>
);

const PAYMENT_METHOD_CARDS: {
  method: PaymentMethod;
  label: string;
  icon: LucideIcon;
  accent: CardAccent;
}[] = [
  { method: 'efectivo', label: 'Efectivo', icon: Banknote, accent: 'emerald' },
  { method: 'transferencia', label: 'Transferencia', icon: Landmark, accent: 'blue' },
  { method: 'mercado_pago', label: 'Mercado Pago', icon: Wallet, accent: 'violet' },
  { method: 'fiado', label: 'Fiado', icon: HandCoins, accent: 'amber' },
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
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Caja</h1>
              <p className={styles.subtitle}>Resumen diario de ingresos por método de pago.</p>
            </div>
          </header>

          {/* Date selector */}
          <section className={styles.dateBar}>
            <label htmlFor="cash-date" className={styles.dateLabel}>
              <CalendarDays className={styles.dateIcon} />
              Fecha
            </label>
            <input
              id="cash-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={styles.dateInput}
            />
          </section>

          {/* Content */}
          {loading ? (
            <div className={styles.stack}>
              <div className={styles.grid2}>
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className={[styles.skeletonCard, styles.skeletonCardLarge]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className={[styles.bar, styles.barTitle, styles.barTitleMid].filter(Boolean).join(' ')} />
                    <div className={[styles.bar, styles.barValue, styles.barValueMid].filter(Boolean).join(' ')} />
                    <div className={[styles.bar, styles.barSub, styles.barSubMid].filter(Boolean).join(' ')} />
                  </div>
                ))}
              </div>
              <div className={styles.gridMethods}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <CashCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : error ? (
            <div className={styles.stateBox}>
              <AlertCircle className={styles.stateIcon} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadSummary} className={styles.retryBtn}>
                <RefreshCw className={styles.retryIcon} />
                Reintentar
              </Button>
            </div>
          ) : summary ? (
            <div className={styles.stack}>
              {/* Total + profit cards */}
              <div className={styles.grid2}>
                <div className={[styles.card, styles.cardHero].filter(Boolean).join(' ')}>
                  <div className={styles.cardRowCenter}>
                    <div className={styles.cardBody}>
                      <p className={styles.cardTitle}>Total del día</p>
                      <p className={styles.cardValueHero}>{formatARS(summary.total)}</p>
                      <p className={styles.cardSub}>
                        {summary.orders} {summary.orders === 1 ? 'ticket' : 'tickets'}
                      </p>
                    </div>
                    <div
                      className={[styles.iconBox, styles.iconBoxLarge].filter(Boolean).join(' ')}
                      data-accent="blue"
                    >
                      <Receipt size={28} />
                    </div>
                  </div>
                </div>

                <div className={[styles.card, styles.cardHero].filter(Boolean).join(' ')}>
                  <div className={styles.cardRowCenter}>
                    <div className={styles.cardBody}>
                      <p className={styles.cardTitle}>Ganancia del día</p>
                      <p className={styles.cardValueHero}>{formatARS(summary.profit ?? 0)}</p>
                      <p className={styles.cardSub}>Ventas menos costo de productos</p>
                    </div>
                    <div
                      className={[styles.iconBox, styles.iconBoxLarge].filter(Boolean).join(' ')}
                      data-accent="emerald"
                    >
                      <TrendingUp size={28} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment methods + tickets */}
              <div className={styles.gridMethods}>
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
                  accent="slate"
                />
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};
