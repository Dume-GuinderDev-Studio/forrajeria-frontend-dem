import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DebtorsPage } from './DebtorsPage';
import { getDebts, markOrderAsPaid } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/orders.service', () => ({
  getDebts: vi.fn(),
  markOrderAsPaid: vi.fn(),
}));

const getDebtsMock = getDebts as unknown as Mock;
const markOrderAsPaidMock = markOrderAsPaid as unknown as Mock;

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  status: 'confirmed',
  customerName: 'María López',
  customerPhone: '11 2345-6789',
  paymentMethod: 'fiado',
  total: 20000,
  createdAt: '2024-03-05T10:30:00.000Z',
  confirmedAt: '2024-03-05T10:30:00.000Z',
  lines: [
    {
      id: 'l1',
      productId: 'p1',
      product: { id: 'p1', name: 'Alimento Perro 3kg' },
      quantity: 2,
      unitPrice: 10000,
      subtotal: 20000,
    },
  ],
  ...overrides,
});

const makeDebtor = (overrides: Record<string, unknown> = {}) => ({
  customerName: 'María López',
  customerPhone: '11 2345-6789',
  totalDebt: 45000,
  orders: [
    makeOrder({ id: 'o1', total: 20000 }),
    makeOrder({
      id: 'o2',
      total: 25000,
      createdAt: '2024-03-06T10:30:00.000Z',
      lines: [
        {
          id: 'l2',
          productId: 'p2',
          product: { id: 'p2', name: 'Alimento Gato 3kg' },
          quantity: 1,
          unitPrice: 25000,
          subtotal: 25000,
        },
      ],
    }),
  ],
  ...overrides,
});

const TWO_DEBTORS = () => [
  makeDebtor(),
  makeDebtor({
    customerName: 'Carlos Ruiz',
    customerPhone: null,
    totalDebt: 12000,
    orders: [makeOrder({ id: 'o3', total: 12000 })],
  }),
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/deudores']}>
      <DebtorsPage />
    </MemoryRouter>,
  );

/**
 * Con la tabla de desktop y las cards de mobile montadas a la vez, cada texto y
 * cada botón aparece DOS veces. Estos helpers acotan las consultas a una vista:
 * ningún selector global puede matchear las dos.
 *
 * OJO: hay que volver a llamarlos después de cada acción que dispare un refetch
 * (por ejemplo "Marcar como pagado"). La página entra en `loading`, eso desmonta
 * el <table> y la lista de cards, y React crea nodos nuevos: cualquier
 * `within` capturado antes queda apuntando a nodos muertos.
 */
const getTableView = async () => {
  await screen.findAllByText('María López');
  const table = document.querySelector('table');
  if (!table) throw new Error('No se encontró la tabla de desktop');
  return within(table as HTMLElement);
};

const findCardsList = (): HTMLElement => {
  const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'));
  if (!list) throw new Error('No se encontró la lista de cards de mobile');
  return list as HTMLElement;
};

const getCardsView = async () => {
  await waitFor(() => {
    findCardsList();
  });
  return within(findCardsList());
};

describe('DebtorsPage — vista de tabla (desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDebtsMock.mockResolvedValue(TWO_DEBTORS());
    markOrderAsPaidMock.mockResolvedValue(undefined);
  });

  it('lista las 5 columnas con sus datos', async () => {
    renderPage();
    const view = await getTableView();

    const headers = view.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Cliente',
      'Teléfono',
      'Órdenes pendientes',
      'Deuda total',
      'Acciones',
    ]);

    const row = view.getByText('María López').closest('tr') as HTMLElement;
    expect(row.textContent).toContain('11 2345-6789');
    expect(row.textContent).toContain('2 órdenes');
    expect(row.textContent).toContain(formatARS(45000));
  });

  it('el deudor sin teléfono muestra "Sin teléfono"', async () => {
    renderPage();
    const view = await getTableView();

    const row = view.getByText('Carlos Ruiz').closest('tr') as HTMLElement;
    expect(row.textContent).toContain('Sin teléfono');
    expect(row.textContent).toContain('1 orden');
    expect(row.textContent).toContain(formatARS(12000));
  });

  it('al expandir desde la tabla renderiza la tabla anidada de órdenes con sus 5 columnas', async () => {
    renderPage();
    const view = await getTableView();

    const row = view.getByText('María López').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Ver detalle' }));

    // La tabla de detalle es la segunda <table> del DOM.
    const nested = document.querySelectorAll('table')[1];
    expect(nested).toBeTruthy();
    const nestedView = within(nested as HTMLElement);

    const headers = nestedView.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Fecha', 'Items', 'Total', 'Estado', 'Acciones']);

    expect(nestedView.getByText('2')).toBeInTheDocument();
    // Ojo: formatARS usa espacio duro (U+00A0) y getByText no lo normaliza,
    // por eso los montos se assertan sobre textContent.
    expect((nested as HTMLElement).textContent).toContain(formatARS(20000));
    expect((nested as HTMLElement).textContent).toContain(formatARS(25000));
    expect(nestedView.getAllByText('Fiada')).toHaveLength(2);
    expect(nestedView.getAllByRole('button', { name: 'Marcar como pagado' })).toHaveLength(2);
  });
});

