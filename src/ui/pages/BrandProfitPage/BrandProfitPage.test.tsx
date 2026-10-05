import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BrandProfitPage } from './BrandProfitPage';
import { getProfitByBrand } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/orders.service', () => ({
  getProfitByBrand: vi.fn(),
}));

const getProfitByBrandMock = getProfitByBrand as unknown as Mock;

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  brandId: 'b1',
  brandName: 'Nutripet',
  sales: 120000,
  profit: 30000,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/ganancia-marcas']}>
      <BrandProfitPage />
    </MemoryRouter>,
  );

/**
 * Con la tabla de desktop y las cards de mobile montadas a la vez, cada texto y
 * cada monto aparece DOS veces. Estos helpers acotan las consultas a una vista:
 * ningún selector global puede matchear las dos.
 */
const getTableView = async () => {
  await screen.findAllByText('Nutripet');
  const table = document.querySelector('table');
  if (!table) throw new Error('No se encontró la tabla de desktop');
  return within(table as HTMLElement);
};

const getCardsView = async () => {
  await waitFor(() => {
    const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'));
    if (!list) throw new Error('No se encontró la lista de cards de mobile');
  });
  const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'))!;
  return within(list as HTMLElement);
};

describe('BrandProfitPage — vista de tabla (desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfitByBrandMock.mockResolvedValue([
      makeRow(),
      makeRow({ brandId: 'b2', brandName: 'Rara', sales: 30000, profit: 5000 }),
    ]);
  });

  it('lista las 3 columnas con venta y ganancia por marca', async () => {
    renderPage();
    const view = await getTableView();

    const headers = view.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Marca', 'Venta del período', 'Ganancia del período']);

    const row = view.getByText('Nutripet').closest('tr');
    expect(row?.textContent).toContain(formatARS(120000));
    expect(row?.textContent).toContain(formatARS(30000));
  });

  it('la fila de Total suma venta y ganancia de todas las marcas', async () => {
    renderPage();
    const view = await getTableView();

    const totalRow = view.getByText('Total').closest('tr');
    expect(totalRow?.textContent).toContain(formatARS(150000));
    expect(totalRow?.textContent).toContain(formatARS(35000));
  });
});

describe('BrandProfitPage — vista de cards (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfitByBrandMock.mockResolvedValue([
      makeRow(),
      makeRow({ brandId: 'b2', brandName: 'Rara', sales: 30000, profit: 5000 }),
    ]);
  });

  it('renderiza una card por marca con venta y ganancia etiquetadas, más la de Total', async () => {
    renderPage();
    const cards = await getCardsView();

    const items = cards.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    // Ojo: `toHaveTextContent` no matchea los montos de formatARS (usa espacio
    // duro U+00A0), por eso se asserta sobre `textContent`.
    expect(items[0].textContent).toContain('Nutripet');
    expect(items[0].textContent).toContain('Venta');
    expect(items[0].textContent).toContain(formatARS(120000));
    expect(items[0].textContent).toContain('Ganancia');
    expect(items[0].textContent).toContain(formatARS(30000));

    expect(items[1].textContent).toContain('Rara');
    expect(items[1].textContent).toContain(formatARS(30000));

    // La última card es el total.
    expect(items[2].textContent).toContain('Total');
    expect(items[2].textContent).toContain(formatARS(150000));
    expect(items[2].textContent).toContain(formatARS(35000));
  });
});

describe('BrandProfitPage — estados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin ventas con marca muestra el estado vacío y no renderiza tabla ni cards', async () => {
    getProfitByBrandMock.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText('No hay ventas con marca asignada en el período seleccionado.'),
    ).toBeInTheDocument();
    expect(document.querySelector('table')).toBeNull();
    expect(document.querySelector('ul')).toBeNull();
  });
});
