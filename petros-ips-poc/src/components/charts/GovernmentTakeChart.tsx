import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartShell } from '@/components/charts/ChartShell';
import { COLORS as PALETTE } from '@/lib/chart-colors';

interface GovernmentTakeChartProps {
  governmentTakePct: number;
  contractorTakePct: number;
}

const SLICE_COLORS = [PALETTE.danger, PALETTE.petrol];

/**
 * Government vs Contractor take donut chart.
 *
 * Labels are rendered BELOW the donut in a legend row rather than as
 * outer pie labels. Recharts outer labels extend past the chart's
 * bounding box and get clipped by narrow card containers — this
 * legend-row pattern is the SAP Fiori best practice and avoids
 * truncation at any viewport width.
 */
export function GovernmentTakeChart({ governmentTakePct, contractorTakePct }: GovernmentTakeChartProps) {
  const exceeds100 = governmentTakePct > 100;

  // Cap donut visual at 100/0 when govt take exceeds 100%
  const govtDisplay = exceeds100 ? 100 : Math.max(0, governmentTakePct);
  const contrDisplay = exceeds100 ? 0 : Math.max(0, contractorTakePct);

  const data = [
    { name: 'Government', value: govtDisplay },
    { name: 'Contractor', value: contrDisplay },
  ];

  return (
    <div className="w-full">
      <div className="relative w-full">
        <ChartShell height={180}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={SLICE_COLORS[idx]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [v.toFixed(1) + '%', undefined]}
              contentStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
        </ChartShell>
        {/* Centre label — government take headline figure. When the actual
            value exceeds 100% the donut visual is capped at 100/0 (the
            contractor slice cannot render negative); the asterisk and
            footnote below are the disclosed reconciliation. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-caption text-text-muted uppercase tracking-wider">Govt Take</span>
          <span className="text-xl font-semibold font-data text-danger">
            {governmentTakePct.toFixed(1)}%{exceeds100 && '*'}
          </span>
        </div>
      </div>

      {/* Legend row */}
      <div className="flex justify-center items-center gap-4 text-caption text-text-secondary mt-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SLICE_COLORS[0] }} />
          <span className="whitespace-nowrap">Govt {governmentTakePct.toFixed(1)}%{exceeds100 && '*'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SLICE_COLORS[1] }} />
          <span className="whitespace-nowrap">Contractor {contractorTakePct.toFixed(1)}%</span>
        </span>
      </div>

      {exceeds100 && (
        <p className="text-caption text-text-muted text-center mt-1">
          * Government take exceeds 100% — contractor returns are negative for this project under current assumptions.
        </p>
      )}
    </div>
  );
}
