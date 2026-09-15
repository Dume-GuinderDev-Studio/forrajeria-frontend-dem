import { Tags } from 'lucide-react';
import type { Product } from '@/infrastructure/products.service';

interface BrandBadgeProps {
  product: Product | null | undefined;
  className?: string;
}

/**
 * Badge informativo de marca ("Marca: Eukanuba").
 * No renderiza nada si el producto no tiene marca asignada.
 */
export const BrandBadge = ({ product, className }: BrandBadgeProps) => {
  const brandName = product?.brand?.name?.trim();
  if (!brandName) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 ${className ?? ''}`}
    >
      <Tags size={12} className="shrink-0" />
      Marca: {brandName}
    </span>
  );
};
