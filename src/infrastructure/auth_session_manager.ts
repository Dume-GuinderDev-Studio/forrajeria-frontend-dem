import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { navigateTo } from '@/routing/navigation';
import { devLog, devWarn } from '@/infrastructure/utils/logger';

export interface User {
  id?: string;
  email: string;
  name?: string;
  role?: string;
  picture?: string;
}

const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

const isLocalStorageAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    devWarn('[Auth] localStorage unavailable, using memory fallback (Safari ITP)');
    return false;
  }
};

const createSafeStorage = (): StateStorage => {
  if (isLocalStorageAvailable()) {
    return {
      getItem: (name: string): string | null => {
        try {
          return localStorage.getItem(name);
        } catch (e) {
          devWarn('[Auth] Error reading from localStorage:', e);
          return null;
        }
      },
      setItem: (name: string, value: string): void => {
        try {
          localStorage.setItem(name, value);
        } catch (e) {
          devWarn('[Auth] Error writing to localStorage:', e);
        }
      },
      removeItem: (name: string): void => {
        try {
          localStorage.removeItem(name);
        } catch (e) {
          devWarn('[Auth] Error removing from localStorage:', e);
        }
      },
    };
  }

  devLog('[Auth] Using in-memory storage (Safari/private mode)');
  const memoryStorage: Record<string, string> = {};
  return {
    getItem: (name: string): string | null => memoryStorage[name] || null,
    setItem: (name: string, value: string): void => {
      memoryStorage[name] = value;
    },
    removeItem: (name: string): void => {
      delete memoryStorage[name];
    },
  };
};

const storage = createSafeStorage();

if (typeof window !== 'undefined' && isSafari()) {
  devLog('[Auth] Safari detected - using safe storage');
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  /** Sesión por cookie HttpOnly (flujo Google nuevo): el JWT no es legible
   *  por JS, se guarda solo el usuario; la cookie viaja sola con
   *  `withCredentials`. `token` queda en null. */
  loginWithCookie: (user: User) => void;
  logout: () => void;
}

// -----------------------------------------------------------------------------
// SEGURIDAD — trade-off del almacenamiento del JWT
// -----------------------------------------------------------------------------
// El token se guarda en localStorage (vía zustand persist) porque el backend
// actual lo devuelve en el body (login admin) o en el query string (Google) y
// el interceptor de Axios lo lee de acá para armar el header `Authorization`.
//
// Riesgo: localStorage es accesible por cualquier JS del mismo origen, por lo
// que un XSS podría robar el token.
//
// Migración ideal (requiere backend, fuera de este repo):
//   1. El backend setea una cookie httpOnly + Secure + SameSite=Strict con el
//      token y NO lo expone al JavaScript.
//   2. El frontend deja de guardar el token en el store y simplemente llama a
//      GET /auth/me (la cookie viaja automáticamente en cada request).
//   3. Axios debe configurarse con `withCredentials: true`.
//
// Mitigaciones mientras tanto (lado frontend/infraestructura):
//   - Servir la app con un CSP estricto (restringe ejecución de scripts).
//   - Nunca renderizar HTML crudo proveniente del backend (solo texto/imgs).
//   - Mantener el token fuera de URLs y logs (ver GoogleCallback y api.ts).
// -----------------------------------------------------------------------------
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      loginWithCookie: (user) => {
        set({ user, token: null, isAuthenticated: true });
      },

      logout: () => {
        // 0. Invalidar la cookie HttpOnly `auth_token` en el backend. Es
        //    fire-and-forget: aunque falle la red, igual limpiamos el estado
        //    local. Import dinámico para evitar ciclo estático con api.ts
        //    (api.ts importa este store para el interceptor). La ruta no
        //    requiere auth: limpia aunque el JWT esté vencido.
        void import('./api')
          .then((m) => m.default.post('/auth/logout').catch(() => {}))
          .catch(() => {});

        // 1. Limpiar el estado en memoria. El middleware de persist
        //    escribe este estado limpio (sin token) en el storage.
        set({ user: null, token: null, isAuthenticated: false });

        // 2. Limpieza selectiva: eliminar sólo la key de auth. NO usamos
        //    localStorage.clear() para preservar el carrito ('cart-storage')
        //    y los datos de cliente ('customer-info-storage', en sessionStorage).
        storage.removeItem('auth-storage');

        // 3. Redirigir vía SPA (sin full reload).
        navigateTo('/login');
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => storage),
    },
  ),
);
