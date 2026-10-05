import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from './HomePage';
import { getCategories, getProducts } from '@/infrastructure/products.service';
import type { Product } from '@/infrastructure/products.service';

vi.mock('@/infrastructure/products.service', () => ({
  getProducts: vi.fn(),
  getCategories: vi.fn(),
}));

const getProductsMock = getProducts as unknown as Mock;
const getCategoriesMock = getCategories as unknown as Mock;

const product = (id: string, name: string, price: number): Product => ({
  id,
  name,
  price,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
});

const cardOrder = () =>
  within(screen.getByRole('main'))
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent);

describe('HomePage sort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsMock.mockResolvedValue([
      product('1', 'Producto A', 100),
      product('2', 'Producto B', 300),
      product('3', 'Producto C', 200),
    ]);
    getCategoriesMock.mockResolvedValue([{ id: 'c1', name: 'Perro' }]);
  });

  it('ordena por defecto de mayor a menor precio', async () => {
    render(<HomePage />);

    expect(await screen.findByText('Producto A')).toBeInTheDocument();
    expect(cardOrder()).toEqual(['Producto B', 'Producto C', 'Producto A']);
  });

  it('cambiar el selector a "Precio: Menor a mayor" reordena la lista visible', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await screen.findByText('Producto A');
    await user.click(screen.getByRole('button', { name: /Ordenar/ }));
    await user.click(screen.getByRole('button', { name: 'Precio: Menor a mayor' }));

    expect(cardOrder()).toEqual(['Producto A', 'Producto C', 'Producto B']);
  });

  it('la opción "Nombre: A-Z" ordena alfabéticamente', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await screen.findByText('Producto A');
    await user.click(screen.getByRole('button', { name: /Ordenar/ }));
    await user.click(screen.getByRole('button', { name: 'Nombre: A-Z' }));

    expect(cardOrder()).toEqual(['Producto A', 'Producto B', 'Producto C']);
  });

  it('el overlay de cierre queda por debajo del menú (no traga los clicks)', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await screen.findByText('Producto A');
    await user.click(screen.getByRole('button', { name: /Ordenar/ }));

    // Regresión del bug: el overlay fixed estaba por encima del contexto de
    // la barra que contiene al menú e interceptaba los clicks en las opciones
    // (el menú se cerraba sin ordenar). El overlay se busca por testid, no
    // por clases: su z-index vive en el módulo (20 < 50 del menú).
    expect(screen.getByTestId('sort-menu-overlay')).toBeInTheDocument();

    // Si el overlay tapara el menú, este click caería en el overlay: el menú
    // se cerraría sin ordenar y el orden visible no cambiaría.
    await user.click(screen.getByRole('button', { name: 'Precio: Menor a mayor' }));
    expect(cardOrder()).toEqual(['Producto A', 'Producto C', 'Producto B']);
  });
});
