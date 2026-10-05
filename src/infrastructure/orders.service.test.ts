import { describe, expect, it, vi, type Mock } from 'vitest';
import { createManualOrder, confirmOrder, getMySalesToday, getProfitBySupplier } from './orders.service';
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

describe('getProfitBySupplier (normalización de la fila)', () => {
  const responder = (rows: unknown[]) => {
    apiGet.mockResolvedValue({ data: rows });
  };

  it('deja supplierId en null para el bucket "Sin proveedor"', async () => {
    // El backend manda supplierId: null para las ventas de productos sin marca.
    // Antes caía en `?? record.supplierName` y quedaba supplierId = "Sin
    // proveedor", un string truthy que hacía creer que había un proveedor real.
    responder([
      { supplierId: null, supplierName: 'Sin proveedor', totalSales: 12000, totalProfit: 3000 },
    ]);

    const [row] = await getProfitBySupplier();

    expect(row.supplierId).toBeNull();
    expect(row.supplierName).toBe('Sin proveedor');
  });

  it('conserva el supplierId real cuando viene', async () => {
    responder([
      { supplierId: 's1', supplierName: 'MAJANO', totalSales: 60000, totalProfit: 10000 },
    ]);

    const [row] = await getProfitBySupplier();

    expect(row.supplierId).toBe('s1');
  });

  it('usa el id anidado cuando viene en supplier: { id }', async () => {
    responder([
      { supplier: { id: 's9', name: 'RUMA' }, totalSales: 100, totalProfit: 10 },
    ]);

    const [row] = await getProfitBySupplier();

    expect(row.supplierId).toBe('s9');
  });

  it('deja payableAmount en undefined si el backend no lo manda', async () => {
    // Es lo que hace caer a la vista al cálculo local venta − ganancia.
    responder([{ supplierId: 's1', supplierName: 'MAJANO', totalSales: 60000, totalProfit: 10000 }]);

    const [row] = await getProfitBySupplier();

    expect(row.payableAmount).toBeUndefined();
  });
});
