import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { registerNavigate } from '../navigation';
import { ProtectedRoute, AdminProtectedRoute } from '../ProtectedRoute';
import { HomePage } from '@/ui/pages/HomePage';
import { LoginPage } from '@/ui/pages/LoginPage';
import { GoogleCallback } from '@/ui/pages/GoogleCallback';
import { AdminLayout } from '@/ui/layouts/AdminLayout';
import { EmployeeLayout } from '@/ui/layouts/EmployeeLayout';
import styles from './AppRouter.module.css';

// Code-splitting: las páginas del panel admin se cargan bajo demanda, así no
// inflan el bundle inicial que descarga cualquier visitante del home.
const DashboardPage = lazy(() =>
  import('@/ui/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AdminPage = lazy(() =>
  import('@/ui/components/Pages').then((m) => ({ default: m.AdminPage })),
);
const AdminOrdersPage = lazy(() =>
  import('@/ui/pages/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })),
);
const CashRegisterPage = lazy(() =>
  import('@/ui/pages/CashRegisterPage').then((m) => ({ default: m.CashRegisterPage })),
);
const DebtorsPage = lazy(() =>
  import('@/ui/pages/DebtorsPage').then((m) => ({ default: m.DebtorsPage })),
);
const SuppliersPage = lazy(() =>
  import('@/ui/pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);
const SupplierDebtsPage = lazy(() =>
  import('@/ui/pages/SupplierDebtsPage').then((m) => ({ default: m.SupplierDebtsPage })),
);
const SupplierProfitPage = lazy(() =>
  import('@/ui/pages/SupplierProfitPage').then((m) => ({ default: m.SupplierProfitPage })),
);
const BrandsPage = lazy(() =>
  import('@/ui/pages/BrandsPage').then((m) => ({ default: m.BrandsPage })),
);
const BrandProfitPage = lazy(() =>
  import('@/ui/pages/BrandProfitPage').then((m) => ({ default: m.BrandProfitPage })),
);
const EmployeeDashboardPage = lazy(() =>
  import('@/ui/pages/EmployeeDashboardPage').then((m) => ({
    default: m.EmployeeDashboardPage,
  })),
);

const NavigateRegistrar = () => {
  const navigate = useNavigate();

  useEffect(() => {
    registerNavigate(navigate);
  }, [navigate]);

  return null;
};

const PageLoader = () => (
  <div className={styles.loader}>
    <Loader2 className={styles.spinner} />
    <p className={styles.text}>Cargando...</p>
  </div>
);

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <NavigateRegistrar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />

          {/* Protected Admin Routes — solo role admin */}
          <Route element={<AdminProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/catalogo" element={<AdminPage />} />
              <Route path="/admin/orders" element={<AdminOrdersPage />} />
              <Route path="/admin/caja" element={<CashRegisterPage />} />
              <Route path="/admin/deudores" element={<DebtorsPage />} />
              <Route path="/admin/proveedores" element={<SuppliersPage />} />
              <Route path="/admin/a-pagar" element={<SupplierDebtsPage />} />
              <Route path="/admin/ganancia-proveedores" element={<SupplierProfitPage />} />
              <Route path="/admin/marcas" element={<BrandsPage />} />
              <Route path="/admin/ganancia-marcas" element={<BrandProfitPage />} />
            </Route>
          </Route>

          {/* Protected Employee Routes — admin y empleado */}
          <Route element={<ProtectedRoute />}>
            <Route element={<EmployeeLayout />}>
              <Route
                path="/empleado"
                element={<Navigate to="/empleado/dashboard" replace />}
              />
              <Route path="/empleado/dashboard" element={<EmployeeDashboardPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};
