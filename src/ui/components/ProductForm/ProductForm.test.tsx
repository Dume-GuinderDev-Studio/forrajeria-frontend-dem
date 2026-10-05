import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { productSchema, ProductForm } from './ProductForm';

// Mock enrutado por URL: /brands y /categories tienen que poder responder
// distinto, sobre todo para probar la carga asíncrona de la lista de marcas.
const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

const mockApi = ({
  brands = [] as { id: string; name: string }[],
  categories = [] as { id: string; name: string }[],
} = {}) => {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/brands') return { data: brands };
    if (url === '/products/categories') return { data: categories };
    return { data: [] };
  });
  apiMock.post.mockResolvedValue({ data: {} });
  apiMock.patch.mockResolvedValue({ data: {} });
};

vi.mock('@/infrastructure/api', () => ({ default: apiMock }));

mockApi();

const validProduct = {
  name: 'Royal Canin Cachorro 15kg',
  price: 1000,
  stock: 10,
  categoryId: 'cat-1',
  lifeStage: 'Cachorro',
  image: '',
};

describe('productSchema', () => {
  it('acepta un producto válido', () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = productSchema.safeParse({ ...validProduct, name: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('El nombre es obligatorio');
    }
  });

  it('rechaza precio 0 o negativo', () => {
    expect(productSchema.safeParse({ ...validProduct, price: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, price: -5 }).success).toBe(false);
  });

  it('rechaza stock negativo', () => {
    expect(productSchema.safeParse({ ...validProduct, stock: -1 }).success).toBe(false);
  });

  it('rechaza categoría vacía', () => {
    expect(productSchema.safeParse({ ...validProduct, categoryId: '' }).success).toBe(false);
  });

  it('rechaza etapa de vida inválida', () => {
    expect(productSchema.safeParse({ ...validProduct, lifeStage: 'Bebé' }).success).toBe(false);
  });

  it('rechaza URL de imagen inválida pero acepta vacía, null o undefined', () => {
    expect(productSchema.safeParse({ ...validProduct, image: 'no-es-url' }).success).toBe(false);
    expect(productSchema.safeParse({ ...validProduct, image: '' }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, image: null }).success).toBe(true);
    expect(productSchema.safeParse({ ...validProduct, image: undefined }).success).toBe(true);
  });
});

