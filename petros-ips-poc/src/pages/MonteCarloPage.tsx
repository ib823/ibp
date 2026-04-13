import { useState, useCallback, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Select } from '@/components/ui5/Ui5Select';
import { Input } from '@/components/ui5/Ui5Input';
import { Label } from '@ui5/webcomponents-react';
import { Button } from '@/components/ui5/Ui5Button';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useProjectStore } from '@/store/project-store';
import { KpiCard } from '@/components/shared/KpiCard';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { fmtNum } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { toast } from '@/lib/toast';
import { getPageEntries } from '@/lib/educational-content';
import type { MonteCarloConfig, MonteCarloResult } from '@/engine/types';

const edu = getPageEntries('monteCarlo');

/**
 * Accept a raw input string and call `setter` only when the value parses
 * to a finite number. Empty string and lone "-" are treated as 0 so the
 * user can clear the field while typing. NaN / "abc" / Infinity are
 * silently ignored so state can never hold a non-finite value.
 */
function safeSetNumber(setter: (v: number) => void, raw: string) {
  if (raw === '' || raw === '-') {
    setter(0);
    return;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return;
  setter(parsed);
}

export default function MonteCarloPage() {
  usePageTitle('Monte Carlo');
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const monteCarloResults = useProjectStore((s) => s.monteCarloResults);
  const runMC = useProjectStore((s) => s.runMonteCarlo);
  const isCalculating = useProjectStore((s) => s.isCalculating);

  const [iterations, setIterations] = useState(1000);
  const [seed, setSeed] = useState('42');
  const [oilMin, setOilMin] = useState(0.70);
  const [oilMode, setOilMode] = useState(1.00);
  const [oilMax, setOilMax] = useState(1.30);
  const [gasMin, setGasMin] = useState(0.70);
  const [gasMode, setGasMode] = useState(1.00);
  const [gasMax, setGasMax] = useState(1.30);
  const [prodMu, setProdMu] = useState(0.0);
  const [prodSigma, setProdSigma] = useState(0.10);
  const [capexMean, setCapexMean] = useState(1.00);
  const [capexStd, setCapexStd] = useState(0.10);
  const [opexMean, setOpexMean] = useState(1.00);
  const [opexStd, setOpexStd] = useState(0.08);

  const mcResult = activeProjectId ? monteCarloResults.get(activeProjectId) ?? null : null;

  const handleRun = useCallback(() => {
    if (!activeProjectId) return;
    // Guard against invalid iteration counts (NaN, 0, negative, non-finite)
    if (!Number.isFinite(iterations) || iterations < 1) {
      toast.error('Iterations must be at least 1');
      return;
    }

    // Triangular: require min < max AND min ≤ mode ≤ max. Degenerate
    // distributions (min === max) would divide by zero in the sampler.
    const triChecks: Array<[string, number, number, number]> = [
      ['Oil Price', oilMin, oilMode, oilMax],
      ['Gas Price', gasMin, gasMode, gasMax],
    ];
    for (const [name, min, mode, max] of triChecks) {
      if (!(Number.isFinite(min) && Number.isFinite(mode) && Number.isFinite(max))) {
        toast.error(`${name}: values must be finite numbers`);
        return;
      }
      if (min >= max) {
        toast.error(`${name}: Min must be less than Max`);
        return;
      }
      if (mode < min || mode > max) {
        toast.error(`${name}: Mode must be between Min and Max`);
        return;
      }
    }

    // Normal / lognormal: sigma ≥ 0. Negative spreads are meaningless and
    // would produce mirrored samples with the Box-Muller transform.
    const spreadChecks: Array<[string, number]> = [
      ['Production Sigma', prodSigma],
      ['CAPEX StdDev', capexStd],
      ['OPEX StdDev', opexStd],
    ];
    for (const [name, v] of spreadChecks) {
      if (!Number.isFinite(v) || v < 0) {
        toast.error(`${name} must be ≥ 0`);
        return;
      }
    }
    if (!Number.isFinite(prodMu) || !Number.isFinite(capexMean) || !Number.isFinite(opexMean)) {
      toast.error('Distribution means must be finite numbers');
      return;
    }

    const config: MonteCarloConfig = {
      iterations,
      seed,
      distributions: {
        oilPrice: { type: 'triangular', params: { min: oilMin, mode: oilMode, max: oilMax } },
        gasPrice: { type: 'triangular', params: { min: gasMin, mode: gasMode, max: gasMax } },
        production: { type: 'lognormal', params: { mu: prodMu, sigma: prodSigma } },
        capex: { type: 'normal', params: { mean: capexMean, stdDev: capexStd } },
        opex: { type: 'normal', params: { mean: opexMean, stdDev: opexStd } },
      },
    };
    runMC(activeProjectId, config);
  }, [activeProjectId, iterations, seed, oilMin, oilMode, oilMax, gasMin, gasMode, gasMax, prodMu, prodSigma, capexMean, capexStd, opexMean, opexStd, runMC]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">Monte Carlo Simulation</h1>
          <InfoIcon entry={edu['MC-01']!} />
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

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Config panel */}
        <div className="w-full lg:w-[280px] lg:shrink-0 border border-border bg-white p-4 space-y-3" data-tour="montecarlo-config">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Simulation Config
          </h4>
          <SectionHelp entry={edu['MC-03']!} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <EduTooltip entryId="MC-04">
                <Label className="text-[10px] cursor-help">Iterations</Label>
              </EduTooltip>
              <Input
                type="number"
                min={1}
                max={100000}
                value={iterations}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setIterations(Math.max(1, Math.min(100000, Math.floor(v))));
                }}
                className="h-7 text-xs font-data"
              />
            </div>
            <div>
              <EduTooltip entryId="MC-05">
                <Label className="text-[10px] cursor-help">Seed</Label>
              </EduTooltip>
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="h-7 text-xs font-data" />
            </div>
          </div>

          <hr className="border-border my-2" />
          <DistRow label="Oil Price (Tri)" tooltipId="MC-06" v1={oilMin} v2={oilMode} v3={oilMax} s1={setOilMin} s2={setOilMode} s3={setOilMax} h1="Min" h2="Mode" h3="Max" />
          <DistRow label="Gas Price (Tri)" tooltipId="MC-07" v1={gasMin} v2={gasMode} v3={gasMax} s1={setGasMin} s2={setGasMode} s3={setGasMax} h1="Min" h2="Mode" h3="Max" />
          <DistRow label="Production (LN)" tooltipId="MC-08" v1={prodMu} v2={prodSigma} s1={setProdMu} s2={setProdSigma} h1="Mu" h2="Sigma" />
          <DistRow label="CAPEX (Norm)" tooltipId="MC-09" v1={capexMean} v2={capexStd} s1={setCapexMean} s2={setCapexStd} h1="Mean" h2="StdDev" />
          <DistRow label="OPEX (Norm)" tooltipId="MC-10" v1={opexMean} v2={opexStd} s1={setOpexMean} s2={setOpexStd} h1="Mean" h2="StdDev" />

          <EduTooltip entryId="MC-11">
            <Button
              onClick={handleRun}
              disabled={!activeProjectId || isCalculating}
              icon="simulate"
              className="w-full text-xs h-10 sm:h-9"
            >
              {isCalculating ? `Running ${iterations} iterations...` : 'Run Simulation'}
            </Button>
          </EduTooltip>
        </div>

        {/* Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {!mcResult ? (
            <div className="flex items-center justify-center h-64 border border-border bg-white">
              <p className="text-sm text-text-muted">Configure and run simulation to see results</p>
            </div>
          ) : (
            <MCResults result={mcResult} />
          )}
        </div>
      </div>
    </div>
  );
}

function DistRow({ label, tooltipId, v1, v2, v3, s1, s2, s3, h1, h2, h3 }: {
  label: string;
  tooltipId?: string;
  v1: number; v2: number; v3?: number;
  s1: (v: number) => void; s2: (v: number) => void; s3?: (v: number) => void;
  h1: string; h2: string; h3?: string;
}) {
  return (
    <div>
      {tooltipId ? (
        <EduTooltip entryId={tooltipId}>
          <Label className="text-[10px] font-medium text-text-secondary cursor-help">{label}</Label>
        </EduTooltip>
      ) : (
        <Label className="text-[10px] font-medium text-text-secondary">{label}</Label>
      )}
      <div className="grid grid-cols-3 gap-1 mt-0.5">
        <div className="min-w-0">
          <span className="text-[10px] text-text-muted">{h1}</span>
          <Input type="number" step="0.01" value={v1} onChange={(e) => safeSetNumber(s1, e.target.value)} className="text-[10px] font-data" />
        </div>
        <div className="min-w-0">
          <span className="text-[10px] text-text-muted">{h2}</span>
          <Input type="number" step="0.01" value={v2} onChange={(e) => safeSetNumber(s2, e.target.value)} className="text-[10px] font-data" />
        </div>
        {v3 !== undefined && s3 && h3 && (
          <div className="min-w-0">
            <span className="text-[10px] text-text-muted">{h3}</span>
            <Input type="number" step="0.01" value={v3} onChange={(e) => safeSetNumber(s3, e.target.value)} className="text-[10px] font-data" />
          </div>
        )}
      </div>
    </div>
  );
}

function MCResults({ result }: { result: MonteCarloResult }) {
  const [speConvention, setSpeConvention] = useState(false);
  const u = useDisplayUnits();

  // Histogram data — bin edges are raw USD; pre-scale to display-currency
  // millions so the XAxis tickFormatter, Tooltip labelFormatter, and
  // ReferenceLine x-values all share one coordinate space.
  const histData = useMemo(
    () => result.histogram.map((bin) => ({
      npv: (((bin.edgeLow + bin.edgeHigh) / 2) * u.currencyFactor) / 1e6,
      count: bin.count,
      isAboveP50: ((bin.edgeLow + bin.edgeHigh) / 2) >= (result.p50 as number),
    })),
    [result, u.currencyFactor],
  );

  // Percentile positions in chart coordinate space (display-M). MUST use
  // the same scaling as histData above or reference lines drift off-bar.
  const p10Display = ((result.p10 as number) * u.currencyFactor) / 1e6;
  const p50Display = ((result.p50 as number) * u.currencyFactor) / 1e6;
  const p90Display = ((result.p90 as number) * u.currencyFactor) / 1e6;

  // S-Curve data — same pre-scaling as histogram so axes match.
  const sCurveData = useMemo(() => {
    const sorted = [...result.npvValues].map((v) => v as number).sort((a, b) => a - b);
    const n = sorted.length;
    const step = Math.max(1, Math.floor(n / 200));
    const points = [];
    for (let i = 0; i < n; i += step) {
      points.push({ npv: (sorted[i]! * u.currencyFactor) / 1e6, prob: ((i + 1) / n) * 100 });
    }
    if (points.length > 0 && points[points.length - 1]!.prob < 100) {
      points.push({ npv: (sorted[n - 1]! * u.currencyFactor) / 1e6, prob: 100 });
    }
    return points;
  }, [result, u.currencyFactor]);

  // Statistics
  const npvArray = result.npvValues.map((v) => v as number);
  const minNpv = Math.min(...npvArray);
  const maxNpv = Math.max(...npvArray);
  const probPositive = npvArray.filter((v) => v > 0).length / npvArray.length * 100;

  return (
    <>
      {/* Convention toggle + KPI Cards */}
      <div className="flex items-center justify-end mb-1 gap-2">
        <InfoIcon entry={edu['MC-15']!} />
        <label className="flex items-center gap-2 text-[10px] text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={speConvention}
            onChange={(e) => setSpeConvention(e.target.checked)}
            className="w-3 h-3"
          />
          SPE/PRMS convention (P10 = optimistic)
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={speConvention ? 'P90 (Pessimistic)' : 'P10 (Low Case)'}
          value={u.money(result.p10 as number, { accounting: true })}
          className="border-l-2 border-l-danger"
          eduEntry={edu['MC-12']}
        />
        <KpiCard
          label="P50 (Median)"
          value={u.money(result.p50 as number, { accounting: true })}
          className="border-l-2 border-l-petrol"
          eduEntry={edu['MC-13']}
        />
        <KpiCard
          label={speConvention ? 'P10 (Optimistic)' : 'P90 (High Case)'}
          value={u.money(result.p90 as number, { accounting: true })}
          className="border-l-2 border-l-success"
          eduEntry={edu['MC-14']}
        />
      </div>

      {/* Histogram */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
          NPV Distribution ({fmtNum(result.npvValues.length)} {result.npvValues.length === 1 ? 'iteration' : 'iterations'})
        </h4>
        <SectionHelp entry={edu['MC-16']!} />
        <div className="min-h-[260px]">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={histData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
            <XAxis dataKey="npv" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
            <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} formatter={(v: number) => [v, 'Count']} labelFormatter={(v: number) => `NPV: ${u.currencySymbol}${v.toFixed(0)}M`} />
            <ReferenceLine x={p10Display} stroke="#C0392B" strokeDasharray="4,3" label={{ value: 'P10', fontSize: 11, fill: '#C0392B' }} />
            <ReferenceLine x={p50Display} stroke="#1E3A5F" strokeDasharray="4,3" label={{ value: 'P50', fontSize: 11, fill: '#1E3A5F' }} />
            <ReferenceLine x={p90Display} stroke="#2D8A4E" strokeDasharray="4,3" label={{ value: 'P90', fontSize: 11, fill: '#2D8A4E' }} />
            <Bar dataKey="count" name="Frequency">
              {histData.map((d, i) => (
                <Cell key={i} fill={d.isAboveP50 ? '#3B8DBD' : '#E07060'} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* S-Curve */}
        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Cumulative Probability (S-Curve)
          </h4>
          <SectionHelp entry={edu['MC-17']!} />
          <div className="min-h-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={sCurveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
              <XAxis dataKey="npv" tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Probability']} labelFormatter={(v: number) => `NPV: ${u.currencySymbol}${v.toFixed(0)}M`} />
              <ReferenceLine y={10} stroke="#C0392B" strokeDasharray="3,3" />
              <ReferenceLine y={50} stroke="#1E3A5F" strokeDasharray="3,3" />
              <ReferenceLine y={90} stroke="#2D8A4E" strokeDasharray="3,3" />
              <Line type="monotone" dataKey="prob" stroke="#1E3A5F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        {/* Statistics */}
        <div className="border border-border bg-white p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
            Statistics Summary
          </h4>
          <SectionHelp entry={edu['MC-18']!} />
          <table className="w-full text-xs tabular-nums">
            <tbody>
              {[
                ['Mean NPV', u.money(result.mean as number, { accounting: true }), 'MC-19'],
                ['Median (P50)', u.money(result.p50 as number, { accounting: true }), undefined],
                ['Std Deviation', u.money(result.stdDev, { accounting: true }), 'MC-20'],
                ['P10', u.money(result.p10 as number, { accounting: true }), undefined],
                ['P90', u.money(result.p90 as number, { accounting: true }), undefined],
                ['Minimum', u.money(minNpv, { accounting: true }), undefined],
                ['Maximum', u.money(maxNpv, { accounting: true }), undefined],
                ['P(NPV > 0)', `${probPositive.toFixed(1)}%`, 'MC-21'],
                ['Iterations', fmtNum(result.npvValues.length), undefined],
              ].map(([label, value, tooltipId]) => (
                <tr key={label} className="border-b border-border/30">
                  <td className="py-1.5 text-text-secondary">
                    {tooltipId ? (
                      <EduTooltip entryId={tooltipId as string}><span className="cursor-help">{label}</span></EduTooltip>
                    ) : label}
                  </td>
                  <td className="py-1.5 text-right font-data font-medium text-text-primary">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
