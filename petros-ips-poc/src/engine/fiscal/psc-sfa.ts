// ════════════════════════════════════════════════════════════════════════
// SFA (Small Field Asset) PSC Fiscal Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_SFA,
  YearlyCashflow,
} from '@/engine/types';
import {
  DISCOUNT_RATE,
  usd,
  computeRevenue,
  computeCosts,
  computeGovtDeductions,
  computeYearlyBoe,
  DepreciationSchedule,
} from './shared';

export interface PscSfaInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_PSC_SFA;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

export function calculatePscSfa(inputs: PscSfaInputs): YearlyCashflow[] {
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
    const govtDed = computeGovtDeductions(rev.totalGrossRevenue, fiscalConfig);
    const { royalty, exportDuty, researchCess, revenueAfterRoyalty } = govtDed;

    // Fixed cost recovery ceiling
    const cost = computeCosts(yearlyCosts, year);
    const currentYearCosts = cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
    const eligibleCosts = currentYearCosts + unrecoveredCostCF;
    const costRecoveryCeiling = revenueAfterRoyalty * fiscalConfig.costRecoveryCeilingPct;
    const costRecoveryAmount = Math.min(eligibleCosts, Math.max(0, costRecoveryCeiling));
    const newUnrecoveredCostCF = eligibleCosts - costRecoveryAmount;

    // Fixed profit split
    const profitOilGas = Math.max(0, revenueAfterRoyalty - costRecoveryAmount);
    const contractorProfitShare = profitOilGas * fiscalConfig.contractorProfitSharePct;
    const petronasProfitShare = profitOilGas * fiscalConfig.petronasProfitSharePct;

    const contractorEntitlement = costRecoveryAmount + contractorProfitShare;

    // Tax (reduced PITA for SFA)
    depreciation.addCapex(cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();
    const taxableIncome = contractorEntitlement - capitalAllowance;
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