describe('ProductForm (create mode, single bag)', () => {
  it('muestra una única bolsa con helpers y sin botón Agregar bolsa', async () => {
    render(<ProductForm product={null} />);

    await screen.findByText('Venta por Bolsa');
    expect(
      screen.getByText('Definí el peso de la bolsa cerrada y cuántos kilos quedan abiertos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Definí si este producto también se vende por kilo suelto en la tienda.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/agregar bolsa/i)).toBeNull();
    expect(screen.getAllByPlaceholderText('Peso (kg)')).toHaveLength(1);
  });
});

const productConBolsa = {
  id: 'p1',
  name: 'Alimento Test',
  price: 50000,
  cost: 40000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  image: '',
  presentations: [{ type: 'bag', weightKg: 15, price: 50000, cost: 40000 }],
};

describe('ProductForm (la bolsa toma precio y costo generales)', () => {
  it('no repite los inputs de precio y costo en la bolsa cerrada', async () => {
    render(<ProductForm product={productConBolsa as never} />);

    await screen.findByText('Venta por Bolsa');
    expect(screen.getByPlaceholderText('Peso (kg)')).toHaveValue(15);
    expect(screen.queryByPlaceholderText('Precio ($)')).toBeNull();
    expect(screen.queryByPlaceholderText('Costo ($)')).toBeNull();
  });

  it('muestra en solo lectura el precio y el costo que se van a enviar', async () => {
    render(<ProductForm product={productConBolsa as never} />);

    await screen.findByText('Venta por Bolsa');
    // formatARS separa $ y número con espacio duro: el matcher lo tolera.
    expect(screen.getByText(/Precio.*50\.000.*Costo.*40\.000/)).toBeInTheDocument();
  });
});

const CATEGORIAS = [
  { id: 'c1', name: 'Perro' },
  { id: 'c2', name: 'Gato' },
  { id: 'c3', name: 'Higiene' },
  { id: 'c4', name: 'Accesorios' },
  { id: 'c5', name: 'Otros' },
];

/** El <select> nativo de categoría: el label no está asociado, así que se busca por tag. */
const categorySelect = () =>
  screen.getAllByRole('combobox').find((el) => el.tagName === 'SELECT') as HTMLSelectElement;

/** Interruptor de "Otros". */
const otrosToggle = () => screen.getByLabelText('Se vende por bolsa o por kilo');

describe('ProductForm (la sección de bolsa/kilo depende de la categoría)', () => {
  beforeEach(() => {
    mockApi({ categories: CATEGORIAS });
  });

  it('Accesorios: no muestra bolsa ni kilo, ni el interruptor', async () => {
    render(
      <ProductForm
        product={{
          ...productoSinPresentaciones,
          category: { id: 'c4', name: 'Accesorios' },
        } as never}
      />,
    );

    await screen.findByText('URL de la Imagen');
    expect(screen.queryByText('Venta por Bolsa')).toBeNull();
    expect(screen.queryByText('Venta por Kilo')).toBeNull();
    expect(screen.queryByLabelText('Se vende por bolsa o por kilo')).toBeNull();
  });

  it.each(['Perro', 'Gato', 'Higiene'])(
    '%s: muestra bolsa y kilo, sin interruptor',
    async (categoryName) => {
      render(
        <ProductForm
          product={{ ...productoBase, category: { id: 'c1', name: categoryName } } as never}
        />,
      );

      expect(await screen.findByText('Venta por Bolsa')).toBeInTheDocument();
      expect(screen.getByText('Venta por Kilo')).toBeInTheDocument();
      // El interruptor es solo de "Otros": el resto siempre muestra la sección.
      expect(screen.queryByLabelText('Se vende por bolsa o por kilo')).toBeNull();
    },
  );

  it('Otros: muestra el interruptor, apagado, y esconde bolsa y kilo', async () => {
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c5', name: 'Otros' } } as never}
      />,
    );

    expect(await screen.findByLabelText('Se vende por bolsa o por kilo')).not.toBeChecked();
    expect(screen.queryByText('Venta por Bolsa')).toBeNull();
    expect(screen.queryByText('Venta por Kilo')).toBeNull();
  });

  it('Otros: al encender el interruptor aparece la sección', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c5', name: 'Otros' } } as never}
      />,
    );

    await user.click(otrosToggle());

    expect(screen.getByText('Venta por Bolsa')).toBeInTheDocument();
    expect(screen.getByText('Venta por Kilo')).toBeInTheDocument();
  });

  it('Otros: un producto NUEVO arranca con el interruptor apagado', async () => {
    const user = userEvent.setup();
    render(<ProductForm product={null} />);

    await screen.findByText('URL de la Imagen');
    await user.selectOptions(categorySelect(), 'c5');

    // Sin bolsa ni kilo hasta que el usuario diga que el producto se vende así.
    expect(otrosToggle()).not.toBeChecked();
    expect(screen.queryByText('Venta por Bolsa')).toBeNull();
    expect(screen.queryByText('Venta por Kilo')).toBeNull();
    expect(screen.queryByText('Stock (bolsas cerradas)')).toBeNull();
  });

  it('Otros: un producto guardado con presentaciones arranca con el interruptor encendido', async () => {
    render(
      <ProductForm
        product={{
          ...productoBase,
          category: { id: 'c5', name: 'Otros' },
          presentations: [{ type: 'kilo', weightKg: null, price: 3500, cost: null }],
        } as never}
      />,
    );

    // Si arrancara apagado, el usuario vería desaparecer la sección sin haberlo pedido.
    expect(await otrosToggle()).toBeChecked();
    expect(screen.getByText('Venta por Kilo')).toBeInTheDocument();
  });
});

/**
 * El trigger de marca es un <button role="combobox"> de Radix; el texto que
 * muestra es el del <SelectItem> cuyo value matchea el del Select. Por eso
 * estos tests miran ese texto: es exactamente lo que ve el usuario.
 */
