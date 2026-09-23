// ════════════════════════════════════════════════════════════════════════
// LLA (Late Life Asset) PSC Fiscal Engine
// ════════════════════════════════════════════════════════════════════════
//
// MPM LLA terms — a simplified arrangement with no cost recovery and no
// profit split:
//   • Cash payment: up to 10% of gross production to the Governments
//   • Abandonment cess: Y% of gross production, collected until the
//     Abandonment Cost Commitment is funded, then transferred to PETRONAS,
//     which assumes decommissioning
//   • Contractor's take: 100% − 10% − Y%
//   • No research cess, no supplementary payment
// PITA incentives for LLA PSCs signed 2020–2029: 25% rate, capital
// allowances within two years (20% initial + 40% annual, then the balance),
// export duty exemption.
//
// Reporting on the common schema: the abandonment cess less the
// abandonment spend PETRONAS funds from it is shown as the host share, so
// government receipts + contractor NCF still equal revenue − all costs.
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_LLA,
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
  TaxLossPool,
} from './shared';

/** 20% initial + 40% annual in year one, the balance in year two. */
const LLA_CAPITAL_ALLOWANCE_WEIGHTS = [0.60, 0.40] as const;

export interface PscLlaInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_PSC_LLA;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

export function calculatePscLla(inputs: PscLlaInputs): YearlyCashflow[] {
  const {
    yearlyProduction, yearlyCosts, priceDeck, fiscalConfig,
    equityShare, startYear, endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  const commitment = fiscalConfig.abandonmentCostCommitment * equityShare;
  let cessCollected = 0;
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeProductionBoe = 0;
  const depreciation = new DepreciationSchedule(LLA_CAPITAL_ALLOWANCE_WEIGHTS);
  const taxLosses = new TaxLossPool();

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);
    const { royalty, exportDuty, sarawakSst, revenueAfterRoyalty } =
      computeGovtDeductions(rev, fiscalConfig);

    // Abandonment cess until the commitment is funded
    const abandonmentCess = Math.max(0, Math.min(
      rev.totalGrossRevenue * fiscalConfig.abandonmentCessRate,
      commitment - cessCollected,
      revenueAfterRoyalty,
    ));
    cessCollected += abandonmentCess;

    const contractorTake = revenueAfterRoyalty - abandonmentCess;

    // PETRONAS carries out decommissioning from the cess fund, so ABEX is
    // not a contractor cost under LLA.
    const cost = computeCosts(yearlyCosts, year);

    depreciation.addCapex(cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();
    const taxableIncome = contractorTake - cost.totalOpex - capitalAllowance;
    const { lossRelief, chargeableIncome } = taxLosses.apply(year, taxableIncome);
    const pitaTax = chargeableIncome * fiscalConfig.pitaRate;

    const netCashFlow = contractorTake - pitaTax - cost.totalCapex - cost.totalOpex;
    cumulativeCashFlow += netCashFlow;

    const discountedCashFlow = netCashFlow / Math.pow(1 + DISCOUNT_RATE, yearIndex);
    cumulativeDiscountedCF += discountedCashFlow;

    cumulativeProductionBoe += computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);

    results.push({
      year,
      grossRevenueOil: usd(rev.grossRevenueOil),
      grossRevenueGas: usd(rev.grossRevenueGas),
      grossRevenueCond: usd(rev.grossRevenueCond),
      totalGrossRevenue: usd(rev.totalGrossRevenue),
      royalty: usd(royalty),
      exportDuty: usd(exportDuty),
      researchCess: usd(0),
      sarawakSst: usd(sarawakSst),
      revenueAfterRoyalty: usd(revenueAfterRoyalty),
      costRecoveryCeiling: usd(0),
      costRecoveryAmount: usd(0),
      unrecoveredCostCF: usd(0),
      profitOilGas: usd(revenueAfterRoyalty),
      contractorProfitShare: usd(contractorTake),
      hostProfitShare: usd(abandonmentCess - cost.abandonmentCost),
      contractorEntitlement: usd(contractorTake),
      supplementaryPayment: usd(0),
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
      rcIndex: 0,
      profitabilityIndex: 0,
      cumulativeProduction: cumulativeProductionBoe,
    });
  }

  return results;
}
