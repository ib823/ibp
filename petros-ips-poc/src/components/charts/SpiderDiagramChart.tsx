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
import type { SpiderResult } from '@/engine/sensitivity/spider';
import type { SensitivityVariable } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { ChartDataTable } from '@/components/shared/ChartDataTable';
import { ChartShell } from '@/components/charts/ChartShell';


interface SpiderDiagramChartProps {
  result: SpiderResult;
}

const VARIABLE_COLORS: Record<SensitivityVariable, string> = {
  oilPrice: '#2D8A4E',
  gasPrice: '#1E3A5F',
  production: '#D4A843',
  capex: '#C0392B',
  opex: '#8B5CF6',
};

const VARIABLE_LABELS: Record<SensitivityVariable, string> = {
  oilPrice: 'Oil Price',
  gasPrice: 'Gas Price',
  production: 'Production',
  capex: 'CAPEX',
  opex: 'OPEX',
};

export function SpiderDiagramChart({ result }: SpiderDiagramChartProps) {
  const u = useDisplayUnits();
  const data = useMemo(() => {
    if (result.lines.length === 0) return [];

    const firstLine = result.lines[0]!;
    return firstLine.points.map((pt, idx) => {
      const row: Record<string, number> = {
        pctChange: pt.percentChange * 100,
      };
      for (const line of result.lines) {
        row[line.variable] = ((line.points[idx]!.npv as number) * u.currencyFactor) / 1e6;
      }
      return row;
    });
  }, [result, u.currencyFactor]);

  return (
    <figure className="m-0" aria-label="Spider diagram: NPV versus percent change for each sensitivity variable.">
    <ChartShell height={350}>
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 10, right: 50, left: 30, bottom: 25 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="pctChange"
          type="number"
          domain={[-30, 30]}
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          label={{ value: '% Change from Base', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#9CA3AF' }}
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`}
          label={{ value: `NPV (${u.currencyCode} M)`, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, undefined]}
          labelFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}% change`}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => VARIABLE_LABELS[value as SensitivityVariable] ?? value}
        />
        <ReferenceLine x={0} stroke="#1A1A2E" strokeWidth={1} strokeDasharray="6,3" />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,3" />

        {result.lines.map((line) => (
          <Line
            key={line.variable}
            type="monotone"
            dataKey={line.variable}
            stroke={VARIABLE_COLORS[line.variable]}
            strokeWidth={2}
            dot={{ r: 2.5, fill: VARIABLE_COLORS[line.variable], strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            name={line.variable}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </ChartShell>
    <ChartDataTable
      caption={`Spider sensitivity data: NPV in ${u.currencyCode} millions for each variable across the plus/minus 30 percent range.`}
      columns={[
        { label: '% change from base' },
        ...result.lines.map((l) => ({ label: VARIABLE_LABELS[l.variable], unit: `${u.currencyCode} M` })),
      ]}
      rows={data.map((row) => [
        `${row['pctChange']! >= 0 ? '+' : ''}${row['pctChange']}%`,
        ...result.lines.map((l) => Number((row[l.variable] ?? 0).toFixed(1))),
      ])}
    />
    </figure>
  );
}
