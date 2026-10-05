import { PackageOpen } from 'lucide-react';
import type { Product } from '@/infrastructure/products.service';
import { getOpenBagLabel } from '@/lib/openBag';
import styles from './OpenBagBadge.module.css';

interface OpenBagBadgeProps {
  product: Product | null | undefined;
  className?: string;
  /**
   * Unidad elegida en la pantalla que monta el badge. Si se informa, el badge
   * solo aparece con 'Kilo': el sobrante de la bolsa abierta solo tiene sentido
   * cuando lo que se esta vendiendo es el fraccionado, no la bolsa cerrada.
   * Omitirlo no aplica ningun filtro (listado del catalogo, busqueda).
   */
  unit?: string;
}

/**
 * Badge informativo del sobrante de la bolsa abierta. No renderiza nada si el
 * producto no tiene una bolsa abierta con remanente, ni si se informo una unidad
 * distinta de 'Kilo'.
 */
export const OpenBagBadge = ({ product, className, unit }: OpenBagBadgeProps) => {
  if (unit !== undefined && unit !== 'Kilo') return null;

  const label = getOpenBagLabel(product);
  if (!label) return null;

  return (
    <span className={[styles.badge, className].filter(Boolean).join(' ')}>
      <PackageOpen size={12} className={styles.icon} />
      {label}
    </span>
  );
};
