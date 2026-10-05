import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  buildPayableDebtDescription,
  calcPayableToSupplier,
  calcRowPayable,
  hasIncrementalPayable,
  covredUntilNowISO,
  SupplierProfitPage,
} from './SupplierProfitPage';
import { getProfitBySupplier } from '@/infrastructure/orders.service';
import { getSuppliers } from '@/infrastructure/suppliers.service';
import { createSupplierDebt } from '@/infrastructure/supplier-debts.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/orders.service', () => ({
  getProfitBySupplier: vi.fn(),
}));

vi.mock('@/infrastructure/suppliers.service', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('@/infrastructure/supplier-debts.service', () => ({
  createSupplierDebt: vi.fn(),
  getSupplierDebts: vi.fn(),
  getSupplierDebtsErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const getProfitBySupplierMock = getProfitBySupplier as unknown as Mock;
const getSuppliersMock = getSuppliers as unknown as Mock;
const createSupplierDebtMock = createSupplierDebt as unknown as Mock;

let writeTextMock: Mock;

const renderPage = () =>
  render(
<MemoryRouter>
  <SupplierProfitPage />
</MemoryRouter>,
  );

/**
 * Con la tabla de desktop y las cards de mobile en el DOM a la vez, los textos y
 * botones estan duplicados. Este helper acota las consultas a la tabla para que
 * ningun selector matchee las dos vistas.
 *
 * OJO: hay que volver a llamarlo despues de cada cambio de fecha. La pagina entra
 * en `loading`, eso desmonta el <table> y React crea uno nuevo; un `within`
 * capturado antes queda apuntando a un nodo muerto.
 */
const getTableView = async () => {
  await screen.findAllByText('MAJANO');
  const table = document.querySelector('table');
  if (!table) throw new Error('No se encontro la tabla de desktop');
  return within(table as HTMLElement);
};

/** El <ul> de cards de mobile, acotado para no matchear la tabla. */
const getCardsView = async () => {
  await screen.findAllByText('MAJANO');
  const list = document.querySelector('ul');
  if (!list) throw new Error('No se encontro la lista de cards de mobile');
  return within(list as HTMLElement);
};

describe('calcPayableToSupplier', () => {
  it('calcula venta menos ganancia (ej. $60.000 − $10.000 = $50.000)', () => {
expect(calcPayableToSupplier(60000, 10000)).toBe(50000);
  });

  it('tolera valores nulos o inválidos como 0', () => {
expect(calcPayableToSupplier(Number.NaN, 100)).toBe(-100);
expect(calcPayableToSupplier(50000, 0)).toBe(50000);
  });
});

describe('calcRowPayable', () => {
  it('usa el payableAmount incremental que manda el backend', () => {
// Venta 60000 − ganancia 10000 = 50000, pero 30000 ya están cubiertos por
// deudas previas: solo 20000 quedan pendientes de registrar.
expect(calcRowPayable({
  supplierId: 's1',
  supplierName: 'MAJANO',
  sales: 60000,
  profit: 10000,
  payableAmount: 20000,
})).toBe(20000);
  });

  it('cae a venta − ganancia cuando el backend no manda payableAmount', () => {
const base = { supplierId: 's1', supplierName: 'MAJANO', sales: 60000, profit: 10000 };
expect(calcRowPayable(base)).toBe(50000);
expect(calcRowPayable({ ...base, payableAmount: undefined })).toBe(50000);
// NaN no es un número válido: también cae al cálculo local.
expect(calcRowPayable({ ...base, payableAmount: Number.NaN })).toBe(50000);
  });

  it('respeta el 0 que manda el backend (nada pendiente)', () => {
expect(
  calcRowPayable({
supplierId: 's1',
supplierName: 'MAJANO',
sales: 60000,
profit: 10000,
payableAmount: 0,
  }),
).toBe(0);
  });
});

describe('covredUntilNowISO', () => {
  it('arma el instante actual en ISO con zona, no el fin del día', () => {
    const before = Date.now();
    const value = covredUntilNowISO();
    const after = Date.now();

    // Que sea un instante real, no el 23:59:59 del "Hasta": el backend descuenta
    // de la cobertura todo lo reconocido ANTES de este momento, así que un fin de
    // día tapaba las ventas hechas después de registrar la deuda.
    const ms = new Date(value).getTime();
    expect(Number.isNaN(ms)).toBe(false);
    expect(ms).toBeGreaterThanOrEqual(before - 1000);
    expect(ms).toBeLessThanOrEqual(after + 1000);
    expect(value).not.toContain('23:59:59');
  });

  it('deja pasar a la una venta registrada un minuto después', () => {
    // El caso reportado: deuda registrada a las 22:51, venta a las 22:55. Con
    // fin de día la venta quedaba cubierta y el pendiente volvía a cero.
    const covredUntil = covredUntilNowISO();
    const ventaPosterior = new Date(new Date(covredUntil).getTime() + 4 * 60 * 1000);

    // Esta es la comparación que hace el backend.
    expect(ventaPosterior.getTime() > new Date(covredUntil).getTime()).toBe(true);
  });
});

describe('buildPayableDebtDescription', () => {
  it('arma la descripción con el rango exacto', () => {
expect(buildPayableDebtDescription('MAJANO', '2026-09-01', '2026-09-13')).toBe(
  'Saldo MAJANO (2026-09-01 al 2026-09-13)',
);
  });
});

describe('SupplierProfitPage', () => {
  beforeEach(() => {
vi.clearAllMocks();
// payableAmount manda el incremental pendiente, no el total venta − ganancia.
getProfitBySupplierMock.mockResolvedValue([
  {
supplierId: 's1',
supplierName: 'MAJANO',
sales: 60000,
profit: 10000,
payableAmount: 20000,
lastCovredUntil: '2026-09-10T23:59:59.999-03:00',
  },
]);
getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('muestra el incremental pendiente en la fila y en el total', async () => {
renderPage();

// Encabezado de la columna.
expect(await screen.findByText('A pagar al proveedor')).toBeInTheDocument();

const view = await getTableView();
const row = view.getByText('MAJANO').closest('tr');
// La celda comparte texto con el botón de copiar: se asserta sobre textContent.
expect(row?.textContent).toContain(formatARS(20000));
expect(row?.textContent).not.toContain(formatARS(50000));

// El total "A pagar" es la suma de los incrementales por fila.
const totalRow = view.getByText('Total').closest('tr');
expect(totalRow?.textContent).toContain(formatARS(20000));
  });

  it('el botón de copiar escribe el incremental pendiente al portapapeles', async () => {
const user = userEvent.setup();
renderPage();

const view = await getTableView();
// user-event reemplaza navigator.clipboard en setup(): re-aplicar el mock
// justo antes del click para que el componente lo use.
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  configurable: true,
  writable: true,
});
await user.click(view.getByRole('button', { name: 'Copiar monto a pagar a MAJANO' }));

expect(writeTextMock).toHaveBeenCalledWith(formatARS(20000));
expect(await screen.findByTitle('¡Copiado!')).toBeInTheDocument();
  });

  it('el botón muestra el monto a registrar y abre el modal con ese incremental', async () => {
const user = userEvent.setup();
renderPage();

const view = await getTableView();
const button = view.getByRole('button', { name: `Registrar deuda (${formatARS(20000)})` });
expect(button).toBeEnabled();
await user.click(button);

// Modal abierto con monto y descripción pre-cargados.
expect(await screen.findByText('Nueva deuda')).toBeInTheDocument();
expect(screen.getByPlaceholderText('Ej: 50000')).toHaveValue(20000);
expect(
  (screen.getByPlaceholderText('Ej: Mercadería del 10/9') as HTMLInputElement).value,
).toContain('MAJANO');
  });

  it('crea la deuda con el monto incremental y el covredUntil del período', async () => {
const user = userEvent.setup();
renderPage();

const view = await getTableView();
await user.click(view.getByRole('button', { name: `Registrar deuda (${formatARS(20000)})` }));
await user.click(await screen.findByRole('button', { name: 'Crear deuda' }));

expect(createSupplierDebtMock).toHaveBeenCalledWith({
  supplierId: 's1',
  description: expect.stringContaining('MAJANO'),
  totalAmount: 20000,
  // Instante de la confirmación, no el fin del día del "Hasta": si se mandara
  // 23:59:59, una venta hecha después de registrar la deuda queda tapada.
  covredUntil: expect.any(String),
});
  });

  it('con payableAmount 0 muestra "Ya registrado" deshabilitado y sin monto', async () => {
getProfitBySupplierMock.mockResolvedValue([
  {
supplierId: 's1',
supplierName: 'MAJANO',
sales: 60000,
profit: 10000,
payableAmount: 0,
lastCovredUntil: '2026-09-10T23:59:59.999-03:00',
  },
]);
renderPage();

const view = await getTableView();
const button = view.getByRole('button', { name: 'Ya registrado' });
expect(button).toBeDisabled();
// Sin monto en el label y sin ninguna acción para registrar igual.
expect(button.textContent).not.toContain('$');
expect(view.queryByRole('button', { name: /Registrar deuda/ })).not.toBeInTheDocument();
expect(screen.queryByText('Registrar igual')).not.toBeInTheDocument();

// La venta del período ya está cubierta: el total a pagar también es 0.
const totalRow = view.getByText('Total').closest('tr');
expect(totalRow?.textContent).toContain(formatARS(0));
  });

  it('sin payableAmount el monto se sigue viendo pero la fila no es registrable', async () => {
// Backends viejos que no mandan payableAmount: el número aparece para consultarlo,
// pero la fila no ofrece registrar. Antes sí lo hacía, y como ese número no
// descuenta deudas previas permitía cargar la misma deuda otra vez (R3-CRITICAL).
getProfitBySupplierMock.mockResolvedValue([
  { supplierId: 's1', supplierName: 'MAJANO', sales: 60000, profit: 10000 },
]);
renderPage();

const view = await getTableView();
const row = view.getByText('MAJANO').closest('tr');
expect(row?.textContent).toContain(formatARS(50000));
expect(within(row as HTMLElement).queryByRole('button', { name: /Registrar deuda/ })).toBeNull();
  });
});

/**
 * Vista de cards de mobile: un <li> por proveedor con sus montos etiquetados y
 * las mismas acciones que la fila de la tabla.
 */
describe('SupplierProfitPage - vista de cards (mobile)', () => {
  beforeEach(() => {
vi.clearAllMocks();
getProfitBySupplierMock.mockResolvedValue([
  {
supplierId: 's1',
supplierName: 'MAJANO',
sales: 60000,
profit: 10000,
payableAmount: 20000,
  },
]);
getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('la card muestra el proveedor y los tres montos etiquetados', async () => {
renderPage();

const cards = await getCardsView();
const items = cards.getAllByRole('listitem');
expect(items).toHaveLength(2); // MAJANO + la fila de totales

expect(items[0]).toHaveTextContent('MAJANO');
expect(items[0]).toHaveTextContent('Venta');
expect(items[0]).toHaveTextContent('Mi ganancia');
expect(items[0]).toHaveTextContent('A pagar');

// formatARS devuelve un espacio duro: se compara sobre el textContent.
expect(items[0].textContent).toContain(formatARS(60000));
expect(items[0].textContent).toContain(formatARS(10000));
expect(items[0].textContent).toContain(formatARS(20000));
  });

  it('el botón de la card copia el incremental pendiente', async () => {
const user = userEvent.setup();
renderPage();

// user-event reemplaza navigator.clipboard en setup(): re-aplicar el mock.
Object.defineProperty(window.navigator, 'clipboard', {
  value: { writeText: writeTextMock },
  configurable: true,
  writable: true,
});
const cards = await getCardsView();
await user.click(cards.getByRole('button', { name: 'Copiar monto a pagar a MAJANO' }));

expect(writeTextMock).toHaveBeenCalledWith(formatARS(20000));
expect(await screen.findByTitle('¡Copiado!')).toBeInTheDocument();
  });

  it('desde la card se registra el incremental con su covredUntil', async () => {
const user = userEvent.setup();
renderPage();

const cards = await getCardsView();
await user.click(
  cards.getByRole('button', { name: `Registrar deuda (${formatARS(20000)})` }),
);

expect(await screen.findByText('Nueva deuda')).toBeInTheDocument();
expect(screen.getByPlaceholderText('Ej: 50000')).toHaveValue(20000);

await user.click(screen.getByRole('button', { name: 'Crear deuda' }));
expect(createSupplierDebtMock).toHaveBeenCalledWith({
  supplierId: 's1',
  description: expect.stringContaining('MAJANO'),
  totalAmount: 20000,
  // Instante de la confirmación, no el fin del día del "Hasta": si se mandara
  // 23:59:59, una venta hecha después de registrar la deuda queda tapada.
  covredUntil: expect.any(String),
});
  });

  it('con payableAmount 0 la card muestra "Ya registrado" sin monto', async () => {
getProfitBySupplierMock.mockResolvedValue([
  {
supplierId: 's1',
supplierName: 'MAJANO',
sales: 60000,
profit: 10000,
payableAmount: 0,
  },
]);
renderPage();

const cards = await getCardsView();
const button = cards.getByRole('button', { name: 'Ya registrado' });
expect(button).toBeDisabled();
expect(button.textContent).not.toContain('$');
expect(cards.queryByRole('button', { name: /Registrar deuda/ })).not.toBeInTheDocument();
expect(screen.queryByText('Registrar igual')).not.toBeInTheDocument();
  });

  it('la tabla de desktop conserva sus 5 columnas junto a las cards', async () => {
renderPage();

const view = await getTableView();
expect(view.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
  'Proveedor',
  'Venta del período',
  'Mi ganancia',
  'A pagar al proveedor',
  'Acciones',
]);

// Las dos vistas están montadas a la vez: mismo proveedor, dos veces.
expect(screen.getAllByText('MAJANO')).toHaveLength(2);
  });
});
describe('SupplierProfitPage — fila sin proveedor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El backend agrupa en un bucket las ventas de productos sin marca: esa fila
    // viene con supplierId null y no hay a quién cobrarle.
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: null,
        supplierName: 'Sin proveedor',
        sales: 12000,
        profit: 3000,
        payableAmount: 9000,
      },
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
        payableAmount: 20000,
      },
    ]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
    createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('no muestra el botón Registrar deuda en la fila sin proveedor', async () => {
    renderPage();

    const view = await getTableView();
    const row = view.getByText('Sin proveedor').closest('tr');
    // El monto a pagar se sigue mostrando: lo que no existe es la acción.
    expect(row?.textContent).toContain(formatARS(9000));
    expect(within(row as HTMLElement).queryByRole('button', { name: /Registrar deuda/ })).toBeNull();
  });

  it('deja el botón Registrar deuda en las filas con proveedor real', async () => {
    renderPage();

    const view = await getTableView();
    const row = view.getByText('MAJANO').closest('tr');
    expect(
      within(row as HTMLElement).getByRole('button', { name: /Registrar deuda/ }),
    ).toBeInTheDocument();
  });

  it('no abre el modal de deuda desde la fila sin proveedor', async () => {
    renderPage();

    const view = await getTableView();
    const row = view.getByText('Sin proveedor').closest('tr');
    // Aunque se intente disparar la acción, no hay modal ni deuda: sin proveedor
    // real no hay a quién asociarle el pago.
    within(row as HTMLElement).queryByRole('button', { name: /Registrar deuda/ })?.click();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(createSupplierDebtMock).not.toHaveBeenCalled();
  });
});

describe('SupplierProfitPage — redondeo del monto a pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // payableAmount sin redondear: es lo que llega si el backend no aplica roundTo2.
    // La fila es registrable porque el campo viene presente.
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 11000.1,
        profit: 6413.9,
        payableAmount: 4586.200000000001,
      },
    ]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
    createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('el fallback venta − ganancia devuelve centavos, no decimales flotantes', () => {
    expect(calcPayableToSupplier(11000.1, 6413.9)).toBe(4586.2);
  });

  it('calcRowPayable redondea también el payableAmount que manda el backend', () => {
    expect(
      calcRowPayable({
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 1,
        profit: 1,
        payableAmount: 4586.200000000001,
      }),
    ).toBe(4586.2);
  });

  it('el modal precarga el monto ya redondeado a 2 decimales', async () => {
    renderPage();

    const view = await getTableView();
    await userEvent.setup().click(
      view.getByRole('button', { name: `Registrar deuda (${formatARS(4586.2)})` }),
    );

    const amount = (await screen.findByPlaceholderText('Ej: 50000')) as HTMLInputElement;
    // El backend rechaza con 400 cualquier totalAmount con más de 2 decimales.
    expect(amount.value).toBe('4586.2');
  });

  it('crea la deuda con el monto redondeado aunque el usuario edite el campo', async () => {
    const user = userEvent.setup();
    renderPage();

    const view = await getTableView();
    await user.click(view.getByRole('button', { name: `Registrar deuda (${formatARS(4586.2)})` }));

    const amount = await screen.findByPlaceholderText('Ej: 50000');
    // El campo es editable: si el usuario reintroduce el valor con la cola de
    // flotante, el payload igual debe ir limpio.
    await user.clear(amount);
    await user.type(amount, '4586.200000000001');

    await user.click(screen.getByRole('button', { name: 'Crear deuda' }));

    await waitFor(() => expect(createSupplierDebtMock).toHaveBeenCalled());
    expect(createSupplierDebtMock).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 4586.2 }),
    );
  });
});

