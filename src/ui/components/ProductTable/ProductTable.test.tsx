import { describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LOW_STOCK_THRESHOLD, type Product } from '@/infrastructure/products.service';
import { ProductTable } from './ProductTable';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Alimento Perro Adulto 3kg',
  price: 100,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  ...overrides,
});

interface Handlers {
  onEdit: Mock;
  onDelete: Mock;
  onBulkDelete: Mock;
  onToggleActive: Mock;
}

const makeHandlers = (): Handlers => ({
      // probe-edit-tool
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onBulkDelete: vi.fn(),
  onToggleActive: vi.fn(),
});

/** El componente usa useSearchParams, así que siempre va dentro de un router. */
const renderTable = (products: Product[], handlers: Handlers = makeHandlers()) =>
  render(
    <MemoryRouter initialEntries={['/admin/catalogo']}>
      <ProductTable
        products={products}
        onEdit={handlers.onEdit}
        onDelete={handlers.onDelete}
        onBulkDelete={handlers.onBulkDelete}
        onToggleActive={handlers.onToggleActive}
      />
    </MemoryRouter>,
  );

/** La <ul> de cards es el único <ul> del componente. */
const getCardList = () => screen.getByRole('list');

/** La primera <tr> es el encabezado de la tabla de desktop. */
const getHeaderCells = () => within(screen.getAllByRole('row')[0]).getAllByRole('columnheader');

/** Celdas de la fila de datos `index` (0 = primer producto) de la tabla. */
const getDataCells = (index = 0) => within(screen.getAllByRole('row')[index + 1]).getAllByRole('cell');

describe('ProductTable - vista mobile con cards', () => {
  it('renderiza un <li> por producto de la página actual', () => {
    const products = [
      makeProduct({ id: 'p1' }),
      makeProduct({ id: 'p2', name: 'Alimento Gato Cachorro 1.5kg' }),
      makeProduct({ id: 'p3', name: 'Correa Accesorios 2m' }),
    ];
    renderTable(products);

    const items = within(getCardList()).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain('Alimento Perro Adulto 3kg');
    expect(items[2].textContent).toContain('Correa Accesorios 2m');
  });

  it('conserva la tabla de desktop con sus 7 columnas sin clases que las oculten', () => {
    renderTable([makeProduct()]);

    const headers = getHeaderCells().map((th) => th.textContent);
    expect(headers).toEqual([
      'Producto',
      'Categoría',
      'Etapa',
      'Precio',
      'Stock',
      'En tienda',
      'Acciones',
    ]);

    for (const th of getHeaderCells()) {
      expect(th.className).not.toMatch(/none|hidden/);
    }
  });

  it('mueve el switch a la columna "En tienda" y lo saca de "Acciones"', () => {
    renderTable([makeProduct()]);

    const cells = getDataCells();
    expect(cells).toHaveLength(7);

    // "En tienda" (índice 5) tiene el switch; "Acciones" (índice 6) ya no.
    expect(within(cells[5]).getByRole('switch')).toBeInTheDocument();
    expect(cells[6].querySelector('[role="switch"]')).toBeNull();
  });

  it('extiende el estado vacío de la tabla a colSpan 7', () => {
    renderTable([]);

    // El mismo mensaje aparece en la card de mobile y en la celda de la tabla.
    const emptyTd = screen
      .getAllByText('No hay productos cargados todavía. 📦')
      .map((node) => node.closest('td'))
      .find(Boolean);
    expect(emptyTd).toHaveAttribute('colspan', '7');
  });

  it('etiqueta el switch con la acción que dispara, en tabla y card', () => {
    renderTable([
      makeProduct({ id: 'on', isActive: true }),
      makeProduct({ id: 'off', isActive: false }),
    ]);

    const cards = within(getCardList()).getAllByRole('listitem');

    // Producto activo: la acción del switch es ocultarlo de la tienda.
    expect(within(getDataCells(0)[5]).getByRole('switch')).toHaveAccessibleName(
      'Ocultar de la tienda online',
    );
    expect(within(cards[0]).getByRole('switch')).toHaveAccessibleName(
      'Ocultar de la tienda online',
    );

    // Producto inactivo: la acción es mostrarlo.
    expect(within(getDataCells(1)[5]).getByRole('switch')).toHaveAccessibleName(
      'Mostrar en la tienda online',
    );
    expect(within(cards[1]).getByRole('switch')).toHaveAccessibleName(
      'Mostrar en la tienda online',
    );
  });

  it('muestra el estado de visibilidad y el stock con etiqueta en la card', () => {
    renderTable([
      makeProduct({ id: 'on', isActive: true, stock: 12 }),
      makeProduct({ id: 'off', isActive: false, stock: 0 }),
    ]);

    const cards = within(getCardList()).getAllByRole('listitem');
    expect(cards[0]).toHaveTextContent('Visible en tienda');
    expect(cards[0]).toHaveTextContent('Stock: 12');
    expect(cards[1]).toHaveTextContent('Oculto en tienda');
    expect(cards[1]).toHaveTextContent('Stock: 0');
  });

  it('omite el guion de etapa en la card cuando el producto es de todas las etapas', () => {
    renderTable([makeProduct({ lifeStage: 'All' })]);

    const card = within(getCardList()).getByRole('listitem');
    expect(within(card).queryByText('-')).toBeNull();

    // La tabla sí mantiene el guion: ahí la columna Etapa siempre está.
    expect(within(getDataCells()[2]).getByText('-')).toBeInTheDocument();
  });

  it('dispara onToggleActive, onEdit y onDelete desde las acciones de la card', async () => {
    const handlers = makeHandlers();
    const product = makeProduct({ id: 'p9', isActive: false });
    renderTable([product], handlers);

    const card = within(getCardList()).getByRole('listitem');

    await userEvent.click(within(card).getByRole('switch'));
    expect(handlers.onToggleActive).toHaveBeenCalledWith('p9', false);

    await userEvent.click(within(card).getByTitle('Editar producto'));
    expect(handlers.onEdit).toHaveBeenCalledWith(product);

    // El delete de la card abre el ConfirmModal individual.
    await userEvent.click(within(card).getByTitle('Eliminar producto'));
    const modal = screen.getByRole('heading', { name: '¿Eliminar producto?' });
    expect(modal).toBeInTheDocument();
    expect(document.body.textContent).toContain('Alimento Perro Adulto 3kg');

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(handlers.onDelete).toHaveBeenCalledWith('p9');
  });

  it('muestra el mensaje de catálogo vacío en tabla y cards', () => {
    renderTable([]);
    expect(screen.getAllByText('No hay productos cargados todavía. 📦')).toHaveLength(2);
  });

  it('muestra el mensaje de búsqueda sin resultados en tabla y cards', async () => {
    renderTable([makeProduct()]);

    await userEvent.type(screen.getByPlaceholderText('Buscar producto...'), 'zzz');

    expect(
      screen.getAllByText('No se encontraron productos coincidentes con los filtros aplicados.'),
    ).toHaveLength(2);
  });

  it('marca data-low en la card cuando el stock no supera LOW_STOCK_THRESHOLD', () => {
    const low = makeProduct({ id: 'low', stock: LOW_STOCK_THRESHOLD });
    const ok = makeProduct({ id: 'ok', stock: LOW_STOCK_THRESHOLD + 1 });
    renderTable([low, ok]);

    const cards = within(getCardList()).getAllByRole('listitem');
    const lowStockBadge = cards[0].querySelector(`[data-low="true"]`);
    expect(lowStockBadge).not.toBeNull();
    expect(lowStockBadge).toHaveTextContent(String(LOW_STOCK_THRESHOLD));
    expect(cards[1].querySelector(`[data-low="false"]`)).not.toBeNull();
  });
});

