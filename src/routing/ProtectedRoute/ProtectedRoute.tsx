import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '@/infrastructure/api';
import { useAuthStore } from '@/infrastructure/auth_session_manager';
import { devLog } from '@/infrastructure/utils/logger';
import styles from './ProtectedRoute.module.css';

type SessionStatus = 'loading' | 'authorized' | 'unauthorized';

interface MePayload {
  user?: {
    role?: string;
  };
  role?: string;
}

const AUTHORIZED_ROLES = ['admin', 'empleado'];

/**
 * Hook compartido: valida la sesión contra GET /auth/me y expone el estado
 * junto con el rol devuelto por el backend.
 */
const useSessionStatus = () => {
  // OJO: no exigir `token`. En el flujo Google OAuth la sesión vive en la
  // cookie HttpOnly `auth_token` y el store queda con `token: null`
  // (loginWithCookie). Exigir token acá marcaba esas sesiones como
  // 'unauthorized' sin siquiera llamar a /auth/me y la app rebotaba a
  // /login aunque el backend devolviera 200 válido.
  const { isAuthenticated, logout } = useAuthStore();
  const hadSession = useRef(isAuthenticated);
  const [status, setStatus] = useState<SessionStatus>(
    isAuthenticated ? 'loading' : 'unauthorized',
  );
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      devLog('[Auth] useSessionStatus: sin sesión en store → unauthorized');
      setStatus('unauthorized');
      setRole(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    devLog('[Auth] useSessionStatus: validando sesión contra GET /auth/me…');

    api
      .get<MePayload>('/auth/me')
      .then((response) => {
        if (cancelled) return;

        // LOG TEMPORAL (dev-only): qué respondió /auth/me.
        devLog('[Auth] /auth/me respondió:', response.data);
        const data = response.data;
        // El backend devuelve el body plano { id, email, role }; se acepta
        // también el formato envuelto { user: {...} } por compatibilidad.
        const me = data?.user ?? data;
        const meRole = me?.role;

        if (meRole && AUTHORIZED_ROLES.includes(meRole)) {
          // LOG TEMPORAL (dev-only): decisión tomada con la respuesta.
          devLog('[Auth] rol autorizado → authorized:', meRole);
          setRole(meRole);
          setStatus('authorized');
        } else {
          devLog('[Auth] rol ausente o desconocido → unauthorized. Body:', data);
          setRole(null);
          setStatus('unauthorized');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // LOG TEMPORAL (dev-only): la promesa rechazó antes de decidir.
          devLog(
            '[Auth] /auth/me falló → unauthorized. Status:',
            (error as { response?: { status?: number } })?.response?.status,
          );
          setRole(null);
          setStatus('unauthorized');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (status === 'unauthorized' && hadSession.current) {
      logout();
    }
  }, [status, logout]);

  return { status, role };
};

const SessionLoader = () => (
  <div className={styles.loader}>
    <Loader2 className={styles.spinner} />
    <p className={styles.text}>Verificando tu sesión...</p>
  </div>
);

/**
 * Protege rutas para cualquier usuario autenticado con un rol conocido
 * (admin o empleado). Redirige a /login si no hay sesión válida.
 */
export const ProtectedRoute = () => {
  const { status } = useSessionStatus();

  if (status === 'loading') {
    return <SessionLoader />;
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

/**
 * Variante para rutas exclusivas del admin. Si quien navega es un empleado
 * autenticado, lo redirige a su propio dashboard en vez del login.
 */
export const AdminProtectedRoute = () => {
  const { status, role } = useSessionStatus();

  if (status === 'loading') {
    return <SessionLoader />;
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'admin') {
    return <Navigate to="/empleado/dashboard" replace />;
  }

  return <Outlet />;
};
