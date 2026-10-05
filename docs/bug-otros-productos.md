# Bug: "Otros Productos" muestra productos de la categoría Perro

> **Estado:** diagnóstico completo, **sin fix aplicado**.
> **Fecha:** 2026-09-10
> **Alcance:** solo lectura / investigación. No se modificó lógica de ninguna sección del Home.

---

## Resumen ejecutivo

La sección **"Otros Productos"** del Home incluye productos cuya categoría es **Perro**.

**No es un problema de datos ni de la categoría.** La categoría se carga bien
(confirmado en base de datos y en el panel admin). El problema es que el Home
agrupa por **categoría + etapa de vida** simultáneamente, y existe un valor de
etapa legítimo —`'All'`— que **no matchea ninguno de los buckets de perro**, así
que los productos Perro con esa etapa caen por exclusión en el residuo "Otros".

**Causa raíz:** `HomePage.tsx:135-154` — el filtro `otros` es un residuo por
exclusión, y un producto solo escapa de él si cumple
`category === PERRO && lifeStage ∈ {Adulto, Cachorro, Senior}`.
Un producto Perro con `lifeStage = 'All'` no cumple → cae en "Otros Productos".

---

## PASO 1 — Origen de la sección

**Respuesta: (b) filtro aplicado en el frontend.** No existe un endpoint dedicado
a "Otros". La lista completa de productos se descarga una vez y toda la
segmentación ocurre en un `useMemo` local.

### 1.1 El fetch

`src/ui/pages/HomePage/HomePage.tsx:68-79`

```tsx
const fetchAll = async () => {
  setLoading(true);
  const [productsData, categoriesData] = await Promise.all([
    getProducts(selectedCategory, selectedLifeStage),
    getCategories(),
  ]);
  setProducts(productsData);
  setDbCategories(categoriesData);
  setLoading(false);
};
fetchAll();
```

Con los valores iniciales `selectedCategory = 'TODOS'` y
`selectedLifeStage = LIFE_STAGE_DEFAULT` (`'All'`), el service **no envía ningún
parámetro de filtro**:

`src/infrastructure/products.service.ts:145-147`

```ts
if (category && category !== 'TODOS' && category !== 'all') params.category = category;
if (lifeStage && lifeStage !== 'TODOS' && !isAllLifeStage(lifeStage))
  params.lifeStage = lifeStage;
```

→ el backend devuelve el **catálogo completo** y el Home segmenta del lado del cliente.

### 1.2 La rama que dispara el bug

`HomePage.tsx:133`

```tsx
const isViewingAll = selectedCategory === 'TODOS';
```

Es la **única** rama que setea `categoryToSet: 'Otros'` (línea 213) y
`hasSeeMore` (línea 216), y por lo tanto la única que renderiza el botón
**"Ver más en {section.title}"** (líneas 301-310). Coincide con el síntoma reportado.

`HomePage.tsx:209-217`

```tsx
if (otros.length > 0)
  finalSections.push({
    title: 'Otros Productos',
    icon: <Search size={24} className={styles.sectionIcon} />,
    products: otros.slice(0, 4),
    theme: 'other',
    categoryToSet: 'Otros',
    hasSeeMore: otros.length > 4,
  });
```

### 1.3 La otra rama (para contraste)

Cuando **no** estás en "TODOS" (`HomePage.tsx:219-260`), "Otros Productos" se arma
por etapa de vida y **sin mirar la categoría en absoluto**:

```tsx
const otrosRes = result.filter(
  (p) => !['Cachorro', 'Adulto', 'Senior'].includes(p.lifeStage),
);
```

Esa rama no setea `hasSeeMore`, por lo que **no** muestra el botón "Ver más" y
**no** es la fuente de este bug. Se documenta porque comparte la misma debilidad
de fondo: `'All'` cae en el residuo.

---

## PASO 2 — La lógica de filtrado

`HomePage.tsx:135-154` (código exacto, rama `isViewingAll`)

```tsx
const perroAdulto = result.filter(
  (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Adulto',
);
const perroCachorro = result.filter(
  (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Cachorro',
);
const perroSenior = result.filter(
  (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Senior',
);
const gatos      = result.filter((p) => p.category?.name?.toUpperCase() === 'GATO');
const accesorios = result.filter((p) => p.category?.name?.toUpperCase() === 'ACCESORIOS');
const otros = result.filter(
  (p) =>
    !perroAdulto.includes(p) && !perroCachorro.includes(p) &&
    !perroSenior.includes(p)    && !gatos.includes(p)      && !accesorios.includes(p),
);
```

Y el push de la sección-perro (para ver la diferencia con "Otros"):

`HomePage.tsx:156-165`

