import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';

import { Sheet, SheetContent, SheetTrigger } from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';
import styles from './EmployeeSidebar.module.css';

/**
 * Menú lateral del rol empleado: expone ÚNICAMENTE su panel de ventas.
 * Sin accesos a catálogo, ventas completas, caja, métricas ni reportes.
 */
export const EmployeeSidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Cierra el menú mobile al navegar.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Cierra el menú mobile al pasar a desktop.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={styles.desktop}>
        <div className={styles.header}>
          <span className={styles.brand}>
            BAS <span className={styles.brandAccent}>Empleado</span>
          </span>
        </div>

        <nav className={styles.nav}>
          <EmployeeNavItem
            icon={<LayoutDashboard size={20} />}
            label="Mi panel"
            to="/empleado/dashboard"
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
            <div className={styles.header}>
              <span className={styles.brand}>
                BAS <span className={styles.brandAccent}>Empleado</span>
              </span>
            </div>
            <nav className={styles.nav}>
              <EmployeeNavItem
                icon={<LayoutDashboard size={20} />}
                label="Mi panel"
                to="/empleado/dashboard"
              />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

const EmployeeNavItem = ({
  icon,
  label,
  to,
}: {
  icon: ReactNode;
  label: string;
  to: string;
}) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={[styles.navItem, active ? styles.navItemActive : styles.navItemIdle]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      <span className={styles.navLabel}>{label}</span>
    </Link>
  );
};
