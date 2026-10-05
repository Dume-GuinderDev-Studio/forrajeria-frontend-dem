import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  buildPresentationsPayload,
  ProductPresentationsSection,
  type PresentationsPayloadInput,
} from './ProductPresentationsSection';
import type { Product } from '@/infrastructure/products.service';

// La bolsa cerrada no tiene precio ni costo propios: salen del formulario principal.
const row = (weightKg: number | null, openBagRemainingKg: number | null = null) => ({
  id: 'r',
  weightKg,
  openBagRemainingKg,
});

// Defaults explícitos + spread: los defaults solo aplican si la clave viene
// ausente, así que `generalPrice: null` llega como null de verdad (con `??`
// no se distinguiría "no pasado" de "sin valor").
const build = (
  bagRows: ReturnType<typeof row>[],
  overrides: Partial<PresentationsPayloadInput> = {},
) =>
  buildPresentationsPayload({
    bagRows,
    kiloEnabled: false,
    kiloPrice: null,
    kiloCost: null,
    generalPrice: 100,
    generalCost: null,
    ...overrides,
  });

describe('buildPresentationsPayload', () => {
  it('filtra filas sin peso válido', () => {
    const result = build([row(10), row(null), row(0)], { generalPrice: 100 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'bag', weightKg: 10, price: 100 });
  });

  it('toma el precio y el costo de la bolsa del formulario principal', () => {
    const result = build([row(21)], { generalPrice: 47999, generalCost: 39000 });

    expect(result).toEqual([{ type: 'bag', weightKg: 21, price: 47999, cost: 39000 }]);
  });

  it('no genera bolsa si el precio general no es un número válido', () => {
    expect(build([row(10)], { generalPrice: null })).toHaveLength(0);
    expect(build([row(10)], { generalPrice: 0 })).toHaveLength(0);
  });

  it('normaliza el costo general inválido a null en la bolsa', () => {
    const result = build([row(10)], { generalPrice: 100, generalCost: -5 });

    expect(result[0]).toMatchObject({ price: 100, cost: null });
  });

  it('incluye los kg de bolsa abierta solo cuando son >= 0', () => {
    expect(build([row(10, 4.5)], { generalPrice: 100 })[0]).toMatchObject({
      openBagRemainingKg: 4.5,
    });
    expect(build([row(10, 0)], { generalPrice: 100 })[0]).toMatchObject({
      openBagRemainingKg: 0,
    });
    expect(build([row(10, null)], { generalPrice: 100 })[0]).not.toHaveProperty(
      'openBagRemainingKg',
    );
  });

  it('agrega presentación por kilo cuando está habilitada con precio válido', () => {
    const result = build([row(10)], {
      kiloEnabled: true,
      kiloPrice: 8500,
      kiloCost: 5000,
      generalPrice: 100,
    });

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      type: 'kilo',
      weightKg: null,
      price: 8500,
      cost: 5000,
    });
  });

  it('no agrega kilo si está deshabilitado o el precio es inválido', () => {
    expect(build([row(10)], { kiloEnabled: false, kiloPrice: 8500 })).toHaveLength(1);
    expect(build([row(10)], { kiloEnabled: true, kiloPrice: null })).toHaveLength(1);
    expect(build([row(10)], { kiloEnabled: true, kiloPrice: 0 })).toHaveLength(1);
  });

  it('el kilo conserva su propio precio, no el de la bolsa', () => {
    const result = build([row(15)], {
      kiloEnabled: true,
      kiloPrice: 3500,
      generalPrice: 50000,
    });

    expect(result.find((p) => p.type === 'kilo')).toMatchObject({ price: 3500 });
  });

  it('una única bolsa válida genera un array de 1 bag (+ kilo opcional)', () => {
    const onlyBag = build([row(15)], { generalPrice: 50000, generalCost: 40000 });

    expect(onlyBag).toHaveLength(1);
    expect(onlyBag[0].type).toBe('bag');

    const withKilo = build([row(15)], {
      kiloEnabled: true,
      kiloPrice: 3500,
      generalPrice: 50000,
      generalCost: 40000,
    });

    expect(withKilo).toHaveLength(2);
    expect(withKilo.map((p) => p.type)).toEqual(['bag', 'kilo']);
  });

  it('una bolsa sin peso no genera presentaciones', () => {
    expect(build([row(null)], { generalPrice: 50000 })).toHaveLength(0);
  });
});

