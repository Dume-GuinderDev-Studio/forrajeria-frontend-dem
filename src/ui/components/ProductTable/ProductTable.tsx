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
import styles from './ProductTable.module.css';

type CategoryTheme = 'dog' | 'cat' | 'accessories' | 'default';

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

interface CategoryBadgeProps {
  product: Product;
}

/** Badge de categoría. Compartido por la tabla de desktop y la card de mobile. */
const CategoryBadge = ({ product }: CategoryBadgeProps) => {
  const catName = product.category?.name || '';
  const normalizedCat = catName.toUpperCase();

  let theme: CategoryTheme = 'default';
  if (normalizedCat.includes('PERRO')) theme = 'dog';
  else if (normalizedCat.includes('GATO')) theme = 'cat';
  else if (normalizedCat.includes('ACCESORIOS')) theme = 'accessories';

  return (
    <span className={styles.categoryBadge} data-theme={theme}>
      {catName || 'Sin Categoría'}
    </span>
  );
};

interface StoreVisibilitySwitchProps {
  product: Product;
  onToggleActive: (id: string, currentStatus: boolean) => void;
}

/**
 * Switch de visibilidad en la tienda online. El aria-label describe la ACCIÓN
 * que dispara (ocultar o mostrar) y no el estado actual, para que el lector de
 * pantalla anuncie qué va a pasar al activarlo.
 */
const StoreVisibilitySwitch = ({ product, onToggleActive }: StoreVisibilitySwitchProps) => {
  const isVisible = product.isActive !== false;

  return (
    <button
      onClick={() => onToggleActive(product.id, product.isActive ?? true)}
      data-on={isVisible}
      className={styles.switch}
      role="switch"
      aria-checked={isVisible}
      aria-label={isVisible ? 'Ocultar de la tienda online' : 'Mostrar en la tienda online'}
      title={isVisible ? 'Visible en tienda' : 'Oculto en tienda'}
    >
      <span className={styles.knob} aria-hidden="true" />
    </button>
  );
};

interface RowActionsProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

