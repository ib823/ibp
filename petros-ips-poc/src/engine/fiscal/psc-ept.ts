// ════════════════════════════════════════════════════════════════════════
// EPT (Enhanced Profitability Terms) PSC Fiscal Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_EPT,
  YearlyCashflow,
} from '@/engine/types';
import {
  DISCOUNT_RATE,
  usd,
  computeRevenue,
  computeCosts,
  computeGovtDeductions,
  computeYearlyBoe,
  costRecoveryCeilingFromGross,
  researchCessOnEntitlement,
  DepreciationSchedule,
  TaxLossPool,
} from './shared';

export interface PscEptInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_PSC_EPT;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

/**
 * Compute contractor profit share percentage via linear interpolation
 * between piLower and piUpper boundaries.
 */
function interpolateContractorShare(pi: number, config: FiscalRegime_PSC_EPT): number {
  if (pi <= config.piLower) return config.contractorShareAtLower;
  if (pi >= config.piUpper) return config.contractorShareAtUpper;
  // Linear interpolation
  const fraction = (pi - config.piLower) / (config.piUpper - config.piLower);
  return config.contractorShareAtLower - fraction * (config.contractorShareAtLower - config.contractorShareAtUpper);
}

export function calculatePscEpt(inputs: PscEptInputs): YearlyCashflow[] {
  const {
    yearlyProduction, yearlyCosts, priceDeck, fiscalConfig,
    equityShare, startYear, endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  let unrecoveredCostCF = 0;
  let cumulativeContractorRevenue = 0;
  let cumulativeContractorCost = 0;
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeProductionBoe = 0;
  const depreciation = new DepreciationSchedule();
  const taxLosses = new TaxLossPool();

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);
    const govtDed = computeGovtDeductions(rev, fiscalConfig);
    const { royalty, exportDuty, sarawakSst, revenueAfterRoyalty } = govtDed;

    // PI (lagged — prior year cumulatives)
    const pi = cumulativeContractorCost > 0
      ? cumulativeContractorRevenue / cumulativeContractorCost
      : 0;

    const contractorSharePct = interpolateContractorShare(pi, fiscalConfig);

    // Cost recovery — fixed ceiling
    const cost = computeCosts(yearlyCosts, year);
    const currentYearCosts = cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
    const eligibleCosts = currentYearCosts + unrecoveredCostCF;
    // MPM EPT: ceiling "fixed at 70 per cent of the gross production".
    const costRecoveryCeiling = costRecoveryCeilingFromGross(
      rev.totalGrossRevenue, fiscalConfig.fixedCostRecoveryCeiling, revenueAfterRoyalty,
    );
    const costRecoveryAmount = Math.min(eligibleCosts, costRecoveryCeiling);
    const newUnrecoveredCostCF = eligibleCosts - costRecoveryAmount;

    // Profit split
    const profitOilGas = Math.max(0, revenueAfterRoyalty - costRecoveryAmount);
    const contractorProfitShare = profitOilGas * contractorSharePct;
    const hostProfitShare = profitOilGas * (1 - contractorSharePct);

    // No supplementary payment in EPT
    const supplementaryPayment = 0;
    const contractorEntitlement = costRecoveryAmount + contractorProfitShare;
    const researchCess = researchCessOnEntitlement(
      costRecoveryAmount, contractorProfitShare, fiscalConfig.researchCessRate,
    );

    // Tax — deduct OPEX + ABEX per PITA 1967 Section 33. See ASSESSMENT.md F1, F2.
    // Adjusted losses are carried forward against later income.
    depreciation.addCapex(cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();
    const taxableIncome =
      contractorEntitlement - researchCess - capitalAllowance - cost.totalOpex - cost.abandonmentCost;
    const { lossRelief, chargeableIncome } = taxLosses.apply(year, taxableIncome);
    const pitaTax = chargeableIncome * fiscalConfig.pitaRate;

    // NCF
    const netCashFlow =
      contractorEntitlement - researchCess - pitaTax -
      cost.totalCapex - cost.totalOpex - cost.abandonmentCost;
    cumulativeCashFlow += netCashFlow;

    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    const yearBoe = computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);
    cumulativeProductionBoe += yearBoe;

    // Update accumulators
    cumulativeContractorRevenue += costRecoveryAmount + contractorProfitShare;
    cumulativeContractorCost += currentYearCosts;
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
      sarawakSst: usd(sarawakSst),
      revenueAfterRoyalty: usd(revenueAfterRoyalty),
      costRecoveryCeiling: usd(costRecoveryCeiling),
      costRecoveryAmount: usd(costRecoveryAmount),
      unrecoveredCostCF: usd(newUnrecoveredCostCF),
      profitOilGas: usd(profitOilGas),
      contractorProfitShare: usd(contractorProfitShare),
      hostProfitShare: usd(hostProfitShare),
      contractorEntitlement: usd(contractorEntitlement),
      supplementaryPayment: usd(supplementaryPayment),
      taxableIncome: usd(taxableIncome),
      capitalAllowance: usd(capitalAllowance),
      lossRelief: usd(lossRelief),
      taxAllowanceUsed: usd(0),
      taxLossCF: usd(taxLosses.balance),
      pitaTax: usd(pitaTax),
      netCashFlow: usd(netCashFlow),
      cumulativeCashFlow: usd(cumulativeCashFlow),
      discountedCashFlow: usd(discountedCashFlow),
      cumulativeDiscountedCF: usd(cumulativeDiscountedCF),
      rcIndex: pi, // PI used as rcIndex field for EPT
      profitabilityIndex: 0,
      cumulativeProduction: cumulativeProductionBoe,
    });
  }

  return results;
}
