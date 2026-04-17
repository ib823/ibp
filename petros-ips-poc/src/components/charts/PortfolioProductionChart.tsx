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
import type { ProjectInputs } from '@/engine/types';
import { fmtNum } from '@/lib/format';
import { ChartDataTable } from '@/components/shared/ChartDataTable';

interface PortfolioProductionChartProps {
  projects: readonly ProjectInputs[];
  activeIds: ReadonlySet<string>;
}

const PROJECT_COLORS = [
  '#1E3A5F', '#2D8A4E', '#D4A843', '#C0392B', '#8B5CF6',
];

export function PortfolioProductionChart({ projects, activeIds }: PortfolioProductionChartProps) {
  const { data, activeProjects } = useMemo(() => {
    const active = projects.filter((p) => activeIds.has(p.project.id));
    const minYear = Math.min(...active.map((p) => p.project.startYear));
    const maxYear = Math.max(...active.map((p) => p.project.endYear));

    const rows = [];
    for (let y = minYear; y <= maxYear; y++) {
      const row: Record<string, number> = { year: y };
      for (const proj of active) {
        const oil = proj.productionProfile.oil[y] ?? 0;
        const cond = proj.productionProfile.condensate[y] ?? 0;
        const gasBoed = ((proj.productionProfile.gas[y] ?? 0) * 1e6) / 6000;
        row[proj.project.id] = Math.round(oil + cond + gasBoed);
      }
      rows.push(row);
    }
    return { data: rows, activeProjects: active };
  }, [projects, activeIds]);

  return (
    <figure className="m-0" aria-label="Portfolio production forecast, stacked by project, in barrels of oil equivalent per day.">
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E5EA" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#6B7280' }}
          tickLine={false}
          tickFormatter={(v: number) => fmtNum(v)}
          label={{ value: 'boe/d', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          formatter={(v: number) => [fmtNum(v), undefined]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {activeProjects.map((proj, i) => (
          <Area
            key={proj.project.id}
            type="monotone"
            dataKey={proj.project.id}
            stackId="1"
            stroke={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            fill={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            fillOpacity={0.7}
            name={proj.project.name}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
    <ChartDataTable
      caption="Annual production in barrels of oil equivalent per day, per project."
      columns={[
        { label: 'Year' },
        ...activeProjects.map((p) => ({ label: p.project.name, unit: 'boe/d' })),
      ]}
      rows={data.map((row) => [
        row['year'] ?? '',
        ...activeProjects.map((p) => (row[p.project.id] ?? 0) as number),
      ])}
    />
    </figure>
  );
}
