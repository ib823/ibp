import { useMemo } from 'react';
import { Link } from 'react-router';
import { useProjectStore } from '@/store/project-store';
import { KpiCard } from '@/components/shared/KpiCard';
import { PortfolioProductionChart } from '@/components/charts/PortfolioProductionChart';
import { CapexTimelineChart } from '@/components/charts/CapexTimelineChart';
import { Badge } from '@/components/ui/badge';
import { fmtM, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  Calculator,
  BarChart3,
  PieChart,
  FileText,
  ArrowRight,
} from 'lucide-react';
import type { EconomicsResult } from '@/engine/types';

export default function DashboardPage() {
  const projects = useProjectStore((s) => s.projects);
  const economicsResults = useProjectStore((s) => s.economicsResults);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const portfolioResult = useProjectStore((s) => s.portfolioResult);
  const portfolioSelection = useProjectStore((s) => s.portfolioSelection);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Executive Dashboard</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Portfolio overview — {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)} case scenario
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Portfolio NPV₁₀"
          value={fmtM(portfolioNpv)}
          unit="$M"
          className="border-l-2 border-l-petrol"
        />
        <KpiCard
          label="Total CAPEX"
          value={fmtM(totalCapex)}
          unit="$M"
        />
        <KpiCard
          label="Weighted IRR"
          value={fmtPct(weightedIrr)}
          className={weightedIrr >= 0.10 ? 'border-l-2 border-l-success' : 'border-l-2 border-l-danger'}
        />
        <KpiCard
          label="Active Projects"
          value={totalProjects.toString()}
          unit={`of ${projects.length}`}
        />
      </div>

      {/* Project summary table */}
      <div className="border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Project Summary
          </h4>
          <Link to="/economics" className="text-[11px] text-petrol hover:underline flex items-center gap-1">
            View details <ArrowRight size={12} />
          </Link>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5">Project</th>
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Regime</th>
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Status</th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">NPV ($M)</th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">IRR</th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">CAPEX ($M)</th>
              <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Payback</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const r = projectResults.get(p.project.id);
              if (!r) return null;
              const npv = (r.npv10 as number) / 1e6;
              return (
                <tr key={p.project.id} className="border-b border-border/30 hover:bg-content-alt/50">
                  <td className="px-3 py-2 font-medium text-text-primary">{p.project.name}</td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className="text-[8px] py-0 px-1">
                      {p.project.businessSector === 'CCS' ? 'CCS' : p.fiscalRegimeConfig.type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className={cn(
                      'text-[8px] py-0 px-1',
                      p.project.status === 'producing' && 'bg-success/10 text-success border-success/30',
                      p.project.status === 'active' && 'bg-petrol/10 text-petrol border-petrol/30',
                      p.project.status === 'pre-fid' && 'bg-amber/10 text-amber border-amber/30',
                    )}>
                      {p.project.status}
                    </Badge>
                  </td>
                  <td className={cn('px-2 py-2 text-right font-data font-medium', npv >= 0 ? 'text-success' : 'text-danger')}>
                    {npv.toFixed(1)}
                  </td>
                  <td className="px-2 py-2 text-right font-data">{fmtPct(r.isNonInvestmentPattern ? r.mirr : (r.irr ?? 0))}</td>
                  <td className="px-2 py-2 text-right font-data">{fmtM(r.totalCapex as number)}</td>
                  <td className="px-2 py-2 text-right font-data">{r.paybackYears.toFixed(1)} yr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Portfolio Production Forecast
          </h4>
          <PortfolioProductionChart projects={projects} activeIds={portfolioSelection} />
        </div>
        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            CAPEX Timeline
          </h4>
          <CapexTimelineChart projects={projects} activeIds={portfolioSelection} />
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { to: '/economics', label: 'Economics', desc: 'Project-level cashflows', icon: Calculator },
          { to: '/sensitivity', label: 'Sensitivity', desc: 'Tornado & scenarios', icon: BarChart3 },
          { to: '/portfolio', label: 'Portfolio', desc: 'Aggregation & toggles', icon: PieChart },
          { to: '/financial', label: 'Financial', desc: 'P&L, Balance Sheet, Cash Flow', icon: FileText },
        ].map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="border border-border bg-white p-3 hover:border-petrol/50 transition-colors group"
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
