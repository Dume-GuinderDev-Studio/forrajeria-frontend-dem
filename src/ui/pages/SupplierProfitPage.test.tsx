import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  buildPayableDebtDescription,
  calcPayableToSupplier,
  isPayableDebtRegistered,
  SupplierProfitPage,
} from './SupplierProfitPage';
import { getProfitBySupplier } from '@/infrastructure/orders.service';
import { getSuppliers } from '@/infrastructure/suppliers.service';
import { createSupplierDebt, getSupplierDebts } from '@/infrastructure/supplier-debts.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/orders.service', () => ({
  getProfitBySupplier: vi.fn(),
}));

vi.mock('@/infrastructure/suppliers.service', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('@/infrastructure/supplier-debts.service', () => ({
  createSupplierDebt: vi.fn(),
  getSupplierDebts: vi.fn(),
  getSupplierDebtsErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const getProfitBySupplierMock = getProfitBySupplier as unknown as Mock;
const getSuppliersMock = getSuppliers as unknown as Mock;
const createSupplierDebtMock = createSupplierDebt as unknown as Mock;
const getSupplierDebtsMock = getSupplierDebts as unknown as Mock;

let writeTextMock: Mock;

const renderPage = () =>
  render(
    <MemoryRouter>
      <SupplierProfitPage />
    </MemoryRouter>,
  );

describe('calcPayableToSupplier', () => {
  it('calcula venta menos ganancia (ej. $60.000 − $10.000 = $50.000)', () => {
    expect(calcPayableToSupplier(60000, 10000)).toBe(50000);
  });

  it('tolera valores nulos o inválidos como 0', () => {
    expect(calcPayableToSupplier(Number.NaN, 100)).toBe(-100);
    expect(calcPayableToSupplier(50000, 0)).toBe(50000);
  });
});

describe('buildPayableDebtDescription / isPayableDebtRegistered', () => {
  it('arma la descripción con el rango exacto', () => {
    expect(buildPayableDebtDescription('MAJANO', '2026-09-01', '2026-09-13')).toBe(
      'Saldo MAJANO (2026-09-01 al 2026-09-13)',
    );
  });

  it('detecta duplicado solo con mismo proveedor y misma descripción', () => {
    const debts = [
      {
        id: 'd1',
        supplierId: 's1',
        supplierName: 'MAJANO',
        description: 'Saldo MAJANO (2026-09-01 al 2026-09-13)',
        totalAmount: 50000,
        paidAmount: 0,
        pendingAmount: 50000,
        createdAt: '2026-09-13',
      },
    ];
    expect(
      isPayableDebtRegistered(debts, 's1', 'Saldo MAJANO (2026-09-01 al 2026-09-13)'),
    ).toBe(true);
    // Otro proveedor no es duplicado.
    expect(
      isPayableDebtRegistered(debts, 's2', 'Saldo MAJANO (2026-09-01 al 2026-09-13)'),
    ).toBe(false);
    // Otro rango no es duplicado.
    expect(
      isPayableDebtRegistered(debts, 's1', 'Saldo MAJANO (2026-09-12 al 2026-09-13)'),
    ).toBe(false);
    // Sin supplierId resuelto no se marca.
    expect(
      isPayableDebtRegistered(debts, '', 'Saldo MAJANO (2026-09-01 al 2026-09-13)'),
    ).toBe(false);
  });
});

describe('SupplierProfitPage', () => {
  // Rango que la página usa por defecto (mes actual hasta hoy).
  const currentRangeDesc = (name: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return `Saldo ${name} (${from} al ${to})`;
  };
  beforeEach(() => {
    vi.clearAllMocks();
    getProfitBySupplierMock.mockResolvedValue([
      { supplierId: 's1', supplierName: 'MAJANO', sales: 60000, profit: 10000 },
    ]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
    getSupplierDebtsMock.mockResolvedValue([]);
    createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('muestra la columna "A pagar al proveedor" en la fila y en el total', async () => {
    renderPage();

    // Encabezado de la columna nueva.
    expect(await screen.findByText('A pagar al proveedor')).toBeInTheDocument();

    // Fila MAJANO: 60000 − 10000 = 50000 (la celda comparte texto con el
    // botón de copiar, por eso se aserta sobre el textContent de la fila).
    const row = screen.getByText('MAJANO').closest('tr');
    expect(row?.textContent).toContain(formatARS(50000));

    // Fila Total con la misma columna.
    const totalRow = screen.getByText('Total').closest('tr');
    expect(totalRow?.textContent).toContain(formatARS(50000));
  });

  it('el botón de copiar escribe el valor formateado al portapapeles', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('MAJANO');
    // user-event reemplaza navigator.clipboard en setup(): re-aplicar el
    // mock justo antes del click para que el componente lo use.
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });
    await user.click(screen.getByRole('button', { name: 'Copiar monto a pagar a MAJANO' }));

    expect(writeTextMock).toHaveBeenCalledWith(formatARS(50000));
    expect(await screen.findByTitle('¡Copiado!')).toBeInTheDocument();
  });

  it('"Registrar deuda" abre el modal pre-cargado y confirma con esos valores', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('MAJANO');
    await user.click(screen.getByRole('button', { name: 'Registrar deuda' }));

    // Modal abierto con monto y descripción pre-cargados.
    expect(await screen.findByText('Nueva deuda')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: 50000')).toHaveValue(50000);
    expect(
      (screen.getByPlaceholderText('Ej: Mercadería del 10/9') as HTMLInputElement).value,
    ).toContain('MAJANO');

    await user.click(screen.getByRole('button', { name: 'Crear deuda' }));

    expect(createSupplierDebtMock).toHaveBeenCalledWith({
      supplierId: 's1',
      description: expect.stringContaining('MAJANO'),
      totalAmount: 50000,
    });
  });

  it('muestra "Ya registrada" deshabilitado si ya existe deuda para ese proveedor+rango', async () => {
    getSupplierDebtsMock.mockResolvedValue([
      {
        id: 'd1',
        supplierId: 's1',
        supplierName: 'MAJANO',
        description: currentRangeDesc('MAJANO'),
        totalAmount: 50000,
        paidAmount: 0,
        pendingAmount: 50000,
        createdAt: '2026-09-13',
      },
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('MAJANO');
    expect(screen.getByRole('button', { name: 'Ya registrada' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar deuda' })).not.toBeInTheDocument();

    // Al cambiar el rango, el chequeo se re-ejecuta y vuelve a habilitarse.
    await user.clear(screen.getByLabelText('Desde'));
    await user.type(screen.getByLabelText('Desde'), '2026-09-12');
    expect(await screen.findByRole('button', { name: 'Registrar deuda' })).toBeEnabled();

    // Volviendo al rango original se marca de nuevo como registrada.
    await user.clear(screen.getByLabelText('Desde'));
    const now = new Date();
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    await user.type(screen.getByLabelText('Desde'), first);
    expect(await screen.findByRole('button', { name: 'Ya registrada' })).toBeDisabled();

    // "Registrar igual" permite forzarlo y abre el modal pre-cargado.
    await user.click(screen.getByRole('button', { name: 'Registrar igual' }));
    expect(await screen.findByText('Nueva deuda')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: 50000')).toHaveValue(50000);
  });

  it('no marca duplicado si la deuda es de otro proveedor u otro rango', async () => {
    getSupplierDebtsMock.mockResolvedValue([
      {
        id: 'd9',
        supplierId: 's2',
        supplierName: 'OTRO',
        description: 'Saldo OTRO (2026-09-01 al 2026-09-13)',
        totalAmount: 1000,
        paidAmount: 0,
        pendingAmount: 1000,
        createdAt: '2026-09-13',
      },
      {
        id: 'd8',
        supplierId: 's1',
        supplierName: 'MAJANO',
        description: 'Saldo MAJANO (2026-08-01 al 2026-08-31)',
        totalAmount: 40000,
        paidAmount: 0,
        pendingAmount: 40000,
        createdAt: '2026-08-31',
      },
    ]);
    renderPage();

    await screen.findByText('MAJANO');
    expect(screen.getByRole('button', { name: 'Registrar deuda' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Ya registrada' })).not.toBeInTheDocument();
  });
});
