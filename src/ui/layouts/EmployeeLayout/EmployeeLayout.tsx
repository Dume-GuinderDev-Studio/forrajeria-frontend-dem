import { useAuthStore } from '@/infrastructure/auth_session_manager';
import { Outlet } from 'react-router-dom';
import { LogOut, User as UserIcon } from 'lucide-react';
import { EmployeeSidebar } from '@/ui/components/EmployeeSidebar';
import styles from './EmployeeLayout.module.css';

/**
 * Layout del panel del empleado: navbar con su identidad + menú lateral
 * reducido (solo "Mi panel") + contenido.
 */
export const EmployeeLayout = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className={styles.root}>
      {/* Navbar */}
      <nav className={styles.nav}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoBox}>
            <img
              src="/logo.png"
              alt="BAS"
              className={styles.logoImg}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.classList.add(styles.logoFallback);
              }}
            />
          </div>
          <span className={styles.brandName}>
            BAS <span className={styles.brandAccent}>Empleado</span>
          </span>
        </div>

        {/* User Actions */}
        <div className={styles.userActions}>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{user?.name || 'Empleado'}</span>
            <span className={styles.userEmail}>{user?.email || ''}</span>
          </div>

          <div className={styles.avatar}>
            {user?.picture ? (
              <img src={user.picture} alt="Profile" className={styles.avatarImg} />
            ) : (
              <UserIcon size={20} />
            )}
          </div>

          <div className={styles.divider}></div>

          <button onClick={logout} className={styles.logoutBtn} title="Cerrar Sesión">
            <LogOut size={20} />
            <span className={styles.logoutLabel}>Salir</span>
          </button>
        </div>
      </nav>

      <EmployeeSidebar />

      {/* Main Content Area */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};
