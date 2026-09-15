import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/infrastructure/auth_session_manager';
import api from '@/infrastructure/api';
import { Loader2 } from 'lucide-react';
import { devError, devLog } from '@/infrastructure/utils/logger';

export const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loginWithCookie = useAuthStore((state) => state.loginWithCookie);
  const processed = useRef(false);

  useEffect(() => {
    // Evita procesar dos veces (React StrictMode re-ejecuta efectos en dev).
    if (processed.current) return;
    processed.current = true;

    const finish = (userData: { role?: string }) => {
      const destination = userData?.role === 'empleado' ? '/empleado/dashboard' : '/admin';
      navigate(destination, { replace: true });
    };

    const run = async () => {
      // Mitigación: limpiar la URL de inmediato para que ningún parámetro
      // residual quede en historial ni se filtre vía Referer.
      const legacyToken = searchParams.get('token') || searchParams.get('access_token');
      const legacyUserStr = searchParams.get('user');
      window.history.replaceState(null, '', window.location.pathname);

      // -------------------------------------------------------------------
      // CONTRATO NUEVO (backend SEC-TOKEN-IN-URL): el backend setea el JWT
      // en cookie HttpOnly `auth_token` (Secure + SameSite=Lax) y redirige a
      // /auth/google/callback SIN parámetros. La sesión se completa con
      // GET /api/auth/me (la cookie viaja con withCredentials:include).
      // El store guarda solo el usuario; el token queda fuera del JS.
      // -------------------------------------------------------------------
      try {
        const { data } = await api.get('/auth/me');
        // LOG TEMPORAL (dev-only): qué respondió /auth/me tras el redirect.
        devLog('[Auth] GoogleCallback: /auth/me respondió:', data);
        if (data?.email) {
          devLog('[Auth] GoogleCallback: sesión por cookie OK, rol:', data.role);
          loginWithCookie({
            id: data.id,
            email: data.email,
            role: data.role,
          });
          finish(data);
          return;
        }
        devLog('[Auth] GoogleCallback: /auth/me 200 pero sin email, probando legacy');
      } catch (err: unknown) {
        // Sin sesión por cookie → caer al fallback legacy (transición).
        devLog(
          '[Auth] GoogleCallback: /auth/me falló, probando legacy. Status:',
          (err as { response?: { status?: number } })?.response?.status,
        );
      }

      // -------------------------------------------------------------------
      // FALLBACK LEGACY (deprecado): backend viejo redirigía con
      // ?token=...&user=... Se mantiene durante la transición para no romper
      // clientes con backend sin actualizar. Eliminar cuando se verifique
      // que producción ya emite solo la cookie + redirect limpio.
      // -------------------------------------------------------------------
      if (legacyToken && legacyUserStr) {
        try {
          const userData = JSON.parse(decodeURIComponent(legacyUserStr));
          login(userData, legacyToken);
          finish(userData);
        } catch {
          // No logueamos el token ni la URL completa.
          devError('Error parsing user data from Google callback');
          navigate('/login?error=invalid_user_data', { replace: true });
        }
      } else {
        devError('Missing session: no cookie session (/auth/me) nor legacy query params');
        navigate('/login?error=missing_params', { replace: true });
      }
    };

    run();
  }, [searchParams, login, loginWithCookie, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">
          Autenticando con <span className="text-blue-600">Google</span>
        </h2>
        <p className="text-slate-500 animate-pulse">
          Sincronizando tu identidad con BAS Pet Shop...
        </p>
      </div>
    </div>
  );
};