describe('DebtorsPage — vista de cards (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDebtsMock.mockResolvedValue(TWO_DEBTORS());
    markOrderAsPaidMock.mockResolvedValue(undefined);
  });

  it('renderiza una card por deudor con cliente, teléfono, badge de órdenes y deuda', async () => {
    renderPage();
    await getCardsView();

    const cards = Array.from(findCardsList().children) as HTMLElement[];
    expect(cards).toHaveLength(2);

    expect(cards[0].textContent).toContain('María López');
    expect(cards[0].textContent).toContain('11 2345-6789');
    expect(cards[0].textContent).toContain('2 órdenes');
    expect(cards[0].textContent).toContain(formatARS(45000));
    expect(within(cards[0]).getByRole('button', { name: 'Ver detalle' })).toBeInTheDocument();

    expect(cards[1].textContent).toContain('Carlos Ruiz');
    expect(cards[1].textContent).toContain('Sin teléfono');
    expect(cards[1].textContent).toContain('1 orden');
    expect(cards[1].textContent).toContain(formatARS(12000));
    // El selector global matchea las dos vistas: por eso el scoping anterior.
    expect(screen.getAllByText('Carlos Ruiz')).toHaveLength(2);
  });

  it('"Ver detalle" desde la card expande las órdenes como sublista, no como tabla', async () => {
    renderPage();
    const view = await getCardsView();

    await userEvent.click(view.getAllByRole('button', { name: 'Ver detalle' })[0]);

    // Tras expandir hay que volver a tomar la lista: el nodo pudo ser reemplazado.
    const cards = Array.from(findCardsList().children) as HTMLElement[];
    const card = cards[0];

    expect(within(card).getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
    // El detalle de mobile es una sublista, nunca una tabla anidada.
    expect(card.querySelector('table')).toBeNull();

    const orderItems = within(card).getAllByRole('listitem');
    expect(orderItems).toHaveLength(2);

    expect(orderItems[0].textContent).toContain('2');
    expect(orderItems[0].textContent).toContain(formatARS(20000));
    expect(within(orderItems[0]).getByText('Fiada')).toBeInTheDocument();
    expect(orderItems[0].textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    expect(within(orderItems[0]).getByRole('button', { name: 'Ver' })).toBeInTheDocument();
    expect(
      within(orderItems[0]).getByRole('button', { name: 'Marcar como pagado' }),
    ).toBeInTheDocument();
  });

  it('el deudor expandido sin órdenes muestra el mensaje de lista vacía', async () => {
    getDebtsMock.mockResolvedValue([
      makeDebtor({ customerName: 'Sin Órdenes', customerPhone: null, totalDebt: 0, orders: [] }),
    ]);
    renderPage();
    const view = await getCardsView();

    await userEvent.click(view.getByRole('button', { name: 'Ver detalle' }));

    const cards = Array.from(findCardsList().children) as HTMLElement[];
    expect(
      within(cards[0]).getByText('Este cliente no tiene órdenes fiadas pendientes.'),
    ).toBeInTheDocument();
  });

  it('"Marcar como pagado" desde la card llama al servicio y refresca la lista', async () => {
    renderPage();
    const view = await getCardsView();

    await userEvent.click(view.getAllByRole('button', { name: 'Ver detalle' })[0]);
    const orderItem = within((findCardsList().children[0] as HTMLElement)).getAllByRole(
      'listitem',
    )[0];
    await userEvent.click(within(orderItem).getByRole('button', { name: 'Marcar como pagado' }));

    await waitFor(() => {
      expect(markOrderAsPaidMock).toHaveBeenCalledWith('o1');
    });
    // El refetch vuelve a montar la lista de cards con los mismos 2 deudores.
    await waitFor(() => {
      expect(getDebtsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(Array.from(findCardsList().children)).toHaveLength(2);
    });
  });
});

describe('DebtorsPage — estados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markOrderAsPaidMock.mockResolvedValue(undefined);
  });

  it('sin deudores muestra el estado vacío de la página', async () => {
    getDebtsMock.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText('No hay deudas pendientes. Todos los clientes están al día.'),
    ).toBeInTheDocument();
    expect(document.querySelector('table')).toBeNull();
  });
});
