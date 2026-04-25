import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Link } from 'react-router';
import { Toaster } from '@/components/ui5/Ui5Toast';
import { ThemeProvider } from '@ui5/webcomponents-react';
import '@ui5/webcomponents-react/dist/Assets.js';
import { AppShell } from '@/components/layout/AppShell';
import { usePageTitle } from '@/hooks/usePageTitle';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const EconomicsPage = lazy(() => import('@/pages/EconomicsPage'));
const SensitivityPage = lazy(() => import('@/pages/SensitivityPage'));
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'));
const FinancialPage = lazy(() => import('@/pages/FinancialPage'));
const ReservesPage = lazy(() => import('@/pages/ReservesPage'));
const MonteCarloPage = lazy(() => import('@/pages/MonteCarloPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const GlossaryPage = lazy(() => import('@/pages/GlossaryPage'));
const DataSourcesPage = lazy(() => import('@/pages/DataSourcesPage'));
const AuditTrailPage = lazy(() => import('@/pages/AuditTrailPage'));
const SacMappingPage = lazy(() => import('@/pages/SacMappingPage'));
const DataEntryPage = lazy(() => import('@/pages/DataEntryPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-sm text-text-muted">Loading...</p>
    </div>
  );
}

function NotFoundPage() {
  usePageTitle('Page Not Found');
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 px-4 text-center">
      <h2 className="text-lg font-semibold text-text-primary">Page Not Found</h2>
      <p className="text-sm text-text-secondary">The page you requested does not exist.</p>
      <Link to="/" className="text-sm text-petrol hover:underline">Return to Dashboard</Link>
      <div className="mt-8 pt-4 border-t border-border max-w-md">
        <p className="text-xs text-text-muted">
          PETROS IPS — Proof of Concept. Sample data derived from publicly available
          Sarawak offshore analogues. Illustrative only. Not connected to SAP S/4HANA
          or any production system. © ABeam Consulting Malaysia.
        </p>
      </div>
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
      { path: '/glossary', element: wrap(GlossaryPage) },
      { path: '/data-sources', element: wrap(DataSourcesPage) },
      { path: '/audit', element: wrap(AuditTrailPage) },
      { path: '/sac-mapping', element: wrap(SacMappingPage) },
      { path: '/data-entry', element: wrap(DataEntryPage) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <ThemeProvider>
      <Toaster />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
