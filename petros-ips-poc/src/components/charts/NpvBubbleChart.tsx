import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
  Cell,
} from 'recharts';
import type { EconomicsResult, FiscalRegimeType } from '@/engine/types';
import { fmtPct } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';

interface NpvBubbleChartProps {
  projects: Array<{
    id: string;
    name: string;
    regime: FiscalRegimeType;
    result: EconomicsResult;
  }>;
}

const REGIME_COLORS: Partial<Record<FiscalRegimeType, string>> = {
  PSC_RC: '#1E3A5F',
  PSC_DW: '#2563EB',
  PSC_EPT: '#2D8A4E',
  PSC_SFA: '#D4A843',
  DOWNSTREAM: '#6B7280',
};

function getRegimeColor(regime: FiscalRegimeType): string {
  return REGIME_COLORS[regime] ?? '#6B7280';
}

interface BubbleDataPoint {
  name: string;
  capex: number;
  npv: number;
  production: number;
  irr: number;
  regime: FiscalRegimeType;
}

export function NpvBubbleChart({ projects }: NpvBubbleChartProps) {
  const u = useDisplayUnits();
  const data = useMemo<BubbleDataPoint[]>(() =>
    projects.map((p) => {
      const lastCf = p.result.yearlyCashflows[p.result.yearlyCashflows.length - 1];
      return {
        name: p.name,
        capex: ((p.result.totalCapex as number) * u.currencyFactor) / 1e6,
        npv: ((p.result.npv10 as number) * u.currencyFactor) / 1e6,
        production: lastCf ? lastCf.cumulativeProduction / 1e6 : 0,
        irr: p.result.irr ?? p.result.mirr,
        regime: p.regime,
      };
    }),
    [projects, u.currencyFactor],
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis
          dataKey="capex"
          type="number"
          name="CAPEX"
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
          label={{ value: `Total CAPEX (${u.currencyCode} M)`, position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9CA3AF' }}
        />
        <YAxis
          dataKey="npv"
          type="number"
          name="NPV"
          tick={{ fontSize: 10, fill: '#6B7280' }}
          tickLine={false}
          label={{ value: `NPV₁₀ (${u.currencyCode} M)`, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9CA3AF' }}
        />
        <ZAxis
          dataKey="production"
          type="number"
          range={[80, 600]}
          name="Production"
        />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3,3" />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.[0]) return null;
            const d = payload[0].payload as BubbleDataPoint;
            return (
              <div className="bg-white border border-border p-2 text-xs shadow-sm">
                <div className="font-semibold mb-1">{d.name}</div>
                <div>NPV: <span className="font-data">{u.currencySymbol}{d.npv.toFixed(1)}M</span></div>
                <div>CAPEX: <span className="font-data">{u.currencySymbol}{d.capex.toFixed(0)}M</span></div>
                <div>IRR: <span className="font-data">{fmtPct(d.irr)}</span></div>
                <div>Regime: <span className="font-medium">{d.regime.replace('_', ' ')}</span></div>
              </div>
            );
          }}
        />
        <Scatter data={data}>
          {data.map((d, i) => (
            <Cell key={i} fill={getRegimeColor(d.regime)} fillOpacity={0.8} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
