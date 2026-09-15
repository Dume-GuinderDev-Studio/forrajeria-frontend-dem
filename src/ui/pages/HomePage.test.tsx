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
    const { container } = render(<HomePage />);

    await screen.findByText('Producto A');
    await user.click(screen.getByRole('button', { name: /Ordenar/ }));

    // Regresión del bug: el overlay fixed estaba en z-40, por encima del
    // contexto de la barra (z-30) que contiene al menú (z-50), e interceptaba
    // los clicks en las opciones (el menú se cerraba sin ordenar).
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toMatch(/\bz-20\b/);
    expect(overlay!.className).not.toMatch(/\bz-40\b/);
  });
});
