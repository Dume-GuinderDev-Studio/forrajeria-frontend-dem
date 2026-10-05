import { useEffect, useState, useMemo } from 'react';
import {
  getProducts,
  getCategories,
  type Product,
  type Category,
} from '@/infrastructure/products.service';
import { LIFE_STAGE_DEFAULT } from '@/lib/lifeStage';

import { HomeNavbar } from '@/ui/components/HomeNavbar';
import { QuickFilter } from '@/ui/components/QuickFilter';
import { ProductCard } from '@/ui/components/ProductCard';
import { CartDrawer } from '@/ui/components/CartDrawer';
import { FilterDrawer } from '@/ui/components/FilterDrawer';
import { Footer } from '@/ui/components/Footer';
import {
  Search,
  Dog,
  Baby,
  PawPrint,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  X,
  Cat,
  ShoppingBag,
  ArrowRight,
} from 'lucide-react';
import styles from './HomePage.module.css';

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'recent';

type SectionTheme = 'adult' | 'puppy' | 'senior' | 'cats' | 'accessories' | 'other';

export const HomePage = () => {
  // Basic State
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  const [selectedLifeStage, setSelectedLifeStage] = useState<string>(LIFE_STAGE_DEFAULT);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sort & Filter States
  const [sortBy, setSortBy] = useState<SortOption>('price_desc');
  const [filterStockOnly, setFilterStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, Infinity]);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    const upperCat = cat.toUpperCase();
    if (['OTROS', 'HIGIENE', 'ACCESORIOS'].some((c) => upperCat.includes(c))) {
      setSelectedLifeStage(LIFE_STAGE_DEFAULT);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('TODOS');
    setSelectedLifeStage(LIFE_STAGE_DEFAULT);
    setFilterStockOnly(false);
    setPriceRange([0, Infinity]);
    setSortBy('price_desc');
  };

  // Fetch Initial Data
  useEffect(() => {
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
  }, [selectedCategory, selectedLifeStage]);

  // Derived Logic: Search, Sorting, and Complex Filtering
  interface SectionData {
    title: string;
    icon: React.ReactNode;
    products: Product[];
    theme: SectionTheme;
    categoryToSet?: string;
    lifeStageToSet?: string;
    hasSeeMore?: boolean;
  }

  const { sections, totalFiltered } = useMemo(() => {
    let result = [...products];

    // 1. Search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter((p) => p.name?.toLowerCase().includes(term));
    }

    // 2. Stock Availability filter
    if (filterStockOnly) {
      result = result.filter((p) => (p.stock && p.stock > 0) || p.isActive);
    }

    // 3. Price Range filter
    result = result.filter((p) => {
      const price = p.price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // 4. Sorting logic
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return (a.price || 0) - (b.price || 0);
        case 'price_desc':
          return (b.price || 0) - (a.price || 0);
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'recent':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    const isViewingAll = selectedCategory === 'TODOS';
    const finalSections: SectionData[] = [];

    if (isViewingAll) {
      // "Destacados" mode: Group by category with 6 products limit
      const perroAdulto = result.filter(
        (p) => p.category?.name?.trim().toUpperCase() === 'PERRO' && p.lifeStage === 'Adulto',
      );
      const perroCachorro = result.filter(
        (p) => p.category?.name?.trim().toUpperCase() === 'PERRO' && p.lifeStage === 'Cachorro',
      );
      const perroSenior = result.filter(
        (p) => p.category?.name?.trim().toUpperCase() === 'PERRO' && p.lifeStage === 'Senior',
      );
      // Perro sin etapa definida (lifeStage 'All' o cualquier valor distinto de
      // las tres etapas anteriores). Sin este bucket, esos productos caian por
      // exclusion en 'otros' y se mostraban bajo el titulo "Otros Productos"
      // pese a ser de categoria Perro.
      const perroGeneral = result.filter(
        (p) =>
          p.category?.name?.trim().toUpperCase() === 'PERRO' &&
          !['Adulto', 'Cachorro', 'Senior'].includes(p.lifeStage),
      );
      const gatos = result.filter((p) => p.category?.name?.trim().toUpperCase() === 'GATO');
      const accesorios = result.filter((p) => p.category?.name?.trim().toUpperCase() === 'ACCESORIOS');
      const otros = result.filter(
        (p) =>
          !perroAdulto.includes(p) &&
          !perroCachorro.includes(p) &&
          !perroSenior.includes(p) &&
          !perroGeneral.includes(p) &&
          !gatos.includes(p) &&
          !accesorios.includes(p),
      );

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

      if (perroCachorro.length > 0)
        finalSections.push({
          title: 'Línea Cachorros',
          icon: <Baby size={24} className={styles.sectionIcon} />,
          products: perroCachorro.slice(0, 4),
          theme: 'puppy',
          categoryToSet: 'Perro',
          lifeStageToSet: 'Cachorro',
          hasSeeMore: perroCachorro.length > 4,
        });

      if (perroSenior.length > 0)
        finalSections.push({
          title: 'Línea Senior',
          icon: <PawPrint size={24} className={styles.sectionIcon} />,
          products: perroSenior.slice(0, 4),
          theme: 'senior',
          categoryToSet: 'Perro',
          lifeStageToSet: 'Senior',
          hasSeeMore: perroSenior.length > 4,
        });

      if (perroGeneral.length > 0)
        finalSections.push({
          title: 'Perro General',
          icon: <Dog size={24} className={styles.sectionIcon} />,
          products: perroGeneral.slice(0, 4),
          theme: 'adult',
          categoryToSet: 'Perro',
          lifeStageToSet: 'All',
          hasSeeMore: perroGeneral.length > 4,
        });

      if (gatos.length > 0)
        finalSections.push({
          title: 'Línea Gatos',
          icon: <Cat size={24} className={styles.sectionIcon} />,
          products: gatos.slice(0, 4),
          theme: 'cats',
          categoryToSet: 'Gato',
          hasSeeMore: gatos.length > 4,
        });

      if (accesorios.length > 0)
        finalSections.push({
          title: 'Accesorios',
          icon: <ShoppingBag size={24} className={styles.sectionIcon} />,
          products: accesorios.slice(0, 4),
          theme: 'accessories',
          categoryToSet: 'Accesorios',
          hasSeeMore: accesorios.length > 4,
        });

      if (otros.length > 0)
        finalSections.push({
          title: 'Otros Productos',
          icon: <Search size={24} className={styles.sectionIcon} />,
          products: otros.slice(0, 4),
          theme: 'other',
          categoryToSet: 'Otros',
          hasSeeMore: otros.length > 4,
        });
    } else {
      // Normal filter view: Show all segments without limit
      const cachorros = result.filter((p) => p.lifeStage === 'Cachorro');
      const adultos = result.filter((p) => p.lifeStage === 'Adulto');
      const seniors = result.filter((p) => p.lifeStage === 'Senior');
      const otrosRes = result.filter(
        (p) => !['Cachorro', 'Adulto', 'Senior'].includes(p.lifeStage),
      );

      if (cachorros.length > 0)
        finalSections.push({
          title: 'Línea Cachorros',
          icon: <Baby size={24} className={styles.sectionIcon} />,
          products: cachorros,
          theme: 'puppy',
        });
      if (adultos.length > 0)
        finalSections.push({
          title: 'Línea Adultos',
          icon: <Dog size={24} className={styles.sectionIcon} />,
          products: adultos,
          theme: 'adult',
        });
      if (seniors.length > 0)
        finalSections.push({
          title: 'Línea Senior',
          icon: <PawPrint size={24} className={styles.sectionIcon} />,
          products: seniors,
          theme: 'senior',
        });
      if (otrosRes.length > 0)
        finalSections.push({
          title: 'Otros Productos',
          icon: <SlidersHorizontal size={24} className={styles.sectionIcon} />,
          products: otrosRes,
          theme: 'other',
        });
    }

    return { sections: finalSections, totalFiltered: result.length };
  }, [searchTerm, products, sortBy, filterStockOnly, priceRange, selectedCategory]);

  const handleSeeMore = (cat: string, stage?: string) => {
    setSelectedCategory(cat);
    if (stage) setSelectedLifeStage(stage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const SegmentSection = ({
    section,
    onSeeMore,
  }: {
    section: SectionData;
    onSeeMore?: (cat: string, stage?: string) => void;
  }) => {
    return (
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionBadge} data-theme={section.theme}>
            {section.icon}
          </div>
          <div className={styles.sectionTitles}>
            <div className={styles.sectionTitleRow}>
              <h2 className={styles.sectionTitle} data-theme={section.theme}>
                {section.title}
              </h2>
              <span className={styles.count} data-theme={section.theme}>
                {section.products.length}
              </span>
            </div>
          </div>
          <div className={styles.rule} data-theme={section.theme}></div>
        </div>
        <div className={styles.cardsGrid}>
          {section.products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              isPremium={index === 0 && section.title.includes('Adultos')}
            />
          ))}
        </div>

        {section.hasSeeMore && onSeeMore && section.categoryToSet && (
          <div className={styles.seeMoreWrap}>
            <button
              onClick={() => onSeeMore(section.categoryToSet!, section.lifeStageToSet)}
              className={styles.seeMoreBtn}
            >
              Ver más en {section.title}
              <ArrowRight size={18} className={styles.seeMoreIcon} />
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className={styles.root}>
      <HomeNavbar onOpenCart={() => setIsCartOpen(true)} />

      <main className={styles.main}>
        {/* Search Bar Container */}
        <div className={styles.searchBlock}>
          <div className={styles.searchWrap}>
            <input
              type="text"
              aria-label="Buscar productos"
              placeholder="Buscar alimentos, marcas, accesorios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <Search className={styles.searchIcon} size={24} />
          </div>
        </div>

        {/* Sort & Filter Bar (ML Style) */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            {/* Sort Button */}
            <div className={styles.sortWrap}>
              <button onClick={() => setShowSortMenu(!showSortMenu)} className={styles.sortBtn}>
                <ArrowUpDown size={18} className={styles.sortBtnIcon} />
                <span>Ordenar</span>
                <ChevronDown
                  size={14}
                  className={styles.sortChevron}
                  data-open={showSortMenu}
                />
              </button>

              {showSortMenu && (
                <div className={styles.sortMenu}>
                  {(
                    [
                      { id: 'price_asc', label: 'Precio: Menor a mayor' },
                      { id: 'price_desc', label: 'Precio: Mayor a menor' },
                      { id: 'name_asc', label: 'Nombre: A-Z' },
                      { id: 'recent', label: 'Más recientes' },
                    ] as { id: SortOption; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setShowSortMenu(false);
                      }}
                      data-active={sortBy === opt.id}
                      className={styles.sortOption}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Summary / Quick Status */}
            <div className={styles.filterStatus}>
              <span className={styles.filterStatusLabel}>Filtros activos:</span>
              {selectedCategory !== 'TODOS' && (
                <span className={[styles.chip, styles.chipBlue].filter(Boolean).join(' ')}>
                  {selectedCategory}
                  <X
                    size={12}
                    className={styles.chipX}
                    onClick={() => setSelectedCategory('TODOS')}
                  />
                </span>
              )}
              {filterStockOnly && (
                <span className={[styles.chip, styles.chipGreen].filter(Boolean).join(' ')}>
                  En Stock
                </span>
              )}
            </div>

            {/* Filter Button */}
            <div className={styles.filterWrap}>
              <button onClick={() => setIsFilterOpen(true)} className={styles.filterBtn}>
                <SlidersHorizontal size={18} className={styles.filterBtnIcon} />
                <span>Filtrar</span>
                {(selectedCategory !== 'TODOS' ||
                  filterStockOnly ||
                  priceRange[0] > 0 ||
                  priceRange[1] < Infinity) && <div className={styles.filterDot}></div>}
              </button>
            </div>
          </div>
        </div>

        <QuickFilter
          categories={dbCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategoryChange}
          selectedLifeStage={selectedLifeStage}
          onSelectLifeStage={setSelectedLifeStage}
        />

        {loading ? (
          <div className={styles.cardsGrid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={styles.skeletonCard}></div>
            ))}
          </div>
        ) : totalFiltered === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIconWrap}>
              <Search size={40} className={styles.emptyIcon} />
            </div>
            <p className={styles.emptyTitle}>No hay resultados</p>
            <p className={styles.emptySub}>
              No pudimos encontrar productos que coincidan con tu búsqueda.
            </p>
            <button onClick={handleResetFilters} className={styles.emptyBtn}>
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className={styles.sections}>
            {sections.map((section, idx) => (
              <SegmentSection key={idx} section={section} onSeeMore={handleSeeMore} />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <CartDrawer isOpen={isCartOpen} onOpenChange={setIsCartOpen} />

      <FilterDrawer
        isOpen={isFilterOpen}
        onOpenChange={setIsFilterOpen}
        categories={dbCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
        selectedLifeStage={selectedLifeStage}
        onSelectLifeStage={setSelectedLifeStage}
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        filterStockOnly={filterStockOnly}
        onFilterStockChange={setFilterStockOnly}
        onReset={handleResetFilters}
      />

      {/* z-20 (no mayor): la barra de orden está en un contexto de apilamiento
          propio (relative z-30) y el menú (z-50) vive dentro de él. Con z-40 el
          overlay pintaba POR ENCIMA del menú y se tragaba los clicks en las
          opciones (el menú se cerraba sin cambiar el orden). Con z-20 sigue
          cubriendo el contenido (z-auto) para cerrar al clickear fuera. */}
      {showSortMenu && (
        <div
          data-testid="sort-menu-overlay"
          className={styles.sortOverlay}
          onClick={() => setShowSortMenu(false)}
        />
      )}
    </div>
  );
};
