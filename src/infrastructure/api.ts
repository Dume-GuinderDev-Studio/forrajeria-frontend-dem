import axios, { AxiosError } from 'axios';
import { useAuthStore } from './auth_session_manager';
import { devLog, devWarn, devError } from '@/infrastructure/utils/logger';

const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

export const getBrowserInfo = (): string => {
  if (typeof window === 'undefined') return 'SSR';
  const ua = navigator.userAgent;
  const isSafariBrowser = isSafari();
  return `UA: ${ua.substring(0, 50)}..., isSafari: ${isSafariBrowser}`;
};

const api = axios.create({
  baseURL: import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 60000,
  // Contrato de sesión Google OAuth (SEC-TOKEN-IN-URL): el backend setea el
  // JWT en cookie HttpOnly `auth_token` y redirige sin parámetros. Esta flag
  // hace que el navegador la envíe automáticamente en cada request (incluido
  // GET /auth/me). Sin esto, la sesión por cookie no viaja cross-origin.
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      devLog('[API] No token found in auth store');
    }

    if (isSafari()) {
      devLog('[API/Safari] Request:', config.method?.toUpperCase(), config.url);
      devLog('[API/Safari] Auth header:', config.headers.Authorization ? 'Present' : 'Missing');
    }

    return config;
  },
  (error) => {
    devError('[API] Request interceptor error:', error);
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url;

    devError('[API Error]', status, url);
    devError('[API Error] Response:', error.response?.data);
    devError('[API Error] Message:', error.message);

    if (status === 401) {
      // El 401 de /auth/admin/login significa "credenciales incorrectas"
      // y NO debe disparar el logout automático (lo maneja LoginPage
      // mostrando el error). Para el resto de endpoints, un 401 indica
      // sesión vencida o inválida.
      const isLoginAttempt = url === '/auth/admin/login';
      if (!isLoginAttempt) {
        devWarn('[API] Session expired (401). Logging out...');
        useAuthStore.getState().logout();
      }
    } else if (status === 403) {
      devWarn('[API] Access forbidden (403)');
    } else if (status === 0 || status === undefined) {
      devError('[API] Network error or CORS issue - no response received');
      if (isSafari()) {
        devError('[API/Safari] Possible Safari CORS or ITP issue detected');
      }
    }

    return Promise.reject(error);
  },
);

export default api;
