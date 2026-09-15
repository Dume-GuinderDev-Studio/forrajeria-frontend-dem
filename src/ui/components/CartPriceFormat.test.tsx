import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CartDrawer } from './CartDrawer';
import { useCartStore } from '@/infrastructure/cart_manager';

describe('CartDrawer: Precio por Bolsa formateado y redondeado', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it('"Precio por Bolsa: $113421.69" → formateado sin centavos', () => {
    useCartStore.getState().addItem({
      productId: 'p1',
      name: 'Alimento Test',
      unit: 'Bolsa',
      price: 113421.69,
    });

    const { container } = render(<CartDrawer isOpen={true} onOpenChange={() => {}} />);
    void container;
    const text = document.body.textContent ?? '';

    // Valor formateado y redondeado a peso entero (113421.69 → 113.422)
    expect(text).toContain('113.422');
    // Sin centavos ni número crudo
    expect(text).not.toContain('113421.69');
    expect(text).not.toContain('113421,69');
    expect(text).not.toContain(',00');
  });

  it('Total Estimado también usa formato con separador de miles', () => {
    useCartStore.getState().addItem({
      productId: 'p1',
      name: 'Alimento Test',
      unit: 'Bolsa',
      price: 113421.69,
    });

    render(<CartDrawer isOpen={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Total Estimado')).toBeInTheDocument();
    expect(document.body.textContent).toContain('113.422');
  });
});
