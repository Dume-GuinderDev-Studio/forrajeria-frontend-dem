import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminOrdersPage } from './AdminOrdersPage';
import {
  getOrders,
  cancelOrder,
  confirmOrder,
  type Order,
  type OrderStatus,
} from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/orders.service', async () => {
  const actual =
    await vi.importActual<typeof import('@/infrastructure/orders.service')>(
      '@/infrastructure/orders.service',
    );
  return {
    ...actual,
    getOrders: vi.fn(),
    confirmOrder: vi.fn(),
    cancelOrder: vi.fn(),
  };
});

const getOrdersMock = getOrders as unknown as Mock;
const confirmOrderMock = confirmOrder as unknown as Mock;
const cancelOrderMock = cancelOrder as unknown as Mock;

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'o1',
  status: 'pending' as OrderStatus,
  customerName: 'Ana Gómez',
  customerPhone: '11 1234-5678',
  paymentMethod: 'efectivo',
  total: 15000,
  createdAt: '2024-05-01T10:00:00.000Z',
  confirmedAt: null,
  lines: [
    {
      id: 'l1',
      productId: 'p1',
      product: { id: 'p1', name: 'Alimento Perro Adulto 3kg' },
      quantity: 1,
      unitPrice: 15000,
      subtotal: 15000,
    },
  ],
  ...overrides,
});

const mockOrders = (orders: Order[]) => {
  getOrdersMock.mockResolvedValue({
    data: orders,
    meta: { page: 1, limit: 10, total: orders.length },
  });
};

/** La página usa Link/selectores de ruta, así que siempre va dentro de un router. */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <AdminOrdersPage />
    </MemoryRouter>,
  );

/**
 * La <ul> de cards de mobile. Cada <li> es role="button", así que la <ul> pierde
 * el rol `list` implícito de la a11y tree: la localizamos por estructura.
 */
const getCardList = async () => {
  // El nombre del cliente aparece en la card y en la tabla: alcanza con esperar la carga.
  await screen.findAllByText('Ana Gómez');
  const list = Array.from(document.querySelectorAll('ul')).find((ul) =>
    ul.querySelector('li')?.getAttribute('role') === 'button',
  );
  if (!list) throw new Error('No se encontró la lista de cards de mobile');
  return list;
};

/** Espera a que la página termine de cargar las órdenes. */
const waitForOrders = () => screen.findAllByText('Ana Gómez');

/** Las cards de mobile, en el mismo orden que `orders`. */
const getCards = async () => Array.from((await getCardList()).querySelectorAll('li'));

describe('AdminOrdersPage - vista mobile con cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza un <li> por orden', async () => {
    mockOrders([
      makeOrder({ id: 'o1' }),
      makeOrder({ id: 'o2', customerName: 'Bruno Díaz' }),
      makeOrder({ id: 'o3', customerName: 'Carla Ruiz' }),
    ]);
    renderPage();

    const cards = await getCards();
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Ana Gómez');
    expect(cards[2]).toHaveTextContent('Carla Ruiz');
  });

  it('conserva la tabla de desktop con sus 7 columnas', async () => {
    mockOrders([makeOrder()]);
    renderPage();

    await waitForOrders();
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Fecha',
      'Cliente',
      'Items',
      'Total',
      'Método de pago',
      'Estado',
      'Acciones',
    ]);
  });

  it('renderiza la paginación una sola vez, fuera de ambos wrappers', async () => {
    mockOrders([makeOrder()]);
    renderPage();

    const cardList = await getCardList();
    const pagers = screen.getAllByText(/1\s+orden/);
    expect(pagers).toHaveLength(1);

    // El pager cuelga del mismo wrapper que la lista de cards y la tabla:
    // se renderiza una vez y sirve a las dos vistas.
    const wrapper = cardList.parentElement as HTMLElement;
    expect(wrapper).toContainElement(cardList);
    expect(wrapper).toContainElement(screen.getByRole('table'));
    expect(screen.getByText(/1\s+orden/)).toBeInTheDocument();
  });

  it('abre el detalle de la orden al clickear "Ver" desde la card', async () => {
    mockOrders([makeOrder({ id: 'o1' }), makeOrder({ id: 'o2', customerName: 'Bruno Díaz' })]);
    renderPage();

    const cards = await getCards();
    await userEvent.click(within(cards[1]).getByRole('button', { name: /Ver/ }));

    expect(await screen.findByRole('heading', { name: 'Detalle de la orden' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Bruno Díaz/)).toBeInTheDocument();
  });

  it('abre el detalle al activar la card con teclado', async () => {
    mockOrders([makeOrder()]);
    renderPage();

    const card = (await getCards())[0];
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabindex', '0');

    card.focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Detalle de la orden' })).toBeInTheDocument();
  });

  it('muestra "Confirmar venta" sólo en órdenes pendientes', async () => {
    mockOrders([
      makeOrder({ id: 'o1', status: 'pending' }),
      makeOrder({ id: 'o2', status: 'confirmed', customerName: 'Bruno Díaz' }),
    ]);
    renderPage();

    const cards = await getCards();
    expect(within(cards[0]).getByRole('button', { name: /Confirmar venta/ })).toBeInTheDocument();
    expect(within(cards[1]).queryByRole('button', { name: /Confirmar venta/ })).toBeNull();
  });

  it('abre el diálogo de confirmación desde el botón de la card pendiente', async () => {
    mockOrders([makeOrder({ id: 'o1', status: 'pending' })]);
    renderPage();

    const card = (await getCards())[0];
    await userEvent.click(within(card).getByRole('button', { name: /Confirmar venta/ }));

    // El botón de la card frena la propagación: si no, además abriría el detalle.
    expect(await screen.findByRole('heading', { name: 'Confirmar venta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Detalle de la orden' })).toBeNull();
  });

  it('muestra el badge Cancelada y marca data-cancelled en la card cancelada', async () => {
    mockOrders([
      makeOrder({ id: 'o1', status: 'cancelled', customerName: 'Ana Gómez' }),
      makeOrder({ id: 'o2', status: 'confirmed', customerName: 'Bruno Díaz' }),
    ]);
    renderPage();

    const cards = await getCards();
    expect(within(cards[0]).getByText('Cancelada')).toBeInTheDocument();
    expect(cards[0]).toHaveAttribute('data-cancelled', 'true');
    expect(cards[1]).toHaveAttribute('data-cancelled', 'false');
  });
});

