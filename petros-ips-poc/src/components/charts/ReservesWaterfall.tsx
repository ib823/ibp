import { useMemo } from 'react';
import type { ReservesMovement } from '@/engine/types';

interface ReservesWaterfallProps {
  movements: readonly ReservesMovement[];
  title: string;
  unit: string;
}

interface Bar {
  label: string;
  value: number;
  start: number;
  end: number;
  color: string;
  isFinal?: boolean;
}

export function ReservesWaterfall({ movements, title, unit }: ReservesWaterfallProps) {
  const bars = useMemo(() => {
    if (movements.length === 0) return [];
    const m = movements[0]!;

    const result: Bar[] = [];
    let running = m.opening;

    result.push({
      label: 'Opening',
      value: m.opening,
      start: 0,
      end: m.opening,
      color: '#1E3A5F',
    });

    if (m.extensions !== 0) {
      const prev = running;
      running += m.extensions;
      result.push({
        label: 'Extensions',
        value: m.extensions,
        start: prev,
        end: running,
        color: m.extensions >= 0 ? '#2D8A4E' : '#C0392B',
      });
    }

    if (m.technicalRevisions !== 0) {
      const prev = running;
      running += m.technicalRevisions;
      result.push({
        label: 'Tech. Revisions',
        value: m.technicalRevisions,
        start: prev,
        end: running,
        color: m.technicalRevisions >= 0 ? '#2D8A4E' : '#C0392B',
      });
    }

    if (m.economicRevisions !== 0) {
      const prev = running;
      running += m.economicRevisions;
      result.push({
        label: 'Econ. Revisions',
        value: m.economicRevisions,
        start: prev,
        end: running,
        color: m.economicRevisions >= 0 ? '#2D8A4E' : '#C0392B',
      });
    }

    if (m.production > 0) {
      const prev = running;
      running -= m.production;
      result.push({
        label: 'Production',
        value: -m.production,
        start: prev,
        end: running,
        color: '#C0392B',
      });
    }

    result.push({
      label: 'Closing',
      value: m.closing,
      start: 0,
      end: m.closing,
      color: '#1E3A5F',
      isFinal: true,
    });

    return result;
  }, [movements]);

  if (bars.length === 0) return <p className="text-xs text-text-muted">No data</p>;

  const maxVal = Math.max(...bars.map((b) => Math.max(b.start, b.end)));
  const minVal = Math.min(0, ...bars.map((b) => Math.min(b.start, b.end)));
  const range = maxVal - minVal || 1;

  const svgW = 420;
  const svgH = 220;
  const padL = 8;
  const padR = 8;
  const padT = 24;
  const padB = 50;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const barW = Math.min(50, (chartW / bars.length) * 0.65);
  const gap = (chartW - barW * bars.length) / (bars.length + 1);

  const scaleY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;

  return (
    <div>
      <div className="text-[11px] font-semibold text-text-secondary mb-1">{title} ({unit})</div>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 220 }}>
        <line x1={padL} x2={svgW - padR} y1={scaleY(0)} y2={scaleY(0)} stroke="#E2E5EA" strokeWidth={1} />
        {bars.map((bar, i) => {
          const x = padL + gap + i * (barW + gap);
          const top = scaleY(Math.max(bar.start, bar.end));
          const bottom = scaleY(Math.min(bar.start, bar.end));
          const h = Math.max(1, bottom - top);
          return (
            <g key={i}>
              <rect x={x} y={top} width={barW} height={h} fill={bar.color} opacity={0.85} />
              {i < bars.length - 1 && !bars[i + 1]!.isFinal && (
                <line
                  x1={x + barW}
                  x2={x + barW + gap}
                  y1={scaleY(bar.end)}
                  y2={scaleY(bar.end)}
                  stroke="#9CA3AF"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              )}
              <text x={x + barW / 2} y={top - 4} textAnchor="middle" fontSize={8} fill="#1A1A2E" className="font-data">
                {bar.value >= 0 ? bar.value.toFixed(1) : `(${Math.abs(bar.value).toFixed(1)})`}
              </text>
              <text x={x + barW / 2} y={svgH - padB + 12} textAnchor="middle" fontSize={7} fill="#6B7280">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
