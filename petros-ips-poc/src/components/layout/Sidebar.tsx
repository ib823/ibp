import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Calculator,
  BarChart3,
  PieChart,
  FileText,
  Database,
  Dice5,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/project-store';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/economics', label: 'Economics', icon: Calculator },
  { path: '/sensitivity', label: 'Sensitivity', icon: BarChart3 },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/financial', label: 'Financial', icon: FileText },
  { path: '/reserves', label: 'Reserves', icon: Database },
  { path: '/monte-carlo', label: 'Monte Carlo', icon: Dice5 },
  { path: '/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const location = useLocation();
  const collapsed = useProjectStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'flex flex-col bg-navy text-white border-r border-navy-border transition-all duration-200 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-navy-border">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-widest text-amber uppercase">
            PETROS IPS
          </span>
        )}
        {collapsed && (
          <span className="text-sm font-bold text-amber mx-auto">P</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative',
                isActive
                  ? 'bg-petrol/40 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-navy-light',
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber" />
              )}
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-navy-border text-gray-500 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
