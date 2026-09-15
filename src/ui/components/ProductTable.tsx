import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Trash2, Search, Filter, X, Check } from 'lucide-react';
import {
  ALLOWED_CATEGORY_NAMES,
  LOW_STOCK_THRESHOLD,
  type Product,
} from '@/infrastructure/products.service';
import { isAllLifeStage } from '@/lib/lifeStage';
import { ConfirmModal } from '@/ui/components/ConfirmModal';
import { OpenBagBadge } from '@/ui/components/OpenBagBadge';
import { BrandBadge } from '@/ui/components/BrandBadge';
import { Pagination, DEFAULT_ITEMS_PER_PAGE } from '@/ui/components/Pagination';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onBulkDelete: () => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
}

type StockFilter = 'all' | 'in-stock' | 'out-of-stock' | 'low-stock';
const STOCK_FILTER_LABELS: Record<StockFilter, string> = {
  all: 'Todos',
  'in-stock': 'Con stock',
  'out-of-stock': 'Sin stock',
  'low-stock': 'Stock bajo',
};
const STOCK_FILTER_OPTIONS: StockFilter[] = ['all', 'in-stock', 'out-of-stock', 'low-stock'];

/** Mapea ?stockFilter=out|low (ej. desde el Dashboard) al filtro interno. */
const parseStockFilterParam = (value: string | null): StockFilter => {
  if (value === 'out' || value === 'out-of-stock' || value === 'outOfStock')
    return 'out-of-stock';
  if (value === 'low' || value === 'low-stock' || value === 'lowStock') return 'low-stock';
  if (value === 'in' || value === 'in-stock') return 'in-stock';
  return 'all';
};

