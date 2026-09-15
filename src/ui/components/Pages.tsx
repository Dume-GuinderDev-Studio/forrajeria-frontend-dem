import { ProductForm } from './ProductForm';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { ProductTable } from './ProductTable';
import { BulkUploadModal } from './BulkUploadModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/components/ui/sheet';
import {
  getProducts,
  deleteProduct,
  toggleProductActive,
  exportProductsToCsv,
  type Product,
} from '@/infrastructure/products.service';
import { FileUp, FileDown, Loader2, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

/** Cantidad de DELETEs por lote en el borrado masivo (en serie entre lotes). */
const BULK_DELETE_BATCH_SIZE = 5;
/** Pausa entre lotes del borrado masivo para no saturar al backend. */
const BULK_DELETE_BATCH_DELAY_MS = 400;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const AdminPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /** Progreso del borrado masivo: null cuando no hay uno en curso. */
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchProducts = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await getProducts(undefined, undefined, true); // Fetch inclusive of inactive
      setProducts(data);
    } catch {
      toast.error('Error al cargar productos');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(true);
  }, []);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsProductFormOpen(true);
  };

  // Abrir en modo creación: limpiar primero el producto en edición para que
  // el formulario nunca mezcle estado de una edición anterior (el close lo
  // limpia con delay por la animación de salida, así que hay que hacerlo acá).
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setIsProductFormOpen(true);
  };

  const handleProductFormClose = () => {
    setIsProductFormOpen(false);
    setTimeout(() => setEditingProduct(null), 300); // clear after animation
  };

  // Abre la edición de un producto cuando se llega desde otra sección
  // (ej. Dashboard -> alertas de stock bajo -> /admin/catalogo?edit=<id>).
  useEffect(() => {
    const editProductId = searchParams.get('edit');
    if (!editProductId || products.length === 0) return;

    const product = products.find((p) => p.id === editProductId);
    if (!product) return;

    setEditingProduct(product);
    setIsProductFormOpen(true);

    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  }, [searchParams, products, setSearchParams]);

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success('Producto eliminado exitosamente');
      fetchProducts(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || 'Error al eliminar el producto');
    }
  };

  const handleBulkDelete = async () => {
    // Snapshot: se borra sobre esta lista aunque el estado cambie en el medio.
    const targets = [...products];
    const total = targets.length;
    if (total === 0) return;

    // Borrado en lotes pequeños en serie (no todo en paralelo) para no
    // disparar el rate limit del backend (429). Los fallos individuales
    // (ej. productos con ventas asociadas) no frenan el resto: se cuentan
    // y se resumen al final.
    setIsLoading(true);
    setBulkDeleteProgress({ done: 0, total });
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += BULK_DELETE_BATCH_SIZE) {
      const batch = targets.slice(i, i + BULK_DELETE_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((p) => deleteProduct(p.id)));
      for (const result of results) {
        if (result.status === 'fulfilled') deleted += 1;
        else failed += 1;
      }
      setBulkDeleteProgress({ done: Math.min(i + batch.length, total), total });
      if (i + BULK_DELETE_BATCH_SIZE < targets.length) {
        await sleep(BULK_DELETE_BATCH_DELAY_MS);
      }
    }

    await fetchProducts(true);
    setIsLoading(false);
    setBulkDeleteProgress(null);

    if (failed === 0) {
      toast.success(`Todos los productos han sido eliminados (${deleted})`);
    } else if (deleted === 0) {
      toast.error('No se pudo eliminar ningún producto (tienen ventas asociadas)');
    } else {
      toast.warning(
        `${deleted} eliminados, ${failed} no se pudieron borrar (tienen ventas asociadas)`,
      );
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    // Optimistic update
    setProducts((currentProducts) =>
      currentProducts.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p)),
    );

    try {
      await toggleProductActive(id);
      toast.success(
        currentStatus ? 'Producto ocultado de la tienda' : 'Producto visible en la tienda',
      );
    } catch {
      // Revert on error
      setProducts((currentProducts) =>
        currentProducts.map((p) => (p.id === id ? { ...p, isActive: currentStatus } : p)),
      );
      toast.error('Error al cambiar el estado del producto');
    }
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen font-sans">
      {/* Sidebar */}
      <AdminSidebar onOpenProductForm={handleOpenCreate} />

      {/* Main Content */}
      <main className="flex-1 md:ml-[5rem] lg:md:ml-20 transition-all duration-300 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Gestión de Catálogo
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">
                Administrá tu inventario, precios y stock en tiempo real.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => exportProductsToCsv(products)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <FileDown size={18} />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
              <button
                onClick={() => setIsBulkUploadOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                <FileUp size={18} />
                <span className="hidden sm:inline">Importar CSV</span>
              </button>
            </div>
          </header>

          {/* Stats or Highlights could go here */}

          {/* Product Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              {bulkDeleteProgress ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                  <p className="font-medium text-slate-600 dark:text-slate-300">
                    Eliminando {bulkDeleteProgress.done} de {bulkDeleteProgress.total}...
                  </p>
                  <div className="w-64 h-2 mt-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{
                        width: `${bulkDeleteProgress.total === 0 ? 0 : Math.round((bulkDeleteProgress.done / bulkDeleteProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                  <p>Cargando inventario...</p>
                </>
              )}
            </div>
          ) : (
            <ProductTable
              products={products}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
              onToggleActive={handleToggleActive}
            />
          )}
        </div>
      </main>

      {/* Product Form Drawer */}
      <Sheet
        open={isProductFormOpen}
        onOpenChange={(open) => {
          if (!open) handleProductFormClose();
          else setIsProductFormOpen(true);
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="w-full sm:max-w-xl overflow-y-auto bg-slate-50 dark:bg-slate-900 p-0 border-l border-slate-200 dark:border-slate-800"
        >
          <SheetHeader className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleProductFormClose}
                  className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Volver"
                >
                  <ArrowLeft size={20} />
                </button>
                <SheetTitle className="text-xl font-bold">
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </SheetTitle>
              </div>
              <button
                onClick={handleProductFormClose}
                className="p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
          </SheetHeader>
          <div className="p-6">
            <ProductForm
              key={editingProduct?.id || 'new-product'}
              product={editingProduct}
              onSuccess={async () => {
                // Refetch completo ANTES de cerrar: la lista debe reflejar
                // el backend (con brand/category) antes de permitir reabrir.
                await fetchProducts(true);
                handleProductFormClose();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={() => fetchProducts(true)}
      />
    </div>
  );
};
