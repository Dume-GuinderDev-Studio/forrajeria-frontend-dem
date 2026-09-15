/**
 * Extrae de forma recursiva el primer mensaje de error legible de los
 * payloads de validación del backend (NestJS/class-validator).
 *
 * El backend puede responder con un `message` que es string o un array de
 * objetos con `constraints` y `children`. Esta función normaliza esa
 * estructura a un string único (o `null` si no hay nada).
 */
export const extractValidationMessage = (node: unknown): string | null => {
  if (!node) return null;
  if (typeof node === 'string') return node;

  const anyNode = node as { constraints?: Record<string, string>; children?: unknown[] };

  if (anyNode.constraints) {
    const values = Object.values(anyNode.constraints);
    if (values.length > 0) return values.join('. ');
  }

  if (Array.isArray(anyNode.children)) {
    for (const child of anyNode.children) {
      const message = extractValidationMessage(child);
      if (message) return message;
    }
  }

  return null;
};
