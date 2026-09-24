import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  calcPayableToSupplier,
  getAlreadyRegistered,
  getPendingToRegister,
  SupplierProfitPage,
} from './SupplierProfitPage';
import { getProfitBySupplier } from '@/infrastructure/orders.service';
import { getSuppliers } from '@/infrastructure/suppliers.service';
import { createSupplierDebt } from '@/infrastructure/supplier-debts.service';
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

describe('getPendingToRegister / getAlreadyRegistered', () => {
  it('lee los campos del backend cuando vienen calculados', () => {
    const row = {
      supplierId: 's1',
      supplierName: 'MAJANO',
      sales: 60000,
      profit: 10000,
      alreadyRegistered: 20000,
      pendingToRegister: 30000,
    };
    expect(getPendingToRegister(row)).toBe(30000);
    expect(getAlreadyRegistered(row)).toBe(20000);
  });

  it('usa venta − ganancia como fallback si pending no viene', () => {
    const row = {
      supplierId: 's1',
      supplierName: 'MAJANO',
      sales: 60000,
      profit: 10000,
      alreadyRegistered: 0,
      pendingToRegister: Number.NaN,
    };
    expect(getPendingToRegister(row)).toBe(50000);
  });
});

describe('SupplierProfitPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
        alreadyRegistered: 0,
        pendingToRegister: 50000,
      },
    ]);
    getSuppliersMock.mockResolvedValue([{ id: 's1', name: 'MAJANO' }]);
    createSupplierDebtMock.mockResolvedValue({ id: 'd1' });
    writeTextMock = vi.fn().mockResolvedValue(undefined);
  });

  it('muestra la columna "A pagar al proveedor" con pendingToRegister en la fila y en el total', async () => {
    renderPage();

    // Encabezado de la columna.
    expect(await screen.findByText('A pagar al proveedor')).toBeInTheDocument();

    // Fila MAJANO: pending 50000 (la celda comparte texto con el
    // botón de copiar, por eso se aserta sobre el textContent de la fila).
    const row = screen.getByText('MAJANO').closest('tr');
    expect(row?.textContent).toContain(formatARS(50000));

    // Fila Total con la misma columna.
    const totalRow = screen.getByText('Total').closest('tr');
    expect(totalRow?.textContent).toContain(formatARS(50000));
  });

  it('muestra "Ya registrado" como texto secundario cuando alreadyRegistered > 0', async () => {
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
        alreadyRegistered: 20000,
        pendingToRegister: 30000,
      },
    ]);
    renderPage();

    await screen.findByText('MAJANO');
    const row = screen.getByText('MAJANO').closest('tr');
    // Lo que falta registrar, no el bruto del período.
    expect(row?.textContent).toContain(formatARS(30000));
    expect(row?.textContent).toContain('Ya registrado');
    expect(row?.textContent).toContain(formatARS(20000));
  });

  it('no muestra "Ya registrado" cuando alreadyRegistered es 0', async () => {
    renderPage();

    await screen.findByText('MAJANO');
    expect(screen.queryByText(/Ya registrado/)).not.toBeInTheDocument();
  });

  it('el botón de copiar escribe el pendiente formateado al portapapeles', async () => {
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

  it('"Registrar deuda" abre el modal pre-cargado con pendingToRegister', async () => {
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

  it('registro parcial: muestra el resto pendiente y permite registrar la diferencia', async () => {
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
        alreadyRegistered: 20000,
        pendingToRegister: 30000,
      },
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('MAJANO');
    // Queda pendiente el resto y el botón sigue habilitado.
    const row = screen.getByText('MAJANO').closest('tr');
    expect(row?.textContent).toContain(formatARS(30000));
    expect(row?.textContent).toContain('Ya registrado');
    expect(row?.textContent).toContain(formatARS(20000));
    expect(screen.getByRole('button', { name: 'Registrar deuda' })).toBeEnabled();

    // El modal se pre-carga con la diferencia, no con el total del período.
    await user.click(screen.getByRole('button', { name: 'Registrar deuda' }));
    expect(await screen.findByText('Nueva deuda')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ej: 50000')).toHaveValue(30000);
  });

  it('muestra "Todo registrado" deshabilitado cuando pendingToRegister es 0', async () => {
    getProfitBySupplierMock.mockResolvedValue([
      {
        supplierId: 's1',
        supplierName: 'MAJANO',
        sales: 60000,
        profit: 10000,
        alreadyRegistered: 50000,
        pendingToRegister: 0,
      },
    ]);
    renderPage();

    await screen.findByText('MAJANO');
    const row = screen.getByText('MAJANO').closest('tr');
    expect(row?.textContent).toContain(formatARS(0));
    expect(row?.textContent).toContain('Ya registrado');
    expect(row?.textContent).toContain(formatARS(50000));
    expect(screen.getByRole('button', { name: 'Todo registrado' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Registrar deuda' })).not.toBeInTheDocument();
    // Ya no existe el link "Registrar igual".
    expect(screen.queryByRole('button', { name: 'Registrar igual' })).not.toBeInTheDocument();
  });
});
