import { PackageOpen } from 'lucide-react';
import type { Product } from '@/infrastructure/products.service';
import { getOpenBagLabel } from '@/lib/openBag';

interface OpenBagBadgeProps {
  product: Product | null | undefined;
  className?: string;
}

/**
 * Badge informativo de "bolsa abierta". No renderiza nada si el producto
 * no tiene una bolsa abierta con remanente.
 */
export const OpenBagBadge = ({ product, className }: OpenBagBadgeProps) => {
  const label = getOpenBagLabel(product);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300 ${className ?? ''}`}
    >
      <PackageOpen size={12} className="shrink-0" />
      {label}
    </span>
  );
};
