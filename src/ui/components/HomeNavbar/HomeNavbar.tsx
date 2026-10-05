import { useCartStore } from '@/infrastructure/cart_manager';
import { Handbag } from 'lucide-react';
import styles from './HomeNavbar.module.css';

interface HomeNavbarProps {
  onOpenCart: () => void;
}

export const HomeNavbar = ({ onOpenCart }: HomeNavbarProps) => {
  const { items } = useCartStore();
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className={styles.root}>
      <div className={styles.inner}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoBox}>
            <img
              src="/logo.png"
              alt="BAS"
              className={styles.logoImg}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div className={styles.titles}>
            <h1 className={styles.name}>BAS Pet Shop</h1>
            <p className={styles.tagline}>"Tu mascota feliz"</p>
          </div>
        </div>

        {/* Cart Trigger */}
        <button onClick={onOpenCart} className={styles.cartBtn}>
          <Handbag size={28} />
          {itemCount > 0 && <span className={styles.badge}>{itemCount}</span>}
        </button>
      </div>
    </nav>
  );
};
