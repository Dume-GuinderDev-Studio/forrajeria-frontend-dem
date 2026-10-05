import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ManualSaleDialog } from './ManualSaleDialog';
import { getProducts } from '@/infrastructure/products.service';
import { createManualOrder } from '@/infrastructure/orders.service';
import { formatARS } from '@/lib/format';

vi.mock('@/infrastructure/products.service', () => ({
  getProducts: vi.fn(),
}));

vi.mock('@/infrastructure/orders.service', () => ({
  createManualOrder: vi.fn(),
}));

const getProductsMock = getProducts as unknown as Mock;
const createManualOrderMock = createManualOrder as unknown as Mock;

const PRODUCT_NAME = 'Alimento Perro Adulto 3kg';
// El botón de resultado concatena nombre + stock, así que se matchea por patrón.
const productNamePattern = /Alimento Perro Adulto 3kg/;

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: PRODUCT_NAME,
  price: 8000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  presentations: [
    { id: 'pr1', type: 'bag', weightKg: 1, price: 5000, isActive: true },
    { id: 'pr2', type: 'kilo', weightKg: 25, price: 30000, isActive: true },
  ],
  ...overrides,
});

const renderDialog = () =>
  render(
    <MemoryRouter>
      <ManualSaleDialog open onOpenChange={vi.fn()} />
    </MemoryRouter>,
  );

/**
 * El carrito se renderiza dos veces (tabla de desktop + cards de mobile), así que
 * el nombre del producto y el botón "Quitar producto" están duplicados. Estos
 * helpers acotan las consultas a una vista.
 */
const getTableView = async () => {
  // El nombre también está en el buscador y en la config: sirve solo de espera.
  await screen.findAllByText(PRODUCT_NAME);
  const table = document.querySelector('table');
  if (!table) throw new Error('No se encontró la tabla del carrito');
  return within(table as HTMLElement);
};

const getCardsView = async () => {
  await waitFor(() => {
    const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'));
    if (!list) throw new Error('No se encontró la lista de cards del carrito');
  });
  const list = Array.from(document.querySelectorAll('ul')).find((ul) => ul.querySelector('li'))!;
  return within(list as HTMLElement);
};

/** Flujo real de la UI: buscar producto → clickear el resultado → "Agregar". */
const addProductToCart = async () => {
  const user = userEvent.setup();
  const result = await screen.findByRole('button', { name: productNamePattern });
  await user.click(result);
  await user.click(screen.getByRole('button', { name: 'Agregar' }));
};

describe('ManualSaleDialog — tabla del carrito (desktop)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsMock.mockResolvedValue([makeProduct()]);
    createManualOrderMock.mockResolvedValue({ id: 'o1' });
  });

  it('lista las 6 columnas del carrito y una fila por ítem agregado', async () => {
    renderDialog();
    await addProductToCart();

    const view = await getTableView();
    const headers = view.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      'Producto',
      'Presentación',
      'Cant.',
      'P. unitario',
      'Subtotal',
      'Acciones',
    ]);

    const rows = view.getAllByRole('row');
    // 1 header + 1 ítem.
    expect(rows).toHaveLength(2);

    const row = view.getByText(PRODUCT_NAME).closest('tr');
    expect(row?.textContent).toContain('Bolsa 1 kg');
    expect(row?.textContent).toContain('1');
    expect(row?.textContent).toContain(formatARS(5000));
    expect(within(row as HTMLElement).getByRole('button', { name: 'Quitar producto' })).toBeInTheDocument();
  });

  it('el botón de quitar de la tabla saca el ítem del carrito', async () => {
    renderDialog();
    await addProductToCart();

    const view = await getTableView();
    await userEvent.click(view.getByRole('button', { name: 'Quitar producto' }));

    expect(
      await screen.findByText('Todavía no agregaste productos a la venta.'),
    ).toBeInTheDocument();
  });
});

