// ════════════════════════════════════════════════════════════════════════
// Shared fiscal engine utilities
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  ProjectInputs,
  TimeSeriesData,
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

/** Scale every line of a cost profile by `factor`. */
export function scaleCostProfile(costs: CostProfile, factor: number): CostProfile {
  if (factor === 1) return costs;
  const scale = (series: TimeSeriesData<USD>): TimeSeriesData<USD> => {
    const out: Record<number, USD> = {};
    for (const [y, v] of Object.entries(series)) out[Number(y)] = usd((v as number) * factor);
    return out;
  };
  return {
    capexDrilling: scale(costs.capexDrilling),
    capexFacilities: scale(costs.capexFacilities),
    capexSubsea: scale(costs.capexSubsea),
    capexOther: scale(costs.capexOther),
    opexFixed: scale(costs.opexFixed),
    opexVariable: scale(costs.opexVariable),
    abandonmentCost: scale(costs.abandonmentCost),
  };
}

const workingInterestCache = new WeakMap<CostProfile, Map<number, CostProfile>>();

/**
 * Project costs at the working-interest (equity) share.
 *
 * Cost inputs are entered on a 100% field basis (variable OPEX, for
 * example, is built from 100% production). `computeRevenue` already puts
 * revenue at the equity share, so every contractor cash flow and financial
 * statement must take costs on the same basis — otherwise an 85% partner
 * would be charged 100% of the costs.
 */
export function workingInterestCosts(project: ProjectInputs): CostProfile {
  const share = project.project.equityShare;
  let byShare = workingInterestCache.get(project.costProfile);
  if (!byShare) {
    byShare = new Map();
    workingInterestCache.set(project.costProfile, byShare);
  }
  let scaled = byShare.get(share);
  if (!scaled) {
    scaled = scaleCostProfile(project.costProfile, share);
    byShare.set(share, scaled);
  }
  return scaled;
}

/** Manage CAPEX depreciation schedule for capital allowance.
 *  Default: straight line over CAPEX_DEPRECIATION_YEARS. `weights` gives a
 *  custom schedule, e.g. [0.6, 0.4] for the LLA two-year accelerated
 *  allowance (20% initial + 40% annual, then the balance). */
export class DepreciationSchedule {
  private entries: Array<{ amount: number; step: number }> = [];
  private readonly weights: readonly number[];

  constructor(weights?: readonly number[]) {
    this.weights = weights ?? Array<number>(CAPEX_DEPRECIATION_YEARS).fill(1 / CAPEX_DEPRECIATION_YEARS);
  }

  addCapex(totalCapex: number): void {
    if (totalCapex > 0) {
      this.entries.push({ amount: totalCapex, step: 0 });
    }
  }

  computeAllowance(): number {
    let allowance = 0;
    for (const entry of this.entries) {
      if (entry.step < this.weights.length) {
        allowance += entry.amount * this.weights[entry.step]!;
        entry.step++;
      }
    }
    return allowance;
  }
}

/**
 * Unabsorbed tax-loss pool (PITA 1967 / ITA 1967).
 *
 * A year's adjusted loss — including capital allowances in excess of the
 * adjusted income — is carried forward and set off against the statutory
 * income of later years, oldest vintage first. Without this pool the
 * pre-production and late-life losses of a PSC are silently forfeited and
 * lifetime tax is over-stated.
 *
 * `maxCarryForwardYears` bounds how long a loss vintage survives
 * (ITA 1967 s.44(5F): 10 consecutive years of assessment from YA 2019).
 * Default is unlimited.
 */
export class TaxLossPool {
  private vintages: Array<{ year: number; amount: number }> = [];

  constructor(private readonly maxCarryForwardYears: number = Infinity) {}

  /**
   * Apply this year's adjusted income/(loss). Returns the brought-forward
   * losses relieved this year and the chargeable income after relief.
   */
  apply(year: number, adjustedIncome: number): { lossRelief: number; chargeableIncome: number } {
    this.vintages = this.vintages.filter((v) => year - v.year <= this.maxCarryForwardYears);

    if (adjustedIncome <= 0) {
      if (adjustedIncome < 0) this.vintages.push({ year, amount: -adjustedIncome });
      return { lossRelief: 0, chargeableIncome: 0 };
    }

    let remaining = adjustedIncome;
    let lossRelief = 0;
    for (const v of this.vintages) {
      if (remaining <= 0) break;
      const used = Math.min(v.amount, remaining);
      v.amount -= used;
      remaining -= used;
      lossRelief += used;
    }
    this.vintages = this.vintages.filter((v) => v.amount > 0);
    return { lossRelief, chargeableIncome: remaining };
  }

