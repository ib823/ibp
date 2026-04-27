import { useMemo } from 'react';
import type { YearlyCashflow, FiscalRegimeType } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { getEntry } from '@/lib/educational-content';

interface WaterfallChartProps {
  cashflows: readonly YearlyCashflow[];
  fiscalRegimeType?: FiscalRegimeType;
}

interface WaterfallBar {
  label: string;
  value: number;
  start: number;
  end: number;
  color: string;
  isFinal?: boolean;
  /** Educational entry ID — surfaces as SVG <title> tooltip on hover. */
  eduEntryId?: string;
}

const SHORT_LABELS: Record<string, string> = {
  'Gross Revenue': 'Revenue',
  'Export Duty': 'Exp. Duty',
  'Research Cess': 'Res. Cess',
  'PETRONAS Share': 'PTNS Share',
  'Supp. Payment': 'Supp. Pmt',
  'PITA Tax': 'PITA',
  'Corp. Tax': 'Corp. Tax',
  'Net Costs': 'Costs',
  'Contractor NCF': 'Contr. NCF',
};

export function WaterfallChart({ cashflows, fiscalRegimeType }: WaterfallChartProps) {
  const u = useDisplayUnits();
  const bars = useMemo(() => {
    const totalRevenue = cashflows.reduce((s, cf) => s + (cf.totalGrossRevenue as number), 0);
    const totalRoyalty = cashflows.reduce((s, cf) => s + (cf.royalty as number), 0);
    const totalExportDuty = cashflows.reduce((s, cf) => s + (cf.exportDuty as number), 0);
    const totalResearchCess = cashflows.reduce((s, cf) => s + (cf.researchCess as number), 0);
    const totalPetronasShare = cashflows.reduce((s, cf) => s + (cf.hostProfitShare as number), 0);
    const totalSP = cashflows.reduce((s, cf) => s + (cf.supplementaryPayment as number), 0);
    const totalTax = cashflows.reduce((s, cf) => s + (cf.pitaTax as number), 0);
    const totalNcf = cashflows.reduce((s, cf) => s + (cf.netCashFlow as number), 0);

    const isDownstream = fiscalRegimeType === 'DOWNSTREAM';
    const taxLabel = isDownstream ? 'Corp. Tax' : 'PITA Tax';

    // Waterfall: Revenue → deductions → NCF
    const result: WaterfallBar[] = [];
    let running = totalRevenue;

    result.push({
      label: 'Gross Revenue',
      value: totalRevenue,
      start: 0,
      end: totalRevenue,
      color: '#1E3A5F',
      eduEntryId: 'E-22',
    });

    if (totalRoyalty > 0) {
      running -= totalRoyalty;
      result.push({
        label: 'Royalty',
        value: -totalRoyalty,
        start: running + totalRoyalty,
        end: running,
        color: '#C0392B',
        eduEntryId: 'E-23',
      });
    }

    if (totalExportDuty > 0) {
      running -= totalExportDuty;
      result.push({
        label: 'Export Duty',
        value: -totalExportDuty,
        start: running + totalExportDuty,
        end: running,
        color: '#D35400',
      });
    }

    if (totalResearchCess > 0) {
      running -= totalResearchCess;
      result.push({
        label: 'Research Cess',
        value: -totalResearchCess,
        start: running + totalResearchCess,
        end: running,
        color: '#E67E22',
      });
    }

    if (totalPetronasShare > 0) {
      running -= totalPetronasShare;
      result.push({
        label: 'PETRONAS Share',
        value: -totalPetronasShare,
        start: running + totalPetronasShare,
        end: running,
        color: '#E74C3C',
        eduEntryId: 'E-24',
      });
    }

    if (totalSP > 0) {
      running -= totalSP;
      result.push({
        label: 'Supp. Payment',
        value: -totalSP,
        start: running + totalSP,
        end: running,
        color: '#D35400',
        eduEntryId: 'E-24a',
      });
    }

    if (totalTax > 0) {
      running -= totalTax;
      result.push({
        label: taxLabel,
        value: -totalTax,
        start: running + totalTax,
        end: running,
        color: '#C0392B',
        eduEntryId: 'E-25',
      });
    }

    // Costs bar: CAPEX + OPEX + ABEX minus cost recovery received
    const impliedCosts = totalRevenue - totalRoyalty - totalExportDuty - totalResearchCess - totalPetronasShare - totalSP - totalTax - totalNcf;
    if (impliedCosts > 0) {
      running -= impliedCosts;
      result.push({
        label: 'Net Costs',
        value: -impliedCosts,
        start: running + impliedCosts,
        end: running,
        color: '#8B4513',
        eduEntryId: 'E-26',
      });
    }

    result.push({
      label: 'Contractor NCF',
      value: totalNcf,
      start: 0,
      end: totalNcf,
      color: totalNcf >= 0 ? '#2D8A4E' : '#C0392B',
      isFinal: true,
      eduEntryId: 'E-27',
    });

    return result;
  }, [cashflows, fiscalRegimeType]);

  if (bars.length === 0) return null;

  const maxVal = Math.max(...bars.map((b) => Math.max(b.start, b.end)));
  const minVal = Math.min(0, ...bars.map((b) => Math.min(b.start, b.end)));
  const range = maxVal - minVal || 1;

  const svgW = 700;
  const svgH = 300;
  const padL = 10;
  const padR = 10;
  const padT = 30;
  const padB = 60;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const barWidth = Math.min(60, (chartW / bars.length) * 0.7);
  const barGap = (chartW - barWidth * bars.length) / (bars.length + 1);

  const scaleY = (v: number) => padT + chartH - ((v - minVal) / range) * chartH;
  const zeroY = scaleY(0);

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ maxHeight: 300 }}>
      {/* Zero line */}
      <line
        x1={padL}
        x2={svgW - padR}
        y1={zeroY}
        y2={zeroY}
        stroke="#E2E5EA"
        strokeWidth={1}
      />

      {bars.map((bar, i) => {
        const x = padL + barGap + i * (barWidth + barGap);
        const top = scaleY(Math.max(bar.start, bar.end));
        const bottom = scaleY(Math.min(bar.start, bar.end));
        const height = Math.max(1, bottom - top);
        const entry = bar.eduEntryId ? getEntry(bar.eduEntryId) : undefined;
        const tooltipText = entry?.tooltip ?? undefined;

        return (
          <g key={i}>
            {tooltipText && <title>{tooltipText}</title>}
            {/* Bar */}
            <rect
              x={x}
              y={top}
              width={barWidth}
              height={height}
              fill={bar.color}
              opacity={0.9}
            />
            {/* Connector line to next bar */}
            {i < bars.length - 1 && !bars[i + 1]!.isFinal && (
              <line
                x1={x + barWidth}
                x2={x + barWidth + barGap}
                y1={scaleY(bar.end)}
                y2={scaleY(bar.end)}
                stroke="#9CA3AF"
                strokeWidth={1}
                strokeDasharray="3,2"
              />
            )}
            {/* Value label */}
            <text
              x={x + barWidth / 2}
              y={top - 6}
              textAnchor="middle"
              className="font-data"
              fill="#1A1A2E"
              fontSize={11}
            >
              {u.money(bar.value)}
            </text>
            {/* Bar label */}
            <text
              x={x + barWidth / 2}
              y={svgH - padB + 14}
              textAnchor="middle"
              fill="#6B7280"
              fontSize={bars.length > 6 ? 9 : 11}
            >
              {bars.length > 6 ? (SHORT_LABELS[bar.label] ?? bar.label) : bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
