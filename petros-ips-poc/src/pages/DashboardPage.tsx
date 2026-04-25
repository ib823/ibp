import { useMemo } from 'react';
import { Link } from 'react-router';
import { useProjectStore, useEffectiveProjects } from '@/store/project-store';
import { usePageTitle } from '@/hooks/usePageTitle';
import { KpiCard } from '@/components/shared/KpiCard';
import { PortfolioProductionChart } from '@/components/charts/PortfolioProductionChart';
import { CapexTimelineChart } from '@/components/charts/CapexTimelineChart';
import { Badge } from '@/components/ui5/Ui5Badge';
import { Pill } from '@/components/shared/Pill';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { fmtPct } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import { getPageEntries } from '@/lib/educational-content';
import {
  Calculator,
  BarChart3,
  PieChart,
  FileText,
  ArrowRight,
} from 'lucide-react';
import type { EconomicsResult } from '@/engine/types';

const edu = getPageEntries('dashboard');

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const projects = useProjectStore((s) => s.projects);
  const economicsResults = useProjectStore((s) => s.economicsResults);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const portfolioResult = useProjectStore((s) => s.portfolioResult);
  const portfolioSelection = useProjectStore((s) => s.portfolioSelection);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const projectResults = useMemo(() => {
    const map = new Map<string, EconomicsResult>();
    for (const [id, scenarioMap] of economicsResults) {
      const result = scenarioMap.get(activeScenario);
      if (result) map.set(id, result);
    }
    return map;
  }, [economicsResults, activeScenario]);

  const { totalCapex, weightedIrr, totalProjects } = useMemo(() => {
    let capexSum = 0;
    let irrWeighted = 0;
    let capexWeightTotal = 0;
    let count = 0;
    for (const [id, r] of projectResults) {
      if (!portfolioSelection.has(id)) continue;
      count++;
      capexSum += r.totalCapex as number;
      irrWeighted += (r.irr ?? r.mirr) * (r.totalCapex as number);
      capexWeightTotal += r.totalCapex as number;
    }
    return {
      totalCapex: capexSum,
      weightedIrr: capexWeightTotal > 0 ? irrWeighted / capexWeightTotal : 0,
      totalProjects: count,
    };
  }, [projectResults, portfolioSelection]);

  const portfolioNpv = portfolioResult ? (portfolioResult.totalNpv as number) : 0;
  const u = useDisplayUnits();
  // Charts below read productionProfile / costProfile directly — feed them
  // override-merged projects so what-if edits propagate to the dashboard.
  const effectiveProjects = useEffectiveProjects();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Executive Dashboard</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Portfolio overview — {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)} case scenario
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" data-tour="dashboard-kpis">
        <KpiCard
          label="Portfolio NPV₁₀"
          value={u.money(portfolioNpv, { accounting: true })}
          className="border-l-2 border-l-petrol"
          eduEntry={edu['D-01']}
        />
        <KpiCard
          label="Total CAPEX"
          value={u.money(totalCapex, { accounting: true })}
          eduEntry={edu['D-02']}
        />
        <KpiCard
          label="Weighted IRR"
          value={fmtPct(weightedIrr)}
          className={weightedIrr >= 0.10 ? 'border-l-2 border-l-success' : 'border-l-2 border-l-danger'}
          eduEntry={edu['D-03']}
        />
        <KpiCard
          label="Active Projects"
          value={`${totalProjects}/${projects.length}`}
          eduEntry={edu['D-04']}
        />
      </div>

      {/* Project summary table */}
      <div className="border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Project Summary
          </h4>
          <Link to="/economics" className="text-xs text-petrol hover:underline flex items-center gap-1">
            View details <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-collapse text-xs min-w-[640px] tabular-nums">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5 sticky left-0 bg-content-alt z-20 shadow-[2px_0_0_0_rgb(226,229,234)]">
                <EduTooltip entryId="D-07"><span className="cursor-help">Project</span></EduTooltip>
              </th>
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
                <EduTooltip entryId="D-08"><span className="cursor-help">Regime</span></EduTooltip>
              </th>
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Status</th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
                <EduTooltip entryId="D-10"><span className="cursor-help">NPV ({u.currencySymbol}M)</span></EduTooltip>
              </th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
                <EduTooltip entryId="D-11"><span className="cursor-help">IRR</span></EduTooltip>
              </th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
                <EduTooltip entryId="D-12"><span className="cursor-help">CAPEX ({u.currencySymbol}M)</span></EduTooltip>
              </th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
                <EduTooltip entryId="D-13"><span className="cursor-help">Payback</span></EduTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const r = projectResults.get(p.project.id);
              if (!r) return null;
              const npvRaw = r.npv10 as number;
              const regimeLabel = p.fiscalRegimeConfig.type === 'DOWNSTREAM'
                ? (p.project.businessSector === 'CCS' ? 'CCS/DS' : 'DOWNSTREAM')
                : p.fiscalRegimeConfig.type.replace('_', ' ');
              const regimeTooltipId = p.project.businessSector === 'CCS' ? 'D-18'
                : p.fiscalRegimeConfig.type === 'PSC_RC' ? 'D-14'
                : p.fiscalRegimeConfig.type === 'PSC_DW' ? 'D-15'
                : p.fiscalRegimeConfig.type === 'PSC_EPT' ? 'D-16'
                : p.fiscalRegimeConfig.type === 'PSC_SFA' ? 'D-17'
                : undefined;
              const statusTooltipId = p.project.status === 'active' ? 'D-09a'
                : p.project.status === 'pre-fid' ? 'D-09b'
                : p.project.status === 'producing' ? 'D-09c'
                : undefined;
              return (
                <tr key={p.project.id} className="group border-b border-border/30 hover:bg-content-alt/50">
                  <td className="px-3 py-2 font-medium text-text-primary sticky left-0 bg-white group-hover:bg-content-alt/50 z-20 shadow-[2px_0_0_0_rgb(226,229,234)]">
                    <Link
                      to="/economics"
                      onClick={() => setActiveProject(p.project.id)}
                      className="hover:text-petrol hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol"
                      title={`Open ${p.project.name} in Economics`}
                    >
                      {p.project.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <EduTooltip entryId={regimeTooltipId}>
                      <Badge variant="outline" className="text-[10px] py-0 px-1 cursor-help">
                        {regimeLabel}
                      </Badge>
                    </EduTooltip>
                  </td>
                  <td className="px-2 py-2">
                    <EduTooltip entryId={statusTooltipId}>
                      <span className="cursor-help inline-block">
                        <Pill
                          tone={
                            p.project.status === 'producing' ? 'success'
                            : p.project.status === 'active' ? 'petrol'
                            : p.project.status === 'pre-fid' ? 'amber'
                            : 'neutral'
                          }
                          size="sm"
                        >
                          {p.project.status}
                        </Pill>
                      </span>
                    </EduTooltip>
                  </td>
                  <td className={cn('px-2 py-2 text-right font-data font-medium', npvRaw >= 0 ? 'text-success' : 'text-danger')}>
                    {u.money(npvRaw, { accounting: true })}
                  </td>
                  <td className="px-2 py-2 text-right font-data">{fmtPct(r.isNonInvestmentPattern ? r.mirr : (r.irr ?? 0))}</td>
                  <td className="px-2 py-2 text-right font-data">{u.money(r.totalCapex as number, { accounting: true })}</td>
                  <td className="px-2 py-2 text-right font-data">{r.paybackYears.toFixed(1)} yr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Portfolio Production Forecast
          </h4>
          <SectionHelp entry={edu['D-22']!} />
          <div className="min-h-[280px] sm:min-h-[320px]">
            <PortfolioProductionChart projects={effectiveProjects} activeIds={portfolioSelection} />
          </div>
        </div>
        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            CAPEX Timeline
          </h4>
          <SectionHelp entry={edu['D-23']!} />
          <div className="min-h-[280px] sm:min-h-[320px]">
            <CapexTimelineChart projects={effectiveProjects} activeIds={portfolioSelection} />
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { to: '/economics', label: 'Economics', desc: 'Project-level cashflows', icon: Calculator },
          { to: '/sensitivity', label: 'Sensitivity', desc: 'Tornado & scenarios', icon: BarChart3 },
          { to: '/portfolio', label: 'Portfolio', desc: 'Aggregation & toggles', icon: PieChart },
          { to: '/financial', label: 'Financial', desc: 'P&L, Balance Sheet, Cash Flow', icon: FileText },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="focus-ring border border-border bg-white p-3 hover:border-petrol/50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <link.icon size={14} className="text-petrol" />
              <span className="text-xs font-semibold text-text-primary group-hover:text-petrol">{link.label}</span>
            </div>
            <p className="text-[10px] text-text-muted">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
