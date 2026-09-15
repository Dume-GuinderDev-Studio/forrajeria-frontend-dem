/**
 * Parsea números con separadores de miles estilo lista de proveedores, tanto
 * en-US ("72,666.00") como es-AR ("72.666,00") → 72666.
 *
 * Regla conservadora con los decimales:
 * - Si hay AMBOS separadores (`,` y `.`), el ÚLTIMO es el decimal y el otro
 *   es de miles: se elimina el de miles y el decimal pasa a `.`.
 * - Si hay un solo tipo de separador REPETIDO ("1.000.000", "1,000,000"), son
 *   todos de miles: se eliminan.
 * - Si hay UN SOLO separador ("72.5", "72.66", "72.666"), se trata como
 *   decimal. NOTA: "72.666" se lee como 72.666 y NO como 72666 — los miles de
 *   un solo grupo necesitan el decimal explícito ("72.666,00"). Se prioriza
 *   no romper decimales chicos antes que adivinar miles ambiguos.
 *
 * Devuelve null si no hay un número válido (nunca NaN). Acepta espacios,
 * NBSP y símbolos como `$` (se ignoran).
 */
export const parseLocalizedNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const normalized = normalizeNumberText(value);
  if (normalized === '' || normalized === '-' || normalized === '.') return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

/**
 * Normaliza el texto a formato canónico con `.` decimal (ej. "72,666.00" →
 * "72666.00"). Devuelve '' si no hay dígitos. Se usa para mostrar el valor
 * ya limpio en el input después de pegar.
 */
export const normalizeNumberText = (raw: string): string => {
  let text = raw.trim().replace(/\s/g, '');
  if (text === '') return '';
  const negative = text.startsWith('-');
  // Quitar todo lo que no sea dígito ni separador (ej. `$`, letras).
  text = text.replace(/[^0-9.,]/g, '');
  if (text === '' || /^[.,]+$/.test(text)) return '';

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  let out: string;
  if (lastDot !== -1 && lastComma !== -1) {
    // Ambos separadores: el último es el decimal, el otro es de miles.
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    out = text.split(thousandsSep).join('');
    // Si el decimal aparecía más de una vez, quedarse con el último.
    const parts = out.split(decimalSep);
    const int = parts.slice(0, -1).join('');
    out = `${int}.${parts[parts.length - 1]}`;
  } else if (lastDot !== -1) {
    out = text.indexOf('.') !== lastDot ? text.split('.').join('') : text;
  } else {
    out =
      text.indexOf(',') !== lastComma ? text.split(',').join('') : text.replace(',', '.');
  }

  // Seguridad: un solo punto decimal como máximo.
  const chunks = out.split('.');
  if (chunks.length > 2) {
    const frac = chunks.pop() as string;
    out = `${chunks.join('')}.${frac}`;
  }
  if (out === '' || out === '.') return '';
  return negative && !out.startsWith('-') ? `-${out}` : out;
};
