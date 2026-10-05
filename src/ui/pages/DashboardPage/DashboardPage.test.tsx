import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { getOrdersMetrics } from '@/infrastructure/orders.service';
import { getLowStockProducts } from '@/infrastructure/products.service';

vi.mock('@/infrastructure/orders.service', () => ({
  getOrdersMetrics: vi.fn(),
}));

vi.mock('@/infrastructure/products.service', async () => {
  const actual =
    await vi.importActual<typeof import('@/infrastructure/products.service')>(
      '@/infrastructure/products.service',
    );
  return {
    ...actual,
    getLowStockProducts: vi.fn(),
  };
});

const getOrdersMetricsMock = getOrdersMetrics as unknown as Mock;
const getLowStockProductsMock = getLowStockProducts as unknown as Mock;

const LONG_PRODUCT_NAME =
  'Vital Can Balanced Ad. Raza Grande 20Kg Bolsa X 3 Unidades';

const metrics = {
  today: { sales: 1000, orders: 1 },
  week: { sales: 2000, orders: 2 },
  month: { sales: 3000, orders: 3 },
  avgTicket: 1000,
  profitMonth: 500,
};

const alerts = {
  outOfStock: [
    { id: 'p1', name: LONG_PRODUCT_NAME, stock: 0, category: { name: 'Perro' } },
  ],
  lowStock: [
    { id: 'p2', name: 'Comida para Perro Adulto 3kg', stock: 2, category: { name: 'Gato' } },
  ],
};

const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <LocationProbe />
      <DashboardPage />
    </MemoryRouter>,
  );

/** La card de alertas de stock, sin el resto del layout del admin. */
const getAlertsSection = async () => {
  await screen.findAllByText(LONG_PRODUCT_NAME);
  return screen.getByText('Alertas de stock').closest('section') as HTMLElement;
};

describe('DashboardPage - alertas de stock responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrdersMetricsMock.mockResolvedValue(metrics);
    getLowStockProductsMock.mockResolvedValue(alerts);
  });

  it('renderiza la lista flex sólo para mobile', async () => {
    renderPage();
    const alerts = await getAlertsSection();

    const mobileWrapper = within(alerts).getAllByRole('list')[0].parentElement;
    expect(mobileWrapper?.className).toContain('sm:hidden');

    // El <table> de shadcn va envuelto en su propio div con overflow-x-auto,
    // así que el wrapper responsive es el div de ese div.
    const tableContainer = within(alerts).getAllByRole('table')[0].parentElement;
    const desktopWrapper = tableContainer?.parentElement;
    expect(desktopWrapper?.className).toContain('hidden sm:block');
  });

  it('usa filas flex que no se ensanchan y con nombre de 2 líneas', async () => {
    renderPage();
    const alerts = await getAlertsSection();

    const lists = within(alerts).getAllByRole('list');
    expect(lists).toHaveLength(2); // "Sin stock" y "Stock bajo"
    for (const list of lists) {
      expect(list.className).toContain('divide-y');
    }

    const rows = Array.from(alerts.querySelectorAll('li'));
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      expect(row.className).toContain('flex');
      expect(row.className).toContain('items-center');
      expect(row.className).toContain('px-4');
      expect(row.className).toContain('py-3');

      const name = row.querySelector('span.min-w-0');
      expect(name).not.toBeNull();
      expect(name?.className).toContain('flex-1');
      expect(name?.className).toContain('line-clamp-2');
      expect(name?.className).toContain('break-words');

      // Ícono y badge no se pueden comprimir.
      expect(row.querySelector('span.shrink-0')).not.toBeNull();
      const badge = row.querySelector('[data-slot="badge"]');
      expect(badge?.className).toContain('shrink-0');
    }
  });

  it('muestra el encabezado Producto / Stock actual sin usar una tabla', async () => {
    renderPage();
    const alerts = await getAlertsSection();

    const headers = within(alerts).getAllByText('Stock actual');
    expect(headers).toHaveLength(4); // 2 de la lista mobile + 2 de la tabla

    const mobileHeaders = headers.filter((header) => header.closest('table') === null);
    expect(mobileHeaders).toHaveLength(2);

    for (const header of mobileHeaders) {
      const container = header.parentElement;
      expect(container?.tagName).not.toBe('TH');
      expect(container?.className).toContain('flex');
      expect(container?.className).toContain('justify-between');
    }
  });

  it('conserva la columna Categoría en la tabla de desktop', async () => {
    renderPage();
    const alerts = await getAlertsSection();

    const categoryHeaders = within(alerts).getAllByRole('columnheader', { name: 'Categoría' });
    expect(categoryHeaders).toHaveLength(2);

    // Categoría no aparece en la lista de mobile, sólo en la tabla.
    const categoryBadges = within(alerts).getAllByText('Perro');
    for (const badge of categoryBadges) {
      expect(badge.closest('table')).not.toBeNull();
    }
  });

  it('navega al producto al tocar o al activar con teclado una fila', async () => {
    renderPage();
    const alerts = await getAlertsSection();

    const row = alerts.querySelectorAll('li')[0];
    expect(row.tagName).toBe('LI');
    expect(row.getAttribute('role')).toBe('button');
    expect(row.getAttribute('tabindex')).toBe('0');

    await userEvent.click(row);
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/catalogo?edit=p1');
  });
});

