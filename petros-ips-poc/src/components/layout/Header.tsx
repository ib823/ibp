import { ShellBar, ShellBarItem } from '@ui5/webcomponents-react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui5/Ui5Button';
import { ScenarioSelector } from '@/components/shared/ScenarioSelector';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { useProjectStore } from '@/store/project-store';
import { startTour, resetTourFlag } from '@/lib/tour-state';

export function Header() {
  const isCalculating = useProjectStore((s) => s.isCalculating);
  const runAll = useProjectStore((s) => s.runAllProjectEconomics);
  const mobileSidebarOpen = useProjectStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useProjectStore((s) => s.setMobileSidebarOpen);

  return (
    <div className="border-b border-border shrink-0">
      {/* ShellBar — SAP Fiori branding + global actions */}
      <ShellBar
        primaryTitle="PETROS IPS"
        secondaryTitle="Integrated Planning System"
      >
        <ShellBarItem
          icon="sys-help"
          text="Start Tour"
          onClick={() => {
            resetTourFlag();
            startTour();
          }}
        />
      </ShellBar>

      {/* Toolbar row — page-level controls */}
      <div className="flex items-center h-12 px-3 sm:px-4 gap-2 bg-white">
        {/* Mobile hamburger — visible ONLY below lg breakpoint */}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex lg:hidden items-center justify-center w-11 h-11 rounded border border-border text-text-primary hover:bg-content-alt shrink-0"
          aria-label={mobileSidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <span className="text-[10px] font-semibold tracking-wider uppercase text-amber bg-amber/10 border border-amber/30 px-2 py-0.5 rounded shrink-0">
          POC
        </span>
        <div className="flex-1" />
        <EduTooltip entryId="D-05">
          <div data-tour="scenario-selector">
            <ScenarioSelector />
          </div>
        </EduTooltip>
        <EduTooltip entryId="D-06">
          <Button
            variant="outline"
            size="sm"
            onClick={runAll}
            disabled={isCalculating}
            icon="refresh"
            className="text-xs h-10 sm:h-9 min-w-[44px] sm:min-w-0 px-2 sm:px-3"
            aria-label="Recalculate all projects"
          >
            <span className="hidden sm:inline">Recalculate All</span>
          </Button>
        </EduTooltip>
      </div>
    </div>
  );
}
