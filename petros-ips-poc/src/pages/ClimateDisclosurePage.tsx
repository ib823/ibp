// ════════════════════════════════════════════════════════════════════════
// IFRS S2 — Climate Disclosure page (D35)
//
// Mandatory for Bursa-listed Malaysian entities from FY2025+. PETROS as
// Sarawak's state vehicle in Gas Roadmap + NETR context is high-disclosure-
// risk. This page demonstrates Pillar 4 (Metrics & Targets) — Scope 1/2/3
// emissions schedule + internal carbon-price liability.
// ════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { generateIFRSS2Schedule, aggregatePortfolioEmissions, DEFAULT_EMISSIONS_FACTORS } from '@/engine/financial/ifrs-s2';
import { useProjectStore } from '@/store/project-store';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { fmtNum } from '@/lib/format';
import { KpiCard } from '@/components/shared/KpiCard';

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

      <div className="text-caption text-text-muted">
        <strong>IFRS S2 four-pillar framework:</strong> Governance (1) · Strategy (2) · Risk Management (3) · Metrics &amp; Targets (4 — this page).
        Pillars 1-3 are narrative disclosures handled in the IFRS S2 SAC story. Reference: IFRS S2 (June 2023);
        Bursa Malaysia Sustainability Reporting Framework; Malaysian National Energy Transition Roadmap (NETR 2023).
      </div>
    </div>
  );
}
