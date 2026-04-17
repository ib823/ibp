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
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { computeCosts } from '@/engine/fiscal/shared';
import { ChartShell } from '@/components/charts/ChartShell';

interface AnnualCashFlowChartProps {
  cashflows: readonly YearlyCashflow[];
  costProfile: CostProfile;
}

// Canonical chart-migration pattern for display units:
//
//   1. Pull bound values from `useDisplayUnits()`.
//   2. Pre-scale raw base-currency (USD) values to DISPLAY-CURRENCY-MILLIONS
//      inside a `useMemo` whose deps include `u.currencyFactor` (a scalar,
//      not the whole conversions array — re-renders stay cheap).
//   3. Render axis labels / tickFormatter / Tooltip formatter / ReferenceLine
//      values against the ALREADY-SCALED plot data. Never apply the factor
//      a second time inside the formatter.
//   4. YAxis label reads `${u.currencyCode} M` so the unit is spelled out
//      next to the plot without clashing with accounting-style KPI cards.
export function AnnualCashFlowChart({ cashflows, costProfile }: AnnualCashFlowChartProps) {
  const u = useDisplayUnits();

  const data = useMemo(() => {
    return cashflows.map((cf) => {
      const cost = computeCosts(costProfile, cf.year);
      const totalCapex = cost.totalCapex + cost.abandonmentCost;
      return {
        year: cf.year,
        revenue: ((cf.totalGrossRevenue as number) * u.currencyFactor) / 1e6,
        capex: (-(totalCapex) * u.currencyFactor) / 1e6,
        ncf: ((cf.netCashFlow as number) * u.currencyFactor) / 1e6,
        cumNcf: ((cf.cumulativeCashFlow as number) * u.currencyFactor) / 1e6,
      };
    });
  }, [cashflows, costProfile, u.currencyFactor]);

  return (
    <ChartShell height={250}>
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}`}
          label={{ value: `${u.currencyCode} M`, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, undefined]}
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
    </ChartShell>
  );
}
