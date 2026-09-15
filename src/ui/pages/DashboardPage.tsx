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
import {
  getLowStockProducts,
  type LowStockAlerts,
  type LowStockProduct,
} from '@/infrastructure/products.service';
import { formatARS } from '@/lib/format';

interface MetricCardConfig {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accent: string;
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
  accent: string;
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {value}
        </p>
        <p className="mt-1 text-sm text-slate-400">{sub}</p>
      </div>
      <div className={`shrink-0 p-3 rounded-xl ${accent}`}>{icon}</div>
    </div>
  </div>
);

/** Cantidad de productos que se muestran por grupo en las alertas de stock. */
const STOCK_ALERT_PREVIEW_MAX = 5;

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
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Producto</TableHead>
        <TableHead>Categoría</TableHead>
        <TableHead className="text-right">Stock actual</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {products.map((product) => (
        <TableRow
          key={product.id}
          className="cursor-pointer"
          onClick={() => onSelect(product.id)}
        >
          <TableCell>
            <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
              {icon}
              <span>{product.name}</span>
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{product.category?.name ?? 'Sin categoría'}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Badge variant={badgeVariant}>{product.stock}</Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const MetricCardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
    <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
    <div className="h-8 w-36 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-700/60 rounded" />
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
          accent: 'bg-chart-1/15 text-chart-1',
        },
        {
          title: 'Ventas de la semana',
          value: formatARS(metrics.week.sales),
          sub: `${metrics.week.orders} ${metrics.week.orders === 1 ? 'ticket' : 'tickets'}`,
          icon: CalendarDays,
          accent: 'bg-chart-2/15 text-chart-2',
        },
        {
          title: 'Ventas del mes',
          value: formatARS(metrics.month.sales),
          sub: `${metrics.month.orders} ${metrics.month.orders === 1 ? 'ticket' : 'tickets'}`,
          icon: CalendarRange,
          accent: 'bg-chart-3/15 text-chart-3',
        },
        {
          title: 'Ticket promedio del mes',
          value: formatARS(metrics.avgTicket),
          sub: 'Promedio por venta confirmada',
          icon: Receipt,
          accent: 'bg-chart-4/15 text-chart-4',
        },
        {
          title: 'Ganancia del mes',
          value: formatARS(metrics.profitMonth),
          sub: 'Ventas menos costo de productos',
          icon: TrendingUp,
          accent: 'bg-chart-5/15 text-chart-5',
        },
      ]
    : [];

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      <AdminSidebar />

      <main className="flex-1 md:ml-[5rem] transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Dashboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Métricas de ventas confirmadas del negocio.
              </p>
            </div>
          </header>

          {/* Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <MetricCardSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800 rounded-2xl border border-red-200 dark:border-red-900/40">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <p className="text-slate-700 dark:text-slate-300 font-medium">{error}</p>
              <Button variant="outline" onClick={loadMetrics} className="mt-4">
                <RefreshCw className="size-4" />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
          <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-200 dark:border-slate-700">
              <TriangleAlert className="size-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Alertas de stock
              </h2>
            </div>

            {lowStockLoading ? (
              <div className="p-5 space-y-3 animate-pulse">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-11 rounded-lg bg-slate-100 dark:bg-slate-700" />
                ))}
              </div>
            ) : lowStockError ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
                <p className="text-slate-600 dark:text-slate-300 font-medium">{lowStockError}</p>
                <Button variant="outline" onClick={loadLowStock} className="mt-4">
                  <RefreshCw className="size-4" />
                  Reintentar
                </Button>
              </div>
            ) : stockAlerts.outOfStock.length === 0 && stockAlerts.lowStock.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-slate-600 dark:text-slate-300 font-medium">
                  ✅ Todo el stock está en buen nivel
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {stockAlerts.outOfStock.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
                      <div className="flex items-center gap-2">
                        <CircleX className="size-4 text-red-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Sin stock
                        </h3>
                        <Badge variant="danger">{stockAlerts.outOfStock.length}</Badge>
                      </div>
                      {stockAlerts.outOfStock.length > STOCK_ALERT_PREVIEW_MAX && (
                        <button
                          onClick={() => navigate('/admin/catalogo?stockFilter=out')}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Ver todos ({stockAlerts.outOfStock.length})
                        </button>
                      )}
                    </div>
                    <StockAlertTable
                      products={stockAlerts.outOfStock.slice(0, STOCK_ALERT_PREVIEW_MAX)}
                      icon={<CircleX className="size-4 text-red-500 shrink-0" />}
                      badgeVariant="danger"
                      onSelect={(id) => navigate(`/admin/catalogo?edit=${id}`)}
                    />
                  </div>
                )}
                {stockAlerts.lowStock.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-1">
                      <div className="flex items-center gap-2">
                        <TriangleAlert className="size-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Stock bajo
                        </h3>
                        <Badge variant="warning">{stockAlerts.lowStock.length}</Badge>
                      </div>
                      {stockAlerts.lowStock.length > STOCK_ALERT_PREVIEW_MAX && (
                        <button
                          onClick={() => navigate('/admin/catalogo?stockFilter=low')}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Ver todos ({stockAlerts.lowStock.length})
                        </button>
                      )}
                    </div>
                    <StockAlertTable
                      products={stockAlerts.lowStock.slice(0, STOCK_ALERT_PREVIEW_MAX)}
                      icon={<TriangleAlert className="size-4 text-amber-500 shrink-0" />}
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
