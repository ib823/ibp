import { RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScenarioSelector } from '@/components/shared/ScenarioSelector';
import { useProjectStore } from '@/store/project-store';

export function Header() {
  const isCalculating = useProjectStore((s) => s.isCalculating);
  const runAll = useProjectStore((s) => s.runAllProjectEconomics);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-border shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1 rounded hover:bg-content-alt text-text-secondary"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-text-primary tracking-tight">
          Integrated Planning System
        </h1>
        <span className="text-[10px] font-medium text-amber bg-amber/10 px-1.5 py-0.5 uppercase tracking-wider">
          POC
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ScenarioSelector />
        <Button
          variant="outline"
          size="sm"
          onClick={runAll}
          disabled={isCalculating}
          className="text-xs gap-1.5"
        >
          <RefreshCw size={14} className={isCalculating ? 'animate-spin' : ''} />
          Recalculate All
        </Button>
      </div>
    </header>
  );
}
