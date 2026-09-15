import type { NavigateFunction } from 'react-router-dom';

/**
 * Referencia global a la función `navigate` de React Router.
 *
 * Permite navegar programáticamente desde código que vive fuera del árbol de
 * componentes React (por ejemplo, el interceptor de Axios al recibir un 401 o
 * el store de auth al hacer logout), sin recurrir a un full reload con
 * `window.location.href`.
 */
let navigateRef: NavigateFunction | null = null;

export const registerNavigate = (navigate: NavigateFunction): void => {
  navigateRef = navigate;
};

export const navigateTo = (to: string): void => {
  if (navigateRef) {
    navigateRef(to, { replace: true });
  } else {
    // Fallback de último recurso si se invoca antes de montar el router.
    window.location.assign(to);
  }
};
