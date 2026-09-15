import api from './api';
import { isAllLifeStage, type LifeStage } from '@/lib/lifeStage';
import { devError } from '@/infrastructure/utils/logger';

export const PresentationType = {
  BAG: 'bag',
  KILO: 'kilo',
} as const;

export type PresentationType = (typeof PresentationType)[keyof typeof PresentationType];

export interface ProductPresentation {
  id?: string;
  type: PresentationType;
  weightKg: number | null;
  // Kilos que quedan en la bolsa abierta. Aplica a presentaciones tipo `bag`
  // (la bolsa física que se fracciona para vender por kilo). El backend lo
  // guarda acá, no a nivel de producto.
  openBagRemainingKg?: number | null;
  price: number;
  /** Costo de la presentación (nullable, opcional como en el CSV). */
  cost?: number | null;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

/**
 * Extrae el id de categoría aceptando tanto la relación anidada
 * (`category`) como el FK plano (`categoryId`), según lo que devuelva el backend.
 */
export const getProductCategoryId = (product: Product): string => {
  const nested = product.category?.id;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  const flat = product.categoryId;
  return typeof flat === 'string' ? flat : '';
};

/**
 * Extrae el id de marca aceptando tanto la relación anidada (`brand`)
 * como el FK plano (`brandId`), según lo que devuelva el backend.
 */
export const getProductBrandId = (product: Product): string | null => {
  const nested = product.brand?.id;
  if (typeof nested === 'string' && nested.length > 0) return nested;
  const flat = product.brandId;
  return typeof flat === 'string' && flat.length > 0 ? flat : null;
};

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  category: {
    name: string;
  };
}

export const ALLOWED_CATEGORY_NAMES = ['Perro', 'Gato', 'Accesorios', 'Otros'] as const;
export type AllowedCategoryName = (typeof ALLOWED_CATEGORY_NAMES)[number];

/**
 * Umbral de stock bajo por defecto para el filtro client-side "Stock bajo"
 * del Catálogo. El backend ahora soporta un `lowStockThreshold` por
 * producto (default 2); esta constante se usa como criterio del filtro
 * del Catálogo cuando no se discrimina por producto.
 */
export const LOW_STOCK_THRESHOLD = 5;

export interface Product {
  id: string; // Reflected from backend UUID
  name: string; // Reflected from backend 'name'
  price: number; // Reflected from backend 'price'
  /** Costo general del producto (nullable, opcional como en el CSV). */
  cost?: number | null;
  stock: number;
  /** Umbral de stock bajo propio del producto (el backend usa 2 por defecto si es null). */
  lowStockThreshold?: number | null;
  category: Category; // Reflected from backend 'category' relation
  lifeStage: LifeStage; // Strict union matching backend
  supplier?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  // FKs planos: algunos endpoints los devuelven en vez de (o además de)
  // las relaciones anidadas. Ver getProductCategoryId/getProductBrandId.
  categoryId?: string | null;
  brandId?: string | null;
  image?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  presentations?: ProductPresentation[];
  // Legacy: el remanente de bolsa abierta ahora vive en la presentación
  // tipo `bag` (ProductPresentation.openBagRemainingKg). Este campo solo
  // existe por compatibilidad con respuestas viejas durante la migración.
  openBagRemainingKg?: number | null;
  // Legacy fields for backwards compatibility (until migration is complete)
  pricePerBag?: number | null;
  pricePerKilo?: number | null;
}

export interface CreateProductPayload {
  name: string;
  price: number;
  /** Costo general del producto (nullable, opcional como en el CSV). */
  cost?: number | null;
  stock: number;
  /** Umbral de stock bajo propio del producto (opcional, default del backend: 2). */
  lowStockThreshold?: number | null;
  categoryId: string; // UUID of the category
  lifeStage: LifeStage;
  supplierId?: string | null; // UUID del proveedor (opcional, en desuso: usar brandId)
  brandId?: string | null; // UUID de la marca (opcional)
  image?: string;
  isActive?: boolean;
  presentations?: ProductPresentation[];
  // Legacy fields for backwards compatibility (until migration is complete)
  pricePerBag?: number | null;
  pricePerKilo?: number | null;
}

