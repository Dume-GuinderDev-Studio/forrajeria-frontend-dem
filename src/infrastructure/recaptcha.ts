/**
 * Helper para obtener un token de reCAPTCHA v3.
 *
 * El script de reCAPTCHA ya NO está hardcodeado en `index.html`: lo inyecta
 * `loadRecaptchaScript()` únicamente cuando el interruptor del frontend
 * `VITE_RECAPTCHA_ENABLED` está habilitado (default `true`). Cuando está en
 * `false` no se carga el script, no se verifica nada y `getRecaptchaToken`
 * devuelve `''` al instante, así ningún botón de enviar queda esperando un
 * token que nunca va a existir.
 *
 * El backend (RecaptchaGuard) espera este token en el header
 * `x-recaptcha-token` al llamar a POST /orders/whatsapp-link. Sin token,
 * `orders.service` omite el header por completo.
 */

// Fallback por si el script todavía no está en el DOM. Debe coincidir con
// el site key que usa el backend.
const FALLBACK_RECAPTCHA_SITE_KEY = '6Lff4XcsAAAAAIifW5PRhvB3zIrk2d4CUXo5NapJ';

const RECAPTCHA_SCRIPT_URL = `https://www.google.com/recaptcha/api.js?render=${FALLBACK_RECAPTCHA_SITE_KEY}`;

interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

// Se lee SIEMPRE en el momento de la llamada (nunca a nivel de módulo) para
// que los tests puedan stubear `import.meta.env` con `vi.stubEnv`.
export const isRecaptchaEnabled = (): boolean => {
  const raw = import.meta.env.VITE_RECAPTCHA_ENABLED;
  if (typeof raw !== 'string') return true;
  return raw.trim().toLowerCase() !== 'false';
};

// Promesa cacheada para que llamadas concurrentes no inyecten el script dos
// veces. Se resetea a `null` si la carga falla, permitiendo un reintento.
let recaptchaScriptPromise: Promise<void> | null = null;

/**
 * Inyecta el `<script>` de reCAPTCHA en `document.head` de forma perezosa e
 * idempotente. Si el interruptor está apagado, resuelve al instante sin tocar
 * el DOM. Es una no-op en entornos sin `document`.
 */
export const loadRecaptchaScript = (): Promise<void> => {
  if (!isRecaptchaEnabled()) {
    return Promise.resolve();
  }

  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (document.querySelector('script[src*="recaptcha/api.js"]')) {
    return Promise.resolve();
  }

  if (recaptchaScriptPromise) {
    return recaptchaScriptPromise;
  }

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RECAPTCHA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Liberamos la caché para que un reintento vuelva a intentar inyectar.
      recaptchaScriptPromise = null;
      reject(new Error('No se pudo cargar reCAPTCHA. Recargá la página e intentá de nuevo.'));
    };
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
};

const getRecaptchaSiteKey = (): string => {
  if (typeof document !== 'undefined') {
    const script = document.querySelector('script[src*="recaptcha/api.js"]');
    const src = script?.getAttribute('src') || '';
    const match = src.match(/[?&]render=([^&]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return FALLBACK_RECAPTCHA_SITE_KEY;
};

/**
 * Devuelve el token de reCAPTCHA para la `action` pedida.
 *
 * Con el interruptor apagado devuelve `''` al instante: nunca rechaza, nunca
 * se queda colgado y el caller (CartDrawer) no queda esperando un token. El
 * `''` hace que `orders.service` no mande el header `x-recaptcha-token`.
 */
export const getRecaptchaToken = async (action: string): Promise<string> => {
  if (!isRecaptchaEnabled()) {
    return '';
  }

  // Si el script no cargó (o sigue cargando), acá se frena: un error de carga
  // se convierte en el mensaje de error que ya muestra CartDrawer.
  await loadRecaptchaScript();

  const grecaptcha = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;

  if (!grecaptcha) {
    return Promise.reject(
      new Error('reCAPTCHA no está disponible. Recargá la página e intentá de nuevo.'),
    );
  }

  const siteKey = getRecaptchaSiteKey();

  return new Promise<string>((resolve, reject) => {
    grecaptcha.ready(() => {
      try {
        grecaptcha.execute(siteKey, { action }).then(resolve).catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  });
};
