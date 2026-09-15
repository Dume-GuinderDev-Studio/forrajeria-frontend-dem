import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { Category } from '@/infrastructure/products.service';
import { LIFE_STAGE_OPTIONS } from '@/lib/lifeStage';

interface FilterDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedLifeStage: string;
  onSelectLifeStage: (stage: string) => void;
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  filterStockOnly: boolean;
  onFilterStockChange: (val: boolean) => void;
  onReset: () => void;
}

export const FilterDrawer = ({
  isOpen,
  onOpenChange,
  categories,
  selectedCategory,
  onSelectCategory,
  selectedLifeStage,
  onSelectLifeStage,
  priceRange,
  onPriceRangeChange,
  filterStockOnly,
  onFilterStockChange,
  onReset,
}: FilterDrawerProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="border-b border-slate-100 pb-4 mb-4">
          <SheetTitle className="text-2xl font-bold flex items-center justify-between">
            Filtros
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-blue-600 font-bold text-xs h-8 px-2 gap-1.5 active:scale-95"
            >
              <RotateCcw size={14} />
              Limpiar
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-8 py-2">
          {/* Categorías */}
          <div className="space-y-4">
            <h4 className="text-base font-bold text-slate-900">Categoría</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSelectCategory('TODOS')}
                className={`text-center py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${selectedCategory === 'TODOS' ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
              >
                Todo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.name)}
                  className={`text-center py-2.5 rounded-xl border-2 transition-all font-medium text-sm capitalize ${selectedCategory === cat.name ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                >
                  {cat.name.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Etapas de vida */}
          {['PERRO', 'GATO', 'TODOS'].some((c) => selectedCategory.toUpperCase().includes(c)) && (
            <div className="space-y-4">
              <h4 className="text-base font-bold text-slate-900">Etapa de Vida</h4>
              <div className="flex flex-wrap gap-2">
                {LIFE_STAGE_OPTIONS.map((stage) => (
                  <button
                    key={stage.value}
                    onClick={() => onSelectLifeStage(stage.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${selectedLifeStage === stage.value ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rango de Precio */}
          <div className="space-y-4">
            <h4 className="text-base font-bold text-slate-900">Rango de Precio ($)</h4>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase ml-1">Mínimo</span>
                <input
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => onPriceRangeChange([Number(e.target.value), priceRange[1]])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase ml-1">Máximo</span>
                <input
                  type="number"
                  value={priceRange[1] === Infinity ? '' : priceRange[1]}
                  onChange={(e) =>
                    onPriceRangeChange([
                      priceRange[0],
                      e.target.value === '' ? Infinity : Number(e.target.value),
                    ])
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Sin límite"
                />
              </div>
            </div>
          </div>

          {/* Disponibilidad */}
          <div className="space-y-4">
            <h4 className="text-base font-bold text-slate-900">Disponibilidad</h4>
            <div
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer"
              onClick={() => onFilterStockChange(!filterStockOnly)}
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">Solo en stock</span>
                <span className="text-xs text-slate-500 font-medium">
                  Ocultar productos agotados
                </span>
              </div>
              <div
                className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors ${filterStockOnly ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
              >
                {filterStockOnly && <div className="h-3 w-3 bg-white rounded-sm"></div>}
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t border-slate-100 pt-6 mt-6">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-lg rounded-2xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-transform"
          >
            Aplicar Filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
