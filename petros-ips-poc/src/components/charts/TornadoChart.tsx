import { useMemo } from 'react';
import type { TornadoResult, SensitivityVariable } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';

interface TornadoChartProps {
  result: TornadoResult;
}

const VARIABLE_LABELS: Record<SensitivityVariable, string> = {
  oilPrice: 'Oil Price',
  gasPrice: 'Gas Price',
  production: 'Production',
  capex: 'CAPEX',
  opex: 'OPEX',
};

const NEG_COLOR = '#E07060';
const POS_COLOR = '#3B8DBD';

export function TornadoChart({ result }: TornadoChartProps) {
  const u = useDisplayUnits();
  const { bars, minNpv, maxNpv, baseNpv } = useMemo(() => {
    // Group by variable, pick ±30% (largest) or widest available
    const byVariable = new Map<SensitivityVariable, { low: number; high: number }>();
    const maxPct = Math.max(
      ...result.dataPoints.map((d) => Math.abs(d.percentChange)),
    );

    for (const dp of result.dataPoints) {
      if (Math.abs(dp.percentChange) !== maxPct) continue;
      const entry = byVariable.get(dp.variable) ?? { low: 0, high: 0 };
      if (dp.percentChange < 0) {
        entry.low = dp.npvValue as number;
      } else {
        entry.high = dp.npvValue as number;
      }
      byVariable.set(dp.variable, entry);
    }

    // Sort by total swing (high - low) descending
    const sorted = [...byVariable.entries()].sort(
      (a, b) => Math.abs(b[1].high - b[1].low) - Math.abs(a[1].high - a[1].low),
    );

    const base = result.baseNpv as number;
    const allVals = sorted.flatMap(([, v]) => [v.low, v.high]);
    allVals.push(base);

    return {
      bars: sorted,
      minNpv: Math.min(...allVals),
      maxNpv: Math.max(...allVals),
      baseNpv: base,
    };
  }, [result]);

  if (bars.length === 0) return null;

  const svgW = 700;
  const barHeight = 32;
  const barGap = 6;
  const padL = 100;
  const padR = 80;
  const padT = 25;
  const chartW = svgW - padL - padR;
  const svgH = padT + bars.length * (barHeight + barGap) + 30;

  const range = maxNpv - minNpv || 1;
  const scaleX = (v: number) => padL + ((v - minNpv) / range) * chartW;
  const baseLine = scaleX(baseNpv);

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 360 }}>
      {/* Header labels */}
      <text x={padL} y={14} fontSize={11} fill="#9CA3AF">
        {u.money(minNpv)}
      </text>
      <text x={svgW - padR} y={14} fontSize={11} fill="#9CA3AF" textAnchor="end">
        {u.money(maxNpv)}
      </text>
      <text x={baseLine} y={14} fontSize={11} fill="#1A1A2E" textAnchor="middle" fontWeight={600}>
        Base: {u.money(baseNpv)}
      </text>

      {/* Base case vertical line */}
      <line
        x1={baseLine}
        x2={baseLine}
        y1={padT - 5}
        y2={svgH - 10}
        stroke="#1A1A2E"
        strokeWidth={1.5}
        strokeDasharray="4,3"
      />

      {bars.map(([variable, { low, high }], i) => {
        const y = padT + i * (barHeight + barGap);

        // Determine which value is the downside (lower NPV) and upside (higher NPV)
        const downside = Math.min(low, high);
        const upside = Math.max(low, high);
        const xDown = scaleX(downside);
        const xUp = scaleX(upside);

        // Downside bar: from downside point to baseline (red/coral)
        const downBarX = xDown;
        const downBarW = Math.max(0, baseLine - xDown);

        // Upside bar: from baseline to upside point (blue/teal)
        const upBarX = baseLine;
        const upBarW = Math.max(0, xUp - baseLine);

        return (
          <g key={variable}>
            {/* Variable label */}
            <text
              x={padL - 8}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              fontSize={11}
              fill="#1A1A2E"
              fontWeight={500}
            >
              {VARIABLE_LABELS[variable]}
            </text>

            {/* Left bar (downside — lower NPV, red) */}
            {downBarW > 0.5 && (
              <rect
                x={downBarX}
                y={y + 2}
                width={downBarW}
                height={barHeight - 4}
                fill={NEG_COLOR}
                rx={1}
              />
            )}

            {/* Right bar (upside — higher NPV, blue) */}
            {upBarW > 0.5 && (
              <rect
                x={upBarX}
                y={y + 2}
                width={upBarW}
                height={barHeight - 4}
                fill={POS_COLOR}
                rx={1}
              />
            )}

            {/* Value labels */}
            <text
              x={xDown - 4}
              y={y + barHeight / 2 + 3}
              textAnchor="end"
              fontSize={11}
              fill="#6B7280"
              className="font-data"
            >
              {u.money(downside)}
            </text>
            <text
              x={xUp + 4}
              y={y + barHeight / 2 + 3}
              textAnchor="start"
              fontSize={11}
              fill="#6B7280"
              className="font-data"
            >
              {u.money(upside)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
