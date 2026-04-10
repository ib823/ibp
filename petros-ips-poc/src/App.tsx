import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Link } from 'react-router';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EconomicsPage = lazy(() => import('@/pages/EconomicsPage'));
const SensitivityPage = lazy(() => import('@/pages/SensitivityPage'));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'));
const FinancialPage = lazy(() => import('@/pages/FinancialPage'));
const ReservesPage = lazy(() => import('@/pages/ReservesPage'));
const MonteCarloPage = lazy(() => import('@/pages/MonteCarloPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-sm text-text-muted">Loading...</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <h2 className="text-lg font-semibold text-text-primary">Page Not Found</h2>
      <p className="text-sm text-text-secondary">The page you requested does not exist.</p>
      <Link to="/" className="text-sm text-petrol hover:underline">Return to Dashboard</Link>
    </div>
  );
}

function wrap(Page: React.LazyExoticComponent<() => React.JSX.Element>) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: wrap(DashboardPage) },
      { path: '/economics', element: wrap(EconomicsPage) },
      { path: '/sensitivity', element: wrap(SensitivityPage) },
      { path: '/portfolio', element: wrap(PortfolioPage) },
      { path: '/financial', element: wrap(FinancialPage) },
      { path: '/reserves', element: wrap(ReservesPage) },
      { path: '/monte-carlo', element: wrap(MonteCarloPage) },
      { path: '/settings', element: wrap(SettingsPage) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <>
      <Toaster position="bottom-right" richColors />
      <RouterProvider router={router} />
    </>
  );
}

export default App;
