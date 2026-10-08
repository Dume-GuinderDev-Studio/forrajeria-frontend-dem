import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

type RecaptchaModule = typeof import('./recaptcha');

interface GrecaptchaMock {
  ready: (callback: () => void) => void;
  execute: Mock;
}

const setGrecaptchaMock = (): GrecaptchaMock => {
  const mock: GrecaptchaMock = {
    ready: (callback) => callback(),
    execute: vi.fn().mockResolvedValue('TOKEN'),
  };
  (window as unknown as { grecaptcha?: GrecaptchaMock }).grecaptcha = mock;
  return mock;
};

const removeRecaptchaScripts = (): void => {
  document.querySelectorAll('script[src*="recaptcha"]').forEach((el) => el.remove());
};

// Import dinámico con módulos reseteados: así cada test arranca con estado
// fresco (la promesa cacheada del script vive a nivel de módulo).
const importModule = async (): Promise<RecaptchaModule> => {
  vi.resetModules();
  return import('./recaptcha');
};

beforeEach(() => {
  removeRecaptchaScripts();
});

afterEach(() => {
  removeRecaptchaScripts();
  vi.unstubAllEnvs();
  delete (window as unknown as { grecaptcha?: GrecaptchaMock }).grecaptcha;
});

describe('isRecaptchaEnabled', () => {
  it('está habilitado por defecto (sin la variable definida)', async () => {
    const { isRecaptchaEnabled } = await importModule();
    expect(isRecaptchaEnabled()).toBe(true);
  });

  it('está habilitado cuando la variable es "true"', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENABLED', 'true');
    const { isRecaptchaEnabled } = await importModule();
    expect(isRecaptchaEnabled()).toBe(true);
  });

  it('se deshabilita solo con el literal "false" (sin importar mayúsculas o espacios)', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENABLED', ' False ');
    const { isRecaptchaEnabled } = await importModule();
    expect(isRecaptchaEnabled()).toBe(false);
  });

  it('cualquier otro valor mantiene el interruptor prendido', async () => {
    vi.stubEnv('VITE_RECAPTCHA_ENABLED', '0');
    const { isRecaptchaEnabled } = await importModule();
    expect(isRecaptchaEnabled()).toBe(true);
  });
});

describe('con VITE_RECAPTCHA_ENABLED=false (interruptor apagado)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RECAPTCHA_ENABLED', 'false');
  });

  it('getRecaptchaToken devuelve "" al instante, sin ejecutar grecaptcha', async () => {
    const grecaptcha = setGrecaptchaMock();
    const { getRecaptchaToken } = await importModule();

    await expect(getRecaptchaToken('order_whatsapp')).resolves.toBe('');
    expect(grecaptcha.execute).not.toHaveBeenCalled();
  });

  it('loadRecaptchaScript no inyecta el script en el DOM', async () => {
    const { loadRecaptchaScript } = await importModule();

    await loadRecaptchaScript();

    expect(document.querySelector('script[src*="recaptcha/api.js"]')).toBeNull();
  });

  it('nunca deja una promesa pendiente que bloquee el botón de enviar', async () => {
    const { getRecaptchaToken } = await importModule();

    // Si la promesa no se resolviera, el test revienta por timeout: es
    // exactamente el escenario donde el botón de enviar quedaba trabado.
    await expect(getRecaptchaToken('order_whatsapp')).resolves.toBe('');
  });
});

describe('con reCAPTCHA habilitado (interruptor prendido)', () => {
  it('getRecaptchaToken ejecuta grecaptcha y devuelve el token', async () => {
    const grecaptcha = setGrecaptchaMock();
    const { getRecaptchaToken, loadRecaptchaScript } = await importModule();

    // jsdom no carga scripts externos: inyectamos, disparamos el onload a
    // mano y recién ahí pedimos el token.
    const loadPromise = loadRecaptchaScript();
    const script = document.querySelector('script[src*="recaptcha/api.js"]');
    expect(script).not.toBeNull();
    script!.dispatchEvent(new Event('load'));
    await loadPromise;

    await expect(getRecaptchaToken('order_whatsapp')).resolves.toBe('TOKEN');

    expect(grecaptcha.execute).toHaveBeenCalledTimes(1);
    const [siteKey, options] = grecaptcha.execute.mock.calls[0];
    expect(siteKey).toBeTruthy();
    expect(options).toEqual({ action: 'order_whatsapp' });
  });

  it('loadRecaptchaScript inyecta el script con render= en document.head', async () => {
    const { loadRecaptchaScript } = await importModule();

    const loadPromise = loadRecaptchaScript();

    const script = document.querySelector<HTMLScriptElement>(
      'script[src*="recaptcha/api.js"]',
    );
    expect(script).not.toBeNull();
    expect(document.head.contains(script)).toBe(true);
    expect(script!.src).toContain('render=');
    expect(script!.async).toBe(true);
    expect(script!.defer).toBe(true);

    script!.dispatchEvent(new Event('load'));
    await loadPromise;
  });

  it('es idempotente: no inyecta el script dos veces', async () => {
    const { loadRecaptchaScript } = await importModule();

    const first = loadRecaptchaScript();
    const script = document.querySelector('script[src*="recaptcha/api.js"]');
    script!.dispatchEvent(new Event('load'));
    await first;

    // Segunda llamada con el script ya presente en el DOM: resuelve de una.
    await loadRecaptchaScript();

    expect(document.querySelectorAll('script[src*="recaptcha/api.js"]')).toHaveLength(1);
  });

  it('rechaza con el mensaje en español si el script falla al cargar', async () => {
    const { loadRecaptchaScript } = await importModule();

    const loadPromise = loadRecaptchaScript();
    const script = document.querySelector('script[src*="recaptcha/api.js"]');
    script!.dispatchEvent(new Event('error'));

    await expect(loadPromise).rejects.toThrow(
      'No se pudo cargar reCAPTCHA. Recargá la página e intentá de nuevo.',
    );
  });
});