const marcaTrigger = () =>
  screen.getAllByRole('combobox').find((el) => el.tagName === 'BUTTON') as HTMLElement;
const marcaVisible = () => marcaTrigger().querySelector('span')?.textContent;

/** Promesa controlable para simular una respuesta que llega tarde. */
const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve: () => resolve() };
};

const productoBase = {
  id: 'p1',
  name: 'Alimento Test',
  price: 50000,
  cost: 40000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  image: '',
  // Con bolsa: el peso es obligatorio mientras la sección esté visible, así que
  // un fixture sin bolsa no serviría para probar otros clics (marca, etc.).
  presentations: [{ type: 'bag', weightKg: 15, price: 50000, cost: 40000 }],
};

/** Producto sin bolsa ni kilo: un collar de Accesorios o uno nuevo de Otros. */
const productoSinPresentaciones = {
  id: 'p1',
  name: 'Alimento Test',
  price: 50000,
  cost: 40000,
  stock: 10,
  category: { id: 'c1', name: 'Perro' },
  lifeStage: 'Adulto',
  image: '',
};

describe('ProductForm (payload de presentaciones según la categoría)', () => {
  beforeEach(() => {
    mockApi({ categories: CATEGORIAS });
    apiMock.patch.mockClear();
    apiMock.post.mockClear();
  });

  const patchDe = () => apiMock.patch.mock.calls[0][1] as Record<string, unknown>;

  it('Accesorios: guarda sin presentaciones y con Precio/Costo General', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c4', name: 'Accesorios' } } as never}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    const patch = patchDe();
    // undefined = la clave se omite y el backend no toca las presentaciones.
    expect(patch.presentations).toBeUndefined();
    expect(patch.price).toBe(50000);
    expect(patch.cost).toBe(40000);
  });

  it('Otros con el interruptor apagado guarda sin presentaciones', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c5', name: 'Otros' } } as never}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    expect(patchDe().presentations).toBeUndefined();
  });

  it('Otros: encendido el interruptor se puede guardar vendido por kilo', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c5', name: 'Otros' } } as never}
      />,
    );

    await user.click(otrosToggle());
    await user.type(screen.getByPlaceholderText('Peso (kg)'), '1');
    await user.click(screen.getByLabelText('Habilitar venta por kilo'));
    await user.type(screen.getByPlaceholderText('Precio por kg ($)'), '3500');

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    const patch = apiMock.patch.mock.calls[0][1] as {
      presentations?: { type: string; price: number }[];
    };
    expect(patch.presentations).toHaveLength(2);
    expect(patch.presentations?.[1]).toMatchObject({ type: 'kilo', price: 3500 });
  });

  it('Otros: apagar el interruptor en un producto con presentaciones pide confirmación', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{
          ...productoBase,
          category: { id: 'c5', name: 'Otros' },
          presentations: [{ type: 'kilo', weightKg: null, price: 3500, cost: null }],
        } as never}
      />,
    );

    expect(await otrosToggle()).toBeChecked();
    await user.click(otrosToggle());

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    // Todavía no se guardó: el aviso corta el submit.
    expect(await screen.findByText('Se van a quitar las presentaciones')).toBeInTheDocument();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('Otros: confirmar el aviso borra las presentaciones (presentations: [])', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{
          ...productoBase,
          category: { id: 'c5', name: 'Otros' },
          presentations: [{ type: 'kilo', weightKg: null, price: 3500, cost: null }],
        } as never}
      />,
    );

    expect(await otrosToggle()).toBeChecked();
    await user.click(otrosToggle());
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await user.click(await screen.findByRole('button', { name: /Quitar y guardar/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    // [] y no undefined: undefined le diría al backend "no toques las presentaciones".
    expect(patchDe().presentations).toEqual([]);
  });

  it('Otros: cancelar el aviso no guarda nada', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{
          ...productoBase,
          category: { id: 'c5', name: 'Otros' },
          presentations: [{ type: 'kilo', weightKg: null, price: 3500, cost: null }],
        } as never}
      />,
    );

    expect(await otrosToggle()).toBeChecked();
    await user.click(otrosToggle());
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await user.click(await screen.findByRole('button', { name: /Cancelar/i }));

    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('Otros: apagar el interruptor sin presentaciones guardadas no pide confirmación', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c5', name: 'Otros' } } as never}
      />,
    );

    await user.click(otrosToggle());
    await user.click(otrosToggle());
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    expect(screen.queryByText('Se van a quitar las presentaciones')).toBeNull();
  });
});

