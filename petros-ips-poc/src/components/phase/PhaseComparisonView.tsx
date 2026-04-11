import { useState, useMemo, useCallback } from 'react';
import { Select } from '@/components/ui5/Ui5Select';
import { Button } from '@/components/ui5/Ui5Button';
import { useProjectStore } from '@/store/project-store';
import { fmtPct, fmtYears } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { GitBranch, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type {
  PhaseComparisonResult,
  PhaseVersionData,
  ProductionProfile,
  ProjectPhaseVersion,
} from '@/engine/types';

const PHASE_LABEL: Record<ProjectPhaseVersion, string> = {
  pre_fid: 'Pre-FID',
  post_fid: 'Post-FID',
  development: 'Development',
  production: 'Production',
  late_life: 'Late Life',
  decommissioning: 'Decommissioning',
};

export function PhaseComparisonView() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  // key forces a full remount when the project changes, so the inner
  // component's useState initializers re-derive the default phase pair
  // (replaces a set-state-in-effect reset pattern).
  return <PhaseComparisonViewInner key={activeProjectId ?? 'none'} />;
}

function PhaseComparisonViewInner() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const phaseData = useProjectStore((s) => s.phaseData);
  const phaseComparisonResult = useProjectStore((s) => s.phaseComparisonResult);
  const comparePhases = useProjectStore((s) => s.comparePhases);

  const activeProject = projects.find((p) => p.project.id === activeProjectId);
  const phases = activeProjectId ? phaseData.get(activeProjectId) ?? [] : [];

  const [phase1, setPhase1] = useState<ProjectPhaseVersion | ''>(
    () => (phases.length >= 2 ? phases[0]!.phase : ''),
  );
  const [phase2, setPhase2] = useState<ProjectPhaseVersion | ''>(
    () => (phases.length >= 2 ? phases[1]!.phase : ''),
  );

  const handleCompare = useCallback(() => {
    if (!activeProjectId || !phase1 || !phase2) return;
    comparePhases(activeProjectId, phase1, phase2);
  }, [activeProjectId, phase1, phase2, comparePhases]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-64 border border-border bg-white">
        <p className="text-sm text-text-muted">Select a project to compare phases</p>
      </div>
    );
  }

  if (phases.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-48 border border-border bg-white gap-2 text-center px-4">
        <GitBranch size={24} className="text-text-muted" />
        <p className="text-sm text-text-secondary">
          No phase versions are available for <strong>{activeProject.project.name}</strong>.
        </p>
        <p className="text-xs text-text-muted">
          Phase versions exist only for projects with multiple lifecycle snapshots
          (e.g. SK-612 Deepwater, Tukau Marginal).
        </p>
      </div>
    );
  }

  const p1Data = phases.find((p) => p.phase === phase1);
  const p2Data = phases.find((p) => p.phase === phase2);

  return (
    <div className="space-y-4">
      {/* Phase selector */}
      <div className="border border-border bg-white p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
              Phase 1
            </label>
            <Select
              value={phase1}
              onValueChange={(v) => setPhase1(v as ProjectPhaseVersion)}
              options={phases.map((p) => ({ value: p.phase, label: p.label }))}
              placeholder="Select phase..."
              aria-label="Phase 1"
            />
          </div>
          <div className="flex items-end justify-center pb-2">
            <GitBranch size={18} className="text-petrol" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">
              Phase 2
            </label>
            <Select
              value={phase2}
              onValueChange={(v) => setPhase2(v as ProjectPhaseVersion)}
              options={phases.map((p) => ({ value: p.phase, label: p.label }))}
              placeholder="Select phase..."
              aria-label="Phase 2"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={!phase1 || !phase2 || phase1 === phase2}
            className="bg-petrol hover:bg-petrol-light text-white text-xs h-9 shrink-0"
          >
            Compare Phases
          </Button>
        </div>
      </div>

      {!phaseComparisonResult && (
        <div className="flex items-center justify-center h-32 border border-border bg-white">
          <p className="text-sm text-text-muted">Click "Compare Phases" to run the comparison</p>
        </div>
      )}

      {phaseComparisonResult && p1Data && p2Data && (
        <>
          <AssumptionsCard p1={p1Data} p2={p2Data} result={phaseComparisonResult} />
          <EconomicsKpiTable result={phaseComparisonResult} />
          <ProductionOverlay p1={p1Data} p2={p2Data} />
          <CashFlowOverlay result={phaseComparisonResult} />
          <PhaseTimeline phases={phases} />
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function peakBpd(profile: ProductionProfile): number {
  let peak = 0;
  const years = new Set<number>([
    ...Object.keys(profile.oil).map(Number),
    ...Object.keys(profile.gas).map(Number),
    ...Object.keys(profile.condensate).map(Number),
  ]);
  for (const y of years) {
    const oil = (profile.oil[y] as number) ?? 0;
    const cond = (profile.condensate[y] as number) ?? 0;
    const gas = (profile.gas[y] as number) ?? 0;
    const boe = oil + cond + (gas * 1000) / 6;
    if (boe > peak) peak = boe;
  }
  return Math.round(peak);
}

function firstProductionYear(profile: ProductionProfile): number | null {
  const years = Object.keys(profile.oil).map(Number).sort((a, b) => a - b);
  for (const y of years) {
    if ((profile.oil[y] ?? 0) > 0 || (profile.gas[y] ?? 0) > 0) return y;
  }
  return null;
}

function ChangeIndicator({
  delta,
  unit = '',
  good = 'positive',
  pct,
}: {
  delta: number;
  unit?: string;
  good?: 'positive' | 'negative' | 'neutral';
  pct?: number | null;
}) {
  if (delta === 0) {
    return <span className="text-text-muted text-xs flex items-center gap-1"><Minus size={11} />no change</span>;
  }
  const isPositive = delta > 0;
  const colorClass =
    good === 'neutral'
      ? 'text-text-secondary'
      : (good === 'positive' && isPositive) || (good === 'negative' && !isPositive)
        ? 'text-success'
        : 'text-danger';
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive ? '+' : '';
  return (
    <span className={cn('text-xs flex items-center gap-1 font-medium', colorClass)}>
      <Icon size={11} />
      {sign}
      {delta.toLocaleString('en-US', { maximumFractionDigits: 1 })}
      {unit}
      {pct !== null && pct !== undefined && Number.isFinite(pct) && (
        <span className="text-[10px] opacity-80">({sign}{pct.toFixed(1)}%)</span>
      )}
    </span>
  );
}

function AssumptionsCard({
  p1,
  p2,
  result,
}: {
  p1: PhaseVersionData;
  p2: PhaseVersionData;
  result: PhaseComparisonResult;
}) {
  const u = useDisplayUnits();
  const peak1 = peakBpd(p1.productionProfile);
  const peak2 = peakBpd(p2.productionProfile);
  const reserves1 = p1.reservesMmboe ?? 0;
  const reserves2 = p2.reservesMmboe ?? 0;
  const reservesDelta = reserves2 - reserves1;
  const reservesPct = reserves1 !== 0 ? (reservesDelta / reserves1) * 100 : null;
  const peakDelta = peak2 - peak1;
  const peakPct = peak1 !== 0 ? (peakDelta / peak1) * 100 : null;
  const capex1 = result.economics1.totalCapex as number;
  const capex2 = result.economics2.totalCapex as number;
  const capexDelta = capex2 - capex1;
  const capexPct = capex1 !== 0 ? (capexDelta / capex1) * 100 : null;
  const fpy1 = firstProductionYear(p1.productionProfile);
  const fpy2 = firstProductionYear(p2.productionProfile);

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Assumptions Comparison
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left px-3 py-1.5 font-semibold text-text-secondary">Parameter</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">{p1.label}</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">{p2.label}</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">Reserves (MMboe)</td>
              <td className="text-right px-3 py-2 font-data">{reserves1.toFixed(0)}</td>
              <td className="text-right px-3 py-2 font-data">{reserves2.toFixed(0)}</td>
              <td className="text-right px-3 py-2"><ChangeIndicator delta={reservesDelta} pct={reservesPct} good="positive" /></td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">Peak Production (boe/d)</td>
              <td className="text-right px-3 py-2 font-data">{peak1.toLocaleString()}</td>
              <td className="text-right px-3 py-2 font-data">{peak2.toLocaleString()}</td>
              <td className="text-right px-3 py-2"><ChangeIndicator delta={peakDelta} pct={peakPct} good="positive" /></td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">Total CAPEX</td>
              <td className="text-right px-3 py-2 font-data">{u.money(capex1, { accounting: true })}</td>
              <td className="text-right px-3 py-2 font-data">{u.money(capex2, { accounting: true })}</td>
              <td className="text-right px-3 py-2"><ChangeIndicator delta={capexDelta / 1e6} pct={capexPct} good="negative" unit="M" /></td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-text-secondary">First Production</td>
              <td className="text-right px-3 py-2 font-data">{fpy1 ?? '—'}</td>
              <td className="text-right px-3 py-2 font-data">{fpy2 ?? '—'}</td>
              <td className="text-right px-3 py-2">
                <ChangeIndicator delta={(fpy2 ?? 0) - (fpy1 ?? 0)} unit=" yr" good="negative" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 pt-3 border-t border-border space-y-2 text-[11px] text-text-muted">
        <div>
          <strong className="text-text-secondary">{p1.label}:</strong> {p1.assumptions}
        </div>
        <div>
          <strong className="text-text-secondary">{p2.label}:</strong> {p2.assumptions}
        </div>
      </div>
    </div>
  );
}

function EconomicsKpiTable({ result }: { result: PhaseComparisonResult }) {
  const u = useDisplayUnits();
  const e1 = result.economics1;
  const e2 = result.economics2;
  const irr1 = e1.isNonInvestmentPattern ? e1.mirr : (e1.irr ?? 0);
  const irr2 = e2.isNonInvestmentPattern ? e2.mirr : (e2.irr ?? 0);

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Economics Comparison
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left px-3 py-1.5 font-semibold text-text-secondary">Metric</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">{result.phase1Label}</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">{result.phase2Label}</th>
              <th className="text-right px-3 py-1.5 font-semibold text-text-secondary">Δ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">NPV₁₀</td>
              <td className="text-right px-3 py-2 font-data">{u.money(e1.npv10 as number, { accounting: true })}</td>
              <td className="text-right px-3 py-2 font-data">{u.money(e2.npv10 as number, { accounting: true })}</td>
              <td className={cn('text-right px-3 py-2 font-data font-medium', result.npvDelta >= 0 ? 'text-success' : 'text-danger')}>
                {u.money(result.npvDelta, { accounting: true })}
              </td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">{e1.isNonInvestmentPattern || e2.isNonInvestmentPattern ? 'IRR/MIRR' : 'IRR'}</td>
              <td className="text-right px-3 py-2 font-data">{fmtPct(irr1)}</td>
              <td className="text-right px-3 py-2 font-data">{fmtPct(irr2)}</td>
              <td className={cn('text-right px-3 py-2 font-data font-medium', irr2 - irr1 >= 0 ? 'text-success' : 'text-danger')}>
                {((irr2 - irr1) * 100).toFixed(2)}pp
              </td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">Profitability Index</td>
              <td className="text-right px-3 py-2 font-data">{e1.profitabilityIndex.toFixed(2)}</td>
              <td className="text-right px-3 py-2 font-data">{e2.profitabilityIndex.toFixed(2)}</td>
              <td className={cn('text-right px-3 py-2 font-data font-medium', e2.profitabilityIndex - e1.profitabilityIndex >= 0 ? 'text-success' : 'text-danger')}>
                {(e2.profitabilityIndex - e1.profitabilityIndex).toFixed(2)}
              </td>
            </tr>
            <tr className="border-b border-border/30">
              <td className="px-3 py-2 text-text-secondary">Payback (yrs)</td>
              <td className="text-right px-3 py-2 font-data">{fmtYears(e1.paybackYears)}</td>
              <td className="text-right px-3 py-2 font-data">{fmtYears(e2.paybackYears)}</td>
              <td className={cn('text-right px-3 py-2 font-data font-medium', e2.paybackYears - e1.paybackYears <= 0 ? 'text-success' : 'text-danger')}>
                {(e2.paybackYears - e1.paybackYears).toFixed(1)} yr
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-text-secondary">Government Take</td>
              <td className="text-right px-3 py-2 font-data">{e1.governmentTakePct.toFixed(1)}%</td>
              <td className="text-right px-3 py-2 font-data">{e2.governmentTakePct.toFixed(1)}%</td>
              <td className={cn('text-right px-3 py-2 font-data font-medium', e2.governmentTakePct - e1.governmentTakePct <= 0 ? 'text-success' : 'text-danger')}>
                {(e2.governmentTakePct - e1.governmentTakePct).toFixed(1)}pp
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductionOverlay({ p1, p2 }: { p1: PhaseVersionData; p2: PhaseVersionData }) {
  const data = useMemo(() => {
    const years = new Set<number>([
      ...Object.keys(p1.productionProfile.oil).map(Number),
      ...Object.keys(p2.productionProfile.oil).map(Number),
    ]);
    return [...years].sort((a, b) => a - b).map((year) => {
      const a1 = (p1.productionProfile.oil[year] ?? 0) + (p1.productionProfile.condensate[year] ?? 0) + ((p1.productionProfile.gas[year] ?? 0) * 1000) / 6;
      const a2 = (p2.productionProfile.oil[year] ?? 0) + (p2.productionProfile.condensate[year] ?? 0) + ((p2.productionProfile.gas[year] ?? 0) * 1000) / 6;
      return { year, [p1.label]: Math.round(a1), [p2.label]: Math.round(a2) };
    });
  }, [p1, p2]);

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Production Profile Overlay (boe/d)
      </h4>
      <div className="min-h-[280px]">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
              formatter={(v: number) => [v.toLocaleString() + ' boe/d', '']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey={p1.label} stroke="#3B8DBD" fill="#3B8DBD" fillOpacity={0.25} strokeDasharray="4,2" />
            <Area type="monotone" dataKey={p2.label} stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.4} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CashFlowOverlay({ result }: { result: PhaseComparisonResult }) {
  const u = useDisplayUnits();
  const data = useMemo(() => {
    const map = new Map<number, { year: number; [k: string]: number }>();
    let cum1 = 0;
    for (const cf of result.economics1.yearlyCashflows) {
      cum1 += ((cf.netCashFlow as number) * u.currencyFactor) / 1e6;
      const row = map.get(cf.year) ?? { year: cf.year };
      row[result.phase1Label] = Math.round(cum1 * 10) / 10;
      map.set(cf.year, row);
    }
    let cum2 = 0;
    for (const cf of result.economics2.yearlyCashflows) {
      cum2 += ((cf.netCashFlow as number) * u.currencyFactor) / 1e6;
      const row = map.get(cf.year) ?? { year: cf.year };
      row[result.phase2Label] = Math.round(cum2 * 10) / 10;
      map.set(cf.year, row);
    }
    return [...map.values()].sort((a, b) => a.year - b.year);
  }, [result, u.currencyFactor]);

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Cumulative Net Cash Flow ({u.currencyCode} M)
      </h4>
      <div className="min-h-[280px]">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `${u.currencySymbol}${v}M`} />
            <Tooltip
              contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
              formatter={(v: number) => [`${u.currencySymbol}${v.toLocaleString()}M`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={result.phase1Label} stroke="#3B8DBD" strokeWidth={2} strokeDasharray="5,3" dot={false} />
            <Line type="monotone" dataKey={result.phase2Label} stroke="#1E3A5F" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PhaseTimeline({ phases }: { phases: readonly PhaseVersionData[] }) {
  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Phase History
      </h4>
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {phases.map((p, i) => (
          <div key={p.phase} className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-petrol border-2 border-petrol-light" />
              <div className="text-[10px] font-semibold text-text-primary mt-1">{p.label}</div>
              <div className="text-[9px] text-text-muted">{PHASE_LABEL[p.phase]}</div>
              <div className="text-[9px] text-text-muted">{new Date(p.createdDate).getFullYear()}</div>
            </div>
            {i < phases.length - 1 && (
              <div className="w-8 sm:w-16 h-px bg-petrol/40 self-center" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
