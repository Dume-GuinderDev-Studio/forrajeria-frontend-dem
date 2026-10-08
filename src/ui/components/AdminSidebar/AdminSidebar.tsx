import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ChevronLeft,
  ChevronRight,
  Menu,
  ShoppingCart,
  CircleDollarSign,
  HandCoins,
  Wallet,
  TrendingUp,
  Truck,
  Tags,
  PieChart,
} from 'lucide-react';

import { Sheet, SheetContent, SheetTrigger } from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';
import styles from './AdminSidebar.module.css';

export const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close mobile menu when navigating to another admin section
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bonus: Lock scroll when mobile menu is open (though Sheet usually handles this)
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Important: 'unset' might conflict if shadcn Sheet also tries to manage it.
      // Radix UI Dialog usually handles this automatically.
      // If we manually manage it, we might want to be careful.
      // However, user requested it. Let's stick to the controlled state which is the robust fix.
      // If we use Radix Sheet, it SHOULD handle scroll locking.
      // Let's add the explicit check just in case the Sheet doesn't covering some edge case of the user's "bug".
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={styles.desktop} data-collapsed={collapsed}>
        <div className={styles.header}>
          {!collapsed && (
            <span className={styles.brand}>
              <span className={styles.brandAccent}>Admin</span>
            </span>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className={styles.collapseBtn}>
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className={styles.nav}>
          <NavItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            to="/admin/dashboard"
            collapsed={collapsed}
          />
          <NavItem
            icon={<Package size={20} />}
            label="Catálogo"
            to="/admin/catalogo"
            collapsed={collapsed}
          />
          <NavItem
            icon={<ShoppingCart size={20} />}
            label="Ventas"
            to="/admin/orders"
            collapsed={collapsed}
          />
          <NavItem
            icon={<CircleDollarSign size={20} />}
            label="Caja"
            to="/admin/caja"
            collapsed={collapsed}
          />
          <NavItem
            icon={<HandCoins size={20} />}
            label="Deudores"
            to="/admin/deudores"
            collapsed={collapsed}
          />
          <NavItem
            icon={<Truck size={20} />}
            label="Proveedores"
            to="/admin/proveedores"
            collapsed={collapsed}
          />
          <NavItem
            icon={<Wallet size={20} />}
            label="A pagar"
            to="/admin/a-pagar"
            collapsed={collapsed}
          />
          <NavItem
            icon={<TrendingUp size={20} />}
            label="Mi ganancia"
            to="/admin/ganancia-proveedores"
            collapsed={collapsed}
          />
          <NavItem
            icon={<Tags size={20} />}
            label="Marcas"
            to="/admin/marcas"
            collapsed={collapsed}
          />
          <NavItem
            icon={<PieChart size={20} />}
            label="Ganancia por marca"
            to="/admin/ganancia-marcas"
            collapsed={collapsed}
          />
        </nav>
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <div className={styles.mobileWrap}>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className={styles.triggerBtn}>
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className={styles.drawerContent}>
            <div className={styles.drawerHeader}>
              <span className={styles.brand}>
                BAS <span className={styles.brandAccent}>Admin</span>
              </span>
            </div>
            <nav className={styles.nav}>
              <NavItem
                icon={<LayoutDashboard size={20} />}
                label="Dashboard"
                to="/admin/dashboard"
                collapsed={false}
              />
              <NavItem
                icon={<Package size={20} />}
                label="Catálogo"
                to="/admin/catalogo"
                collapsed={false}
              />
              <NavItem
                icon={<ShoppingCart size={20} />}
                label="Ventas"
                to="/admin/orders"
                collapsed={false}
              />
              <NavItem
                icon={<CircleDollarSign size={20} />}
                label="Caja"
                to="/admin/caja"
                collapsed={false}
              />
              <NavItem
                icon={<HandCoins size={20} />}
                label="Deudores"
                to="/admin/deudores"
                collapsed={false}
              />
              <NavItem
                icon={<Truck size={20} />}
                label="Proveedores"
                to="/admin/proveedores"
                collapsed={false}
              />
              <NavItem
                icon={<Wallet size={20} />}
                label="A pagar"
                to="/admin/a-pagar"
                collapsed={false}
              />
              <NavItem
                icon={<TrendingUp size={20} />}
                label="Mi ganancia"
                to="/admin/ganancia-proveedores"
                collapsed={false}
              />
              <NavItem
                icon={<Tags size={20} />}
                label="Marcas"
                to="/admin/marcas"
                collapsed={false}
              />
              <NavItem
                icon={<PieChart size={20} />}
                label="Ganancia por marca"
                to="/admin/ganancia-marcas"
                collapsed={false}
              />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

const NavItem = ({
  icon,
  label,
  to,
  collapsed,
}: {
  icon: ReactNode;
  label: string;
  to: string;
  collapsed: boolean;
}) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link to={to} className={styles.navItem} data-active={active} data-centered={collapsed}>
      {icon}
      {!collapsed && <span className={styles.navLabel}>{label}</span>}
    </Link>
  );
};
