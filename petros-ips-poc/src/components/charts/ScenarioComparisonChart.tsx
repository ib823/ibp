import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { ChartDataTable } from '@/components/shared/ChartDataTable';

interface ScenarioBarChartProps {
  results: Record<ScenarioVersion, EconomicsResult>;
}

const SCENARIO_COLORS: Record<ScenarioVersion, string> = {
  high: '#2D8A4E',
  base: '#1E3A5F',
  low: '#D4A843',
  stress: '#C0392B',
};

const SCENARIO_LABELS: Record<ScenarioVersion, string> = {
  high: 'High',
  base: 'Base',
  low: 'Low',
  stress: 'Stress',
};

export function ScenarioBarChart({ results }: ScenarioBarChartProps) {
  const u = useDisplayUnits();
  const data = useMemo(() => {
    return (['high', 'base', 'low', 'stress'] as const).map((s) => ({
      scenario: SCENARIO_LABELS[s],
      scenarioKey: s,
      npv: ((results[s].npv10 as number) * u.currencyFactor) / 1e6,
    }));
  }, [results, u.currencyFactor]);

  // Explicit domain padded 10% on both ends and forced to include zero.
  // Default Recharts domain misbehaves when values straddle zero, compressing bars.
  const [yMin, yMax] = useMemo(() => {
    const vals = data.map((d) => d.npv);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const pad = Math.max((hi - lo) * 0.1, 1);
    return [lo - (lo < 0 ? pad : 0), hi + pad];
  }, [data]);

  return (
    <figure className="m-0" aria-label="NPV ten by scenario comparison">
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="scenario"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, 'NPV₁₀']}
        />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
        <Bar dataKey="npv" maxBarSize={48} radius={[2, 2, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.scenarioKey} fill={SCENARIO_COLORS[d.scenarioKey]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <ChartDataTable
      caption={`NPV₁₀ by scenario, expressed in ${u.currencyCode} millions.`}
      columns={[
        { label: 'Scenario' },
        { label: 'NPV₁₀', unit: `${u.currencyCode} M` },
      ]}
      rows={data.map((d) => [d.scenario, Number(d.npv.toFixed(1))])}
    />
    </figure>
  );
}
