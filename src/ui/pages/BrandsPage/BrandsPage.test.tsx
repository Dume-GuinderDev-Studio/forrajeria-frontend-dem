import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BrandsPage } from './BrandsPage';
import { getBrands, deleteBrand, updateBrand } from '@/infrastructure/brands.service';
import { getSuppliers } from '@/infrastructure/suppliers.service';

vi.mock('@/infrastructure/brands.service', () => ({
  createBrand: vi.fn(),
  deleteBrand: vi.fn(),
  updateBrand: vi.fn(),
  getBrands: vi.fn(),
}));

vi.mock('@/infrastructure/suppliers.service', () => ({ getSuppliers: vi.fn() }));

const getBrandsMock = getBrands as unknown as Mock;
const getSuppliersMock = getSuppliers as unknown as Mock;
const deleteBrandMock = deleteBrand as unknown as Mock;
const updateBrandMock = updateBrand as unknown as Mock;

const makeBrand = (overrides: Record<string, unknown> = {}) => ({
  id: 'b1',
  name: 'Nutripet',
  supplier: { id: 's1', name: 'Distribuidora Norte' },
  createdAt: '2024-02-11T00:00:00.000Z',
  isActive: true,
  ...overrides,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/marcas']}>
      <BrandsPage />
    </MemoryRouter>,
  );

/**
 * Con la tabla de desktop y las cards de mobile montadas a la vez, cada texto y
 * cada botón aparece DOS veces. Estos helpers acotan las consultas a una vista:
 * ningún selector global puede matchear las dos.
 */
const getTableView = async () => {
  await screen.findAllByText('Nutripet');
  const table = document.querySelector('table');
  if (!table) throw new Error('No se encontró la tabla de desktop');
  return within(table as HTMLElement);
};

const getCardsView = async () => {
  // No esperamos por 'Nutripet': con la búsqueda filtrada la card no lo tiene.
  await waitFor(() => {
    const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'));
    if (!list) throw new Error('No se encontró la lista de cards de mobile');
  });
  const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'))!;
  return within(list as HTMLElement);
};

describe('BrandsPage — vista de tabla (desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrandsMock.mockResolvedValue([makeBrand()]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'Distribuidora Norte' }]);
    deleteBrandMock.mockResolvedValue(undefined);
    updateBrandMock.mockResolvedValue(undefined);
  });

  it('lista las 4 columnas con sus datos', async () => {
    renderPage();
    const view = await getTableView();

    const headers = view.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual(['Nombre', 'Proveedor', 'Alta', 'Acciones']);

    expect(view.getByText('Nutripet')).toBeInTheDocument();
    expect(view.getByText('Distribuidora Norte')).toBeInTheDocument();
  });

  it('el estado vacío se muestra una vez en la tabla, con el mismo texto que la card', async () => {
    getBrandsMock.mockResolvedValue([makeBrand()]);
    renderPage();
    const view = await getTableView();

    await userEvent.type(screen.getByPlaceholderText('Buscar marca...'), 'zzz');

    await waitFor(() => {
      expect(
        view.getByText('No se encontraron marcas coincidentes con la búsqueda.'),
      ).toBeInTheDocument();
    });
    const cards = await getCardsView();
    expect(
      cards.getByText('No se encontraron marcas coincidentes con la búsqueda.'),
    ).toBeInTheDocument();
  });
});

describe('BrandsPage — vista de cards (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrandsMock.mockResolvedValue([makeBrand()]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'Distribuidora Norte' }]);
    deleteBrandMock.mockResolvedValue(undefined);
    updateBrandMock.mockResolvedValue(undefined);
  });

  it('renderiza una card por marca con proveedor y fecha', async () => {
    renderPage();
    const cards = await getCardsView();

    const items = cards.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Nutripet');
    expect(items[0]).toHaveTextContent('Distribuidora Norte');
    expect(items[0]).toHaveTextContent(/Alta:/);
  });

  it('eliminar desde la card borra esa marca', async () => {
    renderPage();
    const cards = await getCardsView();

    await userEvent.click(cards.getByRole('button', { name: 'Eliminar Nutripet' }));
    expect(await screen.findByText(/¿Seguro que querés eliminar la marca Nutripet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(deleteBrandMock).toHaveBeenCalledWith('b1');
  });
});
