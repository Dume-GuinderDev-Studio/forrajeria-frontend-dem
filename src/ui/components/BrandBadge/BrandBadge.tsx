import { Tags } from 'lucide-react';
import type { Product } from '@/infrastructure/products.service';
import styles from './BrandBadge.module.css';

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
    <span className={[styles.badge, className].filter(Boolean).join(' ')}>
      <Tags size={12} className={styles.icon} />
      Marca: {brandName}
    </span>
  );
};
