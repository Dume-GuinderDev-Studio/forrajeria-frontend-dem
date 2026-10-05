import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SupplierDebtsPage } from './SupplierDebtsPage';
import styles from './SupplierDebtsPage.module.css';
import {
  cancelSupplierDebt,
  deleteSupplierDebt,
  getSupplierDebt,
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
const getSupplierDebtMock = getSupplierDebt as unknown as Mock;
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

const paidDebt = {
  id: 'd3',
  supplierId: 's2',
  supplierName: 'FERRETERÍA SUR',
  description: 'Arandelas del 02/9',
  totalAmount: 15000,
  paidAmount: 15000,
  pendingAmount: 0,
  createdAt: '2026-09-02T10:00:00.000Z',
};

const payments = [
  {
    id: 'p1',
    amount: 20000,
    paymentMethod: 'efectivo',
    paidAt: '2026-09-05T10:00:00.000Z',
    notes: 'Pago parcial en efectivo',
  },
];

const renderPage = (): RenderResult =>
  render(
    <MemoryRouter>
      <SupplierDebtsPage />
    </MemoryRouter>,
  );

/*
 * La página renderiza las DOS vistas a la vez (tabla de desktop + cards de
 * mobile) y el media query decide cuál se ve. Por eso todo selector global
 * matchea el mismo nodo dos veces: los tests siempre se acotan a una vista
 * con estos helpers.
 */
const queryView = (container: HTMLElement, className: string): HTMLElement => {
  const node = container.querySelector<HTMLElement>(`.${className}`);
  if (!node) throw new Error(`No se encontró el wrapper .${className}`);
  return node;
};

/** VISTA TABLA: la tabla de deudas de desktop (4 columnas + linea secundaria). */
const getDebtTable = (container: HTMLElement) => queryView(container, styles.debtTableDesktop);

/** VISTA TABLA: la tabla del agrupado por proveedor (4 columnas). */
const getGroupTable = (container: HTMLElement) => queryView(container, styles.groupTableDesktop);

/** VISTA CARDS: las cards de deuda de mobile (una <li> por deuda). */
const getDebtCardList = (container: HTMLElement) => queryView(container, styles.debtCardList);

/** VISTA CARDS: las cards del agrupado por proveedor. */
const getGroupCardList = (container: HTMLElement) => queryView(container, styles.groupCardList);

/**
 * Renderiza y espera a que termine la carga: recién ahí existen las dos
 * vistas (tabla + cards). Sin esto los wrappers aún no están en el DOM.
 */
const renderReady = async (): Promise<RenderResult> => {
  const result = renderPage();
  await waitFor(() => {
    getDebtTable(result.container);
    getDebtCardList(result.container);
  });
  return result;
};

/** Solo los <li> directos: dentro de una card de deuda hay otra <ul> de pagos. */
const cardsOf = (list: HTMLElement) =>
  Array.from(list.querySelectorAll<HTMLElement>(':scope > li'));

const deleteButtonIn = (view: HTMLElement, description: string) =>
  within(view).getByRole('button', { name: `Eliminar deuda ${description}` });

const setupBaseline = () => {
  vi.clearAllMocks();
  getSupplierDebtsSummaryMock.mockResolvedValue({ totalPending: 80000, bySupplier: [] });
  getSuppliersMock.mockResolvedValue([]);
  deleteSupplierDebtMock.mockResolvedValue(undefined);
  cancelSupplierDebtMock.mockResolvedValue({ cancelled: true, debt: debtWithPayments });
  // Solo d2 tiene pagos: d1 sirve para cubrir el estado vacío del detalle.
  getSupplierDebtMock.mockImplementation((id: string) =>
    Promise.resolve({ ...debtWithoutPayments, id, payments: id === 'd2' ? payments : [] }),
  );
};

describe('SupplierDebtsPage delete/cancel — vista tabla', () => {
  beforeEach(setupBaseline);

  it('elimina la deuda sin pagos con DELETE tras confirmar', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments]);
    const { container } = await renderReady();

    await user.click(deleteButtonIn(getDebtTable(container), 'Mercadería del 10/9'));

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
    const { container } = await renderReady();

    await user.click(deleteButtonIn(getDebtTable(container), 'Mercadería del 01/9'));

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
    const { container } = await renderReady();

    await user.click(deleteButtonIn(getDebtTable(container), 'Mercadería del 10/9'));
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

describe('SupplierDebtsPage delete/cancel — vista cards', () => {
  beforeEach(setupBaseline);

  it('elimina la deuda sin pagos desde la card de mobile', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments]);
    const { container } = await renderReady();

    const [card] = cardsOf(getDebtCardList(container));
    expect(card.textContent).toContain('Mercadería del 10/9');
    await user.click(deleteButtonIn(card, 'Mercadería del 10/9'));

    expect(await screen.findByText('¿Eliminar esta deuda? No se puede deshacer.'))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(deleteSupplierDebtMock).toHaveBeenCalledWith('d1');
    expect(cancelSupplierDebtMock).not.toHaveBeenCalled();
    expect(getSupplierDebtsMock).toHaveBeenCalledTimes(2);
  });

  it('anula (PATCH cancel) desde la card cuando la deuda ya tiene pagos', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithPayments]);
    const { container } = await renderReady();

    const [card] = cardsOf(getDebtCardList(container));
    await user.click(deleteButtonIn(card, 'Mercadería del 01/9'));

    const description = await screen.findByText(/Esta deuda ya tiene pagos por/);
    expect(description.textContent).toContain(formatARS(20000));
    await user.click(screen.getByRole('button', { name: 'Anular deuda' }));

    expect(cancelSupplierDebtMock).toHaveBeenCalledWith('d2');
    expect(deleteSupplierDebtMock).not.toHaveBeenCalled();
    expect(getSupplierDebtsMock).toHaveBeenCalledTimes(2);
  });

  it('ante 409 de DELETE desde la card redirige al flujo de anulación', async () => {
    const user = userEvent.setup();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments]);
    deleteSupplierDebtMock.mockRejectedValue({ response: { status: 409 } });
    const { container } = await renderReady();

    const [card] = cardsOf(getDebtCardList(container));
    await user.click(deleteButtonIn(card, 'Mercadería del 10/9'));
    expect(await screen.findByText('¿Eliminar esta deuda? No se puede deshacer.'))
      .toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(
      await screen.findByText(/No se puede eliminar, pero se puede anular/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anular deuda' }));

    expect(cancelSupplierDebtMock).toHaveBeenCalledWith('d1');
  });
});

