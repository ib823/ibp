// ════════════════════════════════════════════════════════════════════════
// M&A — Acquisition DCF page (D6)
//
// RFP §5 names "Merger & Acquisition" explicitly. This page demonstrates
// the acquisition-DCF engine with editable target / synergy / premium
// inputs and a visible accretion-dilution result.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { evaluateAcquisition } from '@/engine/financial/ma';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { fmtPct, fmtNum } from '@/lib/format';
import { KpiCard } from '@/components/shared/KpiCard';
import { ChartShell } from '@/components/charts/ChartShell';
import { CHART_NEG, CHART_POS, COLORS } from '@/lib/chart-colors';

export default function MAPage() {
  usePageTitle('M&A — Acquisition Evaluation');
  const u = useDisplayUnits();

  // Default sample: a notional Sarawak shallow-water acquisition target
  // with 10-year cash flow, modest synergies, 30% control premium.
  const [targetWacc, setTargetWacc] = useState(0.09);
  const [acquirerWacc, setAcquirerWacc] = useState(0.10);
  const [controlPremium, setControlPremium] = useState(0.30);
  const [targetAnnualCf, setTargetAnnualCf] = useState(150);  // M USD
  const [synergyAnnual, setSynergyAnnual] = useState(20);     // M USD
  const [integrationCost, setIntegrationCost] = useState(50); // M USD year 1
  const [horizonYears, setHorizonYears] = useState(10);

  const result = useMemo(() => {
    const targetCashflows: number[] = Array(horizonYears).fill(targetAnnualCf * 1e6);
    const revenueSynergies: number[] = Array(horizonYears).fill(0);
    const costSynergies: number[] = Array(horizonYears).fill(synergyAnnual * 1e6);
    const integrationCosts: number[] = [integrationCost * 1e6, ...Array(horizonYears - 1).fill(0)];
    const acquirerCashflows: number[] = Array(horizonYears).fill(targetAnnualCf * 2 * 1e6);

    return evaluateAcquisition({
      targetCashflows,
      targetWacc,
      revenueSynergies,
      costSynergies,
      integrationCosts,
      acquirerWacc,
      controlPremiumPct: controlPremium,
      acquirerCashflows,
    });
  }, [targetWacc, acquirerWacc, controlPremium, targetAnnualCf, synergyAnnual, integrationCost, horizonYears]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-primary">M&A — Acquisition DCF</h1>
        <p className="text-caption text-text-muted">
          Evaluate an acquisition target. Standalone equity value + synergies − control premium = deal NPV
          to acquirer. Per RFP §5; engine module: <code className="text-xs">engine/financial/ma.ts</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border bg-white p-4 space-y-3">
          <h2 className="text-body font-semibold text-text-primary">Inputs</h2>

          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Target standalone NCF (USD M / yr):</span>
            <input
              type="number"
              value={targetAnnualCf}
              onChange={(e) => setTargetAnnualCf(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Target WACC:</span>
            <input
              type="number" step="0.01" value={targetWacc}
              onChange={(e) => setTargetWacc(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Acquirer WACC:</span>
            <input
              type="number" step="0.01" value={acquirerWacc}
              onChange={(e) => setAcquirerWacc(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Control premium:</span>
            <input
              type="number" step="0.05" value={controlPremium}
              onChange={(e) => setControlPremium(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Annual cost synergies (USD M):</span>
            <input
              type="number" value={synergyAnnual}
              onChange={(e) => setSynergyAnnual(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Integration cost yr 1 (USD M):</span>
            <input
              type="number" value={integrationCost}
              onChange={(e) => setIntegrationCost(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Horizon (years):</span>
            <input
              type="number" value={horizonYears}
              onChange={(e) => setHorizonYears(parseInt(e.target.value) || 1)}
              className="w-24 px-2 py-1 border border-border text-body text-right tabular-nums"
            />
          </label>
        </div>

        <div className="border border-border bg-white p-4 space-y-3">
          <h2 className="text-body font-semibold text-text-primary">Result</h2>
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Target equity value" value={u.money(result.targetStandaloneEquityValue as number, { accounting: true })} />
            <KpiCard label="Synergies value" value={u.money(result.synergiesValue as number, { accounting: true })} />
            <KpiCard label="Control premium" value={u.money(result.controlPremium as number, { accounting: true })} />
            <KpiCard label="Acquisition price" value={u.money(result.acquisitionPrice as number, { accounting: true })} />
            <KpiCard label="Deal NPV to acquirer" value={u.money(result.dealNpvToAcquirer as number, { accounting: true })} />
            <KpiCard label="Deal IRR" value={result.dealIrr === null ? 'n/a' : fmtPct(result.dealIrr, 1)} />
            <KpiCard label="Accretion / dilution" value={fmtPct(result.accretionDilutionPct, 2)} />
          </div>
          <p className="text-caption text-text-muted mt-2">
            Positive accretion (PA &gt; 0) = deal accretive to acquirer; negative = dilutive. Rule of thumb: accretive deals at high acquirer WACC are rare without genuine synergies. POC sample: target &amp; acquirer cash flows are flat-line constants for clarity.
          </p>
          <p className="text-caption text-text-muted">
            Iterations for sensitivity analysis: vary control premium and synergy magnitude to find the breakeven price (deal NPV = 0).
          </p>
        </div>
      </div>

      {/* Deal value bridge — components of acquisition price + deal NPV */}
      <div className="border border-border bg-white p-4">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Acquisition value bridge
          <span className="text-caption text-text-muted ml-2">(USD M)</span>
        </h3>
        <ChartShell height={240}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={[
                { name: 'Target equity', value: (result.targetStandaloneEquityValue as number) / 1e6, kind: 'pos' },
                { name: 'Synergies', value: (result.synergiesValue as number) / 1e6, kind: 'pos' },
                { name: 'Control premium', value: -(result.controlPremium as number) / 1e6, kind: 'neg' },
                { name: 'Deal NPV (acq.)', value: (result.dealNpvToAcquirer as number) / 1e6, kind: (result.dealNpvToAcquirer as number) >= 0 ? 'pos' : 'neg' },
              ]}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, 'Value']} contentStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke={COLORS.textSecondary} />
              <Bar dataKey="value">
                {(['pos', 'pos', 'neg', 'pos'] as const).map((kind, idx) => (
                  <Cell key={idx} fill={kind === 'pos' ? CHART_POS : CHART_NEG} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* Cashflow comparison — target vs synergies trajectory */}
      <div className="border border-border bg-white p-4">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Cashflow trajectory: target vs net synergies
        </h3>
        <ChartShell height={240}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={Array.from({ length: horizonYears }, (_, i) => ({
                year: `Y${i + 1}`,
                target: targetAnnualCf,
                netSynergies: synergyAnnual - (i === 0 ? integrationCost : 0),
              }))}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(1)}M`, '']} contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="target" stroke={COLORS.petrol} strokeWidth={2} name="Target NCF" dot={false} />
              <Line type="monotone" dataKey="netSynergies" stroke={CHART_POS} strokeWidth={2} name="Net synergies (after integration cost)" dot={false} />
              <ReferenceLine y={0} stroke={COLORS.textSecondary} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="text-caption text-text-muted">
        <strong>Phase 1b SAC delivery:</strong> SAC Multi-Action <code>MA_AcquisitionDCF</code> with
        target-cashflow upload + scenario layering. Engine basis: <code>engine/financial/ma.ts</code>.
      </div>
      <div className="text-xs text-text-muted">
        Horizon: {fmtNum(horizonYears)} years.
      </div>
    </div>
  );
}
