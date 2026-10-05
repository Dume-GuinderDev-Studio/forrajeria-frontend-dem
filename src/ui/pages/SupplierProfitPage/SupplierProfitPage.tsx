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
import { formatARS, roundToCents } from '@/lib/format';
import { CopyAmountButton } from '@/ui/components/CopyAmountButton';
import styles from './SupplierProfitPage.module.css';
import {
  SupplierDebtDialog,
  type SupplierDebtInitials,
} from '@/ui/components/SupplierDebtDialog';

/**
 * A pagar al proveedor = venta del período − ganancia del período.
 * Ej. venta $60.000 y ganancia $10.000 → a pagar $50.000.
 *
 * El redondeo a centavos NO es cosmético: la resta de dos números de coma
 * flotante puede dar 4586.200000000001, y `CreateSupplierDebtDto.totalAmount` es
 * `@IsNumber({ maxDecimalPlaces: 2 })`, así que el backend lo rechaza con un 400
 * que el front reporta como "No se pudo registrar la deuda".
 */
export const calcPayableToSupplier = (sales: number, profit: number): number =>
  roundToCents((Number(sales) || 0) - (Number(profit) || 0));

/**
 * Descripción determinística con la que se registra la deuda de una fila
 * (codifica el rango exacto del período). Es la que se pre-carga en el modal de
 * Nueva deuda.
 */
export const buildPayableDebtDescription = (
  supplierName: string,
  from: string,
  to: string,
): string => `Saldo ${supplierName} (${from} al ${to})`;

/**
 * Monto pendiente de registrar para una fila. El backend ya lo calcula como el
 * costo de las ventas NO cubiertas por deudas previas (`payableAmount`); el
 * fallback local (venta − ganancia) se usa solo contra backends viejos que no
 * lo envían.
 */
export const calcRowPayable = (row: SupplierProfit): number =>
  Number.isFinite(row.payableAmount)
    ? roundToCents(row.payableAmount as number)
    : calcPayableToSupplier(row.sales, row.profit);

/**
 * ¿El backend Calculó el pendiente incremental de esta fila?
 *
 * `false` = el backend es anterior a `payableAmount` y la vista está mostrando
 * venta − ganancia del período completo, sin descontar las deudas ya
 * registradas. Ese número sirve para INFORMAR, pero no para registrar: usarlo
 * como "a registrar" permita volver a cargar la misma deuda todas las veces que
 * se quisiera, porque nadie descuenta la cobertura previa.
 *
 * Por eso, sin `payableAmount` la fila no ofrece "Registrar deuda". El
 * descuento por cobertura tiene que quedar en el servidor: es el único que
 * sabe qué parte del período ya quedó cubierta por deudas vigentes.
 */
export const hasIncrementalPayable = (row: SupplierProfit): boolean =>
  Number.isFinite(row.payableAmount);

/**
 * Momento hasta el que cubre la deuda que se está registrando.
 *
 * Se manda el INSTANTE de la confirmación, no el fin del día del "Hasta". El
 * backend descuenta de la cobertura toda venta reconocida antes de este
 * instante, así que mandar 23:59:59 hacía que una venta del mismo día, hecha
 * DESPUÉS de registrar la deuda, quedara como ya cubierta sin que nadie la
 * hubiera registrado: el pendiente volvía a 0 y la fila decía "Ya registrado".
 *
 * Mandar el instante además mejora el caso del período a futuro: si se está
 * revisando hasta el 31/10 y hoy es 20/10, las ventas del 21 al 31 no quedan
 * tapadas por una cobertura que todavía no existía cuando se registró.
 *
 * Se manda en ISO con zona (UTC), que es lo que espera la columna timestamptz.
 */
