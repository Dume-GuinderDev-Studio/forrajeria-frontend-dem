import { LIFE_STAGE_OPTIONS } from '@/lib/lifeStage';
import type { Category } from '@/infrastructure/products.service';
import styles from './QuickFilter.module.css';

type PillTheme = 'blue' | 'orange' | 'purple' | 'green' | 'slate' | 'dark';

interface QuickFilterProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  selectedLifeStage: string;
  onSelectLifeStage: (stage: string) => void;
}

export const QuickFilter = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedLifeStage,
  onSelectLifeStage,
}: QuickFilterProps) => {
  const getCategoryConfig = (name: string): { emoji: string; theme: PillTheme } => {
    const normalized = name.toUpperCase();
    if (normalized.includes('PERRO')) return { emoji: '🐶', theme: 'blue' };
    if (normalized.includes('GATO')) return { emoji: '🐱', theme: 'orange' };
    if (normalized.includes('ACCESORIOS')) return { emoji: '🎾', theme: 'purple' };
    if (normalized.includes('OTROS') || normalized.includes('HIGIENE'))
      return { emoji: '✨', theme: 'green' };
    return { emoji: '📦', theme: 'slate' };
  };

  const allCategories: { id: string; label: string; emoji: string; theme: PillTheme }[] = [
    { id: 'TODOS', label: 'Ver Todo', emoji: '🦴', theme: 'dark' },
    ...categories.map((cat) => {
      const config = getCategoryConfig(cat.name);
      return { id: cat.name, label: cat.name, emoji: config.emoji, theme: config.theme };
    }),
  ];

  return (
    <div className={styles.root}>
      {/* ── Category Pills ── */}
      <div className={['scrollbar-hide', styles.scroller].filter(Boolean).join(' ')}>
        <div className={styles.row}>
          {allCategories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                data-theme={cat.theme}
                data-active={isActive}
                className={styles.pill}
              >
                <span className={styles.emoji}>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LifeStages Pills ── */}
      {!['OTROS', 'HIGIENE', 'ACCESORIOS'].some((cat) =>
        selectedCategory.toUpperCase().includes(cat),
      ) && (
        <div className={['scrollbar-hide', styles.scroller].filter(Boolean).join(' ')}>
          <div className={styles.rowWide}>
            {LIFE_STAGE_OPTIONS.map((stage) => (
              <button
                key={stage.value}
                onClick={() => onSelectLifeStage(stage.value)}
                data-active={selectedLifeStage === stage.value}
                className={styles.stagePill}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
