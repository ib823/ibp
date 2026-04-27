// ════════════════════════════════════════════════════════════════════════
// Legacy PSC (1976 / 1985) Volume-Based Fiscal Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_1976,
  FiscalRegime_PSC_1985,
  ProductionTier,
  YearlyCashflow,
} from '@/engine/types';
import {
  DISCOUNT_RATE,
  usd,
  getVal,
  computeRevenue,
  computeCosts,
  computeGovtDeductions,
  computeYearlyBoe,
  DepreciationSchedule,
} from './shared';

// Cost recovery ceilings for legacy PSCs
const OIL_COST_RECOVERY_CEILING = 0.50;
const GAS_COST_RECOVERY_CEILING = 0.60;

export interface PscLegacyInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_PSC_1976 | FiscalRegime_PSC_1985;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

/**
 * Compute blended contractor share based on production volume tiers.
 * Tiers are applied on total daily oil production (bpd).
 */
function computeTieredContractorShare(
  totalBpd: number,
  tiers: readonly ProductionTier[],
): number {
  if (totalBpd <= 0) return tiers[0]?.contractorSharePct ?? 0.50;

  let totalShare = 0;
  let remaining = totalBpd;

  for (const tier of tiers) {
    const tierWidth = tier.volumeCeiling - tier.volumeFloor;
    const volumeInTier = Math.min(remaining, tierWidth);
    if (volumeInTier <= 0) break;
    totalShare += volumeInTier * tier.contractorSharePct;
    remaining -= volumeInTier;
  }

  return totalShare / totalBpd;
}

export function calculatePscLegacy(inputs: PscLegacyInputs): YearlyCashflow[] {
  const {
    yearlyProduction, yearlyCosts, priceDeck, fiscalConfig,
    equityShare, startYear, endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  let unrecoveredCostCF = 0;
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeProductionBoe = 0;
  const depreciation = new DepreciationSchedule();

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);
    const govtDed = computeGovtDeductions(rev, fiscalConfig);
    const { royalty, exportDuty, researchCess, revenueAfterRoyalty } = govtDed;

    // Determine cost recovery ceiling as blend of oil vs gas revenue weights
    const oilCondRevenue = rev.grossRevenueOil + rev.grossRevenueCond;
    const gasRevenue = rev.grossRevenueGas;
    const totalHcRevenue = oilCondRevenue + gasRevenue;
    const oilWeight = totalHcRevenue > 0 ? oilCondRevenue / totalHcRevenue : 0.5;
    const gasWeight = totalHcRevenue > 0 ? gasRevenue / totalHcRevenue : 0.5;
    const blendedCeilingPct = oilWeight * OIL_COST_RECOVERY_CEILING + gasWeight * GAS_COST_RECOVERY_CEILING;

    // Cost recovery
    const cost = computeCosts(yearlyCosts, year);
    const currentYearCosts = cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
    const eligibleCosts = currentYearCosts + unrecoveredCostCF;
    const costRecoveryCeiling = revenueAfterRoyalty * blendedCeilingPct;
    const costRecoveryAmount = Math.min(eligibleCosts, Math.max(0, costRecoveryCeiling));
    const newUnrecoveredCostCF = eligibleCosts - costRecoveryAmount;

    // Volume-based profit split
    const totalOilBpd = getVal(yearlyProduction.oil, year) + getVal(yearlyProduction.condensate, year);
    const contractorSharePct = computeTieredContractorShare(totalOilBpd, fiscalConfig.productionTiers);

    const profitOilGas = Math.max(0, revenueAfterRoyalty - costRecoveryAmount);
    const contractorProfitShare = profitOilGas * contractorSharePct;
    const petronasProfitShare = profitOilGas * (1 - contractorSharePct);

    const contractorEntitlement = costRecoveryAmount + contractorProfitShare;

    // Tax — deduct OPEX + ABEX per PITA 1967 Section 33. See ASSESSMENT.md F1, F2.
    depreciation.addCapex(cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();
    const taxableIncome = contractorEntitlement - capitalAllowance - cost.totalOpex - cost.abandonmentCost;
    const pitaTax = Math.max(0, taxableIncome * fiscalConfig.pitaRate);

    // NCF
    const netCashFlow =
      costRecoveryAmount + contractorProfitShare - pitaTax -
      cost.totalCapex - cost.totalOpex - cost.abandonmentCost;
    cumulativeCashFlow += netCashFlow;

    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    const yearBoe = computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);
    cumulativeProductionBoe += yearBoe;
    unrecoveredCostCF = newUnrecoveredCostCF;

    results.push({
      year,
      grossRevenueOil: usd(rev.grossRevenueOil),
      grossRevenueGas: usd(rev.grossRevenueGas),
      grossRevenueCond: usd(rev.grossRevenueCond),
      totalGrossRevenue: usd(rev.totalGrossRevenue),
      royalty: usd(royalty),
      exportDuty: usd(exportDuty),
      researchCess: usd(researchCess),
      revenueAfterRoyalty: usd(revenueAfterRoyalty),
      costRecoveryCeiling: usd(costRecoveryCeiling),
      costRecoveryAmount: usd(costRecoveryAmount),
      unrecoveredCostCF: usd(newUnrecoveredCostCF),
      profitOilGas: usd(profitOilGas),
      contractorProfitShare: usd(contractorProfitShare),
      petronasProfitShare: usd(petronasProfitShare),
      contractorEntitlement: usd(contractorEntitlement),
      supplementaryPayment: usd(0),
      taxableIncome: usd(taxableIncome),
      capitalAllowance: usd(capitalAllowance),
      pitaTax: usd(pitaTax),
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