export const getCategories = async (): Promise<Category[]> => {
  try {
    const response = await api.get<Category[]>('/products/categories');
    // Solo exponer categorías de especie/tipo. Las categorías de etapa de
    // vida (Alimento Cachorro/Alimento Adulto) ya no existen como categoría.
    const allowed = new Set<string>(ALLOWED_CATEGORY_NAMES);
    return (response.data || []).filter((c) => allowed.has(c.name));
  } catch (error) {
    devError('Error fetching categories:', error);
    return [];
  }
};

export const getProducts = async (
  category?: string,
  lifeStage?: string,
  showAll?: boolean,
): Promise<Product[]> => {
  try {
    const params: Record<string, string | boolean | undefined> = {};
    if (category && category !== 'TODOS' && category !== 'all') params.category = category;
    if (lifeStage && lifeStage !== 'TODOS' && !isAllLifeStage(lifeStage))
      params.lifeStage = lifeStage;
    if (showAll) params.showAll = true;

    const response = await api.get<Product[]>('/products', { params });
    return response.data;
  } catch (error) {
    devError('Error fetching products:', error);
    return [];
  }
};

export const createProduct = async (product: CreateProductPayload): Promise<Product> => {
  const response = await api.post<Product>('/products', product);
  return response.data;
};

export interface LowStockAlerts {
  outOfStock: LowStockProduct[];
  lowStock: LowStockProduct[];
}

export const getLowStockProducts = async (): Promise<LowStockAlerts> => {
  const response = await api.get<LowStockAlerts | LowStockProduct[]>('/products/low-stock');
  const data = response.data;
  // Compatibilidad con la respuesta vieja (array plano): stock 0 →
  // "sin stock", el resto → "stock bajo".
  if (Array.isArray(data)) {
    return {
      outOfStock: data.filter((p) => p.stock === 0),
      lowStock: data.filter((p) => p.stock !== 0),
    };
  }
  return {
    outOfStock: data?.outOfStock ?? [],
    lowStock: data?.lowStock ?? [],
  };
};

export const updateProduct = async (
  id: string,
  product: Partial<CreateProductPayload>,
): Promise<Product> => {
  const response = await api.patch<Product>(`/products/${id}`, product);
  return response.data;
};

export const bulkUploadProducts = async (file: File): Promise<unknown> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/products/bulk', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(`/products/${id}`);
};

export const toggleProductActive = async (id: string): Promise<Product> => {
  const response = await api.patch<Product>(`/products/${id}/toggle-active`);
  return response.data;
};

/**
 * Exporta los productos a un archivo CSV y triggerea la descarga.
 * Columnas separadas y legibles (sin JSON embebido): las presentaciones
 * se desglosan en columnas de bolsa y de kilo. Usa UTF-8 con BOM para
 * compatibilidad con Excel.
 */
export const exportProductsToCsv = (products: Product[]): void => {
  // 1. Definir headers del CSV
  const headers = [
    'id',
    'nombre',
    'categoria',
    'etapa_vida',
    'precio',
    'costo',
    'marca',
    'stock',
    'activo',
    'peso_bolsa_kg',
    'precio_bolsa',
    'costo_bolsa',
    'bolsa_abierta_kg_restantes',
    'precio_kilo',
    'costo_kilo',
    'imagen',
    'fecha_creacion',
    'fecha_actualizacion',
  ];

  // Celda de texto: null/undefined → vacío (nunca "null" como texto).
  const toCell = (value: string | number | boolean | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

  // 2. Convertir cada producto a fila
  const rows = products.map((product) => {
    const bag = product.presentations?.find((p) => p.type === 'bag');
    const kilo = product.presentations?.find((p) => p.type === 'kilo');

    return [
      toCell(product.id),
      toCell(product.name),
      toCell(product.category?.name),
      toCell(product.lifeStage),
      toCell(product.price),
      toCell(product.cost),
      toCell(product.brand?.name),
      toCell(product.stock),
      product.isActive?.toString() ?? 'true',
      toCell(bag?.weightKg),
      toCell(bag?.price ?? product.pricePerBag),
      toCell(bag?.cost),
      toCell(bag?.openBagRemainingKg ?? product.openBagRemainingKg),
      toCell(kilo?.price ?? product.pricePerKilo),
      toCell(kilo?.cost),
      toCell(product.image),
      toCell(product.createdAt),
      toCell(product.updatedAt),
    ];
  });

  // 3. Unir todo con saltos de línea (escapar comillas)
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // 4. Agregar BOM para Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 5. Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  link.href = url;
  link.download = `productos-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
