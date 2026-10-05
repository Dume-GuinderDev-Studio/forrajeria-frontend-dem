import { describe, expect, it } from 'vitest';
import type { Product, ProductPresentation } from '@/infrastructure/products.service';
import { formatKg, getOpenBagLabel, getOpenBagRemainingKg } from './openBag';

const kiloPresentation = (
  overrides: Partial<ProductPresentation> = {},
): ProductPresentation => ({
  type: 'kilo',
  weightKg: null,
  price: 5000,
  isActive: true,
  ...overrides,
});

const bagPresentation = (
  overrides: Partial<ProductPresentation> = {},
): ProductPresentation => ({
  type: 'bag',
  weightKg: 15,
  price: 30000,
  isActive: true,
  openBagRemainingKg: 7,
  ...overrides,
});

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Alimento Premium',
  price: 100,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  presentations: [kiloPresentation(), bagPresentation()],
  ...overrides,
});

describe('getOpenBagRemainingKg', () => {
  it('devuelve los kg restantes de la presentación bag si hay Kilo y remanente > 0', () => {
    expect(getOpenBagRemainingKg(makeProduct())).toBe(7);
  });

  it('caso real: bag de 15kg con 10kg restantes y kilo activa → devuelve 10', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [
            kiloPresentation(),
            bagPresentation({ weightKg: 15, openBagRemainingKg: 10 }),
          ],
        }),
      ),
    ).toBe(10);
  });

  it('busca el dato en la presentación bag, no en la de kilo', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [
            kiloPresentation({ openBagRemainingKg: 10 }),
            bagPresentation({ openBagRemainingKg: null }),
          ],
        }),
      ),
    ).toBeNull();
  });

  it('devuelve null si el remanente de la bolsa es 0', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [kiloPresentation(), bagPresentation({ openBagRemainingKg: 0 })],
        }),
      ),
    ).toBeNull();
  });

  it('devuelve null si el remanente de la bolsa es null o undefined', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [kiloPresentation(), bagPresentation({ openBagRemainingKg: null })],
        }),
      ),
    ).toBeNull();
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [kiloPresentation(), bagPresentation({ openBagRemainingKg: undefined })],
        }),
      ),
    ).toBeNull();
  });

  it('devuelve null si el producto no tiene presentación Kilo', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [bagPresentation({ openBagRemainingKg: 7 })],
        }),
      ),
    ).toBeNull();
  });

  it('devuelve null si la presentación Kilo está inactiva', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [
            kiloPresentation({ isActive: false }),
            bagPresentation({ openBagRemainingKg: 7 }),
          ],
        }),
      ),
    ).toBeNull();
  });

  it('devuelve null si la bolsa con remanente está inactiva', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({
          presentations: [
            kiloPresentation(),
            bagPresentation({ openBagRemainingKg: 7, isActive: false }),
          ],
        }),
      ),
    ).toBeNull();
  });

  it('soporta el campo legacy pricePerKilo como señal de venta por kilo', () => {
    expect(
      getOpenBagRemainingKg(
        makeProduct({ presentations: [], pricePerKilo: 5000, openBagRemainingKg: 3.5 }),
      ),
    ).toBe(3.5);
  });

  it('devuelve null si no hay producto', () => {
    expect(getOpenBagRemainingKg(null)).toBeNull();
    expect(getOpenBagRemainingKg(undefined)).toBeNull();
  });
});

describe('formatKg', () => {
  it('quita ceros innecesarios', () => {
    expect(formatKg(7)).toBe('7');
    expect(formatKg(7.5)).toBe('7.5');
    expect(formatKg(7.25)).toBe('7.25');
    expect(formatKg(0)).toBe('0');
  });
});

describe('getOpenBagLabel', () => {
  it('arma la etiqueta completa', () => {
    expect(getOpenBagLabel(makeProduct())).toBe('Sobrante abierto: 7 kg');
  });

  it('muestra el badge para el caso real: bag de 15kg con 10kg restantes y kilo activa', () => {
    expect(
      getOpenBagLabel(
        makeProduct({
          presentations: [
            kiloPresentation(),
            bagPresentation({ weightKg: 15, openBagRemainingKg: 10 }),
          ],
        }),
      ),
    ).toBe('Sobrante abierto: 10 kg');
  });

  it('usa punto decimal para los kilos fraccionarios', () => {
    expect(
      getOpenBagLabel(
        makeProduct({
          presentations: [kiloPresentation(), bagPresentation({ openBagRemainingKg: 7.5 })],
        }),
      ),
    ).toBe('Sobrante abierto: 7.5 kg');
  });

  it('devuelve null cuando no hay bolsa abierta', () => {
    expect(
      getOpenBagLabel(
        makeProduct({
          presentations: [kiloPresentation(), bagPresentation({ openBagRemainingKg: 0 })],
        }),
      ),
    ).toBeNull();
  });
});
