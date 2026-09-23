// ════════════════════════════════════════════════════════════════════════
// R/C PSC Fiscal Calculation Engine
// ════════════════════════════════════════════════════════════════════════
//
// Shared by the R/C PSC, the Deepwater R/C PSC (MPM, awards from June 2018)
// and the HPHT PSC. Per year:
//   1. Gross revenue at the equity share
//   2. Cash payment (royalty), export duty (liquids), Sarawak SST
//   3. Lagged R/C index → tranche
//   4. Cost recovery, ceiling = tranche % of GROSS production value
//   5. Profit oil/gas split — per stream (liquids / gas) and, where the
//      tranche defines them, below / above the Threshold Volume
//   6. Supplementary Payment on above-THV profit share (if configured)
//   7. Research cess on the contractor's cost oil + profit oil
//   8. PITA: capital allowance, loss carry-forward, investment allowance
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_RC,
  RCTranche,
  SupplementaryPaymentTerms,
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
  AllowancePool,
  DepreciationSchedule,
  TaxLossPool,
} from './shared';

// ── Constants ─────────────────────────────────────────────────────────

/** Default Supplementary Payment terms — Threshold Volume of 30 MMstb
 *  liquids / 0.75 Tscf gas, 70% SP rate. Contract-specific (D18): override
 *  via `fiscalConfig.supplementaryPayment`, or set it to null for none. */
