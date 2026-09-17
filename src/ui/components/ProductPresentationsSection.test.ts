import { describe, expect, it } from 'vitest';
import { buildPresentationsPayload } from './ProductPresentationsSection';

const row = (
  weightKg: number | null,
  price: number | null,
  cost: number | null = null,
) => ({
  id: 'r',
  weightKg,
  price,
  cost,
});

describe('buildPresentationsPayload', () => {
  it('filtra la bolsa cuando está incompleta (peso o precio faltantes o inválidos)', () => {
    expect(buildPresentationsPayload(row(null, 50), false, null)).toEqual([]);
    expect(buildPresentationsPayload(row(5, null), false, null)).toEqual([]);
    expect(buildPresentationsPayload(row(0, 100), false, null)).toEqual([]);
    expect(buildPresentationsPayload(row(3, 0), false, null)).toEqual([]);
    expect(buildPresentationsPayload(null, false, null)).toEqual([]);
  });

  it('arma la presentación de bolsa única con números normalizados', () => {
    const result = buildPresentationsPayload(row(21, 47999), false, null);

    expect(result).toEqual([{ type: 'bag', weightKg: 21, price: 47999, cost: null }]);
  });

  it('agrega presentación por kilo cuando está habilitada con precio válido', () => {
    const result = buildPresentationsPayload(row(10, 100), true, 8500);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: 'bag', weightKg: 10, price: 100 });
    expect(result[1]).toEqual({ type: 'kilo', weightKg: null, price: 8500, cost: null });
  });

  it('no agrega kilo si está deshabilitado o el precio es inválido', () => {
    expect(buildPresentationsPayload(row(10, 100), false, 8500)).toHaveLength(1);
    expect(buildPresentationsPayload(row(10, 100), true, null)).toHaveLength(1);
    expect(buildPresentationsPayload(row(10, 100), true, 0)).toHaveLength(1);
  });

  it('incluye el costo de bolsa cuando se informa y null cuando no', () => {
    expect(buildPresentationsPayload(row(10, 100, 60), false, null)[0]).toEqual({
      type: 'bag',
      weightKg: 10,
      price: 100,
      cost: 60,
    });
    expect(buildPresentationsPayload(row(10, 100), false, null)[0]).toEqual({
      type: 'bag',
      weightKg: 10,
      price: 100,
      cost: null,
    });
  });

  it('incluye el costo por kilo cuando se informa', () => {
    const result = buildPresentationsPayload(row(10, 100), true, 8500, 5000);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ type: 'kilo', weightKg: null, price: 8500, cost: 5000 });
  });

  it('serializa como máximo 1 bag + 0/1 kilo', () => {
    const result = buildPresentationsPayload(row(10, 100, 60), true, 8500, 5000);

    expect(result.filter((p) => p.type === 'bag')).toHaveLength(1);
    expect(result.filter((p) => p.type === 'kilo')).toHaveLength(1);
    expect(result).toHaveLength(2);
  });
});
