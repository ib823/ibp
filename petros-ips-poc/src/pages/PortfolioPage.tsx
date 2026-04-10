import { useMemo, useCallback } from 'react';
import { useProjectStore } from '@/store/project-store';
import { KpiCard } from '@/components/shared/KpiCard';
import { NpvBubbleChart } from '@/components/charts/NpvBubbleChart';
import { PortfolioProductionChart } from '@/components/charts/PortfolioProductionChart';
import { CapexTimelineChart } from '@/components/charts/CapexTimelineChart';
import { HierarchyBar } from '@/components/charts/HierarchyBar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { fmtM, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EconomicsResult } from '@/engine/types';

export default function PortfolioPage() {
  const projects = useProjectStore((s) => s.projects);
  const portfolioSelection = useProjectStore((s) => s.portfolioSelection);
  const toggleProject = useProjectStore((s) => s.toggleProjectInPortfolio);
  const portfolioResult = useProjectStore((s) => s.portfolioResult);
  const economicsResults = useProjectStore((s) => s.economicsResults);
  const activeScenario = useProjectStore((s) => s.activeScenario);

  // Get results for the active scenario per project
  const projectResults = useMemo(() => {
    const map = new Map<string, EconomicsResult>();
    for (const [id, scenarioMap] of economicsResults) {
      const result = scenarioMap.get(activeScenario);
      if (result) map.set(id, result);
    }
    return map;
  }, [economicsResults, activeScenario]);

  // Compute portfolio-level weighted IRR
  const { weightedIrr, totalGovtTake } = useMemo(() => {
    let capexWeightedIrr = 0;
    let totalCapex = 0;
    let govtTakeWeighted = 0;
    let totalRevenue = 0;

    for (const id of portfolioSelection) {
      const r = projectResults.get(id);
      if (!r) continue;
      const capex = r.totalCapex as number;
      capexWeightedIrr += (r.irr ?? r.mirr) * capex;
      totalCapex += capex;
      govtTakeWeighted += r.governmentTakePct * (r.totalRevenue as number);
      totalRevenue += r.totalRevenue as number;
    }

    return {
      weightedIrr: totalCapex > 0 ? capexWeightedIrr / totalCapex : 0,
      totalGovtTake: totalRevenue > 0 ? govtTakeWeighted / totalRevenue : 0,
    };
  }, [portfolioSelection, projectResults]);

  // Bubble chart data (active projects only)
  const bubbleData = useMemo(
    () =>
      projects
        .filter((p) => portfolioSelection.has(p.project.id))
        .map((p) => ({
          id: p.project.id,
          name: p.project.name,
          regime: p.fiscalRegimeConfig.type,
          result: projectResults.get(p.project.id)!,
        }))
        .filter((d) => d.result),
    [projects, portfolioSelection, projectResults],
  );

  const handleToggle = useCallback(
    (id: string, name: string) => {
      const wasActive = portfolioSelection.has(id);
      const result = projectResults.get(id);
      toggleProject(id);

      if (result) {
        const npvM = ((result.npv10 as number) / 1e6).toFixed(1);
        if (wasActive) {
          toast.info(`Removed ${name} — portfolio NPV reduced by $${npvM}M`);
        } else {
          toast.info(`Added ${name} — portfolio NPV increased by $${npvM}M`);
        }
      }
    },
    [portfolioSelection, projectResults, toggleProject],
  );

  if (!portfolioResult) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-text-muted">Calculating portfolio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Portfolio Dashboard</h2>

      {/* PANEL 1 — KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KpiCard
          label="Portfolio NPV₁₀"
          value={fmtM(portfolioResult.totalNpv as number)}
          unit="$M"
          className="border-l-2 border-l-petrol"
        />
        <KpiCard
          label="Active Projects"
          value={portfolioSelection.size.toString()}
          unit={`of ${projects.length}`}
        />
        <KpiCard
          label="Total CAPEX"
          value={fmtM(portfolioResult.totalCapex as number)}
          unit="$M"
        />
        <KpiCard
          label="Wtd Avg IRR"
          value={fmtPct(weightedIrr)}
          className={weightedIrr >= 0.10 ? 'border-l-2 border-l-success' : 'border-l-2 border-l-danger'}
        />
        <KpiCard
          label="Portfolio Govt Take"
          value={totalGovtTake.toFixed(1) + '%'}
        />
      </div>

      {/* PANELS 2 & 3 — Bubble + Toggle List */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            NPV vs CAPEX (Bubble = Production Scale)
          </h4>
          {bubbleData.length > 0 ? (
            <NpvBubbleChart projects={bubbleData} />
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-text-muted">
              No active projects
            </div>
          )}
        </div>

        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Project Inclusion
          </h4>
          <div className="space-y-2">
            {projects.map((p) => {
              const isActive = portfolioSelection.has(p.project.id);
              const result = projectResults.get(p.project.id);
              const npv = result ? (result.npv10 as number) / 1e6 : 0;

              return (
                <div
                  key={p.project.id}
                  className={cn(
                    'flex items-center gap-3 p-2 border border-border/50 transition-opacity',
                    !isActive && 'opacity-40',
                  )}
                >
                  <Switch
                    checked={isActive}
                    onCheckedChange={() => handleToggle(p.project.id, p.project.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">
                      {p.project.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[8px] py-0 px-1">
                        {p.fiscalRegimeConfig.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className={cn(
                    'text-xs font-data font-medium',
                    npv >= 0 ? 'text-success' : 'text-danger',
                  )}>
                    ${npv.toFixed(0)}M
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PANEL 4 — Hierarchy */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Portfolio by Hierarchy
        </h4>
        <HierarchyBar aggregation={portfolioResult.hierarchyAggregation} />
      </div>

      {/* PANELS 5 & 6 — Production + CAPEX */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Portfolio Production Forecast
          </h4>
          <PortfolioProductionChart
            projects={projects}
            activeIds={portfolioSelection}
          />
        </div>

        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            CAPEX Timeline
          </h4>
          <CapexTimelineChart
            projects={projects}
            activeIds={portfolioSelection}
          />
        </div>
      </div>
    </div>
  );
}