describe('SupplierProfitPage — sin payableAmount no se puede registrar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Backend anterior a payableAmount: la vista cae al fallback venta − ganancia.
    // Ese número no descuenta las deudas ya registradas, así que ofrecer el botón
    // permitía cargar la misma deuda una y otra vez (hallazgo R3-CRITICAL).
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
      },
      {
        supplierId: 's2',
        supplierName: 'RUMA',
        sales: 20000,
        profit: 5000,
        payableAmount: 15000,
      },
    ]);
    getSuppliersMock.mockResolvedValue([
      { id: 's1', name: 'MAJANO' },
      { id: 's2', name: 'RUMA' },
    ]);
    createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('la fila sin payableAmount no muestra el botón Registrar deuda', async () => {
    renderPage();

    const view = await getTableView();
    const row = view.getByText('MAJANO').closest('tr');
    // El monto sigue a la vista para poder consultarlo...
    expect(row?.textContent).toContain(formatARS(50000));
    // ...pero no hay acción.
    expect(within(row as HTMLElement).queryByRole('button', { name: /Registrar deuda/ })).toBeNull();
    expect(within(row as HTMLElement).getByText('No disponible')).toBeInTheDocument();
  });

  it('las filas con payableAmount siguen pudiendo registrar', async () => {
    renderPage();

    const view = await getTableView();
    const row = view.getByText('RUMA').closest('tr');
    expect(
      within(row as HTMLElement).getByRole('button', { name: /Registrar deuda/ }),
    ).toBeInTheDocument();
  });

  it('hasIncrementalPayable distingue con y sin payableAmount del backend', () => {
    const base = { supplierId: 's1', supplierName: 'MAJANO', sales: 60000, profit: 10000 };
    expect(hasIncrementalPayable(base)).toBe(false);
    expect(hasIncrementalPayable({ ...base, payableAmount: 50000 })).toBe(true);
    // 0 viene del backend y es un valor válido: "ya registrado", no "no disponible".
    expect(hasIncrementalPayable({ ...base, payableAmount: 0 })).toBe(true);
  });
});
