import { describe, expect, it } from 'vitest';
import { formatARS, roundToCents, roundToWholePeso } from './format';

describe('roundToWholePeso (display-only storefront)', () => {
  it('redondea al peso entero más cercano', () => {
    expect(roundToWholePeso(113421.69)).toBe(113422);
    expect(roundToWholePeso(113421.49)).toBe(113421);
    expect(roundToWholePeso(11256.5)).toBe(11257);
    expect(roundToWholePeso(0)).toBe(0);
  });
});

describe('formatARS (peso entero sin centavos)', () => {
  it('formatea con separador de miles y sin centavos', () => {
    expect(formatARS(roundToWholePeso(113421.69))).toBe(formatARS(113422));
    expect(formatARS(113422)).toContain('113.422');
    expect(formatARS(113422)).not.toContain(',00');
  });

  it('devuelve "—" para null/undefined', () => {
    expect(formatARS(null)).toBe('—');
    expect(formatARS(undefined)).toBe('—');
  });
});

describe('roundToCents (montos que viajan al backend)', () => {
  it('quita la cola de coma flotante de una resta', () => {
    // 11000.1 - 6413.9 da 4586.200000000001 en IEEE-754, que el backend rechaza
    // con 400 (totalAmount es @IsNumber({ maxDecimalPlaces: 2 })).
    const crudo = 11000.1 - 6413.9;
    expect(crudo).toBe(4586.200000000001);
    expect(roundToCents(crudo)).toBe(4586.2);
  });

  it('redondea a dos decimales', () => {
    expect(roundToCents(1.005)).toBe(1.01);
    expect(roundToCents(4586.200000000001)).toBe(4586.2);
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
    expect(roundToCents(20000)).toBe(20000);
    expect(roundToCents(0)).toBe(0);
  });

  it('tolera valores numéricos venidos de strings', () => {
    expect(roundToCents('4586.239' as unknown as number)).toBe(4586.24);
  });
});
