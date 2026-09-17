import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductPresentationsSection } from './ProductPresentationsSection';
import type { Product } from '@/infrastructure/products.service';

const baseProduct = (presentations: Product['presentations']): Product => ({
  id: 'p1',
  name: 'Test Product',
  price: 100,
  stock: 10,
  category: { id: 'cat-1', name: 'Perro' },
  lifeStage: 'Adulto',
  presentations,
});

describe('ProductPresentationsSection (single bag)', () => {
  it('no renderiza el botón "Agregar bolsa"', async () => {
    render(<ProductPresentationsSection onPresentationsChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Peso (kg)')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /agregar bolsa/i })).not.toBeInTheDocument();
  });

  it('muestra los helpers de Bolsa y Kilo para la tienda online', async () => {
    render(<ProductPresentationsSection onPresentationsChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Peso (kg)')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Definí cómo se ofrece la bolsa cerrada en la tienda online.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Definí cómo se ofrece el kilo suelto en la tienda online.'),
    ).toBeInTheDocument();
  });

  it('renderiza un único bloque de bolsa (un solo campo de peso)', async () => {
    render(<ProductPresentationsSection onPresentationsChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Peso (kg)')).toBeInTheDocument();
    });
    expect(screen.getAllByPlaceholderText('Peso (kg)')).toHaveLength(1);
  });

  it('al hidratar un producto legacy con >1 bolsa muestra solo la primera con aviso no bloqueante', async () => {
    const product = baseProduct([
      { id: 'b1', type: 'bag', weightKg: 15, price: 100 },
      { id: 'b2', type: 'bag', weightKg: 8, price: 60 },
    ]);

    render(<ProductPresentationsSection product={product} onPresentationsChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este producto tenía 2 configuraciones de bolsa; se muestra la primera. Revisalo antes de guardar.',
    );
    // Una sola fila visible y con los datos de la primera bolsa.
    expect(screen.getAllByPlaceholderText('Peso (kg)')).toHaveLength(1);
    expect(screen.getByPlaceholderText('Peso (kg)')).toHaveValue(15);
    expect(screen.getByPlaceholderText('Precio ($)')).toHaveValue(100);
  });

  it('notifica al padre con la bolsa única (objeto, no array)', async () => {
    const onChange = vi.fn();
    render(<ProductPresentationsSection onPresentationsChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveProperty('bagRow');
    expect(lastCall).not.toHaveProperty('bagRows');
  });
});
