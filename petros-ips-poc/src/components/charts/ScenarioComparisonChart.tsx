import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';

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

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="scenario"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, 'NPV₁₀']}
        />
        <Bar dataKey="npv" maxBarSize={48} radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.scenarioKey} fill={SCENARIO_COLORS[d.scenarioKey]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
