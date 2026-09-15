import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { useAuthStore } from '@/infrastructure/auth_session_manager';
import api from '@/infrastructure/api';

export const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();

  // Admin section state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      toast.error(
        'Error de autenticación: ' +
          (error === 'missing_params'
            ? 'Faltan parámetros de sesión'
            : 'Datos de usuario inválidos'),
      );
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    const apiUrl =
      import.meta.env.NEXT_PUBLIC_API_URL ||
      import.meta.env.VITE_API_URL ||
      'https://backend-bas.onrender.com/api';
    window.location.href = `${apiUrl}/auth/google`;
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setIsLoading(true);

    try {
      const { data } = await api.post<{
        user: { id: string; email: string; firstName: string; lastName: string; role: string };
        token: string;
      }>('/auth/admin/login', { email: email.trim(), password });

      login(
        {
          id: data.user.id,
          email: data.user.email,
          name: `${data.user.firstName} ${data.user.lastName}`.trim(),
          role: data.user.role,
        },
        data.token,
      );

      const destination = data.user.role === 'empleado' ? '/empleado/dashboard' : '/admin/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401) {
          setAdminError('Credenciales incorrectas. Verificá tu email y contraseña.');
        } else if (status === 429) {
          setAdminError('Demasiados intentos. Esperá un momento y volvé a intentarlo.');
        } else {
          setAdminError('Error al iniciar sesión. Intentá de nuevo más tarde.');
        }
      } else {
        setAdminError('Error de conexión. Verificá tu internet.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border-t-8 border-blue-700 overflow-hidden">
        <div className="p-8 flex flex-col items-center text-center">
          {/* Logo Section */}
          <div className="mb-6">
            <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-2 overflow-hidden mx-auto border-4 border-blue-100">
              <img
                src="/logo.png"
                alt="BAS Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">BAS Pet Shop</h1>
            <p className="text-blue-600 font-medium italic">"Tu mascota feliz"</p>
          </div>

          <div className="w-full space-y-4">
            <p className="text-sm text-slate-500 font-medium">Ingresá con tu cuenta corporativa</p>

            {/* Google Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">o</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Admin toggle button */}
            <button
              type="button"
              onClick={() => {
                setShowAdminForm((v) => !v);
                setAdminError('');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Soy administrador
              <svg
                className={`w-4 h-4 ml-auto transition-transform duration-300 ${showAdminForm ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Admin form — animated collapse */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdminForm ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <form onSubmit={handleAdminLogin} className="pt-1 space-y-3 text-left">
                {/* Error banner */}
                {adminError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
                    <svg
                      className="w-4 h-4 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10c0 4.418-3.582 8-8 8S2 14.418 2 10 5.582 2 10 2s8 3.582 8 8zm-9-3a1 1 0 112 0v3a1 1 0 11-2 0V7zm1 6a1 1 0 100 2 1 1 0 000-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {adminError}
                  </div>
                )}

                {/* Email */}
                <div>
                  <label
                    htmlFor="admin-email"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ejemplo.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-medium text-slate-600 mb-1"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7a9.956 9.956 0 016.21 2.16M9.88 9.88A3 3 0 0114.12 14.12M3 3l18 18"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold py-2.5 rounded-lg transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Verificando...
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Sistema de Gestión BAS
          </div>
        </div>
      </div>
    </div>
  );
};
