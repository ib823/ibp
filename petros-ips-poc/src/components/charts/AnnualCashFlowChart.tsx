import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { YearlyCashflow, CostProfile } from '@/engine/types';
import { fmtM } from '@/lib/format';
import { computeCosts } from '@/engine/fiscal/shared';

interface AnnualCashFlowChartProps {
  cashflows: readonly YearlyCashflow[];
  costProfile: CostProfile;
}

export function AnnualCashFlowChart({ cashflows, costProfile }: AnnualCashFlowChartProps) {
  const data = useMemo(() => {
    return cashflows.map((cf) => {
      const cost = computeCosts(costProfile, cf.year);
      const totalCapex = cost.totalCapex + cost.abandonmentCost;
      return {
        year: cf.year,
        revenue: (cf.totalGrossRevenue as number) / 1e6,
        capex: -(totalCapex) / 1e6,
        ncf: (cf.netCashFlow as number) / 1e6,
        cumNcf: (cf.cumulativeCashFlow as number) / 1e6,
      };
    });
  }, [cashflows, costProfile]);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => fmtM(v * 1e6)}
          label={{ value: '$M', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => ['$' + v.toFixed(1) + 'M', undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} />
        <Bar dataKey="revenue" fill="#1E3A5F" opacity={0.8} name="Revenue" />
        <Bar dataKey="capex" fill="#C0392B" opacity={0.7} name="CAPEX" />
        <Line
          type="monotone"
          dataKey="cumNcf"
          stroke="#D4A843"
          strokeWidth={2}
          dot={false}
          name="Cumulative NCF"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
