import { useState, useCallback, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { Dice5 } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { KpiCard } from '@/components/shared/KpiCard';
import { fmtM, fmtNum } from '@/lib/format';
import type { MonteCarloConfig, MonteCarloResult } from '@/engine/types';

export default function MonteCarloPage() {
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Monte Carlo Simulation</h2>
        <Select value={activeProjectId ?? ''} onValueChange={(v) => setActiveProject(v)}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue placeholder="Select project..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.project.id} value={p.project.id} className="text-xs">
                {p.project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4">
        {/* Config panel */}
        <div className="w-[280px] shrink-0 border border-border bg-white p-4 space-y-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Simulation Config
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Iterations</Label>
              <Input type="number" value={iterations} onChange={(e) => setIterations(Number(e.target.value))} className="h-7 text-xs font-data" />
            </div>
            <div>
              <Label className="text-[10px]">Seed</Label>
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="h-7 text-xs font-data" />
            </div>
          </div>

          <Separator />
          <DistRow label="Oil Price (Tri)" v1={oilMin} v2={oilMode} v3={oilMax} s1={setOilMin} s2={setOilMode} s3={setOilMax} h1="Min" h2="Mode" h3="Max" />
          <DistRow label="Gas Price (Tri)" v1={gasMin} v2={gasMode} v3={gasMax} s1={setGasMin} s2={setGasMode} s3={setGasMax} h1="Min" h2="Mode" h3="Max" />
          <DistRow label="Production (LN)" v1={prodMu} v2={prodSigma} s1={setProdMu} s2={setProdSigma} h1="Mu" h2="Sigma" />
          <DistRow label="CAPEX (Norm)" v1={capexMean} v2={capexStd} s1={setCapexMean} s2={setCapexStd} h1="Mean" h2="StdDev" />
          <DistRow label="OPEX (Norm)" v1={opexMean} v2={opexStd} s1={setOpexMean} s2={setOpexStd} h1="Mean" h2="StdDev" />

          <Button onClick={handleRun} disabled={!activeProjectId || isCalculating} className="w-full bg-petrol hover:bg-petrol-light text-white text-xs">
            <Dice5 size={14} className="mr-1.5" />
            {isCalculating ? `Running ${iterations} iterations...` : 'Run Simulation'}
          </Button>
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

function DistRow({ label, v1, v2, v3, s1, s2, s3, h1, h2, h3 }: {
  label: string;
  v1: number; v2: number; v3?: number;
  s1: (v: number) => void; s2: (v: number) => void; s3?: (v: number) => void;
  h1: string; h2: string; h3?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] font-medium text-text-secondary">{label}</Label>
      <div className="grid grid-cols-3 gap-1 mt-0.5">
        <div>
          <span className="text-[8px] text-text-muted">{h1}</span>
          <Input type="number" step="0.01" value={v1} onChange={(e) => s1(Number(e.target.value))} className="h-6 text-[10px] font-data px-1" />
        </div>
        <div>
          <span className="text-[8px] text-text-muted">{h2}</span>
          <Input type="number" step="0.01" value={v2} onChange={(e) => s2(Number(e.target.value))} className="h-6 text-[10px] font-data px-1" />
        </div>
        {v3 !== undefined && s3 && h3 && (
          <div>
            <span className="text-[8px] text-text-muted">{h3}</span>
            <Input type="number" step="0.01" value={v3} onChange={(e) => s3(Number(e.target.value))} className="h-6 text-[10px] font-data px-1" />
          </div>
        )}
      </div>
    </div>
  );
}

function MCResults({ result }: { result: MonteCarloResult }) {
  const [speConvention, setSpeConvention] = useState(false);
  // Histogram data
  const histData = useMemo(
    () => result.histogram.map((bin) => ({
      npv: ((bin.edgeLow + bin.edgeHigh) / 2) / 1e6,
      count: bin.count,
      isAboveP50: ((bin.edgeLow + bin.edgeHigh) / 2) >= (result.p50 as number),
    })),
    [result],
  );

  // S-Curve data
  const sCurveData = useMemo(() => {
    const sorted = [...result.npvValues].map((v) => v as number).sort((a, b) => a - b);
    const n = sorted.length;
    const step = Math.max(1, Math.floor(n / 200));
    const points = [];
    for (let i = 0; i < n; i += step) {
      points.push({ npv: sorted[i]! / 1e6, prob: ((i + 1) / n) * 100 });
    }
    if (points.length > 0 && points[points.length - 1]!.prob < 100) {
      points.push({ npv: sorted[n - 1]! / 1e6, prob: 100 });
    }
    return points;
  }, [result]);

  // Statistics
  const npvArray = result.npvValues.map((v) => v as number);
  const minNpv = Math.min(...npvArray);
  const maxNpv = Math.max(...npvArray);
  const probPositive = npvArray.filter((v) => v > 0).length / npvArray.length * 100;

  return (
    <>
      {/* Convention toggle + KPI Cards */}
      <div className="flex items-center justify-end mb-1">
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
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label={speConvention ? 'P90 (Pessimistic)' : 'P10 (Low Case)'}
          value={fmtM(result.p10 as number)} unit="$M"
          className="border-l-2 border-l-danger"
        />
        <KpiCard label="P50 (Median)" value={fmtM(result.p50 as number)} unit="$M" className="border-l-2 border-l-petrol" />
        <KpiCard
          label={speConvention ? 'P10 (Optimistic)' : 'P90 (High Case)'}
          value={fmtM(result.p90 as number)} unit="$M"
          className="border-l-2 border-l-success"
        />
      </div>

      {/* Histogram */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          NPV Distribution ({fmtNum(result.npvValues.length)} iterations)
        </h4>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={histData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
            <XAxis dataKey="npv" tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
            <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} />
            <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} formatter={(v: number) => [v, 'Count']} labelFormatter={(v: number) => `NPV: $${v.toFixed(0)}M`} />
            <ReferenceLine x={(result.p10 as number) / 1e6} stroke="#C0392B" strokeDasharray="4,3" label={{ value: 'P10', fontSize: 9, fill: '#C0392B' }} />
            <ReferenceLine x={(result.p50 as number) / 1e6} stroke="#1E3A5F" strokeDasharray="4,3" label={{ value: 'P50', fontSize: 9, fill: '#1E3A5F' }} />
            <ReferenceLine x={(result.p90 as number) / 1e6} stroke="#2D8A4E" strokeDasharray="4,3" label={{ value: 'P90', fontSize: 9, fill: '#2D8A4E' }} />
            <Bar dataKey="count" name="Frequency">
              {histData.map((d, i) => (
                <Cell key={i} fill={d.isAboveP50 ? '#3B8DBD' : '#E07060'} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* S-Curve */}
        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Cumulative Probability (S-Curve)
          </h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={sCurveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
              <XAxis dataKey="npv" tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={(v: number) => `$${v.toFixed(0)}M`} />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Probability']} labelFormatter={(v: number) => `NPV: $${v.toFixed(0)}M`} />
              <ReferenceLine y={10} stroke="#C0392B" strokeDasharray="3,3" />
              <ReferenceLine y={50} stroke="#1E3A5F" strokeDasharray="3,3" />
              <ReferenceLine y={90} stroke="#2D8A4E" strokeDasharray="3,3" />
              <Line type="monotone" dataKey="prob" stroke="#1E3A5F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="border border-border bg-white p-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Statistics Summary
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {[
                ['Mean NPV', `$${fmtM(result.mean as number)}M`],
                ['Median (P50)', `$${fmtM(result.p50 as number)}M`],
                ['Std Deviation', `$${fmtM(result.stdDev)}M`],
                ['P10', `$${fmtM(result.p10 as number)}M`],
                ['P90', `$${fmtM(result.p90 as number)}M`],
                ['Minimum', `$${fmtM(minNpv)}M`],
                ['Maximum', `$${fmtM(maxNpv)}M`],
                ['P(NPV > 0)', `${probPositive.toFixed(1)}%`],
                ['Iterations', fmtNum(result.npvValues.length)],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-border/30">
                  <td className="py-1.5 text-text-secondary">{label}</td>
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
