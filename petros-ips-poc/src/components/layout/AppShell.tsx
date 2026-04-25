import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { GuidedTour } from '@/components/shared/GuidedTour';
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/project-store';
import { useSacPreviewMode } from '@/store/ui-prefs-store';

export function AppShell() {
  const initialize = useProjectStore((s) => s.initialize);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useProjectStore((s) => s.sidebarCollapsed);
  const mobileSidebarOpen = useProjectStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useProjectStore((s) => s.setMobileSidebarOpen);
  const sacPreview = useSacPreviewMode();
  const initialized = useRef(false);
  const location = useLocation();

  // Sync SAC Preview mode → body data attribute so CSS overrides apply
  // globally (across all pages, charts, dialogs, popovers).
  useEffect(() => {
    if (sacPreview) {
      document.body.setAttribute('data-sac-preview', 'true');
    } else {
      document.body.removeAttribute('data-sac-preview');
    }
    return () => {
      document.body.removeAttribute('data-sac-preview');
    };
  }, [sacPreview]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // Auto-collapse sidebar on narrow screens
    if (window.innerWidth < 1024 && !sidebarCollapsed) {
      toggleSidebar();
    }
    requestAnimationFrame(() => {
      initialize();
    });
  }, [initialize, toggleSidebar, sidebarCollapsed]);

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    if (mobileSidebarOpen) setMobileSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-content">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:ring-2 focus:rounded"
      >
        Skip to main content
      </a>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main
          id="main-content"
          role="main"
          aria-label="Main content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          <div className="max-w-[1600px] mx-auto p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
        <Footer />
      </div>
      <GuidedTour />
    </div>
  );
}
