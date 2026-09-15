import { useAuthStore } from '@/infrastructure/auth_session_manager';
import { Outlet } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { EmployeeSidebar } from '@/ui/components/EmployeeSidebar';

/**
 * Layout del panel del empleado: navbar con su identidad + menú lateral
 * reducido (solo "Mi panel") + contenido.
 */
export const EmployeeLayout = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      {/* Navbar */}
      <nav className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border border-emerald-200">
            <img
              src="/logo.png"
              alt="BAS"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.classList.add(
                  'after:content-["B"]',
                  'after:text-emerald-700',
                  'after:font-bold',
                );
              }}
            />
          </div>
          <span className="font-bold text-xl text-slate-800 dark:text-white tracking-tight">
            BAS <span className="text-emerald-600">Empleado</span>
          </span>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {user?.name || 'Empleado'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {user?.email || ''}
            </span>
          </div>

          <div className="h-9 w-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-slate-500">
            {user?.picture ? (
              <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={20} />
            )}
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
            <span className="hidden sm:inline font-medium">Salir</span>
          </button>
        </div>
      </nav>

      <EmployeeSidebar />

      {/* Main Content Area */}
      <main className="md:ml-64 p-4 sm:p-8 w-full max-w-[100vw] overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};