describe('ProductForm (peso de bolsa obligatorio solo con la sección visible)', () => {
  beforeEach(() => {
    mockApi({ categories: CATEGORIAS });
    apiMock.patch.mockClear();
  });

  it('con la sección visible, sin peso no guarda y avisa', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c1', name: 'Perro' } } as never}
      />,
    );

    await screen.findByText('Venta por Bolsa');
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    expect(await screen.findByText('El peso de la bolsa es obligatorio')).toBeInTheDocument();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('con la sección visible y peso cargado, guarda', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id: 'c1', name: 'Perro' } } as never}
      />,
    );

    await screen.findByText('Venta por Bolsa');
    await user.type(screen.getByPlaceholderText('Peso (kg)'), '15');
    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
  });

  it('sin la sección (Accesorios) no se exige peso y guarda igual', async () => {
    const user = userEvent.setup();
    render(
      <ProductForm
        product={{
          ...productoSinPresentaciones,
          category: { id: 'c4', name: 'Accesorios' },
        } as never}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    expect(screen.queryByText('El peso de la bolsa es obligatorio')).toBeNull();
  });
});

describe('ProductForm (etiqueta de stock según la sección de bolsa)', () => {
  beforeEach(() => {
    mockApi({ categories: CATEGORIAS });
  });

  // El id acompaña al nombre porque la categoría se resuelve por id: con 'c1'
  // fijo, visibleCategories devolvería 'Perro' para todos los casos.
  it.each([
    ['c1', 'Perro', true],
    ['c2', 'Gato', true],
    ['c3', 'Higiene', true],
    ['c4', 'Accesorios', false],
  ])('%s: bolsa %s', async (id, categoryName, conBolsa) => {
    render(
      <ProductForm
        product={{ ...productoSinPresentaciones, category: { id, name: categoryName } } as never}
      />,
    );

    await screen.findByText('URL de la Imagen');
    expect(screen.queryByText('Stock (bolsas cerradas)') !== null).toBe(conBolsa);
    // La etiqueta simple solo aparece cuando no hay bolsa visible.
    expect(screen.queryByText('Stock') !== null).toBe(!conBolsa);
  });
});


