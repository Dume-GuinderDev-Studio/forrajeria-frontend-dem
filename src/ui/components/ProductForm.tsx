import { useState, useEffect, useMemo, useRef } from 'react';
import type { ClipboardEvent as ReactClipboardEvent, FocusEvent as ReactFocusEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  createProduct,
  updateProduct,
  getCategories,
  getProductBrandId,
  getProductCategoryId,
  type Category,
  type Product,
  type CreateProductPayload,
} from '@/infrastructure/products.service';
import { devLog, devError } from '@/infrastructure/utils/logger';
import { Package, DollarSign, Tag, Archive, Loader2, Tags, Calculator } from 'lucide-react';
import { calcSuggestedPrice, parseMarginInput } from './suggestedPrice';
import {
  ProductPresentationsSection,
  buildPresentationsPayload,
} from './ProductPresentationsSection';
import { LIFE_STAGES, LIFE_STAGE_DEFAULT, LIFE_STAGE_OPTIONS } from '@/lib/lifeStage';
import { normalizeNumberText, parseLocalizedNumber } from '@/lib/numbers';
import { getBrands, type Brand } from '@/infrastructure/brands.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select';

const optionalCost = z
  .number({ error: 'El costo debe ser un número' })
  .min(0, 'El costo no puede ser negativo')
  .nullable()
  .optional();

