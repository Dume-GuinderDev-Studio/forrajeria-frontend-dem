import { describe, expect, it, vi, type Mock } from 'vitest';
import { createManualOrder, confirmOrder, getMySalesToday } from './orders.service';
import api from './api';

vi.mock('./api', () => ({
  default: { post: vi.fn(), patch: vi.fn(), get: vi.fn() },
}));

const apiPost = api.post as unknown as Mock;
const apiPatch = api.patch as unknown as Mock;
const apiGet = api.get as unknown as Mock;

describe('orders.service', () => {
  it('createManualOrder envía el payload a /orders/manual y devuelve la orden', async () => {
    const mockOrder = { id: 'ord-1', status: 'confirmed' };
    apiPost.mockResolvedValue({ data: mockOrder });

    const payload = {
      cart: [{ productId: 'p1', quantity: 2, unit: 'Bolsa' as const }],
      customerName: 'María',
      paymentMethod: 'efectivo' as const,
    };

    const result = await createManualOrder(payload);

    expect(apiPost).toHaveBeenCalledWith('/orders/manual', payload);
    expect(result).toEqual(mockOrder);
  });

  it('confirmOrder envía el método de pago a /orders/:id/confirm', async () => {
    const mockOrder = { id: 'ord-1', status: 'confirmed' };
    apiPatch.mockResolvedValue({ data: mockOrder });

    const result = await confirmOrder('ord-1', 'transferencia');

    expect(apiPatch).toHaveBeenCalledWith('/orders/ord-1/confirm', {
      paymentMethod: 'transferencia',
    });
    expect(result).toEqual(mockOrder);
  });

  it('getMySalesToday consume /orders/my-sales-today y devuelve el resumen', async () => {
    apiGet.mockResolvedValue({ data: { sales: 25000, orders: 4 } });

    const result = await getMySalesToday();

    expect(apiGet).toHaveBeenCalledWith('/orders/my-sales-today');
    expect(result).toEqual({ sales: 25000, orders: 4 });
  });

  it('getMySalesToday normaliza respuestas con total/count', async () => {
    apiGet.mockResolvedValue({ data: { total: 1500, count: 2 } });

    const result = await getMySalesToday();

    expect(result).toEqual({ sales: 1500, orders: 2 });
  });
});