/** Editar + eliminar. Idéntico en la tabla de desktop y en la card de mobile. */
const RowActions = ({ product, onEdit, onDelete }: RowActionsProps) => (
  <div className={styles.actions}>
    <button
      onClick={() => onEdit(product)}
      className={[styles.iconBtn, styles.editBtn].filter(Boolean).join(' ')}
      title="Editar producto"
    >
      <Edit2 size={18} />
    </button>

    <button
      onClick={() => onDelete(product)}
      className={[styles.iconBtn, styles.deleteBtn].filter(Boolean).join(' ')}
      title="Eliminar producto"
    >
      <Trash2 size={18} />
    </button>
  </div>
);

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

  // Un único mensaje de estado vacío, compartido por la tabla y las cards de mobile.
  const emptyMessage =
    searchTerm || hasActiveFilters
      ? 'No se encontraron productos coincidentes con los filtros aplicados.'
      : 'No hay productos cargados todavía. 📦';

  return (
    <div className={styles.root}>
      {/* Header / Filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} size={18} />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.toolbarActions}>
          {products.length > 0 && (
            <>
              <button onClick={() => setIsBulkDeleteModalOpen(true)} className={styles.bulkDeleteBtn}>
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
          <div className={styles.filterWrap} ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen((open) => !open)}
              aria-label="Filtrar por categoría y stock"
              aria-expanded={isFilterOpen}
              aria-haspopup="listbox"
              title="Filtrar por categoría y stock"
              data-active={hasActiveFilters}
              className={styles.filterBtn}
            >
              <Filter size={18} />
            </button>
            {isFilterOpen && (
              <div role="listbox" aria-label="Filtros de categoría y stock" className={styles.menu}>
                <p className={styles.menuTitle}>Categoría</p>
                {['Todas', ...ALLOWED_CATEGORY_NAMES].map((category) => {
                  const isActive = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectCategory(category)}
                      data-active={isActive}
                      className={styles.menuItem}
                    >
                      <span>{category}</span>
                      {isActive && <Check size={16} />}
                    </button>
                  );
                })}
                <p className={[styles.menuTitle, styles.menuTitleBordered].filter(Boolean).join(' ')}>
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
                      data-active={isActive}
                      className={styles.menuItem}
                    >
                      <span>{STOCK_FILTER_LABELS[option]}</span>
                      {isActive && <Check size={16} />}
                    </button>
                  );
                })}
                {hasActiveFilters && (
                  <button onClick={handleClearFilters} className={styles.clearFilters}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {hasActiveFilters && (
        <div className={styles.activeBar}>
          <span className={styles.activeLabel}>
            {selectedCategory !== 'Todas' && selectedStock !== 'all'
              ? 'Filtros activos:'
              : 'Filtro activo:'}
          </span>
          {selectedCategory !== 'Todas' && (
            <span className={styles.chip}>
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory('Todas')}
                aria-label={`Limpiar filtro de categoría ${selectedCategory}`}
                className={styles.chipBtn}
              >
                <X size={14} />
              </button>
            </span>
          )}
          {selectedStock !== 'all' && (
            <span className={styles.chip}>
              {STOCK_FILTER_LABELS[selectedStock]}
              <button
                onClick={() => setSelectedStock('all')}
                aria-label={`Limpiar filtro de stock ${STOCK_FILTER_LABELS[selectedStock]}`}
                className={styles.chipBtn}
              >
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Mobile: cards. La tabla de desktop se oculta con el media query. */}
      <ul className={styles.cardList}>
        {filteredProducts.length === 0 ? (
          <li className={[styles.card, styles.emptyCard].filter(Boolean).join(' ')}>
            {emptyMessage}
          </li>
        ) : (
          currentProducts.map((product) => (
            <li key={product.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.thumb}>
                  {product.image ? (
                    <img src={product.image} alt={product.name} className={styles.thumbImg} />
                  ) : (
                    <div className={styles.thumbFallback}>N/A</div>
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.productName}>{product.name}</div>
                  <div className={styles.badgeStack}>
                    <OpenBagBadge product={product} />
                    <BrandBadge product={product} />
                  </div>
                </div>
              </div>

              <div className={styles.cardMeta}>
                <CategoryBadge product={product} />
                {/* Sin etapa ("todas") no se renderiza nada: el guion de la
                    tabla acá solo suma ruido en la card. */}
                {!isAllLifeStage(product.lifeStage) && (
                  <span className={styles.stagePill}>{product.lifeStage}</span>
                )}
              </div>

              <div className={styles.cardBottom}>
                <div className={styles.cardBottomGroup}>
                  <div>
                    ${product.price} <span className={styles.priceUnit}>/bolsa</span>
                  </div>
                  {/* En la card el stock lleva etiqueta: acá no hay encabezado. */}
                  <span className={styles.stock} data-low={product.stock <= LOW_STOCK_THRESHOLD}>
                    Stock: {product.stock}
                  </span>
                </div>
                <div className={styles.cardBottomGroup}>
                  <StoreVisibilitySwitch
                    product={product}
                    onToggleActive={onToggleActive}
                  />
                  <span className={styles.switchLabel}>
                    {product.isActive !== false ? 'Visible en tienda' : 'Oculto en tienda'}
                  </span>
                  <RowActions
                    product={product}
                    onEdit={onEdit}
                    onDelete={() => setProductToDelete(product)}
                  />
                </div>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Table */}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>Producto</th>
              <th className={styles.th}>Categoría</th>
              <th className={[styles.th, styles.thCenter].filter(Boolean).join(' ')}>Etapa</th>
              <th className={[styles.th, styles.thRight].filter(Boolean).join(' ')}>Precio</th>
              <th className={[styles.th, styles.thCenter].filter(Boolean).join(' ')}>Stock</th>
              <th
                className={[styles.th, styles.thCenter, styles.thVisibility]
                  .filter(Boolean)
                  .join(' ')}
              >
                En tienda
              </th>
              <th className={[styles.th, styles.thRight].filter(Boolean).join(' ')}>Acciones</th>
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              currentProducts.map((product) => (
                <tr key={product.id} className={styles.tbodyRow}>
                  <td className={styles.td}>
                    <div className={styles.productCell}>
                      <div className={styles.thumb}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className={styles.thumbImg} />
                        ) : (
                          <div className={styles.thumbFallback}>N/A</div>
                        )}
                      </div>
                      <div>
                        <div className={styles.productName}>{product.name}</div>
                        <div className={styles.badgeStack}>
                          <OpenBagBadge product={product} />
                          <BrandBadge product={product} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <CategoryBadge product={product} />
                  </td>
                  <td className={[styles.td, styles.tdCenter].filter(Boolean).join(' ')}>
                    {isAllLifeStage(product.lifeStage) ? (
                      <span className={styles.dash}>-</span>
                    ) : (
                      <span className={styles.stagePill}>{product.lifeStage}</span>
                    )}
                  </td>
                  <td className={[styles.td, styles.tdRight].filter(Boolean).join(' ')}>
                    <div>
                      ${product.price} <span className={styles.priceUnit}>/bolsa</span>
                    </div>
                    {/* precio_kilo is currently not in the confirmed interface, hiding for safety or until mapped */}
                  </td>
                  <td className={[styles.td, styles.tdCenter].filter(Boolean).join(' ')}>
                    <span
                      className={styles.stock}
                      data-low={product.stock <= LOW_STOCK_THRESHOLD}
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td
                    className={[styles.td, styles.tdCenter, styles.tdVisibility]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <StoreVisibilitySwitch
                      product={product}
                      onToggleActive={onToggleActive}
                    />
                  </td>
                  <td className={[styles.td, styles.tdRight].filter(Boolean).join(' ')}>
                    <RowActions
                      product={product}
                      onEdit={onEdit}
                      onDelete={() => setProductToDelete(product)}
                    />
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