/**
 * Contenido y acciones de la card de mobile más allá del renderizado: los datos
 * de la orden, el detalle que abre y las acciones que dispara.
 */
describe('AdminOrdersPage - cards de mobile: contenido y acciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmOrderMock.mockResolvedValue({ status: 'confirmed' });
    cancelOrderMock.mockResolvedValue({ status: 'cancelled' });
  });

  it('la card muestra cliente, teléfono, items, método de pago y total', async () => {
    mockOrders([
      makeOrder({
        id: 'o1',
        lines: [
          ...makeOrder().lines!,
          {
            id: 'l2',
            productId: 'p2',
            product: { id: 'p2', name: 'Juguete Gato' },
            quantity: 2,
            unitPrice: 1000,
            subtotal: 2000,
          },
        ],
      }),
    ]);
    renderPage();

    const card = (await getCards())[0];
    expect(card).toHaveTextContent('Ana Gómez');
    expect(card).toHaveTextContent('11 1234-5678');
    expect(card).toHaveTextContent('2 items');
    expect(card).toHaveTextContent('Efectivo');
    // formatARS mete un espacio duro: se compara sobre el textContent.
    expect(card.textContent).toContain(formatARS(15000));
  });

  it('el detalle abierto desde la card lista las líneas de la orden', async () => {
    mockOrders([makeOrder()]);
    renderPage();

    const card = (await getCards())[0];
    await userEvent.click(within(card).getByRole('button', { name: /Ver/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Alimento Perro Adulto 3kg')).toBeInTheDocument();
    expect(within(dialog).getByText('Total')).toBeInTheDocument();
  });

  it('desde la card de una venta confirmada se puede cancelar la orden', async () => {
    mockOrders([makeOrder({ id: 'o1', status: 'confirmed' })]);
    renderPage();

    const card = (await getCards())[0];
    // En una venta confirmada la card no ofrece "Confirmar venta".
    expect(within(card).queryByRole('button', { name: /Confirmar venta/ })).toBeNull();

    await userEvent.click(within(card).getByRole('button', { name: /Ver/ }));
    const detail = await screen.findByRole('dialog');
    await userEvent.click(within(detail).getByRole('button', { name: /Cancelar venta/ }));

    expect(
      await screen.findByRole('heading', { name: 'Cancelar venta' }),
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText('Ej. el cliente pidió la devolución...'),
      'Se devolvió',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(cancelOrderMock).toHaveBeenCalledWith('o1', 'Se devolvió');
        // Postcondicion: el refetch tiene que dejar el badge en Cancelada.
        const updated = (await getCards())[0];
        expect(within(updated).getByText('Cancelada')).toBeInTheDocument();
  });

  it('confirmar desde la card deja el badge de la orden en Confirmada', async () => {
    mockOrders([makeOrder({ id: 'o1', status: 'pending' })]);
    renderPage();

    const card = (await getCards())[0];
    await userEvent.click(within(card).getByRole('button', { name: /Confirmar venta/ }));

    const confirmDialog = await screen.findByRole('dialog');
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Confirmar' }));

    expect(confirmOrderMock).toHaveBeenCalledWith('o1', 'efectivo');
    const updated = (await getCards())[0];
    expect(within(updated).getByText('Confirmada')).toBeInTheDocument();
    expect(within(updated).queryByRole('button', { name: /Confirmar venta/ })).toBeNull();
  });

  it('la card reemplaza los datos faltantes del cliente por textos por defecto', async () => {
    mockOrders([makeOrder({ id: 'o1' }), makeOrder({ id: 'o2', customerName: '', customerPhone: null })]);
    renderPage();

    const cards = await getCards();
    expect(within(cards[1]).getByText('Cliente sin nombre')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Sin teléfono')).toBeInTheDocument();
  });

  it('sin órdenes no renderiza cards y muestra el estado vacío', async () => {
    mockOrders([]);
    renderPage();

    expect(
      await screen.findByText('No hay órdenes para los filtros seleccionados.'),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('ul li')).toHaveLength(0);
  });
});
