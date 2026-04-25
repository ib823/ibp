import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ProductionProfile } from '@/engine/types';
import { fmtNum } from '@/lib/format';
import { ChartShell } from '@/components/charts/ChartShell';
import { COLORS, PRODUCTION_COLORS } from '@/lib/chart-colors';

interface ProductionChartProps {
  production: ProductionProfile;
  startYear: number;
  endYear: number;
}

export function ProductionChart({ production, startYear, endYear }: ProductionChartProps) {
  const data = useMemo(() => {
    const rows = [];
    for (let y = startYear; y <= endYear; y++) {
      const oilBpd = production.oil[y] ?? 0;
      const condBpd = production.condensate[y] ?? 0;
      // Convert gas MMscfd to boe/d: 1 MMscf/d ≈ 166.67 boe/d (6 Mscf/boe)
      const gasBoed = ((production.gas[y] ?? 0) * 1_000_000) / 6_000;
      rows.push({
        year: y,
        oil: Math.round(oilBpd),
        gas: Math.round(gasBoed),
        condensate: Math.round(condBpd),
      });
    }
    return rows;
  }, [production, startYear, endYear]);

  return (
    <ChartShell height={250}>
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: COLORS.textSecondary }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: COLORS.textSecondary }}
          tickLine={false}
          tickFormatter={(v: number) => fmtNum(v)}
          label={{ value: 'boe/d', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.textMuted }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [fmtNum(v), undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Area
          type="monotone"
          dataKey="oil"
          stackId="1"
          stroke={PRODUCTION_COLORS.oilStroke}
          fill={PRODUCTION_COLORS.oilFill}
          fillOpacity={0.8}
          name="Oil"
        />
        <Area
          type="monotone"
          dataKey="gas"
          stackId="1"
          stroke={PRODUCTION_COLORS.gasStroke}
          fill={PRODUCTION_COLORS.gasFill}
          fillOpacity={0.7}
          name="Gas"
        />
        <Area
          type="monotone"
          dataKey="condensate"
          stackId="1"
          stroke={PRODUCTION_COLORS.condensateStroke}
          fill={PRODUCTION_COLORS.condensateFill}
          fillOpacity={0.6}
          name="Condensate"
        />
      </AreaChart>
    </ResponsiveContainer>
    </ChartShell>
  );
}
