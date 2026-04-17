import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { ChartShell } from '@/components/charts/ChartShell';

interface ScenarioCashFlowOverlayProps {
  results: Record<ScenarioVersion, EconomicsResult>;
}

const SCENARIO_COLORS: Record<ScenarioVersion, string> = {
  high: '#2D8A4E',
  base: '#1E3A5F',
  low: '#D4A843',
  stress: '#C0392B',
};

export function ScenarioCashFlowOverlay({ results }: ScenarioCashFlowOverlayProps) {
  const u = useDisplayUnits();
  const data = useMemo(() => {
    const baseCfs = results.base.yearlyCashflows;
    return baseCfs.map((cf, idx) => {
      const row: Record<string, number> = { year: cf.year };
      for (const s of ['high', 'base', 'low', 'stress'] as const) {
        const scenarioCf = results[s].yearlyCashflows[idx];
        row[s] = scenarioCf
          ? ((scenarioCf.cumulativeCashFlow as number) * u.currencyFactor) / 1e6
          : 0;
      }
      return row;
    });
  }, [results, u.currencyFactor]);

  return (
    <ChartShell height={280}>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`}
          label={{ value: `Cumulative NCF (${u.currencyCode} M)`, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,3" />

        {(['high', 'base', 'low', 'stress'] as const).map((s) => (
          <Line
            key={s}
            type="monotone"
            dataKey={s}
            stroke={SCENARIO_COLORS[s]}
            strokeWidth={s === 'base' ? 2.5 : 1.5}
            dot={false}
            name={s.charAt(0).toUpperCase() + s.slice(1)}
            strokeDasharray={s === 'stress' ? '6,3' : undefined}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </ChartShell>
  );
}
