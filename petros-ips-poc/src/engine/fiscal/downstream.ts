// ════════════════════════════════════════════════════════════════════════
// Downstream / Corporate Tax Fiscal Engine
// ════════════════════════════════════════════════════════════════════════
//
// Not a PSC model — uses standard corporate tax on margin.
// No royalty, cost recovery, or profit split.

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_DOWNSTREAM,
  YearlyCashflow,
} from '@/engine/types';
import {
  DISCOUNT_RATE,
  usd,
  getVal,
  computeRevenue,
  computeCosts,
  computeYearlyBoe,
  AllowancePool,
  DepreciationSchedule,
  TaxLossPool,
} from './shared';

export interface DownstreamInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_DOWNSTREAM;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

export function calculateDownstream(inputs: DownstreamInputs): YearlyCashflow[] {
  const {
    yearlyProduction, yearlyCosts, priceDeck, fiscalConfig,
    equityShare, startYear, endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeProductionBoe = 0;
  let firstRevenueYear: number | null = null;
  const depreciation = new DepreciationSchedule();
  const taxLosses = new TaxLossPool();
  const incentive = fiscalConfig.ccsIncentive;
  const ita = incentive?.type === 'investment-tax-allowance'
    ? new AllowancePool(incentive.allowanceRate, incentive.statutoryIncomeCap, incentive.periodYears)
    : null;

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);

    // CCS revenue: water profile stores CO2 injection in tonnes/day, priced via carbonCredit ($/tonne)
    const co2DailyTonnes = getVal(yearlyProduction.water, year);
    const carbonCreditPrice = getVal(priceDeck.carbonCredit, year);
    const ccsRevenue = co2DailyTonnes * 365 * carbonCreditPrice * equityShare;

    // Total revenue includes both hydrocarbon revenue and CCS storage fees
    const totalRevenue = rev.totalGrossRevenue + ccsRevenue;
    if (firstRevenueYear === null && totalRevenue > 0) firstRevenueYear = year;

    const cost = computeCosts(yearlyCosts, year);
    const totalCosts = cost.totalCapex + cost.totalOpex + cost.abandonmentCost;

    // Depreciation for capital allowance
    depreciation.addCapex(cost.totalCapex);
    ita?.accrue(year, cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();

    // Statutory income = revenue − opex − abex − capital allowance.
    // CCS incentive (Budget 2023, D62) — ONE of:
    //   • Investment Tax Allowance: allowance on qualifying capex set off
    //     against up to 100% of statutory income, balance carried forward;
    //   • Income exemption: 70% of statutory income exempt for 10 years
    //     from the first year of operations.
    // Then brought-forward losses (incl. unabsorbed capital allowance).
    const taxableIncome = totalRevenue - cost.totalOpex - cost.abandonmentCost - capitalAllowance;
    let taxAllowanceUsed = 0;
    if (ita) {
      taxAllowanceUsed = ita.utilise(taxableIncome);
    } else if (
      incentive?.type === 'income-exemption' &&
      firstRevenueYear !== null &&
      year - firstRevenueYear < incentive.periodYears
    ) {
      taxAllowanceUsed = Math.max(0, taxableIncome) * incentive.exemptPct;
    }
    const { lossRelief, chargeableIncome } = taxLosses.apply(year, taxableIncome - taxAllowanceUsed);
    const tax = chargeableIncome * fiscalConfig.taxRate;

    // NCF = revenue - all costs - tax
    const netCashFlow = totalRevenue - totalCosts - tax;
    cumulativeCashFlow += netCashFlow;

    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    const yearBoe = computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);
    cumulativeProductionBoe += yearBoe;

    results.push({
      year,
      grossRevenueOil: usd(rev.grossRevenueOil),
      grossRevenueGas: usd(rev.grossRevenueGas),
      grossRevenueCond: usd(rev.grossRevenueCond),
      totalGrossRevenue: usd(totalRevenue),
      // No royalty/cost recovery/profit split in downstream
      royalty: usd(0),
      exportDuty: usd(0),
      researchCess: usd(0),
      sarawakSst: usd(0),
      revenueAfterRoyalty: usd(totalRevenue),
      costRecoveryCeiling: usd(0),
      costRecoveryAmount: usd(0),
      unrecoveredCostCF: usd(0),
      profitOilGas: usd(0),
      contractorProfitShare: usd(0),
      hostProfitShare: usd(0),
      contractorEntitlement: usd(totalRevenue),
      supplementaryPayment: usd(0),
      taxableIncome: usd(taxableIncome),
      capitalAllowance: usd(capitalAllowance),
      lossRelief: usd(lossRelief),
      taxAllowanceUsed: usd(taxAllowanceUsed),
      taxLossCF: usd(taxLosses.balance),
      pitaTax: usd(tax),
      netCashFlow: usd(netCashFlow),
      cumulativeCashFlow: usd(cumulativeCashFlow),
      discountedCashFlow: usd(discountedCashFlow),
      cumulativeDiscountedCF: usd(cumulativeDiscountedCF),
      rcIndex: 0,
      profitabilityIndex: 0,
      cumulativeProduction: cumulativeProductionBoe,
    });
  }

  return results;
}
