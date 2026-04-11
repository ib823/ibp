import { useMemo, useCallback } from 'react';
import { useProjectStore, useEffectiveProjects } from '@/store/project-store';
import { usePageTitle } from '@/hooks/usePageTitle';
import { KpiCard } from '@/components/shared/KpiCard';
import { NpvBubbleChart } from '@/components/charts/NpvBubbleChart';
import { PortfolioProductionChart } from '@/components/charts/PortfolioProductionChart';
import { CapexTimelineChart } from '@/components/charts/CapexTimelineChart';
import { HierarchyBar } from '@/components/charts/HierarchyBar';
import { Switch } from '@ui5/webcomponents-react';
import { Badge } from '@/components/ui5/Ui5Badge';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { toast } from '@/lib/toast';
import { fmtPct } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import { getPageEntries } from '@/lib/educational-content';
import type { EconomicsResult } from '@/engine/types';

const edu = getPageEntries('portfolio');

export default function PortfolioPage() {
  usePageTitle('Portfolio');
  const projects = useProjectStore((s) => s.projects);
  const portfolioSelection = useProjectStore((s) => s.portfolioSelection);
  const toggleProject = useProjectStore((s) => s.toggleProjectInPortfolio);
  const portfolioResult = useProjectStore((s) => s.portfolioResult);
  const economicsResults = useProjectStore((s) => s.economicsResults);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const u = useDisplayUnits();
  // PortfolioProductionChart + CapexTimelineChart read profiles directly
  // from project objects, so they need override-merged values.
  const effectiveProjects = useEffectiveProjects();

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
        const formatted = u.money(result.npv10 as number);
        if (wasActive) {
          toast.info(`Removed ${name} — portfolio NPV Δ ${formatted}`);
        } else {
          toast.info(`Added ${name} — portfolio NPV Δ ${formatted}`);
        }
      }
    },
    [portfolioSelection, projectResults, toggleProject, u],
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
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Portfolio NPV₁₀"
          value={u.money(portfolioResult.totalNpv as number, { accounting: true })}
          className="border-l-2 border-l-petrol"
          eduEntry={edu['P-01']}
        />
        <KpiCard
          label="Active Projects"
          value={portfolioSelection.size.toString()}
          unit={`of ${projects.length}`}
          eduEntry={edu['P-02']}
        />
        <KpiCard
          label="Total CAPEX"
          value={u.money(portfolioResult.totalCapex as number, { accounting: true })}
          eduEntry={edu['P-03']}
        />
        <KpiCard
          label="Wtd Avg IRR"
          value={fmtPct(weightedIrr)}
          className={weightedIrr >= 0.10 ? 'border-l-2 border-l-success' : 'border-l-2 border-l-danger'}
          eduEntry={edu['P-04']}
        />
        <KpiCard
          label="Portfolio Govt Take"
          value={totalGovtTake.toFixed(1) + '%'}
          eduEntry={edu['P-05']}
        />
      </div>

      {/* PANELS 2 & 3 — Bubble + Toggle List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
            NPV vs CAPEX (Bubble = Production Scale)
          </h4>
          <SectionHelp entry={edu['P-06']!} />
          <div className="min-h-[300px]">
            {bubbleData.length > 0 ? (
              <NpvBubbleChart projects={bubbleData} />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-text-muted">
                No active projects
              </div>
            )}
          </div>
        </div>

        <div className="border border-border bg-white p-4" data-tour="portfolio-toggles">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Project Inclusion
          </h4>
          <SectionHelp entry={edu['P-07']!} />
          <div className="space-y-2">
            {projects.map((p) => {
              const isActive = portfolioSelection.has(p.project.id);
              const result = projectResults.get(p.project.id);
              const npvRaw = result ? (result.npv10 as number) : 0;

              return (
                <div
                  key={p.project.id}
                  className={cn(
                    'flex items-center gap-3 p-2 border border-border/50 transition-opacity',
                    !isActive && 'opacity-40',
                  )}
                >
                  <EduTooltip entryId="P-08">
                    <div className="min-h-[44px] flex items-center">
                      <Switch
                        checked={isActive}
                        onChange={() => handleToggle(p.project.id, p.project.name)}
                        design="Graphical"
                        accessibleName={`Toggle ${p.project.name} inclusion`}
                      />
                    </div>
                  </EduTooltip>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate" title={p.project.name}>
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
                    npvRaw >= 0 ? 'text-success' : 'text-danger',
                  )}>
                    {u.money(npvRaw, { accounting: true })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PANEL 4 — Hierarchy */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
          Portfolio by Hierarchy
        </h4>
        <SectionHelp entry={edu['P-09']!} />
        <HierarchyBar aggregation={portfolioResult.hierarchyAggregation} />
      </div>

      {/* PANELS 5 & 6 — Production + CAPEX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Portfolio Production Forecast
          </h4>
          <SectionHelp entry={edu['P-10']!} />
          <div className="min-h-[280px]">
            <PortfolioProductionChart
              projects={effectiveProjects}
              activeIds={portfolioSelection}
            />
          </div>
        </div>

        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            CAPEX Timeline
          </h4>
          <SectionHelp entry={edu['P-11']!} />
          <div className="min-h-[280px]">
            <CapexTimelineChart
              projects={effectiveProjects}
              activeIds={portfolioSelection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
