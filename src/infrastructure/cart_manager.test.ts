import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, type CartItem } from './cart_manager';

type NewItem = Omit<CartItem, 'quantity'>;

const makeItem = (overrides: Partial<NewItem> = {}): NewItem => ({
  productId: 'p1',
  name: 'Alimento Premium',
  unit: 'Bolsa',
  price: 100,
  ...overrides,
});

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it('agrega un item nuevo con cantidad 1', () => {
    useCartStore.getState().addItem(makeItem());

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: 'p1', quantity: 1 });
  });

  it('acumula cantidad cuando se agrega el mismo producto y unidad', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().addItem(makeItem());

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('trata unidades distintas del mismo producto como líneas separadas', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().addItem(makeItem({ unit: 'Kilo', price: 50 }));

    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('updateQuantity incrementa, decrementa y nunca baja de 1', () => {
    useCartStore.getState().addItem(makeItem());

    useCartStore.getState().updateQuantity('p1', 'Bolsa', 1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);

    useCartStore.getState().updateQuantity('p1', 'Bolsa', -1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    useCartStore.getState().updateQuantity('p1', 'Bolsa', -1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('removeItem elimina la línea indicada', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().removeItem('p1', 'Bolsa');

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('getTotal suma precio por cantidad', () => {
    useCartStore.getState().addItem(makeItem({ price: 100 }));
    useCartStore.getState().updateQuantity('p1', 'Bolsa', 2); // qty = 3
    useCartStore.getState().addItem(
      makeItem({ productId: 'p2', unit: 'Kilo', price: 50 }), // qty = 1
    );

    // 100 * 3 + 50 * 1 = 350
    expect(useCartStore.getState().getTotal()).toBe(350);
  });

  it('clearCart vacía el carrito', () => {
    useCartStore.getState().addItem(makeItem());
    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