```tsx
if (perroAdulto.length > 0)
  finalSections.push({
    title: 'Línea Adultos',
    icon: <Dog size={24} className={styles.sectionIcon} />,
    products: perroAdulto.slice(0, 4),
    theme: 'adult',
    categoryToSet: 'Perro',
    lifeStageToSet: 'Adulto',
    hasSeeMore: perroAdulto.length > 4,
  });
```

### 2.1 Verificación de hipótesis

| Hipótesis | Veredicto | Detalle |
|---|---|---|
| Comparación **case-sensitive** | ❌ Descartada | `?.toUpperCase() === 'PERRO'` cubre `"Perro"`, `"PERRO"`, `"perro"`. |
| Problema de **espacios / trim** | ⚠️ Riesgo latente | No hay `.trim()`. Un `"Perro "` con espacio final caería en `otros`. No es la causa de este bug, pero es una fragilidad real. |
| **Lista fija de categorías** y "Otros" como residuo | ✅ **Confirmada** | Sí es un residuo por exclusión. Pero la lista efectiva no es de *categorías*: es de **categoría + etapa**. Un producto solo escapa si `category = PERRO` **Y** `lifeStage ∈ {Adulto, Cachorro, Senior}`. |
| **Join / mapeo `categoryId → categoryName` roto** | ❌ Descartada | `getProductCategoryId` (`products.service.ts:36-41`, con fallback a `categoryId`) es otro camino y no interviene acá. El Home lee `p.category?.name` directo, y la categoría se ve bien en la card y en el admin → la relación llega bien. |

### 2.2 El dato clave: `'All'` es una etapa legítima

`src/lib/lifeStage.ts:1`

```ts
export const LIFE_STAGES = ['All', 'Cachorro', 'Adulto', 'Senior'] as const;
export const LIFE_STAGE_DEFAULT: LifeStage = 'All';
```

`'All'` es un valor **válido y persistido** en la base, no un `null`. Se escribe por
default al crear o editar un producto si el usuario no elige una etapa:

`src/ui/components/ProductForm/ProductForm.tsx:249` y `:262`

```tsx
lifeStage: product.lifeStage || LIFE_STAGE_DEFAULT,   // edición
lifeStage: LIFE_STAGE_DEFAULT,                        // alta
```

Como `'All'` no es `'Adulto'`, `'Cachorro'` ni `'Senior'`, **ninguno de los tres
`.filter()` de perro lo captura**, y el filtro `otros` lo recoge por exclusión.

> Detalle adicional: `getCategories` filtra con `Set.has(c.name)` sobre
> `ALLOWED_CATEGORY_NAMES = ['Perro', 'Gato', 'Accesorios', 'Otros']`
> (`products.service.ts:63`, `:130-131`) — misma comparación **sin `trim()`**.
> Es decir, un `"Perro "` con espacio tampoco aparecería en el selector de
> categorías del Home, lo que la haría más difícil de detectar.

---

## PASO 3 — Traza del caso puntual

Producto de ejemplo: **"Royal Intestinal Dog 10Kg"** (`category = "Perro"` confirmado).

| # | Paso | Resultado |
|---|---|---|
| 1 | `getProducts('TODOS', 'All')` | Sin params → llega el catálogo completo. `category.name === 'Perro'`, `lifeStage === 'All'`. |
| 2 | `perroAdulto` | ❌ no entra — `lifeStage` es `'All'`, no `'Adulto'`. |
| 3 | `perroCachorro` | ❌ no entra — `lifeStage` es `'All'`. |
| 4 | `perroSenior` | ❌ no entra — `lifeStage` es `'All'`. |
| 5 | `gatos` | ❌ no entra — `category.name` es `'Perro'`, no `'Gato'`. |
| 6 | `accesorios` | ❌ no entra — `category.name` es `'Perro'`. |
| 7 | `otros` | ✅ **entra** — por exclusión, no haber aparecido en ninguno de los 5 anteriores. |
| 8 | Render | `HomePage.tsx:209` crea la sección `title: 'Otros Productos'`, `theme: 'other'`, `categoryToSet: 'Otros'`. |
| 9 | UI | `<h2>Línea Otros…` con el contador `section.products.length` y el botón "Ver más en Otros Productos" (líneas 301-310). |

**Conclusión del PASO 3:** la categoría es correcta; el producto cae en "Otros"
porque su **etapa de vida es `'All'`**, valor que la lógica del Home interpreta
como "sin etapa" y por lo tanto nadie lo reclama.

### Por qué son 4 productos y no 1

Porque el filtro `otros` no cuela productos al azar: cuela **exactamente los
Perro con `lifeStage = 'All'`** (más lo que genuinamente sea categoría `Otros`).
Si el bug se detecta siempre con el mismo grupo de 4, lo esperable es que esos
4 sean los Perro sin etapa asignada. El slice de 4 (`.slice(0, 4)`) hace que solo
se vean los primeros, que puede dar la impresión de aleatoriedad.