/**
 * La lista de cards de mobile comparte el estado de filtros y de paginación con
 * la tabla: es la misma lista de productos renderizada de otra forma.
 */
describe('ProductTable - cards de mobile: filtros y paginación', () => {
  /** Las cards de la página actual, releídas del <ul> (no un nodo cacheado). */
  const getCards = () => within(getCardList()).getAllByRole('listitem');

  it('el buscador de texto acota las cards al producto encontrado', async () => {
    renderTable([
      makeProduct({ id: 'p1' }),
      makeProduct({ id: 'p2', name: 'Alimento Gato Cachorro 1.5kg' }),
    ]);

    await userEvent.type(screen.getByPlaceholderText('Buscar producto...'), 'Gato');

    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Alimento Gato Cachorro 1.5kg');
  });

  it('el filtro de disponibilidad "Sin stock" deja sólo las cards sin stock', async () => {
    renderTable([
      makeProduct({ id: 'p1', name: 'Alimento Perro', stock: 8 }),
      makeProduct({ id: 'p2', name: 'Collar Gato', stock: 0 }),
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Filtrar por categoría y stock' }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'Sin stock' }));

    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Collar Gato');
    expect(cards[0]).toHaveTextContent('Stock: 0');
  });

  it('el filtro de categoría deja sólo las cards de esa categoría', async () => {
    renderTable([
      makeProduct({ id: 'p1', name: 'Alimento Perro', category: { id: 'c1', name: 'Perro' } }),
      makeProduct({ id: 'p2', name: 'Collar Gato', category: { id: 'c2', name: 'Gato' } }),
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Filtrar por categoría y stock' }),
    );
    await userEvent.click(screen.getByRole('option', { name: 'Gato' }));

    const cards = getCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Collar Gato');
  });

  it('la card muestra el precio por bolsa y la etapa cuando no es "todas"', () => {
    renderTable([makeProduct({ price: 100, lifeStage: 'Adulto' })]);

    const card = getCards()[0];
    expect(card.textContent).toContain('$100');
    expect(card.textContent).toContain('/bolsa');
    expect(card.textContent).toContain('Adulto');
  });

  it('las cards muestran sólo los productos de la página actual', async () => {
    // jsdom no implementa scrollTo, que dispara el Pagination al cambiar de página.
    vi.stubGlobal('scrollTo', vi.fn());
    const products = Array.from({ length: 13 }, (_, index) =>
      makeProduct({ id: `p${index + 1}`, name: `Producto ${index + 1}` }),
    );
    renderTable(products);

    expect(getCards()).toHaveLength(12);

    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));

    const secondPage = getCards();
    expect(secondPage).toHaveLength(1);
    expect(secondPage[0]).toHaveTextContent('Producto 13');
    vi.unstubAllGlobals();
  });
});