describe('SupplierDebtsPage — cards de mobile', () => {
  beforeEach(() => {
    setupBaseline();
    getSupplierDebtsMock.mockResolvedValue([debtWithoutPayments, debtWithPayments, paidDebt]);
    getSupplierDebtsSummaryMock.mockResolvedValue({
      totalPending: 80000,
      bySupplier: [
        {
          supplierId: 's1',
          supplierName: 'MAJANO',
          debtsCount: 2,
          totalAmount: 100000,
          paidAmount: 20000,
          pendingAmount: 80000,
        },
        {
          supplierId: 's2',
          supplierName: 'FERRETERÍA SUR',
          debtsCount: 1,
          totalAmount: 15000,
          paidAmount: 15000,
          pendingAmount: 0,
        },
      ],
    });
  });

  it('renderiza una card de deuda y una card de agrupado por cada entrada', async () => {
    const { container } = await renderReady();

    const debtCards = cardsOf(getDebtCardList(container));
    expect(debtCards).toHaveLength(3);
    expect(debtCards[0].textContent).toContain('MAJANO');
    expect(debtCards[0].textContent).toContain('Mercadería del 10/9');
    expect(debtCards[0].textContent).toContain(formatARS(50000));
    expect(debtCards[2].textContent).toContain('FERRETERÍA SUR');

    const groupCards = cardsOf(getGroupCardList(container));
    expect(groupCards).toHaveLength(2);
    expect(groupCards[0].textContent).toContain('MAJANO');
    expect(groupCards[0].textContent).toContain('2 deudas');
    expect(groupCards[0].textContent).toContain(formatARS(20000));
    expect(groupCards[0].textContent).toContain(formatARS(80000));
    expect(groupCards[1].textContent).toContain('1 deuda');
  });

  it('conserva la tabla de desktop con sus 4 columnas y la de agrupado con 4', async () => {
    const { container } = await renderReady();

    const debtHeaders = within(getDebtTable(container))
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    // Total, Pagado y Fecha bajaron a una linea secundaria dentro de la
    // celda de Descripcion: asi la tabla entra en 1024px sin scroll.
    expect(debtHeaders).toEqual([
      'Proveedor',
      'Descripción',
      'Saldo pendiente',
      'Acciones',
    ]);

    // La info movida no se perdio: sigue visible, con etiqueta, bajo la descripcion.
    const firstDebtRow = within(getDebtTable(container)).getAllByRole('row')[1];
    expect(within(firstDebtRow).getByText('Total')).toBeInTheDocument();
    expect(within(firstDebtRow).getByText('Pagado')).toBeInTheDocument();
    expect(within(firstDebtRow).getByText('Fecha')).toBeInTheDocument();

    const groupHeaders = within(getGroupTable(container))
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(groupHeaders).toEqual(['Proveedor', 'Deudas', 'Pagado', 'Saldo pendiente']);
  });

  it('el botón de expandir de la card usa la misma lógica y lista los pagos', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();

    const [card] = cardsOf(getDebtCardList(container));
    await user.click(within(card).getByRole('button', { name: 'Ver detalle' }));

    // Mismo handler que la tabla: pide el detalle de esa deuda.
    expect(getSupplierDebtMock).toHaveBeenCalledWith('d1');
    // El estado de expansión es compartido: la tabla también muestra el detalle.
    await waitFor(() => {
      expect(
        within(getDebtTable(container)).getByText(
          'Todavía no se registraron pagos para esta deuda.',
        ),
      ).toBeInTheDocument();
    });

    // Badge/label del botón de la card pasa a "Ocultar detalle".
    expect(within(card).getByRole('button', { name: 'Ocultar detalle' })).toBeInTheDocument();

    // Con pagos cargados: lista en la card, no tabla anidada.
    const [paidCard] = cardsOf(getDebtCardList(container)).slice(1);
    await user.click(within(paidCard).getByRole('button', { name: 'Ver detalle' }));
    expect(getSupplierDebtMock).toHaveBeenCalledWith('d2');

    await waitFor(() => {
      // Con pagos cargados: lista en la card, no tabla anidada.
      const paymentsList = paidCard.querySelector(`.${styles.debtCardPayments}`);
      expect(paymentsList).not.toBeNull();
      const paymentItem = (paymentsList as HTMLElement).querySelector(
        `.${styles.debtCardPayment}`,
      ) as HTMLElement;
      // formatARS usa espacio duro (\u00a0): se compara sobre textContent porque
      // el matcher de texto de TL normaliza el nodo pero no el patrón.
      expect(paymentItem.textContent).toContain(formatARS(20000));
      expect(within(paymentItem).getByText('Efectivo')).toBeInTheDocument();
      expect(within(paymentItem).getByText('Pago parcial en efectivo')).toBeInTheDocument();
    });
    // En mobile los pagos van en lista, no en una tabla anidada.
    expect(paidCard.querySelector('table')).toBeNull();
  });

  it('muestra el badge Pendiente/Pagada en la card igual que en la tabla', async () => {
    const { container } = await renderReady();

    const cards = cardsOf(getDebtCardList(container));
    expect(within(cards[0]).getByText('Pendiente')).toBeInTheDocument();
    expect(within(cards[0]).queryByText('Pagada')).toBeNull();
    expect(within(cards[2]).getByText('Pagada')).toBeInTheDocument();
    expect(within(cards[2]).queryByText('Pendiente')).toBeNull();

    const rows = within(getDebtTable(container)).getAllByRole('row');
    // Header + 3 filas de deuda (el detalle expandido no está abierto).
    expect(within(rows[1]).getByText('Pendiente')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Pagada')).toBeInTheDocument();
  });

  it('solo ofrece "Registrar pago" en las cards con saldo pendiente', async () => {
    const { container } = await renderReady();

    const cards = cardsOf(getDebtCardList(container));
    expect(within(cards[0]).getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(within(cards[2]).queryByRole('button', { name: 'Registrar pago' })).toBeNull();

    const payButtons = within(getDebtTable(container)).getAllByRole('button', {
      name: 'Registrar pago',
    });
    expect(payButtons).toHaveLength(2);
  });

  it('abre el diálogo de pago desde el botón de la card', async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();

    const [card] = cardsOf(getDebtCardList(container));
    await user.click(within(card).getByRole('button', { name: 'Registrar pago' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Registrar pago' })).toBeInTheDocument();
    expect(dialog.textContent).toContain('MAJANO · Mercadería del 10/9');
  });
});
