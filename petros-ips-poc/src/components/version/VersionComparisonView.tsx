import { useState, useMemo, useCallback } from 'react';
import { Select } from '@/components/ui5/Ui5Select';
import { Button } from '@/components/ui5/Ui5Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useProjectStore } from '@/store/project-store';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type {
  DataVersion,
  VersionComparisonResult,
  YearlyVariance,
} from '@/engine/types';

const VERSION_LABELS: Record<DataVersion, string> = {
  budget: 'Budget',
  forecast: 'Forecast',
  actuals: 'Actuals',
  submitted: 'Submitted',
  approved: 'Approved',
  working: 'Working Draft',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function VersionComparisonView() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  // key forces a full remount on project switch so v1/v2 local state
  // resets to the new project's defaults (and any stale comparison
  // result that might still be cached is ignored on render).
  return <VersionComparisonViewInner key={activeProjectId ?? 'none'} />;
}

function VersionComparisonViewInner() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const versionedData = useProjectStore((s) => s.versionedData);
  const versionComparisonResults = useProjectStore((s) => s.versionComparisonResults);
  const compareVersions = useProjectStore((s) => s.compareVersions);

  const activeProject = projects.find((p) => p.project.id === activeProjectId);
  const projectVersions = activeProjectId ? versionedData.get(activeProjectId) : undefined;
  const availableVersions: DataVersion[] = projectVersions
    ? ([...projectVersions.keys()] as DataVersion[])
    : [];

  const [v1, setV1] = useState<DataVersion>('budget');
  const [v2, setV2] = useState<DataVersion>(
    availableVersions.includes('forecast') ? 'forecast' : (availableVersions[1] ?? 'budget'),
  );

  const result = activeProjectId ? versionComparisonResults.get(activeProjectId) : undefined;

  const handleCompare = useCallback(() => {
    if (!activeProjectId) return;
    compareVersions(activeProjectId, v1, v2);
  }, [activeProjectId, v1, v2, compareVersions]);

  if (!activeProject) {
    return (
      <div className="flex items-center justify-center h-64 border border-border bg-white">
        <p className="text-sm text-text-muted">Select a project to compare versions</p>
      </div>
    );
  }

  const v1Data = projectVersions?.get(v1);
  const v2Data = projectVersions?.get(v2);

  return (
    <div className="space-y-4">
      {/* Selector + status banner */}
      <div className="border border-border bg-white p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Compare</label>
            <Select
              value={v1}
              onValueChange={(val) => setV1(val as DataVersion)}
              options={availableVersions.map((v) => ({ value: v, label: VERSION_LABELS[v] }))}
              aria-label="Compare version"
            />
          </div>
          <div className="flex items-end justify-center pb-2">
            <GitCompareArrows size={18} className="text-petrol" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-text-muted block mb-1">Against</label>
            <Select
              value={v2}
              onValueChange={(val) => setV2(val as DataVersion)}
              options={availableVersions.map((v) => ({ value: v, label: VERSION_LABELS[v] }))}
              aria-label="Against version"
            />
          </div>
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={v1 === v2}
            className="bg-petrol hover:bg-petrol-light text-white text-xs h-9 shrink-0"
          >
            Compare Versions
          </Button>
        </div>

        {/* Status banner */}
        {(v1Data || v2Data) && (
          <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
            {v1Data && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">{VERSION_LABELS[v1]}:</span>
                <StatusBadge status={v1Data.status} />
                <span className="text-text-muted">{formatDate(v1Data.lastModified)}</span>
                <span className="text-text-muted truncate">— {v1Data.modifiedBy}</span>
              </div>
            )}
            {v2Data && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">{VERSION_LABELS[v2]}:</span>
                <StatusBadge status={v2Data.status} />
                <span className="text-text-muted">{formatDate(v2Data.lastModified)}</span>
                <span className="text-text-muted truncate">— {v2Data.modifiedBy}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!result && (
        <div className="flex items-center justify-center h-32 border border-border bg-white">
          <p className="text-sm text-text-muted">Click "Compare Versions" to run the comparison</p>
        </div>
      )}

      {result && (
        <>
          <KpiDeltaRow result={result} v1={v1} v2={v2} />
          <VarianceWaterfall result={result} v1={v1} v2={v2} />
          <VarianceTable variances={result.yearlyVariances} v1={v1} v2={v2} />
          <ProductionOverlayChart variances={result.yearlyVariances} v1={v1} v2={v2} />
        </>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function KpiDeltaRow({
  result,
  v1,
  v2,
}: {
  result: VersionComparisonResult;
  v1: DataVersion;
  v2: DataVersion;
}) {
  const u = useDisplayUnits();
  const v1Label = VERSION_LABELS[v1];
  const v2Label = VERSION_LABELS[v2];

  // Aggregate yearly totals from variances for percentage bases
  const totals = useMemo(() => {
    let revB = 0, capexB = 0, ncfB = 0, prodB = 0;
    for (const v of result.yearlyVariances) {
      revB += v.revenueBudget;
      capexB += v.capexBudget;
      ncfB += v.ncfBudget;
      prodB += v.productionBudget;
    }
    return { revB, capexB, ncfB, prodB };
  }, [result.yearlyVariances]);

  const npvPct = totals.ncfB !== 0 ? (result.npvVariance / Math.abs(totals.ncfB)) * 100 : null;
  const capexPct = totals.capexB !== 0 ? (result.capexVariance / Math.abs(totals.capexB)) * 100 : null;
  const revPct = totals.revB !== 0 ? (result.revenueVariance / Math.abs(totals.revB)) * 100 : null;
  const prodPct = totals.prodB !== 0 ? (result.productionVariance / Math.abs(totals.prodB * 365)) * 100 : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <DeltaCard
        label="NPV₁₀ Δ"
        primary={u.money(result.npvVariance, { accounting: true })}
        sub={`${v1Label} → ${v2Label}`}
        deltaSign={Math.sign(result.npvVariance)}
        pct={npvPct}
        good="positive"
      />
      <DeltaCard
        label="IRR Δ"
        primary={
          result.irrVariance !== null
            ? `${(result.irrVariance * 100).toFixed(2)}pp`
            : 'N/A'
        }
        sub={`${v1Label} → ${v2Label}`}
        deltaSign={result.irrVariance !== null ? Math.sign(result.irrVariance) : 0}
        pct={null}
        good="positive"
      />
      <DeltaCard
        label="CAPEX Δ"
        primary={u.money(result.capexVariance, { accounting: true })}
        sub={`${v1Label} → ${v2Label}`}
        deltaSign={Math.sign(result.capexVariance)}
        pct={capexPct}
        good="negative"
      />
      <DeltaCard
        label="Production Δ"
        primary={`${(result.productionVariance / 1e6).toFixed(1)} MMboe`}
        sub={`${v1Label} → ${v2Label}`}
        deltaSign={Math.sign(result.productionVariance)}
        pct={prodPct}
        good="positive"
      />
      <DeltaCard
        label="Revenue Δ"
        primary={u.money(result.revenueVariance, { accounting: true })}
        sub={`${v1Label} → ${v2Label}`}
        deltaSign={Math.sign(result.revenueVariance)}
        pct={revPct}
        good="positive"
      />
    </div>
  );
}

function DeltaCard({
  label,
  primary,
  sub,
  deltaSign,
  pct,
  good,
}: {
  label: string;
  primary: string;
  sub: string;
  deltaSign: number;
  pct: number | null;
  good: 'positive' | 'negative';
}) {
  let colorClass = 'text-text-primary';
  let borderClass = 'border-l-petrol';
  if (deltaSign !== 0) {
    const isFavorable =
      (good === 'positive' && deltaSign > 0) || (good === 'negative' && deltaSign < 0);
    colorClass = isFavorable ? 'text-success' : 'text-danger';
    borderClass = isFavorable ? 'border-l-success' : 'border-l-danger';
  }
  const Icon = deltaSign > 0 ? TrendingUp : deltaSign < 0 ? TrendingDown : Minus;

  return (
    <div className={cn('border border-border bg-white p-4 border-l-2', borderClass)}>
      <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-semibold font-data', colorClass)}>{primary}</span>
      </div>
      <div className="flex items-center gap-1 mt-1.5 text-[10px]">
        <Icon size={11} className={colorClass} />
        <span className={colorClass}>
          {pct !== null && Number.isFinite(pct) ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : sub}
        </span>
      </div>
    </div>
  );
}

function VarianceTable({
  variances,
  v1,
  v2,
}: {
  variances: readonly YearlyVariance[];
  v1: DataVersion;
  v2: DataVersion;
}) {
  const u = useDisplayUnits();
  const v1L = VERSION_LABELS[v1];
  const v2L = VERSION_LABELS[v2];

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Year-by-Year Variance
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums min-w-[860px]">
          <thead>
            <tr className="border-b border-border bg-content-alt text-text-secondary">
              <th className="text-left px-2 py-1.5 font-semibold">Year</th>
              <th className="text-right px-2 py-1.5 font-semibold">Rev ({v1L}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">Rev ({v2L}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">Δ Rev</th>
              <th className="text-right px-2 py-1.5 font-semibold">Δ %</th>
              <th className="text-right px-2 py-1.5 font-semibold">CAPEX ({v1L.charAt(0)}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">CAPEX ({v2L.charAt(0)}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">Δ CAPEX</th>
              <th className="text-right px-2 py-1.5 font-semibold">NCF ({v1L.charAt(0)}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">NCF ({v2L.charAt(0)}, {u.currencySymbol}M)</th>
              <th className="text-right px-2 py-1.5 font-semibold">Δ NCF</th>
            </tr>
          </thead>
          <tbody>
            {variances.map((v) => {
              const flag = Math.abs(v.revenueVariancePct) > 10;
              return (
                <tr
                  key={v.year}
                  className={cn(
                    'border-b border-border/30',
                    flag && 'bg-amber/5',
                  )}
                >
                  <td className="px-2 py-1 font-data font-medium">{v.year}</td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.revenueBudget, { accounting: true })}</td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.revenueActual, { accounting: true })}</td>
                  <td className={cn('text-right px-2 py-1 font-data font-medium', v.revenueVariance >= 0 ? 'text-success' : 'text-danger')}>
                    {u.money(v.revenueVariance, { accounting: true })}
                  </td>
                  <td className={cn('text-right px-2 py-1 font-data', Math.abs(v.revenueVariancePct) > 10 ? 'text-amber font-semibold' : 'text-text-muted')}>
                    {v.revenueVariancePct.toFixed(1)}%
                  </td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.capexBudget, { accounting: true })}</td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.capexActual, { accounting: true })}</td>
                  <td className={cn('text-right px-2 py-1 font-data font-medium', v.capexVariance <= 0 ? 'text-success' : 'text-danger')}>
                    {u.money(v.capexVariance, { accounting: true })}
                  </td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.ncfBudget, { accounting: true })}</td>
                  <td className="text-right px-2 py-1 font-data">{u.money(v.ncfActual, { accounting: true })}</td>
                  <td className={cn('text-right px-2 py-1 font-data font-medium', v.ncfVariance >= 0 ? 'text-success' : 'text-danger')}>
                    {u.money(v.ncfVariance, { accounting: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-text-muted mt-2">
        Rows highlighted amber where revenue variance exceeds ±10%.
      </p>
    </div>
  );
}

function VarianceWaterfall({
  result,
  v1,
  v2,
}: {
  result: VersionComparisonResult;
  v1: DataVersion;
  v2: DataVersion;
}) {
  const u = useDisplayUnits();
  // Decompose: Budget NCF → Volume Variance → Cost Variance → Forecast NCF
  const totals = useMemo(() => {
    let ncfB = 0, ncfA = 0;
    for (const v of result.yearlyVariances) {
      ncfB += v.ncfBudget;
      ncfA += v.ncfActual;
    }
    return { ncfB, ncfA };
  }, [result.yearlyVariances]);

  const bars = useMemo(() => {
    const startNcf = (totals.ncfB * u.currencyFactor) / 1e6;
    const endNcf = (totals.ncfA * u.currencyFactor) / 1e6;
    const volume = (result.volumeVariance * u.currencyFactor) / 1e6;
    const cost = (result.costVariance * u.currencyFactor) / 1e6;
    const price = (result.priceVariance * u.currencyFactor) / 1e6;

    let running = startNcf;
    const out: Array<{ label: string; value: number; start: number; end: number; color: string; isFinal?: boolean }> = [];
    out.push({ label: `${VERSION_LABELS[v1]} NCF`, value: startNcf, start: 0, end: startNcf, color: '#1E3A5F' });
    if (price !== 0) {
      const newRunning = running + price;
      out.push({ label: 'Price Δ', value: price, start: running, end: newRunning, color: price >= 0 ? '#2D8A4E' : '#C0392B' });
      running = newRunning;
    }
    if (volume !== 0) {
      const newRunning = running + volume;
      out.push({ label: 'Volume Δ', value: volume, start: running, end: newRunning, color: volume >= 0 ? '#2D8A4E' : '#C0392B' });
      running = newRunning;
    }
    if (cost !== 0) {
      const newRunning = running + cost;
      out.push({ label: 'Cost Δ', value: cost, start: running, end: newRunning, color: cost >= 0 ? '#2D8A4E' : '#C0392B' });
      running = newRunning;
    }
    // Residual captures fiscal/tax variance not explained by price+volume+cost
    const residual = endNcf - running;
    if (Math.abs(residual) > 0.05) {
      const newRunning = running + residual;
      out.push({ label: 'Tax & Other Δ', value: residual, start: running, end: newRunning, color: residual >= 0 ? '#2D8A4E' : '#8B5CF6' });
      running = newRunning;
    }
    out.push({ label: `${VERSION_LABELS[v2]} NCF`, value: endNcf, start: 0, end: endNcf, color: '#254A78', isFinal: true });
    return out;
  }, [result, totals, v1, v2, u.currencyFactor]);

  const maxVal = Math.max(...bars.map((b) => Math.max(b.start, b.end, 0)));
  const minVal = Math.min(0, ...bars.map((b) => Math.min(b.start, b.end)));
  const range = (maxVal - minVal) || 1;

  const svgW = 700;
  const svgH = 280;
  const padL = 20;
  const padR = 20;
  const padT = 30;
  const padB = 60;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;
  const barWidth = Math.min(80, (chartW / bars.length) * 0.65);
  const barGap = (chartW - barWidth * bars.length) / (bars.length + 1);
  const scaleY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;
  const zeroY = scaleY(0);

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        NCF Variance Decomposition
      </h4>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 280 }}>
        <line x1={padL} x2={svgW - padR} y1={zeroY} y2={zeroY} stroke="#E2E5EA" strokeWidth={1} />
        {bars.map((bar, i) => {
          const x = padL + barGap + i * (barWidth + barGap);
          const top = scaleY(Math.max(bar.start, bar.end));
          const bottom = scaleY(Math.min(bar.start, bar.end));
          const height = Math.max(2, bottom - top);
          return (
            <g key={i}>
              <rect x={x} y={top} width={barWidth} height={height} fill={bar.color} opacity={0.9} />
              {i < bars.length - 1 && !bars[i + 1]!.isFinal && (
                <line
                  x1={x + barWidth}
                  x2={x + barWidth + barGap}
                  y1={scaleY(bar.end)}
                  y2={scaleY(bar.end)}
                  stroke="#9CA3AF"
                  strokeWidth={1}
                  strokeDasharray="3,2"
                />
              )}
              <text x={x + barWidth / 2} y={top - 6} textAnchor="middle" fill="#1A1A2E" fontSize={11} className="font-data">
                {`${u.currencySymbol}${bar.value.toFixed(1)}M`}
              </text>
              <text x={x + barWidth / 2} y={svgH - padB + 16} textAnchor="middle" fill="#6B7280" fontSize={11}>
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ProductionOverlayChart({
  variances,
  v1,
  v2,
}: {
  variances: readonly YearlyVariance[];
  v1: DataVersion;
  v2: DataVersion;
}) {
  const v1L = VERSION_LABELS[v1];
  const v2L = VERSION_LABELS[v2];

  const data = variances.map((v) => ({
    year: v.year,
    [v1L]: Math.round(v.productionBudget),
    [v2L]: Math.round(v.productionActual),
  }));

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Production Profile Overlay (boe/d)
      </h4>
      <div className="min-h-[280px]">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
              formatter={(v: number) => [v.toLocaleString() + ' boe/d', '']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey={v1L} stroke="#1E3A5F" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey={v2L} stroke="#D4A843" strokeWidth={2} strokeDasharray="5,3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
