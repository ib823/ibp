// ════════════════════════════════════════════════════════════════════════
// RSC — Risk Service Contract Fiscal Engine
// ════════════════════════════════════════════════════════════════════════
//
// Distinct from PSCs: contractor is paid a fee per produced barrel
// (not a profit-oil share) plus cost reimbursement and a performance
// bonus. Government keeps the upside; contractor's return is capped
// by the fee-and-bonus structure.
//
// Mechanics modelled here (illustrative):
//   1. Fee Revenue        = oil-equivalent production × feePerBarrel
//                           (gas converted at 6 Mscf/boe)
//   2. Cost Reimbursement = (CAPEX + OPEX + Abex) this year ×
//                           costReimbursementPct, ceiling-capped at
//                           fee revenue × 0.7 (illustrative cap)
//   3. Performance Bonus  = lump-sum performanceBonus paid in the
//                           year cumulative oil-equiv production
//                           crosses 30 MMboe (THV-style threshold).
//                           Paid once per project life.
//   4. Contractor entitlement = Fee + Reimbursement + Bonus
//   5. Net contractor income = Entitlement − actual costs
//   6. PITA               = max(0, taxable income) × 0.25
//                           (RSC reduced rate; PITA standard is 38%)
//
// Government take is implicit: total revenue (oil/gas at market
// price) is what the upstream JV produces; the fee + reimbursement +
// bonus the contractor receives is a slice. The remaining revenue
// flows to government, alongside royalty / export duty / research
// cess on the gross revenue base.
//
// Reference: Malaysia RSC framework (publicly described 2011 Berantai
// model and subsequent variants). Numbers in `data/fiscal-regimes.ts`
// are illustrative.
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_RSC,
  YearlyCashflow,
} from '@/engine/types';
import {
  DISCOUNT_RATE,
  usd,
  getVal,
  computeRevenue,
  computeCosts,
  computeYearlyBoe,
  DepreciationSchedule,
} from './shared';

const RSC_PITA_RATE = 0.25;
const PERFORMANCE_BONUS_THRESHOLD_BOE = 30_000_000; // 30 MMboe cumulative
const REIMBURSEMENT_CEILING_RATIO = 0.70;          // % of fee revenue

export interface RscInputs {
  readonly yearlyProduction: ProductionProfile;
  readonly yearlyCosts: CostProfile;
  readonly priceDeck: PriceDeck;
  readonly fiscalConfig: FiscalRegime_RSC;
  readonly equityShare: number;
  readonly startYear: number;
  readonly endYear: number;
}

export function calculateRsc(inputs: RscInputs): YearlyCashflow[] {
  const {
    yearlyProduction, yearlyCosts, priceDeck, fiscalConfig,
    equityShare, startYear, endYear,
  } = inputs;

  const results: YearlyCashflow[] = [];
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeProductionBoe = 0;
  let bonusPaid = false;
  const depreciation = new DepreciationSchedule();

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    const rev = computeRevenue(yearlyProduction, priceDeck, year, equityShare);

    // Government deductions on gross revenue (apply before contractor calc).
    // Export duty applies to liquid petroleum (oil + condensate) only —
    // see ASSESSMENT.md F5.
    const royalty = rev.totalGrossRevenue * fiscalConfig.royaltyRate;
    const exportDuty = (rev.grossRevenueOil + rev.grossRevenueCond) * fiscalConfig.exportDutyRate;
    const researchCess = rev.totalGrossRevenue * fiscalConfig.researchCessRate;
    const sarawakSst = rev.totalGrossRevenue * (fiscalConfig.sarawakSstRate || 0);
    const revenueAfterGovtDeductions =
      rev.totalGrossRevenue - royalty - exportDuty - researchCess - sarawakSst;

    // ── Fee revenue ─────────────────────────────────────────────────
    // Convert gas MMscfd → boe-equivalent so the fee applies on a single
    // production stream. Oil + condensate already in bpd.
    const oilDailyBoe = getVal(yearlyProduction.oil, year)
                      + getVal(yearlyProduction.condensate, year);
    const gasDailyBoe = (getVal(yearlyProduction.gas, year) * 1_000_000) / 6_000;
    const yearBoe = (oilDailyBoe + gasDailyBoe) * 365 * equityShare;
    const feeRevenue = yearBoe * fiscalConfig.feePerBarrel;

    // ── Cost reimbursement (capped) ─────────────────────────────────
    const cost = computeCosts(yearlyCosts, year);
    const totalCosts = cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
    const reimbursementUncapped = totalCosts * fiscalConfig.costReimbursementPct;
    const reimbursementCeiling = feeRevenue * REIMBURSEMENT_CEILING_RATIO;
    const costReimbursement = Math.min(reimbursementUncapped, reimbursementCeiling);

    // ── Performance bonus (one-shot) ────────────────────────────────
    const cumulativeBoeBeforeYear = cumulativeProductionBoe;
    const cumulativeBoeAfterYear = cumulativeProductionBoe + yearBoe;
    let performanceBonus = 0;
    if (
      !bonusPaid
      && cumulativeBoeBeforeYear < PERFORMANCE_BONUS_THRESHOLD_BOE
      && cumulativeBoeAfterYear >= PERFORMANCE_BONUS_THRESHOLD_BOE
    ) {
      performanceBonus = fiscalConfig.performanceBonus;
      bonusPaid = true;
    }

    const contractorEntitlement = feeRevenue + costReimbursement + performanceBonus;

    // ── Tax ─────────────────────────────────────────────────────────
    depreciation.addCapex(cost.totalCapex);
    const capitalAllowance = depreciation.computeAllowance();

    // Net contractor income = entitlement − actual costs (we still bear
    // the cost; reimbursement compensates partially). Then deduct
    // capital allowance for tax purposes.
    const netContractorIncome =
      contractorEntitlement - cost.totalOpex - cost.abandonmentCost - capitalAllowance;
    const pita = Math.max(0, netContractorIncome) * RSC_PITA_RATE;

    // Net cash flow to contractor = entitlement − costs − tax
    const netCashFlow = contractorEntitlement - totalCosts - pita;
    cumulativeCashFlow += netCashFlow;

    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    cumulativeProductionBoe = cumulativeBoeAfterYear;

    const yearBoeForCashflow = computeYearlyBoe(rev.oilBpd, rev.condBpd, rev.gasMMscfd);
    void yearBoeForCashflow; // already accumulated above; kept for parity hooks

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
      revenueAfterRoyalty: usd(revenueAfterGovtDeductions),
      // RSC has no cost-recovery pool / profit-oil split — surface the
      // fee + reimbursement + bonus structure on the existing schema.
      costRecoveryCeiling: usd(reimbursementCeiling),
      costRecoveryAmount: usd(costReimbursement),
      unrecoveredCostCF: usd(Math.max(0, reimbursementUncapped - costReimbursement)),
      profitOilGas: usd(0),
      contractorProfitShare: usd(feeRevenue + performanceBonus),
      hostProfitShare: usd(revenueAfterGovtDeductions - contractorEntitlement),
      contractorEntitlement: usd(contractorEntitlement),
      supplementaryPayment: usd(performanceBonus),
      taxableIncome: usd(netContractorIncome),
      capitalAllowance: usd(capitalAllowance),
      pitaTax: usd(pita),
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
