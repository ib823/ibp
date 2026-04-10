import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface GovernmentTakeChartProps {
  governmentTakePct: number;
  contractorTakePct: number;
}

const COLORS = ['#C0392B', '#1E3A5F'];

export function GovernmentTakeChart({ governmentTakePct, contractorTakePct }: GovernmentTakeChartProps) {
  const exceeds100 = governmentTakePct > 100;

  // Cap donut visual at 100/0 when govt take exceeds 100%
  const govtDisplay = exceeds100 ? 100 : Math.max(0, governmentTakePct);
  const contrDisplay = exceeds100 ? 0 : Math.max(0, contractorTakePct);
  const total = govtDisplay + contrDisplay;

  const data = [
    { name: 'Government', value: govtDisplay },
    { name: 'Contractor', value: contrDisplay },
  ];

  // When one slice is very small (< 5%) or zero, use legend-only mode
  const smallSlice = exceeds100 || (total > 0 && (govtDisplay / total < 0.05 || contrDisplay / total < 0.05));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            label={smallSlice ? undefined : ({ name, value }: { name: string; value: number }) =>
              `${name}: ${value.toFixed(1)}%`
            }
            labelLine={!smallSlice}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => [v.toFixed(1) + '%', undefined]}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      {smallSlice && (
        <div className="flex justify-center gap-6 text-[10px] text-text-secondary -mt-2">
          <span>Government: {governmentTakePct.toFixed(1)}%</span>
          <span>Contractor: {contractorTakePct.toFixed(1)}%</span>
        </div>
      )}
      {exceeds100 && (
        <p className="text-[9px] text-text-muted text-center mt-1">
          * Government take exceeds 100% — contractor returns are negative for this project under current assumptions.
        </p>
      )}
    </div>
  );
}
