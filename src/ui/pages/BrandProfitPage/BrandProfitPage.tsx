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
import styles from './BrandProfitPage.module.css';

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
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Ganancia por marca</h1>
              <p className={styles.subtitle}>
                Venta y ganancia total de cada marca en el período seleccionado.
              </p>
            </div>
            <Button variant="outline" onClick={loadProfit} disabled={loading}>
              <RefreshCw className={styles.refreshIcon} data-spin={loading} />
              Actualizar
            </Button>
          </header>

          {/* Summary */}
          <section className={styles.summary}>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div className={styles.statBody}>
                  <p className={styles.statLabel}>Venta total del período</p>
                  <p className={styles.statValue}>{formatARS(totals.sales)}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconBlue].filter(Boolean).join(' ')}>
                  <Wallet size={22} />
                </div>
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statRow}>
                <div className={styles.statBody}>
                  <p className={styles.statLabel}>Ganancia total del período</p>
                  <p className={styles.statValue}>{formatARS(totals.profit)}</p>
                </div>
                <div className={[styles.statIcon, styles.statIconGreen].filter(Boolean).join(' ')}>
                  <TrendingUp size={22} />
                </div>
              </div>
            </div>
          </section>

          {/* Date range filter */}
          <section className={styles.filters}>
            <div className={styles.dateField}>
              <label htmlFor="profit-from" className={styles.dateLabel}>
                <CalendarDays className={styles.dateIcon} />
                Desde
              </label>
              <input
                id="profit-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.dateField}>
              <label htmlFor="profit-to" className={styles.dateLabel}>
                <CalendarDays className={styles.dateIcon} />
                Hasta
              </label>
              <input
                id="profit-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className={styles.dateInput}
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
            <div className={styles.stateBox}>
              <Loader2 className={[styles.stateIcon, styles.stateIconSpin].filter(Boolean).join(' ')} />
              <p>Cargando ganancia por marca...</p>
            </div>
          ) : error ? (
            <div className={[styles.stateBox, styles.stateBoxError].filter(Boolean).join(' ')}>
              <AlertCircle className={[styles.stateIcon, styles.stateIconRed].filter(Boolean).join(' ')} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadProfit} className={styles.retryBtn}>
                <RefreshCw className={styles.refreshIcon} data-spin={false} />
                Reintentar
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className={styles.stateBox}>
              <Tags className={styles.stateIcon} />
              <p>No hay ventas con marca asignada en el período seleccionado.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <>
              {/* Mobile: una card por marca. La tabla de desktop queda debajo. */}
              <ul className={styles.cardList}>
                {rows.map((row) => (
                  <li key={row.brandId || row.brandName} className={styles.card}>
                    <div className={styles.cardName} title={row.brandName}>{row.brandName}</div>
                    <div className={styles.cardMeta}>
                      <span>
                        <span className={styles.cardLabel}>Venta</span>
                        {formatARS(row.sales)}
                      </span>
                      <span>
                        <span className={styles.cardLabel}>Ganancia</span>
                        {formatARS(row.profit)}
                      </span>
                    </div>
                  </li>
                ))}
                <li className={[styles.card, styles.cardTotalRow].filter(Boolean).join(' ')}>
                  <span className={styles.cardLabel}>Total</span>
                  <span>{formatARS(totals.sales)}</span>
                  <span>{formatARS(totals.profit)}</span>
                </li>
              </ul>

              <div className={styles.tableDesktop}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead className={styles.cellRight}>Venta del período</TableHead>
                    <TableHead className={styles.cellRight}>Ganancia del período</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.brandId || row.brandName}>
                          <TableCell className={styles.cellName}>
                            <div className={styles.cellNameText} title={row.brandName}>
                              {row.brandName}
                            </div>
                          </TableCell>
                      <TableCell className={styles.cellRight}>{formatARS(row.sales)}</TableCell>
                      <TableCell className={styles.cellProfit}>{formatARS(row.profit)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className={styles.totalRow}>
                    <TableCell className={styles.totalName}>Total</TableCell>
                    <TableCell className={styles.cellRight}>{formatARS(totals.sales)}</TableCell>
                    <TableCell className={styles.totalProfit}>{formatARS(totals.profit)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
              </>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