  /** Unabsorbed losses carried forward at the end of the last applied year. */
  get balance(): number {
    return this.vintages.reduce((s, v) => s + v.amount, 0);
  }
}

/** Compute government deductions taken from gross revenue before the
 *  cost-recovery / profit split.
 *
 *   Royalty:        cash payment of 10% of gross production to the Federal
 *                   and State Governments (PDA 1974; MPM fiscal terms).
 *   Export duty:    applied to LIQUID petroleum (oil + condensate) only — 10%
 *                   on crude oil under the Customs Duties Order 2025. Gas /
 *                   LNG is not charged. Applying it to gas would over-state
 *                   government take for every Sarawak gas block.
 *                   See ASSESSMENT.md F5.
 *   Sarawak SST:    5% under the State Sales Tax Ordinance 1998 (Sarawak), in
 *                   force for petroleum products from 1 January 2019. Applied
 *                   to total gross revenue. Set `sarawakSstRate: 0.05` for
 *                   Sarawak blocks; 0 for Peninsular / Sabah / non-Malaysian.
 *                   See ASSESSMENT.md D1 / glossary 'sst'.
 *
 *  Research cess is NOT a pre-split deduction: it is 0.5% of the
 *  contractor's cost oil + profit oil — see `researchCessOnEntitlement`.
 */
export function computeGovtDeductions(
  revenue: {
    grossRevenueOil: number;
    grossRevenueGas: number;
    grossRevenueCond: number;
    totalGrossRevenue: number;
  },
  fiscalConfig: {
    royaltyRate: number;
    exportDutyRate?: number;
    sarawakSstRate?: number;
  },
) {
  const royalty = revenue.totalGrossRevenue * fiscalConfig.royaltyRate;
  // Export duty applies to oil + condensate only (liquid petroleum).
  const exportDuty = (revenue.grossRevenueOil + revenue.grossRevenueCond) * (fiscalConfig.exportDutyRate || 0);
  const sarawakSst = revenue.totalGrossRevenue * (fiscalConfig.sarawakSstRate || 0);
  const revenueAfterRoyalty = revenue.totalGrossRevenue - royalty - exportDuty - sarawakSst;
  return { royalty, exportDuty, sarawakSst, revenueAfterRoyalty };
}

/** Research cess — a contractor payment of `rate` (0.5%) on the aggregate
 *  of its cost oil and profit oil. Not applicable to SFA / LLA PSCs. */
export function researchCessOnEntitlement(
  costRecoveryAmount: number,
  contractorProfitShare: number,
  rate: number | undefined,
): number {
  return Math.max(0, costRecoveryAmount + contractorProfitShare) * (rate || 0);
}

/** Cost recovery ceiling: a share of GROSS production value (MPM: EPT
 *  ceiling "fixed at 70 per cent of the gross production"), never more
 *  than what is left after the cash payment and other pre-split deductions. */
export function costRecoveryCeilingFromGross(
  totalGrossRevenue: number,
  ceilingPct: number,
  revenueAfterRoyalty: number,
): number {
  return Math.max(0, Math.min(totalGrossRevenue * ceilingPct, revenueAfterRoyalty));
}

/**
 * Pool of an investment allowance (PITA) or investment tax allowance (ITA)
 * earned on qualifying capex and utilised against a capped share of
 * statutory income, with the unutilised balance carried forward.
 */
export class AllowancePool {
  private balance = 0;
  private firstYear: number | null = null;

  constructor(
    private readonly rate: number,
    private readonly statutoryIncomeCap: number,
    private readonly periodYears: number,
  ) {}

  /** Earn the allowance on this year's qualifying capex (within the period). */
  accrue(year: number, qualifyingCapex: number): void {
    if (qualifyingCapex <= 0) return;
    if (this.firstYear === null) this.firstYear = year;
    if (year - this.firstYear < this.periodYears) this.balance += qualifyingCapex * this.rate;
  }

  /** Utilise against this year's statutory income; returns the amount used. */
  utilise(statutoryIncome: number): number {
    const used = Math.min(this.balance, Math.max(0, statutoryIncome) * this.statutoryIncomeCap);
    this.balance -= used;
    return used;
  }
}

/** Compute BOE production for a year */
export function computeYearlyBoe(oilBpd: number, condBpd: number, gasMMscfd: number): number {
  return (oilBpd + condBpd) * 365 + gasMMscfd * 365 * 1_000_000 / 6_000;
}
