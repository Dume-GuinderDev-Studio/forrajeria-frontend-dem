import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, AdminProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/infrastructure/auth_session_manager';
import api from '@/infrastructure/api';

vi.mock('@/routing/navigation', () => ({
  navigateTo: vi.fn(),
  registerNavigate: vi.fn(),
}));

vi.mock('@/infrastructure/api', () => ({
  default: { get: vi.fn() },
}));

const apiGet = api.get as unknown as Mock;

type GuardKind = 'protected' | 'admin';

const renderGuarded = (guard: GuardKind = 'protected', entry = '/admin/dashboard') => {
  const Guard = guard === 'admin' ? AdminProtectedRoute : ProtectedRoute;

  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
        <Route element={<Guard />}>
          <Route path="/admin/dashboard" element={<div>DASHBOARD_CONTENT</div>} />
        </Route>
        <Route path="/empleado/dashboard" element={<div>EMPLEADO_DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('redirige a /login cuando no hay sesión', async () => {
    renderGuarded();

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
  });

  it('muestra el contenido protegido cuando /auth/me devuelve rol admin', async () => {
    useAuthStore.setState({
      user: { email: 'admin@bas.com', role: 'admin' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockResolvedValue({ data: { role: 'admin' } });

    renderGuarded();

    expect(await screen.findByText('DASHBOARD_CONTENT')).toBeInTheDocument();
  });

  it('permite el acceso a usuarios autenticados con rol empleado', async () => {
    useAuthStore.setState({
      user: { email: 'emp@bas.com', role: 'empleado' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockResolvedValue({ data: { role: 'empleado' } });

    renderGuarded();

    expect(await screen.findByText('DASHBOARD_CONTENT')).toBeInTheDocument();
  });

  it('redirige a /login cuando /auth/me devuelve un rol desconocido', async () => {
    useAuthStore.setState({
      user: { email: 'user@bas.com', role: 'user' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockResolvedValue({ data: { role: 'user' } });

    renderGuarded();

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
  });

  it('redirige a /login cuando /auth/me falla (sesión inválida)', async () => {
    useAuthStore.setState({
      user: { email: 'admin@bas.com', role: 'admin' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockRejectedValue(new Error('401 Unauthorized'));

    renderGuarded();

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument();
  });
});

describe('AdminProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('muestra el contenido admin cuando el rol es admin', async () => {
    useAuthStore.setState({
      user: { email: 'admin@bas.com', role: 'admin' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockResolvedValue({ data: { role: 'admin' } });

    renderGuarded('admin');

    expect(await screen.findByText('DASHBOARD_CONTENT')).toBeInTheDocument();
  });

  it('redirige al dashboard del empleado cuando el rol es empleado', async () => {
    useAuthStore.setState({
      user: { email: 'emp@bas.com', role: 'empleado' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
    apiGet.mockResolvedValue({ data: { role: 'empleado' } });

    renderGuarded('admin');

    expect(await screen.findByText('EMPLEADO_DASHBOARD')).toBeInTheDocument();
  });
});
