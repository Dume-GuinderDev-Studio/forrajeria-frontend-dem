import { describe, expect, it } from 'vitest';
import { formatARS, roundToWholePeso } from './format';

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
