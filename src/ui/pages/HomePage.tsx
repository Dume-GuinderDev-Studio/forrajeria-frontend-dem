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

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'recent';

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
    gradientFrom: string;
    gradientTo: string;
    accentColor: string;
    badgeBg: string;
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
        (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Adulto',
      );
      const perroCachorro = result.filter(
        (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Cachorro',
      );
      const perroSenior = result.filter(
        (p) => p.category?.name?.toUpperCase() === 'PERRO' && p.lifeStage === 'Senior',
      );
      const gatos = result.filter((p) => p.category?.name?.toUpperCase() === 'GATO');
      const accesorios = result.filter((p) => p.category?.name?.toUpperCase() === 'ACCESORIOS');
      const otros = result.filter(
        (p) =>
          !perroAdulto.includes(p) &&
          !perroCachorro.includes(p) &&
          !perroSenior.includes(p) &&
          !gatos.includes(p) &&
          !accesorios.includes(p),
      );

      if (perroAdulto.length > 0)
        finalSections.push({
          title: 'Línea Adultos',
          icon: <Dog size={24} className="text-white" />,
          products: perroAdulto.slice(0, 4),
          gradientFrom: 'from-blue-600',
          gradientTo: 'to-blue-500',
          accentColor: 'text-blue-900',
          badgeBg: 'bg-blue-100',
          categoryToSet: 'Perro',
          lifeStageToSet: 'Adulto',
          hasSeeMore: perroAdulto.length > 4,
        });

      if (perroCachorro.length > 0)
        finalSections.push({
          title: 'Línea Cachorros',
          icon: <Baby size={24} className="text-white" />,
          products: perroCachorro.slice(0, 4),
          gradientFrom: 'from-orange-500',
          gradientTo: 'to-amber-400',
          accentColor: 'text-orange-900',
          badgeBg: 'bg-orange-100',
          categoryToSet: 'Perro',
          lifeStageToSet: 'Cachorro',
          hasSeeMore: perroCachorro.length > 4,
        });

      if (perroSenior.length > 0)
        finalSections.push({
          title: 'Línea Senior',
          icon: <PawPrint size={24} className="text-white" />,
          products: perroSenior.slice(0, 4),
          gradientFrom: 'from-rose-500',
          gradientTo: 'to-pink-400',
          accentColor: 'text-rose-900',
          badgeBg: 'bg-rose-100',
          categoryToSet: 'Perro',
          lifeStageToSet: 'Senior',
          hasSeeMore: perroSenior.length > 4,
        });

      if (gatos.length > 0)
        finalSections.push({
          title: 'Línea Gatos',
          icon: <Cat size={24} className="text-white" />,
          products: gatos.slice(0, 4),
          gradientFrom: 'from-purple-600',
          gradientTo: 'to-purple-500',
          accentColor: 'text-purple-900',
          badgeBg: 'bg-purple-100',
          categoryToSet: 'Gato',
          hasSeeMore: gatos.length > 4,
        });

      if (accesorios.length > 0)
        finalSections.push({
          title: 'Accesorios',
          icon: <ShoppingBag size={24} className="text-white" />,
          products: accesorios.slice(0, 4),
          gradientFrom: 'from-green-600',
          gradientTo: 'to-green-500',
          accentColor: 'text-green-900',
          badgeBg: 'bg-green-100',
          categoryToSet: 'Accesorios',
          hasSeeMore: accesorios.length > 4,
        });

      if (otros.length > 0)
        finalSections.push({
          title: 'Otros Productos',
          icon: <Search size={24} className="text-white" />,
          products: otros.slice(0, 4),
          gradientFrom: 'from-slate-600',
          gradientTo: 'to-slate-500',
          accentColor: 'text-slate-900',
          badgeBg: 'bg-slate-200',
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
          icon: <Baby size={24} className="text-white" />,
          products: cachorros,
          gradientFrom: 'from-orange-500',
          gradientTo: 'to-amber-400',
          accentColor: 'text-orange-900',
          badgeBg: 'bg-orange-100',
        });
      if (adultos.length > 0)
        finalSections.push({
          title: 'Línea Adultos',
          icon: <Dog size={24} className="text-white" />,
          products: adultos,
          gradientFrom: 'from-blue-600',
          gradientTo: 'to-blue-500',
          accentColor: 'text-blue-900',
          badgeBg: 'bg-blue-100',
        });
      if (seniors.length > 0)
        finalSections.push({
          title: 'Línea Senior',
          icon: <PawPrint size={24} className="text-white" />,
          products: seniors,
          gradientFrom: 'from-rose-500',
          gradientTo: 'to-pink-400',
          accentColor: 'text-rose-900',
          badgeBg: 'bg-rose-100',
        });
      if (otrosRes.length > 0)
        finalSections.push({
          title: 'Otros Productos',
          icon: <SlidersHorizontal size={24} className="text-white" />,
          products: otrosRes,
          gradientFrom: 'from-slate-600',
          gradientTo: 'to-slate-500',
          accentColor: 'text-slate-900',
          badgeBg: 'bg-slate-200',
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
      <section className="mb-10 sm:mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${section.gradientFrom} ${section.gradientTo} shadow-lg shadow-blue-200/20`}
          >
            {section.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <h2 className={`text-xl sm:text-2xl font-bold ${section.accentColor} tracking-tight`}>
                {section.title}
              </h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${section.badgeBg} ${section.accentColor} border border-current opacity-65`}
              >
                {section.products.length}
              </span>
            </div>
          </div>
          <div
            className={`flex-1 h-[2px] bg-gradient-to-r ${section.gradientFrom.replace('from-', 'from-')} to-transparent opacity-10 ml-4`}
          ></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {section.products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              isPremium={index === 0 && section.title.includes('Adultos')}
            />
          ))}
        </div>

        {section.hasSeeMore && onSeeMore && section.categoryToSet && (
          <div className="mt-8 flex justify-center sm:justify-end">
            <button
              onClick={() => onSeeMore(section.categoryToSet!, section.lifeStageToSet)}
              className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all hover:shadow-md active:scale-[0.98]"
            >
              Ver más en {section.title}
              <ArrowRight
                size={18}
                className="text-blue-600 transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <HomeNavbar onOpenCart={() => setIsCartOpen(true)} />

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 pt-6 sm:pt-10 pb-16 w-full">
        {/* Search Bar Container */}
        <div className="max-w-3xl mx-auto mb-8 sm:mb-12">
          <div className="relative group">
            <input
              type="text"
              placeholder="Buscar alimentos, marcas, accesorios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-3xl bg-white border-2 border-transparent shadow-xl shadow-blue-900/5 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-lg font-medium placeholder:text-slate-400"
            />
            <Search
              className="absolute left-5 top-4.5 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              size={24}
            />
          </div>
        </div>

        {/* Sort & Filter Bar (ML Style) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-8 relative z-30">
          <div className="flex items-center justify-between divide-x divide-slate-100 h-14">
            {/* Sort Button */}
            <div className="flex-1 relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="w-full h-full flex items-center justify-center gap-2 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors rounded-l-2xl"
              >
                <ArrowUpDown size={18} className="text-blue-600" />
                <span>Ordenar</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${showSortMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showSortMenu && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {[
                    { id: 'price_asc', label: 'Precio: Menor a mayor' },
                    { id: 'price_desc', label: 'Precio: Mayor a menor' },
                    { id: 'name_asc', label: 'Nombre: A-Z' },
                    { id: 'recent', label: 'Más recientes' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id as SortOption);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm font-medium transition-colors ${sortBy === opt.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Summary / Quick Status */}
            <div className="hidden sm:flex items-center px-6 gap-3 flex-[2]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Filtros activos:
              </span>
              {selectedCategory !== 'TODOS' && (
                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100 flex items-center gap-1">
                  {selectedCategory}
                  <X
                    size={12}
                    className="cursor-pointer hover:text-blue-800"
                    onClick={() => setSelectedCategory('TODOS')}
                  />
                </span>
              )}
              {filterStockOnly && (
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                  En Stock
                </span>
              )}
            </div>

            {/* Filter Button */}
            <div className="flex-1">
              <button
                onClick={() => setIsFilterOpen(true)}
                className="w-full h-full flex items-center justify-center gap-2 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors rounded-r-2xl"
              >
                <SlidersHorizontal size={18} className="text-blue-600" />
                <span>Filtrar</span>
                {(selectedCategory !== 'TODOS' ||
                  filterStockOnly ||
                  priceRange[0] > 0 ||
                  priceRange[1] < Infinity) && (
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[440px] bg-white rounded-[24px] animate-pulse shadow-sm border border-slate-100"
              ></div>
            ))}
          </div>
        ) : totalFiltered === 0 ? (
          <div className="text-center py-24 bg-white rounded-[32px] border border-slate-100 shadow-sm">
            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={40} className="text-slate-300" />
            </div>
            <p className="text-2xl font-bold text-slate-800 mb-2">No hay resultados</p>
            <p className="text-slate-500 mb-8">
              No pudimos encontrar productos que coincidan con tu búsqueda.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              Ver todos los productos
            </button>
          </div>
        ) : (
          <div className="space-y-4">
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
        <div className="fixed inset-0 z-20 bg-black/5" onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  );
};
