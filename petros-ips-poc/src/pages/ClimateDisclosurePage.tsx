// ════════════════════════════════════════════════════════════════════════
// IFRS S2 — Climate Disclosure page (D35)
//
// Mandatory for Bursa-listed Malaysian entities from FY2025+. PETROS as
// Sarawak's state vehicle in Gas Roadmap + NETR context is high-disclosure-
// risk. This page demonstrates Pillar 4 (Metrics & Targets) — Scope 1/2/3
// emissions schedule + internal carbon-price liability.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { generateIFRSS2Schedule, aggregatePortfolioEmissions, DEFAULT_EMISSIONS_FACTORS } from '@/engine/financial/ifrs-s2';
import { useProjectStore } from '@/store/project-store';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { fmtNum } from '@/lib/format';
import { KpiCard } from '@/components/shared/KpiCard';
import { ChartShell } from '@/components/charts/ChartShell';
import { COLORS } from '@/lib/chart-colors';

export default function ClimateDisclosurePage() {
  usePageTitle('IFRS S2 — Climate Disclosures');
  const projects = useProjectStore((s) => s.projects);
  const u = useDisplayUnits();

  const [carbonPrice, setCarbonPrice] = useState(25); // USD/tonne CO2e
  const [scope1Factor, setScope1Factor] = useState(DEFAULT_EMISSIONS_FACTORS.scope1KgPerBoe);
  const [scope2Factor, setScope2Factor] = useState(DEFAULT_EMISSIONS_FACTORS.scope2KgPerBoe);
  const [scope3Factor, setScope3Factor] = useState(DEFAULT_EMISSIONS_FACTORS.scope3KgPerBoe);

  const factors = useMemo(() => ({
    scope1KgPerBoe: scope1Factor,
    scope2KgPerBoe: scope2Factor,
    scope3KgPerBoe: scope3Factor,
  }), [scope1Factor, scope2Factor, scope3Factor]);

  const portfolio = useMemo(() => {
    const schedules = projects.map((p) => generateIFRSS2Schedule(p, factors, carbonPrice));
    return aggregatePortfolioEmissions(schedules);
  }, [projects, factors, carbonPrice]);

  const totals = useMemo(() => {
    let totalScope1 = 0, totalScope2 = 0, totalScope3 = 0, totalCarbonLiability = 0;
    for (const y of portfolio) {
      totalScope1 += y.scope1Emissions;
      totalScope2 += y.scope2Emissions;
      totalScope3 += y.scope3Emissions;
      totalCarbonLiability += y.carbonPriceLiability as number;
    }
    return { totalScope1, totalScope2, totalScope3, totalCarbonLiability };
  }, [portfolio]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text-primary">IFRS S2 — Climate Disclosures (Pillar 4)</h1>
        <p className="text-caption text-text-muted">
          Scope 1/2/3 GHG emissions schedule + internal carbon-price liability. Mandatory for
          Bursa-listed entities from FY2025+. Engine: <code className="text-xs">engine/financial/ifrs-s2.ts</code>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-border bg-white p-4 space-y-3 lg:col-span-1">
          <h2 className="text-body font-semibold text-text-primary">Emissions factors (kg CO₂e per BOE)</h2>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Scope 1 (operational):</span>
            <input type="number" value={scope1Factor}
              onChange={(e) => setScope1Factor(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Scope 2 (purchased energy):</span>
            <input type="number" value={scope2Factor}
              onChange={(e) => setScope2Factor(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body">
            <span className="text-text-secondary">Scope 3 (downstream combustion):</span>
            <input type="number" value={scope3Factor}
              onChange={(e) => setScope3Factor(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <label className="flex items-center justify-between gap-2 text-body pt-2 border-t border-border">
            <span className="text-text-secondary">Internal carbon price (USD / tonne):</span>
            <input type="number" value={carbonPrice}
              onChange={(e) => setCarbonPrice(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 border border-border text-right tabular-nums" />
          </label>
          <p className="text-caption text-text-muted">
            Defaults reflect upstream-typical intensities (Sarawak gas Scope 1 ≈ 12 kg/boe; deepwater
            FPSO ≈ 25 kg/boe). PETROS to confirm in Phase 1a.
          </p>
        </div>

        <div className="border border-border bg-white p-4 space-y-3 lg:col-span-2">
          <h2 className="text-body font-semibold text-text-primary">Portfolio totals (life-of-field)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiCard label="Total Scope 1 (kt CO₂e)" value={fmtNum(totals.totalScope1 / 1000, 1)} className="border-l-2 border-l-danger" />
            <KpiCard label="Total Scope 2 (kt CO₂e)" value={fmtNum(totals.totalScope2 / 1000, 1)} className="border-l-2 border-l-amber" />
            <KpiCard label="Total Scope 3 (kt CO₂e)" value={fmtNum(totals.totalScope3 / 1000, 1)} className="border-l-2 border-l-petrol" />
            <KpiCard label="Carbon-price liability" value={u.money(totals.totalCarbonLiability, { accounting: true })} className="border-l-2 border-l-danger" />
          </div>
        </div>
      </div>

      <div className="border border-border bg-white p-4">
        <h2 className="text-body font-semibold text-text-primary mb-2">
          Annual emissions schedule (portfolio aggregate)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-2 py-1 text-left">Year</th>
                <th className="px-2 py-1 text-right">Scope 1 (t CO₂e)</th>
                <th className="px-2 py-1 text-right">Scope 2 (t CO₂e)</th>
                <th className="px-2 py-1 text-right">Scope 3 (t CO₂e)</th>
                <th className="px-2 py-1 text-right">Total (t CO₂e)</th>
                <th className="px-2 py-1 text-right">Carbon liability</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((y) => (
                <tr key={y.year} className="border-t border-border/30">
                  <td className="px-2 py-1">{y.year}</td>
                  <td className="px-2 py-1 text-right">{fmtNum(y.scope1Emissions, 0)}</td>
                  <td className="px-2 py-1 text-right">{fmtNum(y.scope2Emissions, 0)}</td>
                  <td className="px-2 py-1 text-right">{fmtNum(y.scope3Emissions, 0)}</td>
                  <td className="px-2 py-1 text-right font-semibold">{fmtNum(y.totalEmissions, 0)}</td>
                  <td className="px-2 py-1 text-right">{u.money(y.carbonPriceLiability as number, { accounting: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-text-muted mt-2">
          Carbon-price liability uses Scope 1 + Scope 2 only (operational footprint at internal
          carbon price). Scope 3 is disclosed but typically not provisioned.
        </p>
      </div>

      {/* Stacked area chart — annual emissions by Scope */}
      <div className="border border-border bg-white p-4">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Annual emissions by Scope (kt CO₂e)
        </h3>
        <ChartShell height={260}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={portfolio.map((y) => ({
                year: y.year,
                scope1: y.scope1Emissions / 1000,
                scope2: y.scope2Emissions / 1000,
                scope3: y.scope3Emissions / 1000,
              }))}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `${v.toFixed(0)}`} label={{ value: 'kt CO₂e', position: 'insideLeft', angle: -90, fontSize: 11, fill: COLORS.textSecondary }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} kt`, '']} contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="scope1" stackId="1" stroke={COLORS.danger} fill={COLORS.danger} fillOpacity={0.7} name="Scope 1 (operational)" />
              <Area type="monotone" dataKey="scope2" stackId="1" stroke={COLORS.amber} fill={COLORS.amber} fillOpacity={0.7} name="Scope 2 (purchased energy)" />
              <Area type="monotone" dataKey="scope3" stackId="1" stroke={COLORS.petrol} fill={COLORS.petrol} fillOpacity={0.5} name="Scope 3 (downstream combustion)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* Cumulative carbon-price liability (over time) */}
      <div className="border border-border bg-white p-4">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Cumulative internal-carbon-price liability ({u.currencySymbol}M)
          <span className="text-caption text-text-muted ml-2">Scope 1 + 2 at internal carbon price</span>
        </h3>
        <ChartShell height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={(() => {
                let cum = 0;
                return portfolio.map((y) => {
                  cum += (y.carbonPriceLiability as number) * u.currencyFactor / 1e6;
                  return { year: y.year, cumulative: cum, annual: (y.carbonPriceLiability as number) * u.currencyFactor / 1e6 };
                });
              })()}
              margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: COLORS.textSecondary }} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `${u.currencySymbol}${v.toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => [`${u.currencySymbol}${v.toFixed(1)}M`, '']} contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cumulative" stroke={COLORS.danger} strokeWidth={2} name="Cumulative liability" dot={false} />
              <Line type="monotone" dataKey="annual" stroke={COLORS.amber} strokeWidth={1} strokeDasharray="3,3" name="Annual increment" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      {/* Per-project Scope-1 intensity bar chart */}
      <div className="border border-border bg-white p-4">
        <h3 className="text-body font-semibold text-text-primary mb-2">
          Scope 1 emissions by project (life-of-field, kt CO₂e)
        </h3>
        <ChartShell height={220}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={projects.map((p) => {
                const sched = generateIFRSS2Schedule(p, factors, carbonPrice);
                const total = sched.reduce((s, y) => s + y.scope1Emissions, 0) / 1000;
                return { name: p.project.name, scope1: total };
              })}
              margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textSecondary }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickFormatter={(v: number) => `${v.toFixed(0)}`} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)} kt CO₂e`, 'Scope 1']} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="scope1" fill={COLORS.danger} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>

      <div className="text-caption text-text-muted">
        <strong>IFRS S2 four-pillar framework:</strong> Governance (1) · Strategy (2) · Risk Management (3) · Metrics &amp; Targets (4 — this page).
        Pillars 1-3 are narrative disclosures handled in the IFRS S2 SAC story. Reference: IFRS S2 (June 2023);
        Bursa Malaysia Sustainability Reporting Framework; Malaysian National Energy Transition Roadmap (NETR 2023).
      </div>
    </div>
  );
}
