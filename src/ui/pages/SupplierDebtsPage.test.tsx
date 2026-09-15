import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SupplierDebtsPage } from './SupplierDebtsPage';
import {
  cancelSupplierDebt,
  deleteSupplierDebt,
  getSupplierDebts,
  getSupplierDebtsSummary,
} from '@/infrastructure/supplier-debts.service';
import { getSuppliers } from '@/infrastructure/suppliers.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/supplier-debts.service', () => ({
  addSupplierPayment: vi.fn(),
  cancelSupplierDebt: vi.fn(),
  deleteSupplierDebt: vi.fn(),
  getSupplierDebt: vi.fn(),
  getSupplierDebts: vi.fn(),
  getSupplierDebtsSummary: vi.fn(),
  getSupplierDebtsErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

vi.mock('@/infrastructure/suppliers.service', () => ({
  getSuppliers: vi.fn(),
}));

const getSupplierDebtsMock = getSupplierDebts as unknown as Mock;
const getSupplierDebtsSummaryMock = getSupplierDebtsSummary as unknown as Mock;
const getSuppliersMock = getSuppliers as unknown as Mock;
const deleteSupplierDebtMock = deleteSupplierDebt as unknown as Mock;
const cancelSupplierDebtMock = cancelSupplierDebt as unknown as Mock;

const debtWithoutPayments = {
  id: 'd1',
  supplierId: 's1',
  supplierName: 'MAJANO',
  description: 'Mercadería del 10/9',
  totalAmount: 50000,
  paidAmount: 0,
  pendingAmount: 50000,
  createdAt: '2026-09-10T10:00:00.000Z',
};

const debtWithPayments = {
  id: 'd2',
  supplierId: 's1',
  supplierName: 'MAJANO',
  description: 'Mercadería del 01/9',
  totalAmount: 50000,
  paidAmount: 20000,
  pendingAmount: 30000,
  createdAt: '2026-09-01T10:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <SupplierDebtsPage />
    </MemoryRouter>,
  );

describe('SupplierDebtsPage delete/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupplierDebtsSummaryMock.mockResolvedValue({ totalPending: 80000, bySupplier: [] });
    getSuppliersMock.mockResolvedValue([]);
    deleteSupplierDebtMock.mockResolvedValue(undefined);
    cancelSupplierDebtMock.mockResolvedValue({ cancelled: true, debt: debtWithPayments });
  });

  it('elimina la deuda sin pagos con DELETE tras confirmar', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments]);
    renderPage();

    await screen.findByText('Mercadería del 10/9');
    await user.click(screen.getByRole('button', { name: 'Eliminar deuda Mercadería del 10/9' }));

    expect(await screen.findByText('¿Eliminar esta deuda? No se puede deshacer.'))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(deleteSupplierDebtMock).toHaveBeenCalledWith('d1');
    expect(cancelSupplierDebtMock).not.toHaveBeenCalled();
    // Refresca lista + totales.
    expect(getSupplierDebtsMock).toHaveBeenCalledTimes(2);
  });

  it('anula (PATCH cancel) la deuda con pagos tras confirmar', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithPayments]);
    renderPage();

    await screen.findByText('Mercadería del 01/9');
    await user.click(screen.getByRole('button', { name: 'Eliminar deuda Mercadería del 01/9' }));

    const description = await screen.findByText(/Esta deuda ya tiene pagos por/);
    expect(description.textContent).toContain(formatARS(20000));
    expect(description.textContent).toContain('No se puede eliminar, pero se puede anular');
    await user.click(screen.getByRole('button', { name: 'Anular deuda' }));

    expect(cancelSupplierDebtMock).toHaveBeenCalledWith('d2');
    expect(deleteSupplierDebtMock).not.toHaveBeenCalled();
    expect(getSupplierDebtsMock).toHaveBeenCalledTimes(2);
  });

  it('ante 409 de DELETE redirige al flujo de anulación en vez de error genérico', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments]);
    // El frontend creía paidAmount=0 pero el backend responde 409: ya tiene pagos.
    deleteSupplierDebtMock.mockRejectedValue({ response: { status: 409 } });
    renderPage();

    await screen.findByText('Mercadería del 10/9');
    await user.click(screen.getByRole('button', { name: 'Eliminar deuda Mercadería del 10/9' }));
    expect(await screen.findByText('¿Eliminar esta deuda? No se puede deshacer.'))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    // El modal se reabre en modo anulación (sin toast de error genérico).
    expect(
      await screen.findByText(/No se puede eliminar, pero se puede anular/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anular deuda' }));

    expect(cancelSupplierDebtMock).toHaveBeenCalledWith('d1');
  });
});
