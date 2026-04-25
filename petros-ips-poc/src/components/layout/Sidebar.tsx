import { useNavigate, useLocation } from 'react-router';
import {
  SideNavigation,
  SideNavigationItem,
} from '@ui5/webcomponents-react';
import type { SideNavigationPropTypes } from '@ui5/webcomponents-react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/project-store';

// SAP Horizon icon names for each nav route
const NAV_ITEMS = [
  { path: '/',            icon: 'home',                text: 'Dashboard' },
  { path: '/economics',   icon: 'simulate',            text: 'Economics' },
  { path: '/sensitivity', icon: 'horizontal-bar-chart',text: 'Sensitivity' },
  { path: '/portfolio',   icon: 'chain-link',          text: 'Portfolio' },
  { path: '/financial',   icon: 'payment-approval',    text: 'Financial' },
  { path: '/reserves',    icon: 'database',            text: 'Reserves' },
  { path: '/monte-carlo', icon: 'bar-chart',           text: 'Monte Carlo' },
  { path: '/data-entry',  icon: 'edit',                text: 'Data Entry' },
  { path: '/settings',    icon: 'action-settings',     text: 'Settings' },
  { path: '/glossary',    icon: 'learning-assistant',  text: 'Glossary' },
  { path: '/data-sources', icon: 'document',           text: 'Data Sources' },
  { path: '/audit',       icon: 'history',             text: 'Audit Trail' },
] as const;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useProjectStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);
  const mobileSidebarOpen = useProjectStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useProjectStore((s) => s.setMobileSidebarOpen);

  const handleSelectionChange: SideNavigationPropTypes['onSelectionChange'] = (e) => {
    const item = e.detail.item as HTMLElement | undefined;
    const path = item?.getAttribute('data-path');
    if (path) {
      navigate(path);
      setMobileSidebarOpen(false);
    }
  };

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex flex-col bg-white border-r border-border transition-all duration-200',
        // Mobile: fixed overlay, slide in from left
        'fixed inset-y-0 left-0 z-40 w-[240px]',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: static, in-flow
        'lg:static lg:translate-x-0 lg:shrink-0',
        collapsed ? 'lg:w-[60px]' : 'lg:w-[240px]',
      )}
    >
      {/* Mobile close button */}
      <div className="lg:hidden flex items-center justify-end h-14 px-2 border-b border-border">
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="p-2 min-w-[44px] min-h-[44px] text-text-muted hover:text-text-primary"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* UI5 SideNavigation */}
      <div className="flex-1 overflow-y-auto">
        <SideNavigation
          collapsed={collapsed && !mobileSidebarOpen}
          onSelectionChange={handleSelectionChange}
        >
          {NAV_ITEMS.map((item) => (
            <SideNavigationItem
              key={item.path}
              data-path={item.path}
              icon={item.icon}
              text={item.text}
              tooltip={item.text}
              selected={
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              }
            />
          ))}
        </SideNavigation>
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={toggleSidebar}
        className="hidden lg:flex items-center justify-center h-10 border-t border-border text-text-muted hover:text-text-primary transition-colors"
        aria-label="Toggle sidebar collapse"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </nav>
  );
}
