import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from './Pages';

// Mock enrutado por URL: ProductsPage pide /products, y ProductForm (dentro del
// Sheet) pide /categories y /brands al abrirse.
const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/infrastructure/api', () => ({ default: apiMock }));

const producto = {
  id: 'p1',
  name: 'Alimento Test',
  price: 50000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  image: '',
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/admin/catalogo']}>
      <AdminPage />
    </MemoryRouter>,
  );

describe('AdminPage (botón Nuevo Producto)', () => {
  beforeEach(() => {
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/products') return { data: [producto] };
      return { data: [] };
    });
    apiMock.post.mockResolvedValue({ data: {} });
    apiMock.patch.mockResolvedValue({ data: {} });
  });

  it('vive en el encabezado, primero en el DOM, y no en el sidebar', async () => {
    montar();

    const encabezado = (await screen.findByRole('heading', { name: 'Gestión de Catálogo' }))
      .closest('header');
    expect(encabezado).not.toBeNull();

    const nuevo = screen.getByRole('button', { name: /Nuevo Producto/i });
    expect(encabezado).toContainElement(nuevo);

    // El primario va PRIMERO en el DOM a propósito: en mobile es el primero
    // visualmente (fila completa arriba), y así el orden de tab coincide con
    // el visual. En desktop el .primaryToolBtn lo baja con `order: 3` para
    // quedar a la derecha como antes; eso es CSS y jsdom no lo calcula, así que
    // el orden que se verifica acá es el del DOM.
    const botones = Array.from(encabezado!.querySelectorAll('button'));
    expect(botones.map((b) => b.textContent)).toEqual([
      'Nuevo Producto',
      'Exportar CSV',
      'Importar CSV',
    ]);
    expect(botones[0]).toBe(nuevo);
  });

  it('los tres botones llevan su etiqueta completa en el DOM', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Gestión de Catálogo' });

    // Esto verifica el TEXTO, no que se vea: jsdom no carga el CSS de los
    // módulos, asi que un `display: none` en .toolBtnLabel no se puede detectar
    // desde aca. Que la etiqueta se vea en mobile lo guarantees la medicion con
    // navegador real, no esta suite.
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo Producto' })).toBeInTheDocument();

    const encabezado = (await screen.findByRole('heading', { name: 'Gestión de Catálogo' }))
      .closest('header')!;
    expect(encabezado.querySelectorAll('button')).toHaveLength(3);
  });

  it('ya no está en el sidebar y no quedó una copia en el drawer mobile', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Gestión de Catálogo' });

    // El sidebar conserva sus ítems de navegación.
    expect(document.querySelectorAll('aside nav a').length).toBeGreaterThan(0);
    expect(document.querySelector('aside')!.textContent).not.toMatch(/Nuevo Producto/i);

    // Y no quedó una segunda copia en el drawer mobile: el botón existe una
    // sola vez en toda la página.
    expect(screen.getAllByRole('button', { name: /Nuevo Producto/i })).toHaveLength(1);
  });

  it('abre el mismo formulario de Nuevo Producto', async () => {
    const user = userEvent.setup();
    montar();

    const nuevo = await screen.findByRole('button', { name: /Nuevo Producto/i });
    // El formulario arranca cerrado: el título del Sheet no está en el DOM.
    expect(screen.queryByText('Nombre del Producto')).toBeNull();

    await user.click(nuevo);

    // Mismo formulario que antes, abierto en modo creación.
    expect(await screen.findByText('Nombre del Producto')).toBeInTheDocument();
    expect(screen.getByText('Precio ($)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar Producto' })).toBeInTheDocument();
  });

  it('lleva el mismo ícono PlusCircle que tenía en el sidebar', async () => {
    montar();
    const nuevo = await screen.findByRole('button', { name: /Nuevo Producto/i });

    // lucide marca cada ícono con su clase. El export PlusCircle es un alias
    // del que hoy se llama CirclePlus, asi que la clase es lucide-circle-plus:
    // es el mismo icono que llevaba el boton del sidebar.
    const svg = nuevo.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('class')).toContain('lucide-circle-plus');
  });
});