describe('ManualSaleDialog — cards del carrito (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsMock.mockResolvedValue([makeProduct()]);
    createManualOrderMock.mockResolvedValue({ id: 'o1' });
  });

  it('renderiza una card por ítem con nombre, quitar, badge y fila Cant. × precio c/u / Subtotal', async () => {
    renderDialog();
    await addProductToCart();

    const cards = await getCardsView();
    const items = cards.getAllByRole('listitem');
    expect(items).toHaveLength(1);

    const card = items[0];
    expect(card.textContent).toContain(PRODUCT_NAME);
    // Nombre arriba + botón de quitar al costado.
    expect(within(card).getByRole('button', { name: 'Quitar producto' })).toBeInTheDocument();
    // Badge de presentación.
    expect(within(card).getByText('Bolsa 1 kg')).toBeInTheDocument();
    // Abajo: "Cant. N × $ M c/u" a la izquierda y "Subtotal $ X" a la derecha.
    expect(card).toHaveTextContent(/Cant\.\s*1\s*×\s*\$\s*5\.000\s*c\/u/);
    expect(within(card).getByText('Subtotal')).toBeInTheDocument();
    expect(
      (within(card).getByText('Subtotal').parentElement as HTMLElement).textContent,
    ).toContain(formatARS(5000));
  });

  it('el botón de quitar de la card saca ese ítem del carrito', async () => {
    renderDialog();
    await addProductToCart();

    const cards = await getCardsView();
    await userEvent.click(
      within(cards.getAllByRole('listitem')[0]).getByRole('button', { name: 'Quitar producto' }),
    );

    expect(
      await screen.findByText('Todavía no agregaste productos a la venta.'),
    ).toBeInTheDocument();
    // Con el carrito vacío no queda ninguna lista de cards en el documento.
    expect(document.querySelector('ul')).toBeNull();
  });

  it('acumula la cantidad si se agrega dos veces el mismo producto y presentación', async () => {
    renderDialog();
    await addProductToCart();

    // Vuelve a seleccionar el producto (el buscador se resetea al abrir el dialog,
    // pero el resultado sigue montado) y agrega otra unidad.
    await userEvent.click(screen.getByRole('button', { name: productNamePattern }));
    await userEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    const again = await getCardsView();
    const items = again.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(/Cant\.\s*2\s*×\s*\$\s*5\.000\s*c\/u/);
    expect(
      (within(items[0]).getByText('Subtotal').parentElement as HTMLElement).textContent,
    ).toContain(formatARS(10000));
  });
});

describe('ManualSaleDialog — carrito vacío', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductsMock.mockResolvedValue([makeProduct()]);
    createManualOrderMock.mockResolvedValue({ id: 'o1' });
  });

  it('muestra el estado vacío y ningún control de tabla ni card', async () => {
    renderDialog();

    expect(
      await screen.findByText('Todavía no agregaste productos a la venta.'),
    ).toBeInTheDocument();
    expect(document.querySelector('table')).toBeNull();
    expect(document.querySelector('ul')).toBeNull();
  });
});

/**
 * El badge de "Sobrante abierto" informa del remanente de la bolsa física. Solo
 * tiene sentido cuando lo que se vende es el fraccionado por kilo: en una
 * línea de bolsa cerrada hacía creer que se estaba vendiendo la bolsa abierta.
 */
describe('ManualSaleDialog — badge de sobrante abierto', () => {
  const SOBRANTE = /Sobrante abierto/;

  const productoConSobrante = (openBagRemainingKg: number | null) =>
    makeProduct({
      presentations: [
        { id: 'pr1', type: 'bag', weightKg: 15, price: 30000, isActive: true, openBagRemainingKg },
        { id: 'pr2', type: 'kilo', weightKg: 25, price: 3000, isActive: true },
      ],
    });

  /** Selecciona el producto desde los resultados de búsqueda. */
  const seleccionarProducto = async () => {
    const user = userEvent.setup();
    const result = await screen.findByRole('button', { name: productNamePattern });
    await user.click(result);
  };

  /**
   * Cambia la presentación elegida. El <label>Presentación</label> no está
   * asociado al trigger, así que no hay combobox con nombre accesible: se toma
   * el primer select-trigger del dialogo, que es el de Presentación (el
   * segundo es el método de pago). Radix no abre con click en jsdom, se abre
   * con Enter.
   */
  const elegirPresentacion = async (nombre: 'Bolsa' | 'Kilo') => {
    const user = userEvent.setup();
    const trigger = document.querySelector('[data-slot="select-trigger"]');
    if (!trigger) throw new Error('No se encontró el select de Presentación');
    (trigger as HTMLElement).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: nombre }));
    await waitFor(() => expect(trigger.textContent).toContain(nombre));
  };

  /**
   * Acota las consultas a la tarjeta de selección. Hace falta porque el badge
   * sigue apareciendo a proposito en los resultados de búsqueda, así que en el
   * documento hay dos: uno en la lista de resultados y otro en la tarjeta.
   */
  const getTarjetaSeleccion = () => {
    // Las clases de CSS modules conservan el nombre legible con un hash
    // (_configCard_<hash>), asi que el prefijo alcanza para acotar.
    const card = document.querySelector('[class*="configCard"]');
    if (!card) throw new Error('No se encontró la tarjeta de selección');
    return within(card as HTMLElement);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createManualOrderMock.mockResolvedValue({ id: 'o1' });
  });

  it('aparece en la tarjeta de selección cuando la presentación elegida es Kilo', async () => {
    getProductsMock.mockResolvedValue([productoConSobrante(7)]);
    renderDialog();
    await seleccionarProducto();
    await elegirPresentacion('Kilo');

    await waitFor(() => expect(getTarjetaSeleccion().getByText(SOBRANTE)).toBeInTheDocument());
    expect(getTarjetaSeleccion().getByText(SOBRANTE).textContent).toBe('Sobrante abierto: 7 kg');
  });

  it('NO aparece en la tarjeta de selección cuando la presentación elegida es Bolsa', async () => {
    getProductsMock.mockResolvedValue([productoConSobrante(7)]);
    renderDialog();
    await seleccionarProducto();
    await elegirPresentacion('Bolsa');

    // La tarjeta ya esta montada: se espera a que exista para no pasar por
    // un simple "todavia no renderizo".
    await waitFor(() => expect(getTarjetaSeleccion()).not.toBeNull());
    expect(getTarjetaSeleccion().queryByText(SOBRANTE)).toBeNull();
  });

  it('NO aparece cuando la bolsa no tiene sobrante', async () => {
    getProductsMock.mockResolvedValue([productoConSobrante(0)]);
    renderDialog();
    await seleccionarProducto();
    await elegirPresentacion('Kilo');

    await waitFor(() => expect(getTarjetaSeleccion()).not.toBeNull());
    expect(getTarjetaSeleccion().queryByText(SOBRANTE)).toBeNull();
  });

  it('NO aparece en las lineas del carrito, ni en tabla ni en cards', async () => {
    getProductsMock.mockResolvedValue([productoConSobrante(7)]);
    renderDialog();

    // Se agrega por Kilo, que es el caso donde el badge sí es válido: aun así
    // el carrito no lo muestra, porque la línea ya no es una decisión abierta.
    await seleccionarProducto();
    await elegirPresentacion('Kilo');
    await waitFor(() => expect(getTarjetaSeleccion().getByText(SOBRANTE)).toBeInTheDocument());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agregar' }));

    // getTableView/getCardsView ya devuelven el scope de within.
    const tabla = await getTableView();
    expect(tabla.queryByText(SOBRANTE)).toBeNull();
    const cards = await getCardsView();
    expect(cards.queryByText(SOBRANTE)).toBeNull();
  });

  it('el badge sigue en los resultados de busqueda, donde no hay presentacion elegida', async () => {
    getProductsMock.mockResolvedValue([productoConSobrante(7)]);
    renderDialog();

    await waitFor(() => expect(screen.getAllByText(SOBRANTE).length).toBeGreaterThan(0));
  });
});

