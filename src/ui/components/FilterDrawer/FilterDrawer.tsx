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
import styles from './FilterDrawer.module.css';

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
      <SheetContent className={styles.content}>
        <SheetHeader className={styles.header}>
          <SheetTitle className={styles.headerTitle}>
            Filtros
            <Button variant="ghost" size="sm" onClick={onReset} className={styles.resetBtn}>
              <RotateCcw size={14} />
              Limpiar
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className={styles.body}>
          {/* Categorías */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Categoría</h4>
            <div className={styles.categoryGrid}>
              <button
                onClick={() => onSelectCategory('TODOS')}
                data-selected={selectedCategory === 'TODOS'}
                className={styles.optionBtn}
              >
                Todo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.name)}
                  data-selected={selectedCategory === cat.name}
                  className={[styles.optionBtn, styles.capitalize].filter(Boolean).join(' ')}
                >
                  {cat.name.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Etapas de vida */}
          {['PERRO', 'GATO', 'TODOS'].some((c) => selectedCategory.toUpperCase().includes(c)) && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Etapa de Vida</h4>
              <div className={styles.stageRow}>
                {LIFE_STAGE_OPTIONS.map((stage) => (
                  <button
                    key={stage.value}
                    onClick={() => onSelectLifeStage(stage.value)}
                    data-selected={selectedLifeStage === stage.value}
                    className={styles.stageBtn}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Rango de Precio */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Rango de Precio ($)</h4>
            <div className={styles.priceRow}>
              <div className={styles.priceField}>
                <label htmlFor="price-min" className={styles.priceLabel}>
                  Mínimo
                </label>
                <input
                  id="price-min"
                  type="number"
                  value={priceRange[0]}
                  onChange={(e) => onPriceRangeChange([Number(e.target.value), priceRange[1]])}
                  className={styles.priceInput}
                  placeholder="0"
                />
              </div>
              <div className={styles.priceField}>
                <label htmlFor="price-max" className={styles.priceLabel}>
                  Máximo
                </label>
                <input
                  id="price-max"
                  type="number"
                  value={priceRange[1] === Infinity ? '' : priceRange[1]}
                  onChange={(e) =>
                    onPriceRangeChange([
                      priceRange[0],
                      e.target.value === '' ? Infinity : Number(e.target.value),
                    ])
                  }
                  className={styles.priceInput}
                  placeholder="Sin límite"
                />
              </div>
            </div>
          </div>

          {/* Disponibilidad */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Disponibilidad</h4>
            <div className={styles.stockRow} onClick={() => onFilterStockChange(!filterStockOnly)}>
              <div className={styles.stockTexts}>
                <span className={styles.stockTitle}>Solo en stock</span>
                <span className={styles.stockSub}>Ocultar productos agotados</span>
              </div>
              <div className={styles.checkbox} data-checked={filterStockOnly}>
                {filterStockOnly && <div className={styles.checkDot}></div>}
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className={styles.footer}>
          <Button onClick={() => onOpenChange(false)} className={styles.applyBtn}>
            Aplicar Filtros
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
