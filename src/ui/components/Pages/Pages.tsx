import { ProductForm } from '../ProductForm';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from '../AdminSidebar';
import { ProductTable } from '../ProductTable';
import { BulkUploadModal } from '../BulkUploadModal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/components/ui/sheet';
import {
  getProducts,
  deleteProduct,
  toggleProductActive,
  exportProductsToCsv,
  type Product,
} from '@/infrastructure/products.service';
import { FileUp, FileDown, Loader2, ArrowLeft, X, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import styles from './Pages.module.css';

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
    <div className={styles.root}>
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.inner}>
          {/* Header Section */}
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>Gestión de Catálogo</h1>
              <p className={styles.subtitle}>
                Administrá tu inventario, precios y stock en tiempo real.
              </p>
            </div>
            <div className={styles.headerActions}>
              {/* Primero en el DOM para que en mobile (donde va arriba, a lo
                  ancho) el orden de foco coincida con el visual. En desktop el
                  .primaryToolBtn usa order para quedar a la derecha, igual
                  que estaba. Mismos handlers de siempre. */}
              <button
                onClick={handleOpenCreate}
                className={[styles.toolBtn, styles.primaryToolBtn].filter(Boolean).join(' ')}
              >
                <PlusCircle size={18} />
                <span className={styles.toolBtnLabel}>Nuevo Producto</span>
              </button>
              <button onClick={() => exportProductsToCsv(products)} className={styles.toolBtn}>
                <FileDown size={18} />
                <span className={styles.toolBtnLabel}>Exportar CSV</span>
              </button>
              <button onClick={() => setIsBulkUploadOpen(true)} className={styles.toolBtn}>
                <FileUp size={18} />
                <span className={styles.toolBtnLabel}>Importar CSV</span>
              </button>
            </div>
          </header>

          {/* Stats or Highlights could go here */}

          {/* Product Table */}
          {isLoading ? (
            <div className={styles.loading}>
              {bulkDeleteProgress ? (
                <>
                  <Loader2 className={styles.spinner} />
                  <p className={styles.progressText}>
                    Eliminando {bulkDeleteProgress.done} de {bulkDeleteProgress.total}...
                  </p>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressBar}
                      style={{
                        width: `${bulkDeleteProgress.total === 0 ? 0 : Math.round((bulkDeleteProgress.done / bulkDeleteProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className={styles.spinner} />
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
        <SheetContent showCloseButton={false} className={styles.drawerContent}>
          <SheetHeader className={styles.drawerHeader}>
            <div className={styles.drawerHeadRow}>
              <div className={styles.drawerHeadLeft}>
                <button
                  onClick={handleProductFormClose}
                  className={styles.backBtn}
                  aria-label="Volver"
                >
                  <ArrowLeft size={20} />
                </button>
                <SheetTitle className={styles.drawerTitle}>
                  {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </SheetTitle>
              </div>
              <button
                onClick={handleProductFormClose}
                className={styles.closeBtn}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
          </SheetHeader>
          <div className={styles.drawerBody}>
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
