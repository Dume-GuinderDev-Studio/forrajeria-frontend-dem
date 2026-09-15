import { describe, expect, it } from 'vitest';
import { normalizeNumberText, parseLocalizedNumber } from './numbers';

describe('parseLocalizedNumber', () => {
  it('interpreta miles en-US y es-AR', () => {
    expect(parseLocalizedNumber('72,666.00')).toBe(72666);
    expect(parseLocalizedNumber('72.666,00')).toBe(72666);
    expect(parseLocalizedNumber('1.234.567,89')).toBe(1234567.89);
    expect(parseLocalizedNumber('1,234,567.89')).toBe(1234567.89);
  });

  it('miles repetidos del mismo separador', () => {
    expect(parseLocalizedNumber('1.000.000')).toBe(1000000);
    expect(parseLocalizedNumber('1,000,000')).toBe(1000000);
  });

  it('no rompe decimales chicos ni de un solo separador', () => {
    expect(parseLocalizedNumber('72.5')).toBe(72.5);
    expect(parseLocalizedNumber('72.66')).toBe(72.66);
    expect(parseLocalizedNumber('72,5')).toBe(72.5);
    // Ambiguo con 3 dígitos: se prioriza decimal antes que miles.
    expect(parseLocalizedNumber('72.666')).toBe(72.666);
  });

  it('tolera espacios, NBSP y símbolos', () => {
    expect(parseLocalizedNumber(' 72 666,50 ')).toBe(72666.5);
    expect(parseLocalizedNumber('$72.666,00')).toBe(72666);
    expect(parseLocalizedNumber('72666')).toBe(72666);
  });

  it('devuelve null ante vacío o inválido (nunca NaN)', () => {
    expect(parseLocalizedNumber('')).toBeNull();
    expect(parseLocalizedNumber(null)).toBeNull();
    expect(parseLocalizedNumber(undefined)).toBeNull();
    expect(parseLocalizedNumber('abc')).toBeNull();
    expect(parseLocalizedNumber('...')).toBeNull();
    expect(parseLocalizedNumber(Number.NaN)).toBeNull();
    const result = parseLocalizedNumber('72,666.00');
    expect(result !== null && Number.isNaN(result)).toBe(false);
  });
});

describe('normalizeNumberText', () => {
  it('devuelve el texto canónico para mostrar en el input', () => {
    expect(normalizeNumberText('72,666.00')).toBe('72666.00');
    expect(normalizeNumberText('72.666,00')).toBe('72666.00');
    expect(normalizeNumberText('72.5')).toBe('72.5');
    expect(normalizeNumberText('')).toBe('');
  });
});
