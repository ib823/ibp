// ════════════════════════════════════════════════════════════════════════
// IFRS S2 — Climate-related Disclosures (D35)
// ════════════════════════════════════════════════════════════════════════
//
// Mandatory for Bursa Malaysia listed entities from FY2025+.
// PETROS as Sarawak's state vehicle in a Gas Roadmap + NETR context is
// high-disclosure-risk and requires comprehensive climate reporting.
//
// IFRS S2 four-pillar disclosure framework:
//   1. Governance       — Board-level oversight, management's role
//   2. Strategy         — Climate-related risks/opportunities, business
//                          model & strategy resilience, transition plan
//   3. Risk management  — Process for identifying/assessing/managing
//                          climate risks (physical + transition)
//   4. Metrics & targets — Scope 1/2/3 emissions, carbon-related assets,
//                          internal carbon price, climate-related targets
//
// This module produces the QUANTITATIVE schedules (Pillar 4 — metrics
// & targets), driven by project-level emissions data. Pillars 1-3 are
// narrative disclosures handled in the IFRS S2 SAC story.
//
// Reference: IFRS S2 (June 2023); Bursa Malaysia Sustainability Reporting
// Framework; Malaysian National Energy Transition Roadmap (NETR 2023).
// ════════════════════════════════════════════════════════════════════════

import type { ProjectInputs, USD } from '@/engine/types';
import { getVal, usd } from '@/engine/fiscal/shared';

/** IFRS S2 emissions scopes (Greenhouse Gas Protocol). */
export type EmissionsScope = 'scope1' | 'scope2' | 'scope3';

export interface ProjectEmissionsFactors {
  /** kg CO₂e per BOE produced (Scope 1 — operational). Sarawak gas:
   *  ~12 kg/boe. Sarawak deepwater oil: ~25 kg/boe (FPSO power use).
   *  Default 15 kg/boe for upstream. Override per asset class. */
  readonly scope1KgPerBoe: number;
  /** kg CO₂e per BOE produced (Scope 2 — purchased energy).
   *  Default 5 kg/boe for upstream. */
  readonly scope2KgPerBoe: number;
  /** kg CO₂e per BOE produced (Scope 3 — downstream combustion of products).
   *  Default 410 kg/boe (typical product-mix combustion intensity). */
  readonly scope3KgPerBoe: number;
}

export const DEFAULT_EMISSIONS_FACTORS: ProjectEmissionsFactors = {
  scope1KgPerBoe: 15,
  scope2KgPerBoe: 5,
  scope3KgPerBoe: 410,
};

export interface IFRSSchedule_S2_Yearly {
  readonly year: number;
  /** tonnes CO₂e */
  readonly scope1Emissions: number;
  readonly scope2Emissions: number;
  readonly scope3Emissions: number;
  readonly totalEmissions: number;
  /** Internal carbon price liability — provision for future carbon costs
   *  at the entity's chosen internal carbon price. (D35 Pillar 4) */
  readonly carbonPriceLiability: USD;
}

/** Build IFRS S2 metrics schedule for a project. */
export function generateIFRSS2Schedule(
  project: ProjectInputs,
  factors: ProjectEmissionsFactors = DEFAULT_EMISSIONS_FACTORS,
  /** Internal carbon price (USD/tonne CO₂e) — entity policy choice.
   *  Default $25/tonne; PETROS to set per Phase 1a Discovery. */
  internalCarbonPrice: number = 25,
): IFRSSchedule_S2_Yearly[] {
  const out: IFRSSchedule_S2_Yearly[] = [];
  for (let y = project.project.startYear; y <= project.project.endYear; y++) {
    const oilBpd = getVal(project.productionProfile.oil, y);
    const condBpd = getVal(project.productionProfile.condensate, y);
    const gasMMscfd = getVal(project.productionProfile.gas, y);
    const yearlyBoe = (oilBpd + condBpd) * 365 + gasMMscfd * 365 * 1_000_000 / 6_000;

    const scope1 = (yearlyBoe * factors.scope1KgPerBoe) / 1000; // tonnes
    const scope2 = (yearlyBoe * factors.scope2KgPerBoe) / 1000;
    const scope3 = (yearlyBoe * factors.scope3KgPerBoe) / 1000;
    const total = scope1 + scope2 + scope3;
    const carbonLiability = (scope1 + scope2) * internalCarbonPrice; // S1+S2 only for internal pricing

    out.push({
      year: y,
      scope1Emissions: Math.round(scope1),
      scope2Emissions: Math.round(scope2),
      scope3Emissions: Math.round(scope3),
      totalEmissions: Math.round(total),
      carbonPriceLiability: usd(carbonLiability),
    });
  }
  return out;
}

/** Aggregate IFRS S2 schedules across the portfolio for Group disclosure. */
export function aggregatePortfolioEmissions(
  schedules: ReadonlyArray<readonly IFRSSchedule_S2_Yearly[]>,
): IFRSSchedule_S2_Yearly[] {
  const byYear = new Map<number, IFRSSchedule_S2_Yearly>();
  for (const sched of schedules) {
    for (const entry of sched) {
      const cur = byYear.get(entry.year);
      if (!cur) {
        byYear.set(entry.year, { ...entry });
      } else {
        byYear.set(entry.year, {
          year: entry.year,
          scope1Emissions: cur.scope1Emissions + entry.scope1Emissions,
          scope2Emissions: cur.scope2Emissions + entry.scope2Emissions,
          scope3Emissions: cur.scope3Emissions + entry.scope3Emissions,
          totalEmissions: cur.totalEmissions + entry.totalEmissions,
          carbonPriceLiability: usd((cur.carbonPriceLiability as number) + (entry.carbonPriceLiability as number)),
        });
      }
    }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