/**
 * Comportamiento de la lista de cards de mobile de las alertas: qué muestra,
 * cuántas filas expone y a dónde navega. El helper existente espera por un
 * producto concreto, así que alcanza cuando hay alertas con datos.
 */
describe('DashboardPage - cards de mobile de alertas de stock', () => {
  const getAlertsCardsSection = () =>
    screen.getByText('Alertas de stock').closest('section') as HTMLElement;

  /** Las <ul> de mobile de las alertas, en orden: "Sin stock" y luego "Stock bajo". */
  const getMobileLists = (section: HTMLElement) =>
    Array.from(section.querySelectorAll('ul'));

  /**
   * Cada <li> de la lista tiene role="button", así que pierde el rol `listitem`
   * en el árbol de accesibilidad: las cards se toman por estructura.
   */
  const getMobileCards = (list: Element) => Array.from(list.querySelectorAll('li'));

  beforeEach(() => {
    vi.clearAllMocks();
    getOrdersMetricsMock.mockResolvedValue(metrics);
    getLowStockProductsMock.mockResolvedValue(alerts);
  });

  it('cada card muestra el producto y su stock, sin duplicar la categoría', async () => {
    renderPage();
    await screen.findAllByText(LONG_PRODUCT_NAME);
    const section = getAlertsCardsSection();

    const [outOfStock, lowStock] = getMobileLists(section);
    expect(getMobileCards(outOfStock)).toHaveLength(1);
    expect(getMobileCards(outOfStock)[0]).toHaveTextContent(LONG_PRODUCT_NAME);
    expect(within(outOfStock).getAllByText('0')).toHaveLength(1);

    expect(getMobileCards(lowStock)).toHaveLength(1);
    expect(getMobileCards(lowStock)[0]).toHaveTextContent('Comida para Perro Adulto 3kg');
    expect(within(lowStock).getAllByText('2')).toHaveLength(1);

    // El grupo se titula arriba de su lista: cada card es sólo producto + stock.
    expect(within(section).getByRole('heading', { name: 'Sin stock' })).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'Stock bajo' })).toBeInTheDocument();

    // La card de mobile no lleva la categoría: sólo producto y stock.
    for (const list of [outOfStock, lowStock]) {
      expect(within(list).queryByText('Perro')).toBeNull();
    }
  });

  it('la lista de mobile se limita a los 5 productos de la vista previa', async () => {
    getLowStockProductsMock.mockResolvedValue({
      outOfStock: [
        { id: 'p1', name: LONG_PRODUCT_NAME, stock: 0, category: { name: 'Perro' } },
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `p${i + 2}`,
          name: `Producto ${i + 2}`,
          stock: 0,
          category: { name: 'Perro' },
        })),
      ],
      lowStock: [],
    });
    renderPage();
    await screen.findAllByText(LONG_PRODUCT_NAME);
    const section = getAlertsCardsSection();

    const cards = getMobileCards(getMobileLists(section)[0]);
    expect(cards).toHaveLength(5);
    // La tabla de desktop queda en la misma vista previa.
    expect(within(section).getAllByRole('row')).toHaveLength(6); // encabezado + 5
  });

  it('"Ver todos" lleva al catálogo con el filtro de cada grupo', async () => {
    const many = (prefix: string) =>
      Array.from({ length: 6 }, (_, i) => ({
        id: `${prefix}${i}`,
        name: `${prefix} ${i}`,
        stock: 0,
        category: { name: 'Perro' },
      }));
    getLowStockProductsMock.mockResolvedValue({
      outOfStock: many('Sin'),
      lowStock: many('Bajo'),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Ver todos/ })).toHaveLength(2);
    });

    const seeAll = screen.getAllByRole('button', { name: /Ver todos/ });
    await userEvent.click(seeAll[0]);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/catalogo?stockFilter=out',
    );
    await userEvent.click(seeAll[1]);
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/catalogo?stockFilter=low',
    );
  });

  it('tocar una card de "Stock bajo" abre ese producto', async () => {
    renderPage();
    await screen.findAllByText(LONG_PRODUCT_NAME);
    const section = getAlertsCardsSection();

    const card = getMobileCards(getMobileLists(section)[1])[0];
    await userEvent.click(card);

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/catalogo?edit=p2');
  });

  it('sin alertas no hay cards y se avisa que el stock está en buen nivel', async () => {
    getLowStockProductsMock.mockResolvedValue({ outOfStock: [], lowStock: [] });
    renderPage();

    expect(
      await screen.findByText('✅ Todo el stock está en buen nivel'),
    ).toBeInTheDocument();
    const section = getAlertsCardsSection();
    expect(section.querySelectorAll('ul')).toHaveLength(0);
    expect(section.querySelectorAll('li')).toHaveLength(0);
  });

  it('el error de alertas ofrece Reintentar y vuelve a pintar las cards', async () => {
    getLowStockProductsMock.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(
      await screen.findByText(
        'No se pudieron cargar las alertas de stock. Reintentá en unos segundos.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await screen.findAllByText(LONG_PRODUCT_NAME);
    const section = getAlertsCardsSection();
    expect(getMobileLists(section)).toHaveLength(2);
  });
});
