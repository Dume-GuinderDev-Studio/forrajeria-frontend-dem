/**
 * Helper para obtener un token de reCAPTCHA v3.
 *
 * El script de reCAPTCHA ya se carga en `index.html` con
 * `https://www.google.com/recaptcha/api.js?render=<site-key>`.
 * Acá simplemente usamos el `window.grecaptcha` global que deja disponible.
 *
 * El backend (RecaptchaGuard) espera este token en el header
 * `x-recaptcha-token` al llamar a POST /orders/whatsapp-link.
 */

// Fallback por si el script no está en el DOM. Debe coincidir con index.html.
const FALLBACK_RECAPTCHA_SITE_KEY = '6Lff4XcsAAAAAIifW5PRhvB3zIrk2d4CUXo5NapJ';

interface Grecaptcha {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
}

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

export const getRecaptchaToken = (action: string): Promise<string> => {
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