/** Convierte el valor crudo del input numérico: vacío → null (nunca 0 forzado). */
const emptyToNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  price: z.number().min(0.01, 'El precio debe ser mayor a 0'),
  cost: optionalCost,
  stock: z.number().min(0, 'El stock no puede ser negativo'),
  lowStockThreshold: z
    .number({ error: 'El umbral debe ser un número' })
    .int('El umbral debe ser un número entero')
    .min(0, 'El umbral no puede ser negativo')
    .nullable()
    .optional(),
  categoryId: z.string().min(1, 'La categoría es obligatoria'),
  lifeStage: z.enum(LIFE_STAGES),
  brandId: z.string().nullable().optional(),
  image: z.string().url('Debe ser una URL válida').optional().or(z.literal('')).nullable(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

/** Valor centinela del Select para "Sin marca" (los items no aceptan string vacío). */
const NO_BRAND_VALUE = '__none';

interface PresentationRow {
  id: string;
  weightKg: number | null;
  price: number | null;
  cost?: number | null;
  /** Margen % solo para cálculo en el formulario, NO se persiste al backend. */
  marginPct?: number | null;
  /** Kg restantes de la bolsa físicamente abierta (opcional, se envía al backend). */
  openBagRemainingKg?: number | null;
}

interface ProductFormProps {
  product?: Product | null;
  onSuccess?: () => void | Promise<void>;
}

export const ProductForm = ({ product, onSuccess }: ProductFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isBrandsLoading, setIsBrandsLoading] = useState(true);

  const [presentationsData, setPresentationsData] = useState<{
    bagRow: PresentationRow | null;
    kiloEnabled: boolean;
    kiloPrice: number | null;
    kiloCost: number | null;
  }>({
    bagRow: null,
    kiloEnabled: false,
    kiloPrice: null,
    kiloCost: null,
  });
  // Margen % general: solo herramienta de cálculo, no se persiste al backend.
  const [generalMargin, setGeneralMargin] = useState<number | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const data = await getCategories();
        devLog('[ProductForm] Categorías recibidas:', data);
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          devError('[ProductForm] La respuesta de categorías no es un array:', data);
          setCategories([]);
        }
      } catch (error) {
        devError('[ProductForm] Error fetching categories:', error);
        setCategories([]);
      } finally {
        setIsCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchBrands = async () => {
      setIsBrandsLoading(true);
      try {
        const data = await getBrands();
        setBrands(Array.isArray(data) ? data : []);
      } catch (error) {
        devError('[ProductForm] Error fetching brands:', error);
        setBrands([]);
      } finally {
        setIsBrandsLoading(false);
      }
    };
    fetchBrands();
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });

  /**
   * Limpieza de separadores de miles en precio/costo general (ej. pegan
   * "72,666.00" de la lista del proveedor → muestra "72666.00").
   * En type="number" el pegado crudo se descartaría, por eso se intercepta
   * el paste y se deja el valor ya normalizado en el input (req. punto 4).
   */
  const applyCleanedGeneralNumber = (field: 'price' | 'cost', cleaned: string) => {
    if (cleaned === '') {
      if (field === 'cost') {
        setValue(field, null, { shouldValidate: true, shouldDirty: true });
      }
      return;
    }
    const n = Number(cleaned);
    if (Number.isFinite(n)) {
      setValue(field, n, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleGeneralNumberPaste = (
    e: ReactClipboardEvent<HTMLInputElement>,
    field: 'price' | 'cost',
  ) => {
    const pasted = e.clipboardData.getData('text');
    if (!/[.,]/.test(pasted)) return; // número plano: comportamiento default
    e.preventDefault();
    const cleaned = normalizeNumberText(pasted);
    e.currentTarget.value = cleaned;
    applyCleanedGeneralNumber(field, cleaned);
  };

  const handleGeneralNumberBlur = (
    e: ReactFocusEvent<HTMLInputElement>,
    field: 'price' | 'cost',
    rhfOnBlur: (event: ReactFocusEvent<HTMLInputElement>) => unknown,
  ) => {
    void rhfOnBlur(e);
    const cleaned = normalizeNumberText(e.target.value);
    if (cleaned !== e.target.value) {
      e.target.value = cleaned;
      applyCleanedGeneralNumber(field, cleaned);
    }
  };

  const priceReg = register('price', { setValueAs: parseLocalizedNumber });
  const costReg = register('cost', { setValueAs: parseLocalizedNumber });

  /** Precio sugerido general: precio = costo * (1 + margen/100). Editable después. */
  const calcGeneralPrice = () => {
    const cost = getValues('cost');
    if (cost === null || cost === undefined) {
      toast.error('Cargá el costo general para calcular el precio');
      return;
    }
    const suggested = calcSuggestedPrice(cost, generalMargin);
    if (suggested === null) {
      toast.error('Costo o margen inválido');
      return;
    }
    setValue('price', suggested, { shouldValidate: true, shouldDirty: true });
    toast.success(`Precio sugerido: $${suggested}`);
  };

  // Valores originales con los que se inicializó el formulario: en update
  // se omiten brandId/categoryId si no cambiaron, para nunca pisar el dato
  // real con un valor vacío por un error de timing de carga.
  const originalRef = useRef<{ categoryId: string; brandId: string | null } | null>(null);

  // Reset form when product prop changes. El producto llega completo desde
  // la lista (GET /products ya incluye la relación brand).
  useEffect(() => {
    if (product) {
      // LOG TEMPORAL: objeto completo tal como llega al abrir edición.
      console.log('[ProductForm] Producto a editar:', product);
      const initialCategoryId = getProductCategoryId(product);
      const initialBrandId = getProductBrandId(product);
      reset({
        name: product.name,
        price: product.price,
        cost: product.cost ?? null,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold ?? null,
        categoryId: initialCategoryId,
        lifeStage: product.lifeStage || LIFE_STAGE_DEFAULT,
        brandId: initialBrandId,
        image: product.image || '',
      });
      originalRef.current = { categoryId: initialCategoryId, brandId: initialBrandId };
    } else {
      reset({
        name: '',
        price: 0,
        cost: null,
        stock: 0,
        lowStockThreshold: null,
        categoryId: '',
        lifeStage: LIFE_STAGE_DEFAULT,
        brandId: null,
        image: '',
      });
      originalRef.current = null;
    }
  }, [product, reset]);

  const onSubmit = async (data: ProductFormValues) => {
    setIsLoading(true);
    try {
      // Construir presentations desde la bolsa única + kilo opcional
      const presentations = buildPresentationsPayload(
        presentationsData.bagRow,
        presentationsData.kiloEnabled,
        presentationsData.kiloPrice,
        presentationsData.kiloCost,
      );

      // Validaciones adicionales

      if (
        presentationsData.kiloEnabled &&
        (!presentationsData.kiloPrice || presentationsData.kiloPrice <= 0)
      ) {
        toast.error('El precio por kilo es obligatorio cuando está habilitado');
        setIsLoading(false);
        return;
      }

      // Payload con presentations
      const normalizeCost = (v: number | null | undefined): number | null => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };

      const payload: CreateProductPayload = {
        name: data.name,
        price: data.price,
        cost: normalizeCost(data.cost),
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold ?? null,
        categoryId: data.categoryId,
        lifeStage: data.lifeStage,
        brandId: data.brandId || undefined,
        image: data.image || undefined,
        presentations: presentations.length > 0 ? presentations : undefined,
      };

      if (product) {
        // En update, omitir brandId/categoryId si no cambiaron respecto a
        // los valores originales: evita pisar el dato real con un vacío si
        // el formulario se inicializó antes de tener el detalle completo.
        const patch: Partial<CreateProductPayload> = { ...payload };
        const original = originalRef.current;
        if (original && (data.brandId ?? null) === (original.brandId ?? null)) {
          delete patch.brandId;
        }
        if (original && data.categoryId === original.categoryId) {
          delete patch.categoryId;
        }
        await updateProduct(product.id, patch);
        toast.success('Producto actualizado exitosamente 🚀');
      } else {
        await createProduct(payload);
        toast.success('Producto creado exitosamente 🚀');
      }
      if (!product) reset();
      // Se espera al padre (refetch + cierre) con el botón en "Guardando...":
      // evita doble submit mientras el drawer sigue abierto sincronizando.
      if (onSuccess) await onSuccess();
    } catch (error: unknown) {
      devError('Error creating product:', error);
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Hubo un error al crear el producto';
      toast.error(`Error: ${errorMessage} ❌`);
    } finally {
      setIsLoading(false);
    }
  };

  // La categoría/marca actual del producto puede no estar en las listas
  // (ej. categoría filtrada por ALLOWED_CATEGORY_NAMES o marca aún no
  // cargada): igual se agrega como opción para que el valor preseleccionado
  // siempre tenga su <option> y el control no aparezca vacío.
  const visibleCategories = useMemo(() => {
    const current = product?.category;
    if (!current?.id || categories.some((cat) => cat.id === current.id)) return categories;
    return [...categories, current];
  }, [categories, product]);

  const visibleBrands = useMemo(() => {
    const current = product?.brand;
    if (!current?.id || brands.some((brand) => brand.id === current.id)) return brands;
    return [...brands, { ...current }];
  }, [brands, product]);

  const selectedCategoryId = watch('categoryId');
  const selectedCategoryObj = visibleCategories.find((cat) => cat.id === selectedCategoryId);
  const selectedCategoryName = selectedCategoryObj?.name?.toUpperCase() || '';
  const showAdvancedFields = !['OTROS', 'HIGIENE', 'ACCESORIOS'].some((cat) =>
    selectedCategoryName.includes(cat),
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 max-w-2xl mx-auto transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* El título vive en el Sheet contenedor: no duplicarlo acá. */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Nombre */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Package size={16} /> Nombre del Producto
          </label>
          <input
            {...register('name')}
            placeholder="Ej: Royal Canin Cachorro 15kg"
            className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.name.message}</p>
          )}
        </div>

        {/* Categoría, Etapa de Vida y Stock */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Tag size={16} /> Categoría
            </label>
            <div className="relative">
              <select
                {...register('categoryId')}
                disabled={isCategoriesLoading}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {isCategoriesLoading ? 'Cargando categorías...' : 'Seleccionar Categoría...'}
                </option>
                {!isCategoriesLoading && visibleCategories.length === 0 && (
                  <option value="" disabled>
                    No se encontraron categorías
                  </option>
                )}
                {visibleCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {isCategoriesLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-slate-400" size={16} />
                </div>
              )}
            </div>
            {errors.categoryId && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.categoryId.message}</p>
            )}
          </div>

          {showAdvancedFields && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Tag size={16} /> Etapa de Vida
              </label>
              <div className="relative">
                <select
                  {...register('lifeStage')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                >
                  {LIFE_STAGE_OPTIONS.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.lifeStage && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.lifeStage.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Archive size={16} /> Stock Inicial
            </label>
            <input
              type="number"
              {...register('stock', { valueAsNumber: true })}
              className={`w-full px-4 py-3 rounded-xl border ${errors.stock ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
            />
            {errors.stock && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.stock.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Archive size={16} /> Umbral de stock bajo
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Por defecto: 2"
              {...register('lowStockThreshold', { setValueAs: emptyToNull })}
              className={`w-full px-4 py-3 rounded-xl border ${errors.lowStockThreshold ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
            />
            {errors.lowStockThreshold && (
              <p className="text-red-500 text-xs mt-1 font-medium">
                {errors.lowStockThreshold.message}
              </p>
            )}
          </div>
        </div>

        {/* Precio y Costo General */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <DollarSign size={16} /> Precio General ($)
            </label>
            <input
              type="number"
              step="0.01"
              {...priceReg}
              onPaste={(e) => handleGeneralNumberPaste(e, 'price')}
              onBlur={(e) => handleGeneralNumberBlur(e, 'price', priceReg.onBlur)}
              className={`w-full px-4 py-3 rounded-xl border ${errors.price ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
            />
            {errors.price && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.price.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <DollarSign size={16} /> Costo General ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Opcional"
              {...costReg}
              onPaste={(e) => handleGeneralNumberPaste(e, 'cost')}
              onBlur={(e) => handleGeneralNumberBlur(e, 'cost', costReg.onBlur)}
              className={`w-full px-4 py-3 rounded-xl border ${errors.cost ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
            />
            {errors.cost && (
              <p className="text-red-500 text-xs mt-1 font-medium">{errors.cost.message}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="Margen (%)"
                title="Margen % (solo cálculo, no se guarda)"
                value={generalMargin ?? ''}
                onChange={(e) =>
                  setGeneralMargin(
                    e.target.value === '' ? null : parseMarginInput(e.target.value),
                  )
                }
                className="w-28 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              />
              <button
                type="button"
                onClick={calcGeneralPrice}
                title="Precio = costo × (1 + margen/100). El precio sigue siendo editable."
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Calculator size={13} />
                Calcular precio
              </button>
            </div>
          </div>
        </div>

        {/* Marca (opcional) */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Tags size={16} /> Marca (opcional)
          </label>
          <Controller
            name="brandId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? NO_BRAND_VALUE}
                onValueChange={(value) =>
                  field.onChange(value === NO_BRAND_VALUE ? null : value)
                }
                disabled={isBrandsLoading}
              >
                <SelectTrigger className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 h-auto">
                  <SelectValue
                    placeholder={
                      isBrandsLoading ? 'Cargando marcas...' : 'Sin marca'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRAND_VALUE}>Sin marca</SelectItem>
                  {visibleBrands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Presentaciones - Solo mostrar para categorías avanzadas */}
        {showAdvancedFields && (
          <ProductPresentationsSection
            product={product}
            onPresentationsChange={setPresentationsData}
          />
        )}

        {/* URL Imagen */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            URL de la Imagen
          </label>
          <input
            {...register('image')}
            placeholder="https://ejemplo.com/imagen.jpg"
            className={`w-full px-4 py-3 rounded-xl border ${errors.image ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-slate-600'} bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
          />
          {errors.image && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.image.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3
            ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30 active:scale-[0.98]'}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : product ? (
            'Guardar Cambios'
          ) : (
            'Guardar Producto'
          )}
        </button>
      </form>
    </div>
  );
};
