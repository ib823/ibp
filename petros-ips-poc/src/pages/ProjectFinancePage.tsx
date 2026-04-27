// ════════════════════════════════════════════════════════════════════════
// Project Finance — Debt Service Waterfall page (D6)
//
// RFP §5 names "Project Finance" explicitly. This page demonstrates the
// debt-service-waterfall engine with DSCR / LLCR / cash-sweep.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import {
  ComposedChart, AreaChart, Bar, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { buildDebtServiceSchedule } from '@/engine/financial/project-finance';
import { useProjectStore, getActiveResult } from '@/store/project-store';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { fmtNum } from '@/lib/format';
import { KpiCard } from '@/components/shared/KpiCard';
import { Select } from '@/components/ui5/Ui5Select';
import { ChartShell } from '@/components/charts/ChartShell';
import { COLORS, CHART_POS } from '@/lib/chart-colors';

export default function ProjectFinancePage() {
  usePageTitle('Project Finance');
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const result = useProjectStore((s) => getActiveResult(s));
  const u = useDisplayUnits();

  const [debtFraction, setDebtFraction] = useState(0.65);
  const [interestRate, setInterestRate] = useState(0.07);
  const [tenorYears, setTenorYears] = useState(10);
  const [taxRate, setTaxRate] = useState(0.38);
  const [cashSweepThreshold, setCashSweepThreshold] = useState(1.30);

  const pf = useMemo(() => {
    if (!result) return null;
    // Build CFADS series — operating CF before debt service, derived from
    // project NCF + (CAPEX added back, since NCF already netted it out).
    const cfads = result.yearlyCashflows.map((cf) => {
      // CFADS = NCF + tax (we want pre-finance, post-tax) ≈ NCF (POC simplification).
      // For real PF, CFADS = revenue − OPEX − cash tax.
      return cf.netCashFlow as number;
    });
    return buildDebtServiceSchedule({
      cfads,
      totalCapex: result.totalCapex as number,
      debtFraction,
      interestRate,
      tenorYears,
      taxRate,
      constructionYears: 1,
      cashSweepThreshold,
    });
  }, [result, debtFraction, interestRate, tenorYears, taxRate, cashSweepThreshold]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-text-primary">Project Finance</h1>
          <p className="text-caption text-text-muted">
            Debt-service waterfall with DSCR / LLCR / cash-sweep. Engine: <code className="text-xs">engine/financial/project-finance.ts</code>.
          </p>
        </div>
        <Select
          value={activeProjectId ?? ''}
          onValueChange={(v) => setActiveProject(v)}
          options={projects.map((p) => ({ value: p.project.id, label: p.project.name }))}
          placeholder="Select project..."
          className="w-full sm:w-[220px]"
          aria-label="Select project"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4 space-y-3">
          <h2 className="text-body font-semibold text-text-primary">Capital structure</h2>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Debt fraction (gearing):</span>
            <input type="number" step="0.05" min="0" max="0.9" value={debtFraction}
              onChange={(e) => setDebtFraction(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Interest rate:</span>
            <input type="number" step="0.005" value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Tenor (years):</span>
            <input type="number" value={tenorYears}
              onChange={(e) => setTenorYears(parseInt(e.target.value) || 1)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Cash-sweep DSCR threshold:</span>
            <input type="number" step="0.05" value={cashSweepThreshold}
              onChange={(e) => setCashSweepThreshold(parseFloat(e.target.value) || 1)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Tax rate (for shield):</span>
            <input type="number" step="0.01" value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
        </div>

        <div className="border border-border bg-white p-4 space-y-3">
          <h2 className="text-body font-semibold text-text-primary">Coverage ratios</h2>
          {!pf && <p className="text-body text-text-muted">Select a project to see results.</p>}
          {pf && (
            <div className="grid grid-cols-2 gap-2">
              <KpiCard label="Total debt" value={u.money(pf.totalDebt as number, { accounting: true })} />
              <KpiCard label="Total equity" value={u.money(pf.totalEquity as number, { accounting: true })} />
              <KpiCard label="Min DSCR" value={pf.minDscr.toFixed(2)} className={pf.minDscr < 1.20 ? 'border-l-2 border-l-danger' : 'border-l-2 border-l-success'} />
              <KpiCard label="Avg DSCR" value={pf.avgDscr.toFixed(2)} />
              <KpiCard label="LLCR" value={pf.llcr.toFixed(2)} className={pf.llcr < 1.30 ? 'border-l-2 border-l-amber' : 'border-l-2 border-l-success'} />
              <KpiCard label="PLCR" value={pf.plcr.toFixed(2)} />
              <KpiCard label="Tax shield NPV" value={u.money(pf.taxShieldNpv as number, { accounting: true })} />
            </div>
          )}
        </div>
      </div>

      {pf && (
        <div className="border border-border bg-white p-4">
          <h2 className="text-body font-semibold text-text-primary mb-2">
            Debt service schedule ({fmtNum(pf.schedule.length)} years)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-2 py-1 text-left">Year</th>
                  <th className="px-2 py-1 text-right">Opening</th>
                  <th className="px-2 py-1 text-right">Drawdown</th>
                  <th className="px-2 py-1 text-right">Interest</th>
                  <th className="px-2 py-1 text-right">Principal</th>
                  <th className="px-2 py-1 text-right">Cash sweep</th>
                  <th className="px-2 py-1 text-right">Closing</th>
                  <th className="px-2 py-1 text-right">CFADS</th>
                  <th className="px-2 py-1 text-right">DSCR</th>
                </tr>
              </thead>
              <tbody>
                {pf.schedule.map((y) => (
                  <tr key={y.year} className="border-t border-border/30">
                    <td className="px-2 py-1">Y{y.year}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.opening as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.drawdown as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.interest as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.scheduledPrincipal as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.cashSweep as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.closing as number, { accounting: true })}</td>
                    <td className="px-2 py-1 text-right">{u.money(y.cfads as number, { accounting: true })}</td>
                    <td className={`px-2 py-1 text-right ${y.dscr < 1.20 ? 'text-danger' : ''}`}>{y.dscr.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-caption text-text-muted mt-2">
            Industry DSCR target ≥ 1.20 for upstream; LLCR target ≥ 1.30. Cells flagged red when below threshold.
          </p>
        </div>
      )}

      {/* DSCR over time + debt outstanding */}
      {pf && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border bg-white p-4">
            <h3 className="text-body font-semibold text-text-primary mb-2">
              DSCR trajectory
              <span className="text-caption text-text-muted ml-2">target ≥ 1.20</span>
            </h3>
            <ChartShell height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={pf.schedule.map((y) => ({
                    year: `Y${y.year}`,
                    dscr: Math.min(y.dscr, 5), // cap visible at 5 to keep chart readable
                  }))}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => v.toFixed(2)} domain={[0, 'auto']} />
                  <Tooltip formatter={(v: number) => [v.toFixed(2), 'DSCR']} contentStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={1.20} stroke={COLORS.danger} strokeDasharray="4,3" label={{ value: 'Target 1.20', fontSize: 10, fill: COLORS.danger }} />
                  <ReferenceLine y={1.30} stroke={COLORS.amber} strokeDasharray="4,3" label={{ value: 'Sweep 1.30', fontSize: 10, fill: COLORS.amber }} />
                  <Bar dataKey="dscr" fill={CHART_POS} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>

          <div className="border border-border bg-white p-4">
            <h3 className="text-body font-semibold text-text-primary mb-2">
              Debt outstanding (USD M)
            </h3>
            <ChartShell height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={pf.schedule.map((y) => ({
                    year: `Y${y.year}`,
                    closing: (y.closing as number) / 1e6,
                  }))}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Closing balance']} contentStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="closing" stroke={COLORS.danger} fill={COLORS.danger} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartShell>
          </div>
        </div>
      )}

      {/* CFADS allocation waterfall */}
      {pf && (
        <div className="border border-border bg-white p-4">
          <h3 className="text-body font-semibold text-text-primary mb-2">
            Annual CFADS allocation: Interest · Principal · Cash sweep · Equity (post-debt-service)
          </h3>
          <ChartShell height={260}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                data={pf.schedule.map((y) => ({
                  year: `Y${y.year}`,
                  interest: (y.interest as number) / 1e6,
                  principal: (y.scheduledPrincipal as number) / 1e6,
                  sweep: (y.cashSweep as number) / 1e6,
                  equity: Math.max(0, (y.cfadsAfterDebtService as number) / 1e6),
                }))}
                margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, '']} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="interest" stackId="a" fill={COLORS.danger} name="Interest" />
                <Bar dataKey="principal" stackId="a" fill={COLORS.amber} name="Principal" />
                <Bar dataKey="sweep" stackId="a" fill={COLORS.petrol} name="Cash sweep" />
                <Bar dataKey="equity" stackId="a" fill={CHART_POS} name="Available to equity" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartShell>
        </div>
      )}

      <div className="text-caption text-text-muted">
        <strong>Phase 1b SAC delivery:</strong> Multi-Action <code>DA_ProjectFinance_Waterfall</code>
        with full lender-perspective sensitivity (interest-rate shock, default scenario, refinancing).
      </div>
    </div>
  );
}
