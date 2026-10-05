import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenBagBadge } from './OpenBagBadge';
import type { Product, ProductPresentation } from '@/infrastructure/products.service';

const kilo = (o: Partial<ProductPresentation> = {}): ProductPresentation => ({
  type: 'kilo',
  weightKg: null,
  price: 5000,
  isActive: true,
  ...o,
});

const bag = (o: Partial<ProductPresentation> = {}): ProductPresentation => ({
  type: 'bag',
  weightKg: 15,
  price: 30000,
  isActive: true,
  openBagRemainingKg: 7,
  ...o,
});

const producto = (o: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Alimento Premium',
  price: 30000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  presentations: [kilo(), bag()],
  ...o,
});

const textoBadge = (container: HTMLElement) => container.textContent?.trim() ?? '';

describe('OpenBagBadge', () => {
  it('muestra el texto nuevo "Sobrante abierto: X kg"', () => {
    const { container } = render(<OpenBagBadge product={producto()} />);
    expect(textoBadge(container)).toBe('Sobrante abierto: 7 kg');
  });

  it('con unidad Kilo y kg > 0 el badge es visible', () => {
    const { container } = render(<OpenBagBadge product={producto()} unit="Kilo" />);
    expect(textoBadge(container)).toBe('Sobrante abierto: 7 kg');
  });

  it('con unidad Bolsa el badge NO aparece aunque haya sobrante', () => {
    const { container } = render(<OpenBagBadge product={producto()} unit="Bolsa" />);
    expect(textoBadge(container)).toBe('');
  });

  it('con unidad Unidad el badge NO aparece', () => {
    const { container } = render(<OpenBagBadge product={producto()} unit="Unidad" />);
    expect(textoBadge(container)).toBe('');
  });

  it('con Kilo pero sin sobrante (0 kg) el badge NO aparece', () => {
    const { container } = render(
      <OpenBagBadge product={producto({ presentations: [kilo(), bag({ openBagRemainingKg: 0 })] })} unit="Kilo" />,
    );
    expect(textoBadge(container)).toBe('');
  });

  it('con Kilo pero sin sobrante (null) el badge NO aparece', () => {
    const { container } = render(
      <OpenBagBadge
        product={producto({ presentations: [kilo(), bag({ openBagRemainingKg: null })] })}
        unit="Kilo"
      />,
    );
    expect(textoBadge(container)).toBe('');
  });

  it('sin unidad informada no aplica el filtro (listado del admin y busqueda)', () => {
    const { container } = render(<OpenBagBadge product={producto()} />);
    expect(textoBadge(container)).toBe('Sobrante abierto: 7 kg');
  });

  it('no renderiza nada si el producto no puede venderse por kilo', () => {
    const { container } = render(
      <OpenBagBadge product={producto({ presentations: [bag()] })} unit="Kilo" />,
    );
    expect(textoBadge(container)).toBe('');
  });

  it('no renderiza nada si el producto es null', () => {
    const { container } = render(<OpenBagBadge product={null} unit="Kilo" />);
    expect(textoBadge(container)).toBe('');
    expect(screen.queryByText(/Sobrante abierto/)).toBeNull();
  });
});
