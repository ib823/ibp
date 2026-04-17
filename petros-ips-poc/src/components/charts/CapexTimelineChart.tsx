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
} from 'recharts';
import type { ProjectInputs } from '@/engine/types';
import { computeCosts } from '@/engine/fiscal/shared';
import { fmtNum } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';

interface CapexTimelineChartProps {
  projects: readonly ProjectInputs[];
  activeIds: ReadonlySet<string>;
}

const PROJECT_COLORS = [
  '#1E3A5F', '#2D8A4E', '#D4A843', '#C0392B', '#8B5CF6',
];

export function CapexTimelineChart({ projects, activeIds }: CapexTimelineChartProps) {
  const u = useDisplayUnits();
  const { data, activeProjects } = useMemo(() => {
    const active = projects.filter((p) => activeIds.has(p.project.id));
    const minYear = Math.min(...active.map((p) => p.project.startYear));
    const maxYear = Math.max(...active.map((p) => p.project.endYear));

    let cumCapex = 0;
    const rows = [];
    for (let y = minYear; y <= maxYear; y++) {
      const row: Record<string, number> = { year: y };
      let yearTotal = 0;
      for (const proj of active) {
        const cost = computeCosts(proj.costProfile, y);
        const capexM = (cost.totalCapex * u.currencyFactor) / 1e6;
        row[proj.project.id] = Math.round(capexM * 10) / 10;
        yearTotal += capexM;
      }
      cumCapex += yearTotal;
      row['cumCapex'] = Math.round(cumCapex * 10) / 10;
      rows.push(row);
    }
    return { data: rows, activeProjects: active };
  }, [projects, activeIds, u.currencyFactor]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${fmtNum(v)}M`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => `${u.currencySymbol}${fmtNum(v)}M`}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {activeProjects.map((proj, i) => (
          <Bar
            key={proj.project.id}
            yAxisId="left"
            dataKey={proj.project.id}
            stackId="capex"
            fill={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            name={proj.project.name}
            isAnimationActive={false}
          />
        ))}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumCapex"
          stroke="#1A1A2E"
          strokeWidth={2}
          dot={false}
          name="Cumulative"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
