// ════════════════════════════════════════════════════════════════════════
// Project Finance — Debt Service Waterfall page (D6)
//
// RFP §5 names "Project Finance" explicitly. This page demonstrates the
// debt-service-waterfall engine with DSCR / LLCR / cash-sweep.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { buildDebtServiceSchedule } from '@/engine/financial/project-finance';
import { useProjectStore, getActiveResult } from '@/store/project-store';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { fmtNum } from '@/lib/format';
import { KpiCard } from '@/components/shared/KpiCard';
import { Select } from '@/components/ui5/Ui5Select';

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

      <div className="text-caption text-text-muted">
        <strong>Phase 1b SAC delivery:</strong> Multi-Action <code>DA_ProjectFinance_Waterfall</code>
        with full lender-perspective sensitivity (interest-rate shock, default scenario, refinancing).
      </div>
    </div>
  );
}
