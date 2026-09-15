import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Menu } from 'lucide-react';

import { Sheet, SheetContent, SheetTrigger } from '@/ui/components/ui/sheet';
import { Button } from '@/ui/components/ui/button';

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
      <aside className="hidden md:flex flex-col bg-slate-900 text-white min-h-screen w-64 fixed left-0 top-0 z-40">
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <span className="font-bold text-xl tracking-tight">
            BAS <span className="text-emerald-500">Empleado</span>
          </span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          <EmployeeNavItem
            icon={<LayoutDashboard size={20} />}
            label="Mi panel"
            to="/empleado/dashboard"
          />
        </nav>
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              <Menu size={24} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-slate-900 text-white border-r-slate-800 w-64 p-0">
            <div className="h-16 flex items-center px-6 border-b border-slate-700">
              <span className="font-bold text-xl tracking-tight">
                BAS <span className="text-emerald-500">Empleado</span>
              </span>
            </div>
            <nav className="flex-1 py-6 px-3 space-y-2">
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
      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
        active
          ? 'bg-emerald-600/20 text-emerald-400'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
};
