import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleX,
  Receipt,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import { AdminSidebar } from '@/ui/components/AdminSidebar';
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
import { getOrdersMetrics, type OrderMetrics } from '@/infrastructure/orders.service';
import { getLowStockProducts, type LowStockAlerts, type LowStockProduct } from '@/infrastructure/products.service';
import { formatARS } from '@/lib/format';
import styles from './DashboardPage.module.css';

type MetricAccent = 'chart1' | 'chart2' | 'chart3' | 'chart4' | 'chart5';

interface MetricCardConfig {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accent: MetricAccent;
}

const MetricCard = ({
  title,
  value,
  sub,
  icon,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: MetricAccent;
}) => (
  <div className={styles.card}>
    <div className={styles.cardRow}>
      <div className={styles.cardBody}>
        <p className={styles.cardTitle}>{title}</p>
        <p className={styles.cardValue}>{value}</p>
        <p className={styles.cardSub}>{sub}</p>
      </div>
      <div className={styles.iconBox} data-accent={accent}>
        {icon}
      </div>
    </div>
  </div>
);

/** Cantidad de productos que se muestran por grupo en las alertas de stock. */
const STOCK_ALERT_PREVIEW_MAX = 5;

/**
 * Vista mobile de las alertas de stock: lista flex en lugar de <table>.
 *
 * Una tabla nunca se encoge por debajo del ancho de su contenido mas
 * largo, asi que con nombres largos la columna "Stock actual" se iba de
 * la card. Aca cada fila es un flex donde el nombre puede partirse en dos
 * lineas y el badge queda siempre visible.
 */
const StockAlertList = ({
  products,
  icon,
  badgeVariant,
  onSelect,
}: {
  products: LowStockProduct[];
  icon: React.ReactNode;
  badgeVariant: 'danger' | 'warning';
  onSelect: (id: string) => void;
}) => (
  <>
    <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground">
      <span>Producto</span>
      <span>Stock actual</span>
    </div>
    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
      {products.map((product) => (
        <li
          key={product.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(product.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(product.id);
            }
          }}
          className={[
            'flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50',
            styles.clickableItem,
          ].join(' ')}
        >
          <span className="shrink-0">{icon}</span>
          <span
            className={[
              'min-w-0 flex-1 line-clamp-2 break-words text-sm font-medium',
              styles.productNameText,
            ].join(' ')}
          >
            {product.name}
          </span>
          <Badge variant={badgeVariant} className="shrink-0">
            {product.stock}
          </Badge>
        </li>
      ))}
    </ul>
  </>
);

/**
 * En desktop la tabla mantiene la columna Categoria, asi que se conserva
 * tal cual y solo se muestra a partir de sm. Por debajo de sm manda la
 * lista flex.
 */
