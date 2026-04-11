// ════════════════════════════════════════════════════════════════════════
// Shared fiscal engine utilities
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  USD,
} from '@/engine/types';

export const DISCOUNT_RATE = 0.10;
export const CAPEX_DEPRECIATION_YEARS = 5;
// NOTE: This constant is ALSO exposed in the editable Display Unit
// conversion table as the `mmscf-mmbtu` row. The table row is **display
// only** — the gas revenue math in `grossRevenueGas` hardcodes 1.055 and
// will not respond to user edits. The UnitConversionSection UI flags the
// corresponding row with a warning badge.
export const MSCF_TO_MMBTU = 1.055; // 1 Mscf ≈ 1.055 MMBtu

export function usd(n: number): USD {
  return n as USD;
}

export function getVal<T extends number>(
  series: Readonly<Record<number, T>> | undefined,
  year: number,
): number {
  return (series?.[year] as number | undefined) ?? 0;
}

/** Compute gross revenue components for a given year (raw USD) */
export function computeRevenue(
  production: ProductionProfile,
  priceDeck: PriceDeck,
  year: number,
  equityShare: number,
) {
  const oilBpd = getVal(production.oil, year);
  const gasMMscfd = getVal(production.gas, year);
  const condBpd = getVal(production.condensate, year);

  const oilPrice = getVal(priceDeck.oil, year);
  const gasPrice = getVal(priceDeck.gas, year);
  const condPrice = getVal(priceDeck.condensate, year);

  const grossRevenueOil = oilBpd * 365 * oilPrice * equityShare;
  const grossRevenueGas = gasMMscfd * 1000 * MSCF_TO_MMBTU * gasPrice * 365 * equityShare;
  const grossRevenueCond = condBpd * 365 * condPrice * equityShare;
  const totalGrossRevenue = grossRevenueOil + grossRevenueGas + grossRevenueCond;

  return { grossRevenueOil, grossRevenueGas, grossRevenueCond, totalGrossRevenue, oilBpd, gasMMscfd, condBpd };
}

/** Sum CAPEX categories for a year */
export function computeCosts(costs: CostProfile, year: number) {
  const totalCapex =
    getVal(costs.capexDrilling, year) +
    getVal(costs.capexFacilities, year) +
    getVal(costs.capexSubsea, year) +
    getVal(costs.capexOther, year);

  const totalOpex =
    getVal(costs.opexFixed, year) +
    getVal(costs.opexVariable, year);

  const abandonmentCost = getVal(costs.abandonmentCost, year);

  return { totalCapex, totalOpex, abandonmentCost };
}

/** Manage CAPEX depreciation schedule for capital allowance */
export class DepreciationSchedule {
  private entries: Array<{ amount: number; yearsRemaining: number }> = [];

  addCapex(totalCapex: number): void {
    if (totalCapex > 0) {
      this.entries.push({
        amount: totalCapex / CAPEX_DEPRECIATION_YEARS,
        yearsRemaining: CAPEX_DEPRECIATION_YEARS,
      });
    }
  }

  computeAllowance(): number {
    let allowance = 0;
    for (const entry of this.entries) {
      if (entry.yearsRemaining > 0) {
        allowance += entry.amount;
        entry.yearsRemaining--;
      }
    }
    return allowance;
  }
}

/** Compute government deductions from gross revenue (royalty, export duty, research cess) */
export function computeGovtDeductions(
  totalGrossRevenue: number,
  fiscalConfig: { royaltyRate: number; exportDutyRate?: number; researchCessRate?: number },
) {
  const royalty = totalGrossRevenue * fiscalConfig.royaltyRate;
  const exportDuty = totalGrossRevenue * (fiscalConfig.exportDutyRate || 0);
  const researchCess = totalGrossRevenue * (fiscalConfig.researchCessRate || 0);
  const revenueAfterRoyalty = totalGrossRevenue - royalty - exportDuty - researchCess;
  return { royalty, exportDuty, researchCess, revenueAfterRoyalty };
}

/** Compute BOE production for a year */
export function computeYearlyBoe(oilBpd: number, condBpd: number, gasMMscfd: number): number {
  return (oilBpd + condBpd) * 365 + gasMMscfd * 365 * 1_000_000 / 6_000;
}