describe('ProductForm (marca)', () => {
  // El mock es de módulo: sin limpiar, calls[0] es la llamada de un test previo.
  beforeEach(() => {
    apiMock.patch.mockClear();
    apiMock.post.mockClear();
  });

  it('muestra la marca guardada del producto', async () => {
    mockApi({ brands: [{ id: 'b-1', name: 'ROYAL CANIN' }] });
    render(
      <ProductForm
        product={{ ...productoBase, brand: { id: 'b-1', name: 'ROYAL CANIN' } } as never}
      />,
    );

    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));
  });

  it('muestra la marca cuando el id viene plano (sin relación anidada)', async () => {
    mockApi({ brands: [{ id: 'b-1', name: 'ROYAL CANIN' }] });
    render(<ProductForm product={{ ...productoBase, brandId: 'b-1' } as never} />);

    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));
  });

  it('muestra Sin marca cuando el producto no tiene marca', async () => {
    mockApi({ brands: [{ id: 'b-1', name: 'ROYAL CANIN' }] });
    render(<ProductForm product={productoBase as never} />);

    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('Sin marca'));
  });

  it('conserva la marca cuando la lista llega después (carga asíncrona)', async () => {
    // La lista de marcas se resuelve tarde: el Select ya está controlado con el
    // id del producto y solo después llegan los items de la lista.
    const brandsGate = createDeferred();
    let brandsResolved = false;
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/brands') {
        await brandsGate.promise;
        brandsResolved = true;
        return {
          data: [
            { id: 'b-1', name: 'ROYAL CANIN' },
            { id: 'b-2', name: 'PRO PLAN' },
          ],
        };
      }
      return { data: [] };
    });
    apiMock.patch.mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    render(
      <ProductForm
        product={{ ...productoBase, brand: { id: 'b-1', name: 'ROYAL CANIN' } } as never}
      />,
    );

    // Antes de que llegue la lista, la marca del producto ya se ve.
    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));

    brandsGate.resolve();

    // Prueba positiva de que la lista efectivamente cargó. Sin esto, la
    // comprobación siguiente no distinguiría "cargó y conservó la marca" de
    // "nunca cargó": con el gate sin resolver sería idéntica a la de arriba y
    // no podría fallar nunca.
    await waitFor(() => expect(brandsResolved).toBe(true));

    // La marca sigue visible después de cargar: el eco del <select> nativo
    // oculto de Radix no puede pisar el valor del form.
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));

    // Y las opciones del dropdown son ahora las de la lista que recién cargó,
    // lo que confirma que el contenido llegó y no solo el flag.
    marcaTrigger().focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('option', { name: 'PRO PLAN' })).toBeInTheDocument();
  });

  it('omite brandId del patch si la marca no cambió (no pisa el dato real)', async () => {
    mockApi({ brands: [{ id: 'b-1', name: 'ROYAL CANIN' }] });
    const user = userEvent.setup();

    render(
      <ProductForm
        product={{ ...productoBase, brand: { id: 'b-1', name: 'ROYAL CANIN' } } as never}
      />,
    );
    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    const patch = apiMock.patch.mock.calls[0][1] as Record<string, unknown>;
    // El eco de Radix solía dejar brandId en "" y eso hacía que el form lo
    // creyera cambiado. Si no se manda la clave, el backend no toca la marca.
    expect('brandId' in patch).toBe(false);
  });

  it('manda la marca nueva cuando el usuario la cambia', async () => {
    mockApi({
      brands: [
        { id: 'b-1', name: 'ROYAL CANIN' },
        { id: 'b-2', name: 'PRO PLAN' },
      ],
    });
    const user = userEvent.setup();

    render(
      <ProductForm
        product={{ ...productoBase, brand: { id: 'b-1', name: 'ROYAL CANIN' } } as never}
      />,
    );
    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));

    marcaTrigger().focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: 'PRO PLAN' }));
    await waitFor(() => expect(marcaVisible()).toBe('PRO PLAN'));

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    const patch = apiMock.patch.mock.calls[0][1] as { brandId?: string };
    expect(patch.brandId).toBe('b-2');
  });

  it('sigue mandando la marca cuando el usuario elige Sin marca', async () => {
    mockApi({ brands: [{ id: 'b-1', name: 'ROYAL CANIN' }] });
    const user = userEvent.setup();

    render(
      <ProductForm
        product={{ ...productoBase, brand: { id: 'b-1', name: 'ROYAL CANIN' } } as never}
      />,
    );
    await screen.findByText('Venta por Bolsa');
    await waitFor(() => expect(marcaVisible()).toBe('ROYAL CANIN'));

    // Radix Select no abre con click en jsdom: se abre con teclado.
    marcaTrigger().focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('option', { name: 'Sin marca' }));
    await waitFor(() => expect(marcaVisible()).toBe('Sin marca'));

    await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }));
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalled());
    const patch = apiMock.patch.mock.calls[0][1] as { brandId?: string | null };
    // null desvincula la marca: es distinto de omitirla.
    expect(patch.brandId).toBeNull();
  });
});

describe('productSchema (marca)', () => {
  it('rechaza una marca vacía en vez de aceptarla en silencio', () => {
    const base = {
      name: 'X',
      price: 100,
      stock: 1,
      categoryId: 'c1',
      lifeStage: 'Adulto',
      image: '',
    };
    expect(productSchema.safeParse({ ...base, brandId: 'b-1' }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, brandId: null }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, brandId: '' }).success).toBe(false);
  });
});