const StockAlertTable = ({
  products,
  icon,
  badgeVariant,
  onSelect,
}: {
  products: LowStockProduct[];
  icon: React.ReactNode;
  badgeVariant: 'danger' | 'warning';
  onSelect: (id: string) => void;
}) => (
  <>
    <div className="sm:hidden">
      <StockAlertList
        products={products}
        icon={icon}
        badgeVariant={badgeVariant}
        onSelect={onSelect}
      />
    </div>
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead className={styles.cellRight}>Stock actual</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow
              key={product.id}
              className={styles.clickableRow}
              onClick={() => onSelect(product.id)}
            >
              <TableCell className={styles.cellProduct}>
                <div className={styles.productCell}>
                  {icon}
                  <span className={styles.productName}>{product.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{product.category?.name ?? 'Sin categoría'}</Badge>
              </TableCell>
              <TableCell className={styles.cellRight}>
                <Badge variant={badgeVariant}>{product.stock}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </>
);

const MetricCardSkeleton = () => (
  <div className={styles.skeleton}>
    <div className={[styles.bar, styles.barTitle].filter(Boolean).join(' ')} />
    <div className={[styles.bar, styles.barValue].filter(Boolean).join(' ')} />
    <div className={[styles.bar, styles.barSub].filter(Boolean).join(' ')} />
  </div>
);

export const DashboardPage = () => {
  const [metrics, setMetrics] = useState<OrderMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stockAlerts, setStockAlerts] = useState<LowStockAlerts>({
    outOfStock: [],
    lowStock: [],
  });
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [lowStockError, setLowStockError] = useState('');

  const navigate = useNavigate();

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getOrdersMetrics();
      setMetrics(data);
    } catch {
      setMetrics(null);
      setError('No se pudieron cargar las métricas. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const loadLowStock = useCallback(async () => {
    setLowStockLoading(true);
    setLowStockError('');

    try {
      const data = await getLowStockProducts();
      setStockAlerts(data);
    } catch {
      setStockAlerts({ outOfStock: [], lowStock: [] });
      setLowStockError('No se pudieron cargar las alertas de stock. Reintentá en unos segundos.');
    } finally {
      setLowStockLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

  const cards: MetricCardConfig[] = metrics
    ? [
        {
          title: 'Ventas de hoy',
          value: formatARS(metrics.today.sales),
          sub: `${metrics.today.orders} ${metrics.today.orders === 1 ? 'ticket' : 'tickets'}`,
          icon: CalendarClock,
          accent: 'chart1',
        },
        {
          title: 'Ventas de la semana',
          value: formatARS(metrics.week.sales),
          sub: `${metrics.week.orders} ${metrics.week.orders === 1 ? 'ticket' : 'tickets'}`,
          icon: CalendarDays,
          accent: 'chart2',
        },
        {
          title: 'Ventas del mes',
          value: formatARS(metrics.month.sales),
          sub: `${metrics.month.orders} ${metrics.month.orders === 1 ? 'ticket' : 'tickets'}`,
          icon: CalendarRange,
          accent: 'chart3',
        },
        {
          title: 'Ticket promedio del mes',
          value: formatARS(metrics.avgTicket),
          sub: 'Promedio por venta confirmada',
          icon: Receipt,
          accent: 'chart4',
        },
        {
          title: 'Ganancia del mes',
          value: formatARS(metrics.profitMonth),
          sub: 'Ventas menos costo de productos',
          icon: TrendingUp,
          accent: 'chart5',
        },
      ]
    : [];

  return (
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Dashboard</h1>
              <p className={styles.subtitle}>Métricas de ventas confirmadas del negocio.</p>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className={styles.grid}>
              {Array.from({ length: 5 }).map((_, index) => (
                <MetricCardSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className={styles.stateBox}>
              <AlertCircle className={styles.stateIcon} />
              <p className={styles.stateError}>{error}</p>
              <Button variant="outline" onClick={loadMetrics} className={styles.retryBtn}>
                <RefreshCw className={styles.retryIcon} />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className={styles.grid}>
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <MetricCard
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    sub={card.sub}
                    accent={card.accent}
                    icon={<Icon size={22} />}
                  />
                );
              })}
            </div>
          )}

          {/* Stock alerts */}
          <section className={styles.alerts}>
            <div className={styles.alertsHead}>
              <TriangleAlert className={styles.alertsHeadIcon} />
              <h2 className={styles.alertsTitle}>Alertas de stock</h2>
            </div>

            {lowStockLoading ? (
              <div className={styles.alertsSkeleton}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className={styles.alertsSkeletonBar} />
                ))}
              </div>
            ) : lowStockError ? (
              <div className={styles.alertsEmpty}>
                <AlertCircle className={styles.stateIcon} />
                <p className={styles.stateError}>{lowStockError}</p>
                <Button variant="outline" onClick={loadLowStock} className={styles.retryBtn}>
                  <RefreshCw className={styles.retryIcon} />
                  Reintentar
                </Button>
              </div>
            ) : stockAlerts.outOfStock.length === 0 && stockAlerts.lowStock.length === 0 ? (
              <div className={styles.alertsEmpty}>
                <p className={styles.alertsEmptyText}>✅ Todo el stock está en buen nivel</p>
              </div>
            ) : (
              <div className={styles.alertsList}>
                {stockAlerts.outOfStock.length > 0 && (
                  <div>
                    <div className={styles.groupHead}>
                      <div className={styles.groupHeadLeft}>
                        <CircleX className={[styles.groupIcon, styles.groupIconRed].filter(Boolean).join(' ')} />
                        <h3 className={styles.groupTitle}>Sin stock</h3>
                        <Badge variant="danger">{stockAlerts.outOfStock.length}</Badge>
                      </div>
                      {stockAlerts.outOfStock.length > STOCK_ALERT_PREVIEW_MAX && (
                        <button
                          onClick={() => navigate('/admin/catalogo?stockFilter=out')}
                          className={styles.seeAll}
                        >
                          Ver todos ({stockAlerts.outOfStock.length})
                        </button>
                      )}
                    </div>
                    <StockAlertTable
                      products={stockAlerts.outOfStock.slice(0, STOCK_ALERT_PREVIEW_MAX)}
                      icon={<CircleX className={[styles.rowIcon, styles.rowIconRed].filter(Boolean).join(' ')} />}
                      badgeVariant="danger"
                      onSelect={(id) => navigate(`/admin/catalogo?edit=${id}`)}
                    />
                  </div>
                )}
                {stockAlerts.lowStock.length > 0 && (
                  <div>
                    <div className={styles.groupHead}>
                      <div className={styles.groupHeadLeft}>
                        <TriangleAlert className={[styles.groupIcon, styles.groupIconAmber].filter(Boolean).join(' ')} />
                        <h3 className={styles.groupTitle}>Stock bajo</h3>
                        <Badge variant="warning">{stockAlerts.lowStock.length}</Badge>
                      </div>
                      {stockAlerts.lowStock.length > STOCK_ALERT_PREVIEW_MAX && (
                        <button
                          onClick={() => navigate('/admin/catalogo?stockFilter=low')}
                          className={styles.seeAll}
                        >
                          Ver todos ({stockAlerts.lowStock.length})
                        </button>
                      )}
                    </div>
                    <StockAlertTable
                      products={stockAlerts.lowStock.slice(0, STOCK_ALERT_PREVIEW_MAX)}
                      icon={<TriangleAlert className={[styles.rowIcon, styles.rowIconAmber].filter(Boolean).join(' ')} />}
                      badgeVariant="warning"
                      onSelect={(id) => navigate(`/admin/catalogo?edit=${id}`)}
                    />
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};
