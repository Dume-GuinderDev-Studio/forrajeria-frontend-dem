import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeeDashboardPage } from './EmployeeDashboardPage';
import { getMySalesToday } from '@/infrastructure/orders.service';
import { useAuthStore } from '@/infrastructure/auth_session_manager';

vi.mock('@/routing/navigation', () => ({
  navigateTo: vi.fn(),
  registerNavigate: vi.fn(),
}));

vi.mock('@/infrastructure/orders.service', () => ({
  getMySalesToday: vi.fn(),
}));

vi.mock('@/ui/components/ManualSaleDialog', () => ({
  ManualSaleDialog: ({ open }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? <div>MANUAL_SALE_DIALOG_OPEN</div> : null,
}));

const getMySalesTodayMock = getMySalesToday as unknown as Mock;

describe('EmployeeDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: { email: 'emp@bas.com', name: 'Empleado Uno', role: 'empleado' },
      token: 'jwt-token',
      isAuthenticated: true,
    });
  });

  it('muestra el resumen de ventas de hoy', async () => {
    getMySalesTodayMock.mockResolvedValue({ sales: 15000, orders: 3 });

    render(<EmployeeDashboardPage />);

    const summary = await screen.findByText(/Vendiste/);
    expect(summary).toHaveTextContent('Vendiste $ 15.000 hoy en 3 ventas');
  });

  it('abre el modal de venta manual al tocar "Cargar venta"', async () => {
    getMySalesTodayMock.mockResolvedValue({ sales: 0, orders: 0 });

    render(<EmployeeDashboardPage />);
    await screen.findByText(/Vendiste/);

    await userEvent.click(screen.getByRole('button', { name: /cargar venta/i }));

    expect(await screen.findByText('MANUAL_SALE_DIALOG_OPEN')).toBeInTheDocument();
  });

  it('muestra el error y permite reintentar la carga', async () => {
    getMySalesTodayMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ sales: 8000, orders: 1 });

    render(<EmployeeDashboardPage />);

    expect(
      await screen.findByText(/No se pudieron cargar tus ventas de hoy/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    const summary = await screen.findByText(/Vendiste/);
    expect(summary).toHaveTextContent('Vendiste $ 8.000 hoy en 1 venta');
  });
});
