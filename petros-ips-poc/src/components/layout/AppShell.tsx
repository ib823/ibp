import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/store/project-store';

export function AppShell() {
  const initialize = useProjectStore((s) => s.initialize);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useProjectStore((s) => s.sidebarCollapsed);
  const initialized = useRef(false);

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

  return (
    <div className="flex h-screen overflow-hidden bg-content">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