export const DEFAULT_SP_TERMS: SupplementaryPaymentTerms = {
  rate: 0.70,
  thvLiquidsMmstb: 30,
  thvGasTscf: 0.75,
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Look up the applicable tranche for a given R/C index.
 * Returns the first tranche where rcFloor <= rcIndex < rcCeiling.
 * Falls back to the first tranche if none match (e.g. rcIndex = 0).
 */
function lookupTranche(
  tranches: readonly RCTranche[],
  rcIndex: number,
): RCTranche {
  for (const tranche of tranches) {
    if (rcIndex >= tranche.rcFloor && rcIndex < tranche.rcCeiling) {
      return tranche;
    }
  }
  // Fallback: if rcIndex is exactly on the boundary or negative, use first tranche
  return tranches[0]!;
}

/**
 * Fraction of this year's volume that lies above the threshold, given the
 * cumulative volume before the year. 0 below THV, 1 once fully above it,
 * pro-rated in the crossing year.
 */
export function fractionAboveThreshold(
  cumulativeBefore: number,
  yearVolume: number,
  threshold: number,
): number {
  if (yearVolume <= 0) return 0;
  const cumulativeAfter = cumulativeBefore + yearVolume;
  if (cumulativeAfter <= threshold) return 0;
  if (cumulativeBefore >= threshold) return 1;
  return (cumulativeAfter - threshold) / yearVolume;
}

/** Contractor profit share of each stream for a tranche, blending the
 *  below- and above-THV shares by the fraction of volume above THV. */
export function trancheContractorShares(
  tranche: RCTranche,
  liquidsAboveThv: number,
  gasAboveThv: number,
): { liquids: number; gas: number } {
  const liquidsBelow = tranche.contractorProfitSharePct;
  const liquidsAbove = tranche.contractorProfitSharePctAboveThv ?? liquidsBelow;
  const gasBelow = tranche.gasContractorProfitSharePct ?? liquidsBelow;
  const gasAbove = tranche.gasContractorProfitSharePctAboveThv ?? gasBelow;
  return {
    liquids: liquidsBelow + (liquidsAbove - liquidsBelow) * liquidsAboveThv,
    gas: gasBelow + (gasAbove - gasBelow) * gasAboveThv,
  };
}

// ── Public Interface ──────────────────────────────────────────────────

export interface PscRcInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_PSC_RC;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

/**
 * Calculate R/C PSC fiscal model for a single project across all years.
 *
 * Follows the standard lagged R/C approach: this year's tranche is
 * determined by the R/C index computed from PRIOR year cumulative values.
 * One cost pool is used for oil and gas (the DW R/C PSC keeps separate
 * cost banks — allocating costs by stream needs cost data by commodity).
 */
export function calculatePscRc(inputs: PscRcInputs): YearlyCashflow[] {
  const {
    yearlyProduction,
    yearlyCosts,
    priceDeck,
    fiscalConfig,
    equityShare,
    startYear,
    endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  const spTerms = fiscalConfig.supplementaryPayment === undefined
    ? DEFAULT_SP_TERMS
    : fiscalConfig.supplementaryPayment;
  const thv = fiscalConfig.thresholdVolume;

  // Running accumulators
  let unrecoveredCostCF = 0;
  let cumulativeContractorRevenue = 0; // cost recovery + contractor profit share − SP
  let cumulativeContractorCost = 0;    // capex + opex + abex
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeLiquidsMmstb = 0;      // oil + condensate, 100% field basis
  let cumulativeGasTscf = 0;           // 100% field basis
  let cumulativeProductionBoe = 0;

  const depreciation = new DepreciationSchedule();
  const taxLosses = new TaxLossPool();
  const ia = fiscalConfig.investmentAllowance;
  const investmentAllowance = ia
    ? new AllowancePool(ia.rate, ia.statutoryIncomeCap, ia.periodYears)
    : null;

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    // ── STEP 1: Gross Revenue (raw USD, equity share applied) ────────
    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);
    const { grossRevenueOil, grossRevenueGas, grossRevenueCond, totalGrossRevenue } = rev;
    const grossRevenueLiquids = grossRevenueOil + grossRevenueCond;

    // ── STEP 2: Government deductions → revenue after govt takes ─────
    // Cash payment (royalty), export duty (liquids only — ASSESSMENT.md
    // F5) and Sarawak SST (D1). See shared.ts computeGovtDeductions.
    const { royalty, exportDuty, sarawakSst, revenueAfterRoyalty } =
      computeGovtDeductions(rev, fiscalConfig);

    // ── STEP 3: R/C Index (lagged — uses prior year cumulatives) ──────
    const rcIndex = cumulativeContractorCost > 0
      ? cumulativeContractorRevenue / cumulativeContractorCost
      : 0;
    const tranche = lookupTranche(fiscalConfig.tranches, rcIndex);

    // ── STEP 4: Cost Recovery (ceiling on gross production) ───────────
    const { totalCapex, totalOpex, abandonmentCost } = computeCosts(yearlyCosts, year);

    const currentYearCosts = totalCapex + totalOpex + abandonmentCost;
    const eligibleCosts = currentYearCosts + unrecoveredCostCF;

    const costRecoveryCeiling = costRecoveryCeilingFromGross(
      totalGrossRevenue, tranche.costRecoveryCeilingPct, revenueAfterRoyalty,
    );
    const costRecoveryAmount = Math.min(eligibleCosts, costRecoveryCeiling);
    const newUnrecoveredCostCF = eligibleCosts - costRecoveryAmount;

    // ── STEP 5: Profit Oil/Gas Split ──────────────────────────────────
    // Volumes are tracked on a 100% field basis against the THV; the
    // year's profit oil/gas is attributed to each stream pro-rata to its
    // gross revenue.
    const yearLiquidsMmstb = ((rev.oilBpd + rev.condBpd) * 365) / 1_000_000; // bpd → MMstb/yr
    const yearGasTscf = (rev.gasMMscfd * 365) / 1_000_000;                    // MMscf/d → Tscf/yr

    const liquidsWeight = totalGrossRevenue > 0 ? grossRevenueLiquids / totalGrossRevenue : 0;
    const gasWeight = totalGrossRevenue > 0 ? grossRevenueGas / totalGrossRevenue : 0;

    const shares = trancheContractorShares(
      tranche,
      thv ? fractionAboveThreshold(cumulativeLiquidsMmstb, yearLiquidsMmstb, thv.liquidsMmstb) : 0,
      thv ? fractionAboveThreshold(cumulativeGasTscf, yearGasTscf, thv.gasTscf) : 0,
    );
    const contractorSharePct = liquidsWeight * shares.liquids + gasWeight * shares.gas;

    const profitOilGas = Math.max(0, revenueAfterRoyalty - costRecoveryAmount);
    const contractorProfitShare = profitOilGas * contractorSharePct;
    const hostProfitShare = profitOilGas - contractorProfitShare;

    // ── STEP 6: Supplementary Payment ─────────────────────────────────
    // SP applies only to the contractor profit share attributable to
    // production above the SP Threshold Volume; liquids (crude oil incl.
    // condensate) and gas are tracked independently, pro-rated in the
    // crossing year.
    let supplementaryPayment = 0;
    if (spTerms) {
      const aboveThvRevenueShare =
        liquidsWeight * fractionAboveThreshold(cumulativeLiquidsMmstb, yearLiquidsMmstb, spTerms.thvLiquidsMmstb) +
        gasWeight * fractionAboveThreshold(cumulativeGasTscf, yearGasTscf, spTerms.thvGasTscf);
      supplementaryPayment = contractorProfitShare * aboveThvRevenueShare * spTerms.rate;
    }
    cumulativeLiquidsMmstb += yearLiquidsMmstb;
    cumulativeGasTscf += yearGasTscf;

    // ── STEP 7: Contractor Entitlement & research cess ────────────────
    const contractorEntitlement = costRecoveryAmount + contractorProfitShare - supplementaryPayment;
    const researchCess = researchCessOnEntitlement(
      costRecoveryAmount, contractorProfitShare, fiscalConfig.researchCessRate,
    );

    // ── STEP 8: Tax ───────────────────────────────────────────────────
    // Under PITA 1967 Section 33, OPEX, abandonment and the research cess
    // are deductible expenses wholly and exclusively incurred in producing
    // gross income. Cost recovery is a PSC revenue mechanic, distinct from
    // tax-base treatment. Both apply. See ASSESSMENT.md F1, F2. The PITA
    // investment allowance is set off against capped statutory income;
    // adjusted losses (incl. excess capital allowance) are carried forward.
    depreciation.addCapex(totalCapex);
    investmentAllowance?.accrue(year, totalCapex);
    const capitalAllowance = depreciation.computeAllowance();
    const taxableIncome =
      contractorEntitlement - researchCess - capitalAllowance - totalOpex - abandonmentCost;
    const taxAllowanceUsed = investmentAllowance ? investmentAllowance.utilise(taxableIncome) : 0;
    const { lossRelief, chargeableIncome } = taxLosses.apply(year, taxableIncome - taxAllowanceUsed);
    const pitaTax = chargeableIncome * fiscalConfig.pitaRate;

    // ── STEP 9: Net Cash Flow ─────────────────────────────────────────
    // NCF = Cost recovery + Contractor profit share − SP − Research cess
    //       − PITA − CAPEX − OPEX − ABEX
    const netCashFlow =
      contractorEntitlement -
      researchCess -
      pitaTax -
      totalCapex -
      totalOpex -
      abandonmentCost;

    cumulativeCashFlow += netCashFlow;

    // ── STEP 10: Discounted Cash Flow ─────────────────────────────────
    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    // ── Cumulative production (BOE, 6 Mscf/boe) ───────────────────────
    cumulativeProductionBoe += computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);

    // ── Update accumulators for next year's R/C calculation ───────────
    cumulativeContractorRevenue += contractorEntitlement;
    cumulativeContractorCost += currentYearCosts;
    unrecoveredCostCF = newUnrecoveredCostCF;

    // ── Build result ──────────────────────────────────────────────────
    results.push({
      year,
      grossRevenueOil: usd(grossRevenueOil),
      grossRevenueGas: usd(grossRevenueGas),
      grossRevenueCond: usd(grossRevenueCond),
      totalGrossRevenue: usd(totalGrossRevenue),
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
      taxAllowanceUsed: usd(taxAllowanceUsed),
      taxLossCF: usd(taxLosses.balance),
      pitaTax: usd(pitaTax),
      netCashFlow: usd(netCashFlow),
      cumulativeCashFlow: usd(cumulativeCashFlow),
      discountedCashFlow: usd(discountedCashFlow),
      cumulativeDiscountedCF: usd(cumulativeDiscountedCF),
      rcIndex,
      profitabilityIndex: 0, // Per-year PI removed; use EconomicsResult.profitabilityIndex (discounted)
      cumulativeProduction: cumulativeProductionBoe,
    });
  }

  return results;
}