export const covredUntilNowISO = (): string => new Date().toISOString();

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
    // El total "A pagar" es la suma de los pendientes reales por fila: así
    // coincide exactamente con lo que el usuario puede registrar.
    const payable = rows.reduce((sum, row) => sum + calcRowPayable(row), 0);
    return { sales, profit, payable };
  }, [rows]);

  /**
   * Id real del proveedor de la fila, o `null` si a esa fila no se le puede
   * registrar una deuda.
   *
   * Solo hay una forma válida: que la fila traiga un `supplierId` que exista en
   * la lista de proveedores. El fallback por nombre que había antes era el que
   * terminaba colgándole la deuda de "Sin proveedor" a un proveedor real: si el
   * id no resuelve, esa fila no tiene a quién cobrarle y se devuelve `null`.
   */
  const resolveRowSupplierId = (row: SupplierProfit): string | null => {
    if (!row.supplierId) return null;
    return suppliers.some((supplier) => supplier.id === row.supplierId) ? row.supplierId : null;
  };

  // Abre el modal de Nueva deuda pre-cargado con el proveedor de la fila, el
  // monto pendiente real y la fecha de cobertura del período. El usuario revisa
  // y confirma en el formulario.
  const openDebtForRow = (row: SupplierProfit) => {
    const supplierId = resolveRowSupplierId(row);
    // Cinturón y tirantes: sin proveedor real no hay deuda que registrar. La fila
    // tampoco muestra el botón, pero si algún otro camino llegara acá no debe
    // abrir un modal al que no se le puede asociar ningún proveedor.
    if (!supplierId) return;
    if (!hasIncrementalPayable(row)) return;
    const payable = calcRowPayable(row);
    setDebtInitials({
      supplierId,
      description: buildPayableDebtDescription(row.supplierName, from, to),
      totalAmount: String(payable),
      // Cubre lo vendido hasta ahora, no todo el día: una venta hecha después de
      // registrar la deuda tiene que volver a aparecer como pendiente.
      covredUntil: covredUntilNowISO(),
    });
  };

  return (
    <div className={styles.root}>
      <AdminSidebar />

      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Rendición por proveedor</h1>
              <p className={styles.subtitle}>
                Venta y ganancia total de cada proveedor en el período seleccionado.
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
                  <p className={styles.statLabel}>Mi ganancia del período</p>
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
              <p>Cargando rendición por proveedor...</p>
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
              <Truck className={styles.stateIcon} />
              <p>No hay ventas con proveedor asignado en el período seleccionado.</p>
            </div>
          ) : (
            <>
            {/* Mobile: una card por proveedor. La tabla de desktop queda debajo. */}
            <ul className={styles.cardList}>
              {rows.map((row) => {
                    const payable = calcRowPayable(row);
                return (
                  <li key={row.supplierId || row.supplierName} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardName} title={row.supplierName}>
                        {row.supplierName}
                      </div>
                      <div className={styles.cardActions}>
                            <ProfitRowActions row={row} supplierId={resolveRowSupplierId(row)} onRegister={openDebtForRow} />
                      </div>
                    </div>

                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetric}>
                        <span className={styles.cardLabel}>Venta</span>
                        {formatARS(row.sales)}
                      </span>
                      <span className={styles.cardMetric}>
                        <span className={styles.cardLabel}>Mi ganancia</span>
                        {formatARS(row.profit)}
                      </span>
                      <span className={[styles.cardMetric, styles.cardPayable].filter(Boolean).join()}>
                        <span className={styles.cardLabel}>A pagar</span>
                        {formatARS(payable)}
                        <CopyAmountButton
                          value={formatARS(payable)}
                          label={`Copiar monto a pagar a ${row.supplierName}`}
                        />
                      </span>
                    </div>
                  </li>
                );
              })}
              <li className={[styles.card, styles.cardTotalRow].filter(Boolean).join()}>
                <span className={styles.cardLabel}>Total</span>
                <span>{formatARS(totals.sales)}</span>
                <span>{formatARS(totals.profit)}</span>
                <span>{formatARS(totals.payable)}</span>
              </li>
            </ul>

            <div className={styles.tableDesktop}>
            <div className={styles.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className={styles.cellRight}>Venta del período</TableHead>
                    <TableHead className={styles.cellRight}>Mi ganancia</TableHead>
                    <TableHead className={styles.cellRight}>A pagar al proveedor</TableHead>
                    <TableHead className={styles.cellRight}>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const payable = calcRowPayable(row);
                    return (
                      <TableRow key={row.supplierId || row.supplierName}>
                        <TableCell className={styles.cellName}>
                          <div className={styles.cellNameText} title={row.supplierName}>
                            {row.supplierName}
                          </div>
                        </TableCell>
                        <TableCell className={styles.cellRight}>{formatARS(row.sales)}</TableCell>
                        <TableCell className={styles.cellProfit}>{formatARS(row.profit)}</TableCell>
                        <TableCell className={styles.cellPayable}>
                          <span className={styles.payableInline}>
                            {formatARS(payable)}
                            <CopyAmountButton
                              value={formatARS(payable)}
                              label={`Copiar monto a pagar a ${row.supplierName}`}
                            />
                          </span>
                        </TableCell>
                        <TableCell className={styles.cellRight}>
                              <ProfitRowActions row={row} supplierId={resolveRowSupplierId(row)} onRegister={openDebtForRow} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className={styles.totalRow}>
                    <TableCell className={styles.totalName}>Total</TableCell>
                    <TableCell className={styles.cellRight}>{formatARS(totals.sales)}</TableCell>
                    <TableCell className={styles.totalProfit}>{formatARS(totals.profit)}</TableCell>
                    <TableCell className={styles.cellRight}>{formatARS(totals.payable)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            </div>
            </>
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
        // Tras crear la deuda se recarga la rendición: el backend ya descuenta
        // lo cubierto y la fila pasa a "Ya registrado" sin tocar nada.
        onCreated={loadProfit}
      />
    </div>
  );
};

interface ProfitRowActionsProps {
  row: SupplierProfit;
  onRegister: (row: SupplierProfit) => void;
  /** Id del proveedor de la fila, o null si a la fila no se le puede cobrar. */
  supplierId: string | null;
}

/**
 * Acciones de la fila. Compartidas por la tabla y la card de mobile.
 * El estado depende SOLO del monto pendiente: si no queda nada incremental
 * por registrar, la venta del período ya está cubierta y no hay nada más
 * que registrar para ese proveedor.
*/
const ProfitRowActions = ({ row, onRegister, supplierId }: ProfitRowActionsProps) => {
  const payable = calcRowPayable(row);
  // El bucket "Sin proveedor" agrupa ventas de productos sin marca: no hay
  // ninguna persona a la que se le pueda cobrar, así que no hay deuda que
  // registrar. Mostrar el botón ahí era la vía para colgarle la deuda al
  // proveedor que estuviera primero en el selector del modal.
  if (!supplierId) {
    return (
      <span className={styles.sinProveedor} title="No hay proveedor al que registrarle una deuda">
        No aplica
      </span>
    );
  }
  // Sin payableAmount el monto es venta − ganancia del período completo, sin
  // descontar deudas previas: no es lo que hay que registrar hoy. Mostrar el
  // botón ahí habilitaba cargar la misma deuda una y otra vez (R3-CRITICAL).
  if (!hasIncrementalPayable(row)) {
    return (
      <span
        className={styles.sinProveedor}
        title="Tu backend todavía no envía el saldo pendiente. Actualizalo para poder registrar deudas desde acá."
      >
        No disponible
      </span>
    );
  }
  if (payable <= 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Check className={styles.checkIcon} />
        Ya registrado
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={() => onRegister(row)}>
      Registrar deuda ({formatARS(payable)})
    </Button>
  );
};