describe('ManualSaleDialog — limite de resultados visibles', () => {
  const FOOTER = /Mostrando \d+ de \d+\. Escribí para filtrar\./;

  /** Genera n productos con nombres únicos: Producto 01..Producto n. */
  const makeCatalog = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      makeProduct({
        id: `p${index + 1}`,
        name: `Producto ${String(index + 1).padStart(3, '0')}`,
      }),
    );

  const getSearchInput = () =>
    screen.getByPlaceholderText('Escribí el nombre del producto...');

  beforeEach(() => {
    vi.clearAllMocks();
    createManualOrderMock.mockResolvedValue({ id: 'o1' });
  });

  it('muestra la linea de aviso cuando hay mas productos que el limite', async () => {
    getProductsMock.mockResolvedValue(makeCatalog(42));
    renderDialog();

    await waitFor(() => expect(screen.getAllByText('Producto 001').length).toBeGreaterThan(0));
    expect(screen.getByText(FOOTER)).toBeInTheDocument();
    expect(screen.getByText(FOOTER)).toHaveTextContent('Mostrando 30 de 42. Escribí para filtrar.');
    // Solo se renderizan los 30 primeros.
    expect(screen.queryByText('Producto 031')).not.toBeInTheDocument();
  });

  it('la linea de aviso NO es clickeable ni agrega productos', async () => {
    getProductsMock.mockResolvedValue(makeCatalog(42));
    renderDialog();

    const footer = (await screen.findByText(FOOTER)).closest('p')!;
    expect(footer.tagName).toBe('P');
    expect(footer.closest('button')).toBeNull();
  });

  it('encuentra un producto que esta fuera de los primeros resultados visibles', async () => {
    getProductsMock.mockResolvedValue(makeCatalog(42));
    renderDialog();

    await waitFor(() => expect(screen.getAllByText('Producto 001').length).toBeGreaterThan(0));
    await userEvent.setup().type(getSearchInput(), 'Producto 042');

    const result = await screen.findByRole('button', { name: /Producto 042/ });
    expect(result).toBeInTheDocument();
    expect(screen.queryByText(FOOTER)).not.toBeInTheDocument();
  });

  it('NO muestra la linea de aviso cuando todos los resultados caben', async () => {
    getProductsMock.mockResolvedValue(makeCatalog(5));
    renderDialog();

    await waitFor(() => expect(screen.getAllByText('Producto 005').length).toBeGreaterThan(0));
    expect(screen.queryByText(FOOTER)).not.toBeInTheDocument();
  });

  it('el filtro por texto reduce Y y actualiza la linea de aviso', async () => {
    getProductsMock.mockResolvedValue([
      ...makeCatalog(42),
      makeProduct({ id: 'pz', name: 'Alimento Perro Adulto 3kg' }),
    ]);
    renderDialog();

    await waitFor(() => expect(screen.getAllByText('Producto 001').length).toBeGreaterThan(0));
    expect(screen.getByText(FOOTER)).toHaveTextContent('Mostrando 30 de 43. Escribí para filtrar.');

    await userEvent.setup().type(getSearchInput(), 'Alimento');

    await waitFor(() => expect(screen.queryByText(FOOTER)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: productNamePattern })).toBeInTheDocument();
  });
});
