import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Package, DollarSign, Tag, Archive, Loader2, Tags } from 'lucide-react';
import {
  ProductPresentationsSection,
  buildPresentationsPayload,
} from '../ProductPresentationsSection';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/components/ui/alert-dialog';
import styles from './ProductForm.module.css';

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

/** Valor para mostrar/derivar: número finito o null (NaN de un input a medio tipear). */
const finiteNumberOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normaliza el nombre de categoría para comparar sin depender de mayúsculas. */
const categoryKey = (name?: string | null): string => (name ?? '').toUpperCase();

/** "Otros" necesita el interruptor: no todos sus productos se venden por bolsa/kilo. */
const esCategoriaOtros = (name?: string | null): boolean => categoryKey(name).includes('OTROS');

/** Accesorios no se venden por bolsa ni por kilo: no hay sección que mostrar. */
const esCategoriaAccesorios = (name?: string | null): boolean =>
  categoryKey(name).includes('ACCESORIOS');

/** El producto guardado ya tiene bolsa o kilo cargado. */
const tienePresentaciones = (product?: Product | null): boolean =>
  (product?.presentations?.length ?? 0) > 0;

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
  // Una marca es un id no vacío o null. min(1) cierra el hueco por el que un
  // valor vacío pasaba la validación en silencio y terminaba en el payload.
  brandId: z.string().min(1, 'La marca no puede ser vacía').nullable().optional(),
  image: z.string().url('Debe ser una URL válida').optional().or(z.literal('')).nullable(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

/** Valor centinela del Select para "Sin marca" (los items no aceptan string vacío). */
const NO_BRAND_VALUE = '__none';

/**
 * Único punto de normalización entre el form y el Select de marca: el form
 * guarda siempre `string | null`, y el Select siempre recibe un string.
 *
 * El Select de Radix es controlado y, con el dropdown cerrado, su <select>
 * nativo oculto todavía no tiene registradas las <option> de los items: al
 * asignarle el valor actual el browser lo deja en "" y dispara un change que
 * Radix reemite como onValueChange(""). Ese "" NO es una marca válida ni el
 * centinela "Sin marca", y como `??` no trata "" como ausente, terminaba
 * pisando el id real en el form y el select mostraba "Sin marca" siempre.
 */
const toBrandSelectValue = (value: string | null | undefined): string =>
  value && value !== '' ? value : NO_BRAND_VALUE;

/** Traduce la salida del Select al valor del form (null = sin marca). */
const toBrandFormValue = (value: string): string | null =>
  value === NO_BRAND_VALUE || value === '' ? null : value;

interface PresentationRow {
  id: string;
  weightKg: number | null;
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
  const [profitMarginPercent, setProfitMarginPercent] = useState<string>('');

  const [presentationsData, setPresentationsData] = useState<{
    bagRow: PresentationRow;
    kiloEnabled: boolean;
    kiloPrice: number | null;
    kiloCost: number | null;
  }>({
    bagRow: {
      id: crypto.randomUUID(),
      weightKg: null,
      openBagRemainingKg: null,
    },
    kiloEnabled: false,
    kiloPrice: null,
    kiloCost: null,
  });
  /**
   * Interruptor de la categoría "Otros": decide si el producto se vende por
   * bolsa y/o por kilo. Apagado por defecto en productos nuevos; encendido si el
   * producto guardado ya tenía presentaciones, para no borrarlas de entrada.
   */
  const [otrosVentaPorBolsa, setOtrosVentaPorBolsa] = useState(false);
  /** Error del peso de bolsa, que solo aplica con la sección visible. */
  const [bagWeightError, setBagWeightError] = useState<string | undefined>(undefined);
  /**
   * Datos del submit en espera cuando hay que confirmar que se quitan las
   * presentaciones: se guarda el form ya validado y se reintenta al confirmar.
   */
  const [pendingRemoval, setPendingRemoval] = useState<ProductFormValues | null>(null);

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
      // Un producto de "Otros" que ya tiene presentaciones arranca con el
      // interruptor encendido: apagarlo sin querer le borraría la venta por kilo.
      setOtrosVentaPorBolsa(
        esCategoriaOtros(product?.category?.name) && tienePresentaciones(product),
      );
      setBagWeightError(undefined);
      setProfitMarginPercent('');
      setPendingRemoval(null);
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
      setOtrosVentaPorBolsa(false);
      setBagWeightError(undefined);
      setProfitMarginPercent('');
      setPendingRemoval(null);
      originalRef.current = null;
    }
  }, [product, reset]);

  /**
   * Guarda el producto. `removePresentations` manda `presentations: []` para
   * borrar las que tiene, en vez de `undefined` (que el backend leería como
   * "no toques esto").
   */
  const persist = async (data: ProductFormValues, removePresentations = false) => {
    setIsLoading(true);
    try {
      // Construir presentations desde los datos del componente (una única
      // bolsa + kilo opcional; el backend recibe un ARRAY con 1 bag como máximo).
      // La bolsa toma precio y costo de los campos generales del formulario:
      // no hay una segunda fuente para el mismo dato. La sección depende de la
      // categoría (ver showPresentations): si no está visible no se construye nada
      // y el producto se guarda con Precio/Costo General.
      const presentations = showPresentations
        ? buildPresentationsPayload({
            bagRows: [presentationsData.bagRow],
            kiloEnabled: presentationsData.kiloEnabled,
            kiloPrice: presentationsData.kiloPrice,
            kiloCost: presentationsData.kiloCost,
            generalPrice: data.price,
            generalCost: data.cost ?? null,
          })
        : [];

      // Validaciones de la sección de presentaciones. Solo aplican cuando la
      // sección está visible: si está apagada no se puede exigir nada, y un kilo
      // cargado antes del cambio de categoría no debe bloquear el guardado.
      if (showPresentations) {
        const bagWeight = presentationsData.bagRow.weightKg;
        if (!bagWeight || bagWeight <= 0) {
          setBagWeightError('El peso de la bolsa es obligatorio');
          setIsLoading(false);
          return;
        }
        setBagWeightError(undefined);

        if (
          presentationsData.kiloEnabled &&
          (!presentationsData.kiloPrice || presentationsData.kiloPrice <= 0)
        ) {
          toast.error('El precio por kilo es obligatorio cuando está habilitado');
          setIsLoading(false);
          return;
        }
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
        // null y undefined no son lo mismo para el backend: null desvincula la
        // marca y undefined la deja como está. Con `||` un null terminaba en
        // undefined y era imposible sacarle la marca a un producto desde acá.
        brandId: data.brandId === null ? null : data.brandId,
        image: data.image || undefined,
        // undefined = no tocar; [] = borrar todas. Solo se manda cuando el usuario
        // apagó el interruptor de "Otros" en un producto que ya tenía
        // presentaciones; en el resto de los casos el dato queda como está.
        presentations:
          presentations.length > 0 ? presentations : removePresentations ? [] : undefined,
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

  /**
   * Apagar el interruptor de "Otros" en un producto que ya tiene presentaciones
   * las borra. Se pide confirmación antes de guardar, porque el efecto no se ve
   * en el formulario: la sección simplemente desapareció.
   */
  const vaAQuitarPresentaciones = (): boolean =>
    Boolean(product) &&
    showOtrosToggle &&
    !otrosVentaPorBolsa &&
    tienePresentaciones(product);

  const onSubmit = (data: ProductFormValues) => {
    if (vaAQuitarPresentaciones()) {
      // Se guarda el form ya validado y se reintenta al confirmar.
      setPendingRemoval(data);
      return;
    }
    void persist(data);
  };

  const confirmarQuitarPresentaciones = () => {
    const data = pendingRemoval;
    setPendingRemoval(null);
    if (data) void persist(data, true);
  };

  // La categoría/marca actual del producto puede no estar en las listas
  // (ej. categoría filtrada por ALLOWED_CATEGORY_NAMES o marca aún no
  // cargada): igual se agrega como opción para que el valor preseleccionado
  // siempre tenga su <option> y el control no aparezca vacío.
  /**
   * Estable a propósito: ProductPresentationsSection dispara este callback desde
   * un efecto que lo tiene en dependencias. Si la identidad cambiara en cada
   * render, el efecto se repetiría y el setState entraría en loop.
   */
  const handlePresentationsChange = useCallback(
    (next: typeof presentationsData) => {
      setPresentationsData(next);
      // El error de peso se limpia apenas el usuario toca la bolsa.
      setBagWeightError(undefined);
    },
    [],
  );

  const visibleCategories = useMemo(() => {
    const current = product?.category;
    if (!current?.id || categories.some((cat) => cat.id === current.id)) return categories;
    return [...categories, current];
  }, [categories, product]);

  // La marca actual puede venir anidada (brand) o como id plano (brandId):
  // es la misma lectura que usa getProductBrandId, para que el valor del form y
  // la lista de options no puedan discrepar entre sí.
  const currentBrandId = product ? getProductBrandId(product) : null;

  /**
   * Las options tienen que incluir SIEMPRE la marca actual: Radix dibuja el
   * trigger con el texto del item que matchea el value, así que un value sin
   * item deja el select en blanco. El nombre solo existe en la relación anidada
   * o en la lista cargada; si llega solo el id plano se usa el id como etiqueta
   * para que el select siga siendo legible en vez de vacío.
   */
  const visibleBrands = useMemo(() => {
    if (!currentBrandId) return brands;
    if (brands.some((brand) => brand.id === currentBrandId)) return brands;
    const nested = product?.brand;
    const label =
      nested?.id === currentBrandId ? { ...nested } : { id: currentBrandId, name: currentBrandId };
    return [...brands, label];
  }, [brands, currentBrandId, product]);

  const selectedCategoryId = watch('categoryId');
  const selectedCategoryObj = visibleCategories.find((cat) => cat.id === selectedCategoryId);
  const selectedCategoryName = selectedCategoryObj?.name?.toUpperCase() || '';
  // Etapa de Vida no aplica a Accesorios, Higiene ni Otros: son categorías sin
  // etapa. Es una condición propia y separada de la de presentaciones, porque
  // que un producto no tenga etapa de vida no dice nada sobre si se vende por
  // bolsa o por kilo.
  const showLifeStage = !['OTROS', 'HIGIENE', 'ACCESORIOS'].some((cat) =>
    selectedCategoryName.includes(cat),
  );

  // La sección de bolsa/kilo depende de la categoría:
  //   - Accesorios: nunca (un collar no se vende por bolsa ni por kilo).
  //   - Otros: solo si el interruptor está encendido, porque en esa categoría
  //     conviven productos sueltos (maíz, alpiste) con productos en bolsa.
  //   - Todas las demás: siempre, como hasta ahora.
  const esAccesorios = esCategoriaAccesorios(selectedCategoryName);
  const esOtros = esCategoriaOtros(selectedCategoryName);
  const showOtrosToggle = esOtros && !esAccesorios;
  const showPresentations = !esAccesorios && (!esOtros || otrosVentaPorBolsa);

  // Precio y costo generales: son los de la bolsa cerrada, así que la sección
  // de presentaciones los lee de acá en vez de duplicar el estado. El submit
  // usa los valores ya validados por zod (data.price / data.cost).
  const watchedPrice = watch('price');
  const watchedCost = watch('cost');
  const generalPrice = finiteNumberOrNull(watchedPrice);
  const generalCost = finiteNumberOrNull(watchedCost);

  const canCalculate = useMemo(() => {
    const cost = generalCost;
    if (cost === null || cost === undefined || cost === 0) return false;
    const pctStr = profitMarginPercent.trim();
    if (pctStr === '') return false;
    const pct = Number(pctStr);
    if (!Number.isFinite(pct) || pct < 0) return false;
    return true;
  }, [generalCost, profitMarginPercent]);

  const handleCalculatePrice = () => {
    const cost = generalCost;
    if (cost === null || cost === undefined || cost === 0) return;
    const pctStr = profitMarginPercent.trim();
    if (pctStr === '') return;
    const pct = Number(pctStr);
    if (!Number.isFinite(pct) || pct < 0) return;
    const calculated = cost * (1 + pct / 100);
    const rounded = Math.round(calculated);
    setValue('price', rounded, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div className={styles.root}>
      {/* El título vive en el Sheet contenedor: no duplicarlo acá. */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        {/* Nombre */}
        <div className={styles.field}>
          <label className={styles.label}>
            <Package size={16} /> Nombre del Producto
          </label>
          <input
            {...register('name')}
            placeholder="Ej: Royal Canin Cachorro 15kg"
            className={[styles.input, errors.name ? styles.inputError : '']
              .filter(Boolean)
              .join(' ')}
          />
          {errors.name && <p className={styles.fieldError}>{errors.name.message}</p>}
        </div>

        {/* Categoría, Etapa de Vida y Stock */}
        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label}>
              <Tag size={16} /> Categoría
            </label>
            <div className={styles.selectWrap}>
              <select
                {...register('categoryId')}
                disabled={isCategoriesLoading}
                className={[styles.input, styles.select].filter(Boolean).join(' ')}
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
                <div className={styles.spinnerWrap}>
                  <Loader2 className={styles.spinner} size={16} />
                </div>
              )}
            </div>
            {errors.categoryId && (
              <p className={styles.fieldError}>{errors.categoryId.message}</p>
            )}
          </div>

          {showLifeStage && (
            <div className={styles.field}>
              <label className={styles.label}>
                <Tag size={16} /> Etapa de Vida
              </label>
              <div className={styles.selectWrap}>
                <select {...register('lifeStage')} className={[styles.input, styles.select].filter(Boolean).join(' ')}>
                  {LIFE_STAGE_OPTIONS.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.lifeStage && (
                <p className={styles.fieldError}>{errors.lifeStage.message}</p>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>
              <Archive size={16} /> {showPresentations ? 'Stock (bolsas cerradas)' : 'Stock'}
            </label>
            <input
              type="number"
              {...register('stock', { valueAsNumber: true })}
              className={[styles.input, errors.stock ? styles.inputError : '']
                .filter(Boolean)
                .join(' ')}
            />
            {errors.stock && <p className={styles.fieldError}>{errors.stock.message}</p>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <Archive size={16} /> Umbral de stock bajo
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Por defecto: 2"
              {...register('lowStockThreshold', { setValueAs: emptyToNull })}
              className={[styles.input, errors.lowStockThreshold ? styles.inputError : '']
                .filter(Boolean)
                .join(' ')}
            />
            {errors.lowStockThreshold && (
              <p className={styles.fieldError}>{errors.lowStockThreshold.message}</p>
            )}
          </div>
        </div>

        {/* Precio y Costo General */}
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>
              <DollarSign size={16} /> Precio ($)
            </label>
            <input
              type="number"
              step="0.01"
              {...priceReg}
              onPaste={(e) => handleGeneralNumberPaste(e, 'price')}
              onBlur={(e) => handleGeneralNumberBlur(e, 'price', priceReg.onBlur)}
              className={[styles.input, errors.price ? styles.inputError : '']
                .filter(Boolean)
                .join(' ')}
            />
            {errors.price && <p className={styles.fieldError}>{errors.price.message}</p>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              <DollarSign size={16} /> Costo ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Opcional"
              {...costReg}
              onPaste={(e) => handleGeneralNumberPaste(e, 'cost')}
              onBlur={(e) => handleGeneralNumberBlur(e, 'cost', costReg.onBlur)}
              className={[styles.input, errors.cost ? styles.inputError : '']
                .filter(Boolean)
                .join(' ')}
            />
            {errors.cost && <p className={styles.fieldError}>{errors.cost.message}</p>}
          </div>
        </div>

        {/* Calculadora de precio */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="profitMarginPercent">Ganancia sobre costo (%)</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              id="profitMarginPercent"
              type="number"
              step="0.01"
              value={profitMarginPercent}
              onChange={(e) => setProfitMarginPercent(e.target.value)}
              placeholder="Ej: 20"
              className={styles.input}
              style={{ flex: '1 1 120px', minWidth: '120px' }}
            />
            <button
              type="button"
              onClick={handleCalculatePrice}
              disabled={!canCalculate}
              className={styles.submit}
              style={{ flex: '0 0 auto', padding: '0.75rem 1.5rem', marginTop: 0 }}
            >
              Calcular precio
            </button>
          </div>
        </div>

        {/* Marca (opcional) */}
        <div className={styles.field}>
          <label className={styles.label}>
            <Tags size={16} /> Marca (opcional)
          </label>
          <Controller
            name="brandId"
            control={control}
            render={({ field }) => (
              <Select
                value={toBrandSelectValue(field.value)}
                onValueChange={(value) => {
                  // "" nunca es una selección real: Radix lanza si un item lo
                  // tiene, y su input nativo reemite "" como eco cuando el
                  // dropdown cerrado todavía no registró los items. Descartarlo
                  // evita que un eco interno pise la marca que está en el form
                  // (si lo guardáramos como null, el bug sería el mismo).
                  if (value === '') return;
                  field.onChange(toBrandFormValue(value));
                }}
                disabled={isBrandsLoading}
              >
                <SelectTrigger className={styles.brandTrigger}>
                  <SelectValue placeholder={isBrandsLoading ? 'Cargando marcas...' : 'Sin marca'} />
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

        {/* Interruptor de "Otros": en esa categoría conviven productos sueltos
        (maíz, alpiste, semillas) con productos en bolsa, así que la decisión es
        del usuario. Accesorios no lo muestra: ahí nunca hay bolsa ni kilo. */}
        {showOtrosToggle && (
          <div className={styles.field}>
            <label className={styles.switch}>
              <input
                type="checkbox"
                checked={otrosVentaPorBolsa}
                onChange={(e) => setOtrosVentaPorBolsa(e.target.checked)}
                className={styles.toggle}
              />
              <div className={styles.track} />
              <span className={styles.switchLabel}>Se vende por bolsa o por kilo</span>
            </label>
          </div>
        )}

        {/* La sección depende de la categoría: Accesorios nunca; Otros solo con el
        interruptor encendido; el resto siempre. El peso de bolsa es obligatorio
        únicamente mientras la sección está visible. */}
        {showPresentations && (
          <ProductPresentationsSection
            product={product}
            generalPrice={generalPrice}
            generalCost={generalCost}
            errors={{ bagWeightRequired: bagWeightError }}
            onPresentationsChange={handlePresentationsChange}
          />
        )}

        {/* URL Imagen */}
        <div className={styles.field}>
          <label className={styles.labelPlain}>URL de la Imagen</label>
          <input
            {...register('image')}
            placeholder="https://ejemplo.com/imagen.jpg"
            className={[styles.input, errors.image ? styles.inputError : '']
              .filter(Boolean)
              .join(' ')}
          />
          {errors.image && <p className={styles.fieldError}>{errors.image.message}</p>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          data-loading={isLoading}
          className={styles.submit}
        >
          {isLoading ? (
            <>
              <Loader2 className={styles.spinner} size={20} />
              Guardando...
            </>
          ) : product ? (
            'Guardar Cambios'
          ) : (
            'Guardar Producto'
          )}
        </button>
      </form>

        {/* Va fuera del <form> a propósito: el <button> que Radix renderiza en
        AlertDialogAction no declara type, y dentro de un form dispararía el
        submit por su cuenta. */}
        <AlertDialog
          open={pendingRemoval !== null}
          onOpenChange={(open) => {
            if (!open) setPendingRemoval(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Se van a quitar las presentaciones</AlertDialogTitle>
              <AlertDialogDescription>
                Este producto ya tenía venta por bolsa y/o por kilo. Si guardás así, se
                le borran las presentaciones y queda solo con el precio general.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmarQuitarPresentaciones}>
                Quitar y guardar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
};
