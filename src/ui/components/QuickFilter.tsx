import { LIFE_STAGE_OPTIONS } from '@/lib/lifeStage';
import type { Category } from '@/infrastructure/products.service';

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
  const getCategoryConfig = (name: string) => {
    const normalized = name.toUpperCase();
    if (normalized.includes('PERRO'))
      return {
        emoji: '🐶',
        activeBg: 'bg-blue-600',
        activeText: 'text-white',
        inactiveText: 'text-blue-600',
        inactiveBorder: 'border-blue-200',
      };
    if (normalized.includes('GATO'))
      return {
        emoji: '🐱',
        activeBg: 'bg-orange-500',
        activeText: 'text-white',
        inactiveText: 'text-orange-600',
        inactiveBorder: 'border-orange-200',
      };
    if (normalized.includes('ACCESORIOS'))
      return {
        emoji: '🎾',
        activeBg: 'bg-purple-600',
        activeText: 'text-white',
        inactiveText: 'text-purple-600',
        inactiveBorder: 'border-purple-200',
      };
    if (normalized.includes('OTROS') || normalized.includes('HIGIENE'))
      return {
        emoji: '✨',
        activeBg: 'bg-green-600',
        activeText: 'text-white',
        inactiveText: 'text-green-600',
        inactiveBorder: 'border-green-200',
      };
    return {
      emoji: '📦',
      activeBg: 'bg-slate-600',
      activeText: 'text-white',
      inactiveText: 'text-slate-600',
      inactiveBorder: 'border-slate-200',
    };
  };

  const allCategories = [
    {
      id: 'TODOS',
      label: 'Ver Todo',
      emoji: '🦴',
      activeBg: 'bg-slate-800',
      activeText: 'text-white',
      inactiveText: 'text-slate-600',
      inactiveBorder: 'border-slate-200',
    },
    ...categories.map((cat) => {
      const config = getCategoryConfig(cat.name);
      return {
        id: cat.name,
        label: cat.name,
        emoji: config.emoji,
        activeBg: config.activeBg,
        activeText: config.activeText,
        inactiveText: config.inactiveText,
        inactiveBorder: config.inactiveBorder,
      };
    }),
  ];

  return (
    <div className="mb-6 md:mb-8 space-y-4">
      {/* ── Category Pills ── */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide">
        <div className="flex gap-2 md:flex-wrap md:justify-center pb-2 md:pb-0">
          {allCategories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`
                  flex-shrink-0 flex items-center gap-1.5
                  rounded-full
                  px-4 py-2
                  text-sm font-semibold
                  transition-all duration-200
                  ${
                    isActive
                      ? `${cat.activeBg} ${cat.activeText} shadow-md`
                      : `bg-white border ${cat.inactiveBorder} ${cat.inactiveText} hover:shadow-sm active:scale-95`
                  }
                `}
              >
                <span className="text-base">{cat.emoji}</span>
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
        <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible scrollbar-hide">
          <div className="flex gap-2 md:gap-3 md:flex-wrap md:justify-center pb-2 md:pb-0">
            {LIFE_STAGE_OPTIONS.map((stage) => (
              <button
                key={stage.value}
                onClick={() => onSelectLifeStage(stage.value)}
                className={`
                  relative flex-shrink-0
                  rounded-full px-4 py-1.5 md:px-5 md:py-2 text-sm font-semibold
                  transition-all duration-200 border
                  ${
                    selectedLifeStage === stage.value
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }
                `}
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