describe('ProductPresentationsSection (single bag UI)', () => {
  const onChange = vi.fn();

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // formatARS separa el $ del número con espacio duro (U+00A0): el matcher
  // tiene que tolerarlo o el texto no matchea nunca.
  const echoRegex = (price: string, cost: string) =>
    new RegExp(
      `Precio\\s*\\$\\s*${escapeRe(price)}\\s*·\\s*Costo\\s*(?:\\$\\s*)?${escapeRe(cost)}`,
    );

  const renderSection = (
    props: Partial<React.ComponentProps<typeof ProductPresentationsSection>> = {},
  ) =>
    render(
      <ProductPresentationsSection
        product={null}
        generalPrice={50000}
        generalCost={40000}
        onPresentationsChange={onChange}
        {...props}
      />,
    );

  it('no expone el botón Agregar bolsa', () => {
    renderSection();

    expect(screen.queryByText(/agregar bolsa/i)).toBeNull();
    expect(screen.getByPlaceholderText('Peso (kg)')).toBeInTheDocument();
  });

  it('no tiene inputs de precio ni de costo propios en la bolsa cerrada', () => {
    renderSection();

    expect(screen.queryByPlaceholderText('Precio ($)')).toBeNull();
    expect(screen.queryByPlaceholderText('Costo ($)')).toBeNull();
  });

  it('muestra en solo lectura el precio y el costo que salen del formulario principal', () => {
    renderSection();

    expect(screen.getByText(echoRegex('50.000', '40.000'))).toBeInTheDocument();
  });

  it('el eco del precio se actualiza con los valores generales', () => {
    const { rerender } = renderSection();

    rerender(
      <ProductPresentationsSection
        product={null}
        generalPrice={51000}
        generalCost={41000}
        onPresentationsChange={onChange}
      />,
    );

    expect(screen.getByText(echoRegex('51.000', '41.000'))).toBeInTheDocument();
  });

  it('sin costo general el eco lo muestra como sin definir', () => {
    renderSection({ generalCost: null });

    expect(screen.getByText(echoRegex('50.000', '—'))).toBeInTheDocument();
  });

  it('muestra los helpers de bolsa cerrada y kilo suelto', () => {
    renderSection();

    expect(
      screen.getByText('Definí el peso de la bolsa cerrada y cuántos kilos quedan abiertos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Definí si este producto también se vende por kilo suelto en la tienda.'),
    ).toBeInTheDocument();
  });

  it('precarga el peso de la bolsa guardada y avisa si difiere del general', () => {
    const product = {
      id: 'p1',
      name: 'Alimento Test',
      price: 50000,
      cost: 40000,
      stock: 10,
      category: { id: 'c1', name: 'Perro' },
      lifeStage: 'Adulto',
      presentations: [{ type: 'bag', weightKg: 15, price: 52000, cost: 41000 }],
    } as unknown as Product;

    renderSection({ product });

    expect(screen.getByPlaceholderText('Peso (kg)')).toHaveValue(15);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('52.000');
    expect(alert.textContent).toContain('50.000');
    expect(alert.textContent).toContain('41.000');
    expect(alert.textContent).toContain('40.000');
  });

  it('no avisa cuando la bolsa guardada coincide con el general', () => {    const product = {
      id: 'p1',
      name: 'Alimento Test',
      price: 50000,
      cost: 40000,
      stock: 10,
      category: { id: 'c1', name: 'Perro' },
      lifeStage: 'Adulto',
      presentations: [{ type: 'bag', weightKg: 15, price: 50000, cost: 40000 }],
    } as unknown as Product;

    renderSection({ product });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('avisa cuando la bolsa guardada no tiene costo y el producto sí', () => {
    const product = {
      id: 'p1',
      name: 'Alimento Test',
      price: 50000,
      cost: 40000,
      stock: 10,
      category: { id: 'c1', name: 'Perro' },
      lifeStage: 'Adulto',
      presentations: [{ type: 'bag', weightKg: 15, price: 50000 }],
    } as unknown as Product;

    renderSection({ product });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('sin definir');
    expect(alert.textContent).toContain('40.000');
  });

  it('no avisa si ni la bolsa guardada ni el producto tienen costo', () => {
    const product = {
      id: 'p1',
      name: 'Alimento Test',
      price: 50000,
      stock: 10,
      category: { id: 'c1', name: 'Perro' },
      lifeStage: 'Adulto',
      presentations: [{ type: 'bag', weightKg: 15, price: 50000 }],
    } as unknown as Product;

    renderSection({ product });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('con N>1 bolsas muestra solo la primera + aviso sin romper', () => {
    const product = {
      id: 'p1',
      name: 'Alimento Test',
      price: 50000,
      stock: 10,
      category: { id: 'c1', name: 'Perro' },
      lifeStage: 'Adulto',
      presentations: [
        { type: 'bag', weightKg: 15, price: 50000 },
        { type: 'bag', weightKg: 7.5, price: 26000 },
      ],
    } as unknown as Product;

    renderSection({ product });

    // Solo la primera bolsa es editable…
    expect(screen.getByPlaceholderText('Peso (kg)')).toHaveValue(15);
    // …y el aviso no bloqueante cuenta el total.
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('2 configuraciones de bolsa');
    expect(alert.textContent).toContain('se muestra la primera');
  });
});