export const ProductTable = ({
  products,
  onEdit,
  onDelete,
  onBulkDelete,
  onToggleActive,
}: ProductTableProps) => {
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedStock, setSelectedStock] = useState<StockFilter>(() =>
    parseStockFilterParam(searchParams.get('stockFilter')),
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = DEFAULT_ITEMS_PER_PAGE;
  const filterRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al clickear fuera o presionar Escape.
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isFilterOpen]);

  // Filtrado client-side sobre la lista ya cargada: texto + categoría + stock (AND).
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      normalizedSearch === '' ||
      product.name.toLowerCase().includes(normalizedSearch);
    const matchesCategory =
      selectedCategory === 'Todas' ||
      (product.category?.name ?? '').toLowerCase() === selectedCategory.toLowerCase();
    const matchesStock =
      selectedStock === 'all'
        ? true
        : selectedStock === 'in-stock'
          ? product.stock > 0
          : selectedStock === 'out-of-stock'
            ? product.stock === 0
            : product.stock <= LOW_STOCK_THRESHOLD;
    return matchesSearch && matchesCategory && matchesStock;
  });
  const hasActiveFilters = selectedCategory !== 'Todas' || selectedStock !== 'all';

  const currentProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Aplica ?stockFilter=out|low una sola vez al montar (ej. llegando desde
  // el Dashboard con "Ver todos") y lo consume de la URL, igual que
  // AdminPage hace con ?edit=<id>.
  useEffect(() => {
    const param = searchParams.get('stockFilter');
    const mapped = parseStockFilterParam(param);
    if (param && mapped !== 'all') {
      setSelectedStock(mapped);
      const next = new URLSearchParams(searchParams);
      next.delete('stockFilter');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resetear a página 1 cuando cambia algún filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedStock]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleSelectStock = (stock: StockFilter) => {
    setSelectedStock(stock);
  };

  const handleClearFilters = () => {
    setSelectedCategory('Todas');
    setSelectedStock('all');
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header / Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-slate-900/50">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
          {products.length > 0 && (
            <>
              <button
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors font-medium text-sm flex items-center gap-2 px-3"
              >
                <Trash2 size={16} /> Eliminar todos
              </button>

              <ConfirmModal
                isOpen={isBulkDeleteModalOpen}
                title="¿Borrar todos los productos?"
                description="Esta acción eliminará de forma permanente todos los productos vaciando el catálogo. No se puede deshacer."
                confirmLabel="Eliminar todos"
                onConfirm={onBulkDelete}
                onCancel={() => setIsBulkDeleteModalOpen(false)}
                variant="danger"
              />
            </>
          )}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen((open) => !open)}
              aria-label="Filtrar por categoría y stock"
              aria-expanded={isFilterOpen}
              aria-haspopup="listbox"
              title="Filtrar por categoría y stock"
              className={`p-2 border rounded-lg transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Filter size={18} />
            </button>
            {isFilterOpen && (
              <div
                role="listbox"
                aria-label="Filtros de categoría y stock"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg"
              >
                <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Categoría
                </p>
                {['Todas', ...ALLOWED_CATEGORY_NAMES].map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectCategory(category)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-700 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{category}</span>
                      {isActive && <Check size={16} />}
                    </button>
                  );
                })}
                <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-100 dark:border-slate-700 mt-1">
                  Disponibilidad
                </p>
                {STOCK_FILTER_OPTIONS.map((option) => {
                  const isActive = selectedStock === option;
                  return (
                    <button
                      key={option}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectStock(option)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold text-blue-700 dark:text-blue-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{STOCK_FILTER_LABELS[option]}</span>
                      {isActive && <Check size={16} />}
                    </button>
                  );
                })}
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-t border-slate-100 dark:border-slate-700"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900/50">
          <span className="text-slate-500 dark:text-slate-400">
            {selectedCategory !== 'Todas' && selectedStock !== 'all'
              ? 'Filtros activos:'
              : 'Filtro activo:'}
          </span>
          {selectedCategory !== 'Todas' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory('Todas')}
                aria-label={`Limpiar filtro de categoría ${selectedCategory}`}
                className="rounded-full p-0.5 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                <X size={14} />
              </button>
            </span>
          )}
          {selectedStock !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
              {STOCK_FILTER_LABELS[selectedStock]}
              <button
                onClick={() => setSelectedStock('all')}
                aria-label={`Limpiar filtro de stock ${STOCK_FILTER_LABELS[selectedStock]}`}
                className="rounded-full p-0.5 transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Categoría</th>
              <th className="px-6 py-4 text-center">Etapa</th>
              <th className="px-6 py-4 text-right">Precio</th>
              <th className="px-6 py-4 text-center">Stock</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {searchTerm || hasActiveFilters
                    ? 'No se encontraron productos coincidentes con los filtros aplicados.'
                    : 'No hay productos cargados todavía. 📦'}
                </td>
              </tr>
            ) : (
              currentProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 flex-shrink-0 overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 font-bold">
                            N/A
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {product.name}
                        </div>
                        <div className="mt-1 flex flex-col items-start gap-1">
                          <OpenBagBadge product={product} />
                          <BrandBadge product={product} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const catName = product.category?.name || '';
                      const normalizedCat = catName.toUpperCase();

                      let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
                      if (normalizedCat.includes('PERRO'))
                        badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                      else if (normalizedCat.includes('GATO'))
                        badgeColor = 'bg-orange-100 text-orange-800 border-orange-200';
                      else if (normalizedCat.includes('ACCESORIOS'))
                        badgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                      else if (normalizedCat.includes('OTROS'))
                        badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';

                      return (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}
                        >
                          {catName || 'Sin Categoría'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isAllLifeStage(product.lifeStage) ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                        {product.lifeStage}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                    <div>
                      ${product.price}{' '}
                      <span className="text-xs text-slate-400 font-normal">/bolsa</span>
                    </div>
                    {/* precio_kilo is currently not in the confirmed interface, hiding for safety or until mapped */}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`font-bold ${product.stock <= LOW_STOCK_THRESHOLD ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onToggleActive(product.id, product.isActive ?? true)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${product.isActive !== false ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'}`}
                        role="switch"
                        aria-checked={product.isActive !== false}
                        title={
                          product.isActive !== false ? 'Visible en tienda' : 'Oculto en tienda'
                        }
                      >
                        <span className="sr-only">Activar/Desactivar producto</span>
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${product.isActive !== false ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                      </button>

                      <button
                        onClick={() => onEdit(product)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar producto"
                      >
                        <Edit2 size={18} />
                      </button>

                      <button
                        onClick={() => setProductToDelete(product)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Eliminar producto"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredProducts.length}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={handlePageChange}
        itemLabel="productos"
      />

      <ConfirmModal
        isOpen={productToDelete !== null}
        title="¿Eliminar producto?"
        description={`¿Estás seguro que querés eliminar "${productToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (productToDelete) {
            onDelete(productToDelete.id);
          }
        }}
        onCancel={() => setProductToDelete(null)}
        variant="danger"
      />
    </div>
  );
};