### ⚠️ Verificación pendiente

**No se pudo cerrar contra datos reales.** No hay backend levantado en el entorno
de análisis:

- `curl http://localhost:3000/api/products` → vacío
- `.env` no define `VITE_API_URL` (solo existe `.env.example`)

Para cerrar el diagnóstico hace falta **una** de estas dos:

1. **En el panel admin**, mirar el campo *lifeStage* de "Royal Intestinal Dog 10Kg"
   y de los otros 3. Si dice `All` → diagnóstico cerrado.
2. **Levantar el backend** y consultar el JSON crudo de `GET /products` para ver
   `lifeStage` real de esos productos.

---

## PASO 4 — Opciones de fix (propuestas, NO aplicadas)

Hay una **decisión de producto** detrás, no es un one-liner mecánico. Dos caminos
con consecuencias opuestas sobre qué productos son visibles en el Home:

### Opción A — "Otros" = categoría literal `Otros`

Cambiar el filtro `otros` de residuo por exclusión a un filtro por categoría:

```tsx
const otros = result.filter((p) => p.category?.name?.toUpperCase() === 'OTROS');
```

- ✅ Semántica honesta: la sección muestra lo que su nombre dice.
- ✅ Elimina de raíz la mezcla de categorías en la misma sección.
- ⚠️ **Los productos Perro con `lifeStage = 'All'` desaparecen del Home** en
  lugar de aparecer mal clasificados. Hay que decidir si eso es aceptable o si
  esos productos deben tener etapa cargada sí o sí (y corregir los datos).

### Opción B — Bucketizar `'All'` (mantiene el residuo)

Sumar un bucket para los Perro sin etapa, y recién después calcular el residuo:

```tsx
const perroGeneral = result.filter(
  (p) => p.category?.name?.toUpperCase() === 'PERRO' && !['Adulto', 'Cachorro', 'Senior'].includes(p.lifeStage),
);
const otros = result.filter(
  (p) =>
    !perroAdulto.includes(p) && !perroCachorro.includes(p) && !perroSenior.includes(p) &&
    !perroGeneral.includes(p) && !gatos.includes(p) && !accesorios.includes(p),
);
```

- ✅ Ningún producto desaparece; los Perro sin etapa se muestran como Perro.
- ✅ Cambio acotado: **no toca** las secciones Perro/Gato/Accesorios existentes.
- ⚠️ Hay que decidir el título/icono de la nueva sección (p. ej. "Línea Perro General").
- ⚠️ Mantiene el filtro por residuo, que es estructuralmente frágil.

### Recomendación

**Opción B**, por dos razones:

1. Es la que respeta tu restricción explícita de **no tocar la lógica de las
   demás secciones** si no están relacionadas con el bug.
2. No oculta productos: la Opción A "arregla" el síntoma haciendo desaparecer
   mercadería del Home, que puede ser peor que el bug original.

Además, **en cualquiera de las dos opciones** corresponde aplicar el `.trim()` en
las comparaciones de categoría y, por separado, evaluar si corresponde un
`default de lifeStage` distinto de `'All'` en el alta de productos para que el
caso no vuelva a producirse por el mismo camino.

---

## Referencias de código

| Ubicación | Qué contiene |
|---|---|
| `src/ui/pages/HomePage/HomePage.tsx:68-79` | Fetch de productos y categorías |
| `src/ui/pages/HomePage/HomePage.tsx:133` | `isViewingAll` — selector de rama |
| `src/ui/pages/HomePage/HomePage.tsx:135-154` | **Filtros de sección (incluye el `otros` del bug)** |
| `src/ui/pages/HomePage/HomePage.tsx:156-217` | Push de las secciones del Home |
| `src/ui/pages/HomePage/HomePage.tsx:219-260` | Rama alternativa (filtrada por categoría) |
| `src/ui/pages/HomePage/HomePage.tsx:280-286` | `<h2>` del título + `<span>` contador |
| `src/ui/pages/HomePage/HomePage.tsx:301-310` | Botón "Ver más en {title}" |
| `src/infrastructure/products.service.ts:36-41` | `getProductCategoryId` (no interviene en este bug) |
| `src/infrastructure/products.service.ts:63` | `ALLOWED_CATEGORY_NAMES` |
| `src/infrastructure/products.service.ts:130-147` | Filtrado de categorías y params de `getProducts` |
| `src/lib/lifeStage.ts:1-6` | `LIFE_STAGES` y `LIFE_STAGE_DEFAULT = 'All'` |
| `src/ui/components/ProductForm/ProductForm.tsx:249, 262` | Default de `lifeStage` en alta/edición |
