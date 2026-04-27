// ════════════════════════════════════════════════════════════════════════
// R/C PSC Fiscal Calculation Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_RC,
  RCTranche,
  YearlyCashflow,
  USD,
} from '@/engine/types';

// ── Constants ─────────────────────────────────────────────────────────

const DISCOUNT_RATE = 0.10;
const CAPEX_DEPRECIATION_YEARS = 5;
const MSCF_TO_MMBTU = 1.055; // 1 Mscf ≈ 1.055 MMBtu

// Supplementary Payment thresholds (Threshold Volume)
const THV_OIL_MMSTB = 30;    // million stock-tank barrels
const THV_GAS_TSCF = 0.75;   // trillion standard cubic feet
const SP_RATE = 0.70;         // supplementary payment rate

// ── Helpers ───────────────────────────────────────────────────────────

function usd(n: number): USD {
  return n as USD;
}

function getVal<T extends number>(
  series: Readonly<Record<number, T>> | undefined,
  year: number,
): number {
  return (series?.[year] as number | undefined) ?? 0;
}

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

  // Running accumulators
  let unrecoveredCostCF = 0;
  let cumulativeContractorRevenue = 0; // cost recovery + contractor profit share
  let cumulativeContractorCost = 0;    // capex + opex
  let cumulativeCashFlow = 0;
  let cumulativeDiscountedCF = 0;
  let cumulativeOilMmstb = 0;  // cumulative oil in MMstb
  let cumulativeGasTscf = 0;   // cumulative gas in Tscf
  let cumulativeProductionBoe = 0;

  // CAPEX depreciation schedule: track undepreciated amounts by vintage year
  // Each entry: [originalAmount, yearsRemaining]
  const depreciationSchedule: Array<{ amount: number; yearsRemaining: number }> = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearIndex = year - startYear;

    // ── STEP 1: Gross Revenue ─────────────────────────────────────────
    const oilBpd = getVal(yearlyProduction.oil, year);
    const gasMMscfd = getVal(yearlyProduction.gas, year);
    const condBpd = getVal(yearlyProduction.condensate, year);

    const oilPrice = getVal(priceDeck.oil, year);
    const gasPrice = getVal(priceDeck.gas, year); // USD/MMBtu
    const condPrice = getVal(priceDeck.condensate, year);

    // Revenue in raw USD (not $M) — consistent with cost profile units
    // Equity share applied to each component individually for consistent display
    const grossRevenueOil = oilBpd * 365 * oilPrice * equityShare;
    // Gas: MMscfd → Mscf/d (*1000) → MMBtu/d (*1.055) → USD/d (*gasPrice) → USD/yr (*365)
    const grossRevenueGasCorrected = gasMMscfd * 1000 * MSCF_TO_MMBTU * gasPrice * 365 * equityShare;
    const grossRevenueCond = condBpd * 365 * condPrice * equityShare;

    const totalGrossRevenue = grossRevenueOil + grossRevenueGasCorrected + grossRevenueCond;

    // ── STEP 2: Government deductions from gross revenue ────────────
    // Export duty: liquid petroleum (oil + condensate) only — see shared.ts /
    // ASSESSMENT.md F5. Gas/LNG zero-rated under Customs Duties Order.
    const royalty = totalGrossRevenue * fiscalConfig.royaltyRate;
    const exportDuty = (grossRevenueOil + grossRevenueCond) * (fiscalConfig.exportDutyRate || 0);
    const researchCess = totalGrossRevenue * (fiscalConfig.researchCessRate || 0);

    // ── STEP 3: Revenue After Government Takes ───────────────────────
    const revenueAfterRoyalty = totalGrossRevenue - royalty - exportDuty - researchCess;

    // ── STEP 4: R/C Index (lagged — uses prior year cumulatives) ──────
    const rcIndex = cumulativeContractorCost > 0
      ? cumulativeContractorRevenue / cumulativeContractorCost
      : 0;

    // ── STEP 5: Lookup tranche ────────────────────────────────────────
    const tranche = lookupTranche(fiscalConfig.tranches, rcIndex);

    // ── STEP 6: Cost Recovery ─────────────────────────────────────────
    const totalCapex =
      getVal(yearlyCosts.capexDrilling, year) +
      getVal(yearlyCosts.capexFacilities, year) +
      getVal(yearlyCosts.capexSubsea, year) +
      getVal(yearlyCosts.capexOther, year);

    const totalOpex =
      getVal(yearlyCosts.opexFixed, year) +
      getVal(yearlyCosts.opexVariable, year);

    const abandonmentCost = getVal(yearlyCosts.abandonmentCost, year);

    const currentYearCosts = totalCapex + totalOpex + abandonmentCost;
    const eligibleCosts = currentYearCosts + unrecoveredCostCF;

    const costRecoveryCeiling = revenueAfterRoyalty * tranche.costRecoveryCeilingPct;
    const costRecoveryAmount = Math.min(eligibleCosts, Math.max(0, costRecoveryCeiling));
    const newUnrecoveredCostCF = eligibleCosts - costRecoveryAmount;

    // ── STEP 7: Profit Oil/Gas Split ──────────────────────────────────
    const profitOilGas = Math.max(0, revenueAfterRoyalty - costRecoveryAmount);
    const contractorProfitShare = profitOilGas * tranche.contractorProfitSharePct;
    const petronasProfitShare = profitOilGas * (1 - tranche.contractorProfitSharePct);

    // ── STEP 8: Supplementary Payment ─────────────────────────────────
    // Track cumulative production for THV check
    const yearOilMmstb = (oilBpd * 365) / 1_000_000;      // bpd → MMstb/yr
    const yearGasTscf = (gasMMscfd * 365) / 1_000_000;     // MMscf/d → Tscf/yr
    cumulativeOilMmstb += yearOilMmstb;
    cumulativeGasTscf += yearGasTscf;

    let supplementaryPayment = 0;
    if (cumulativeOilMmstb > THV_OIL_MMSTB || cumulativeGasTscf > THV_GAS_TSCF) {
      supplementaryPayment = contractorProfitShare * SP_RATE;
    }

    // ── STEP 9: Contractor Entitlement ────────────────────────────────
    const contractorEntitlement = costRecoveryAmount + contractorProfitShare - supplementaryPayment;

    // ── STEP 10: Tax ──────────────────────────────────────────────────
    // Add this year's CAPEX to depreciation schedule
    if (totalCapex > 0) {
      depreciationSchedule.push({
        amount: totalCapex / CAPEX_DEPRECIATION_YEARS,
        yearsRemaining: CAPEX_DEPRECIATION_YEARS,
      });
    }

    // Calculate capital allowance (sum of active depreciation tranches)
    let capitalAllowance = 0;
    for (const entry of depreciationSchedule) {
      if (entry.yearsRemaining > 0) {
        capitalAllowance += entry.amount;
        entry.yearsRemaining--;
      }
    }

    // Under PITA 1967 Section 33, OPEX and abandonment are deductible expenses
    // wholly and exclusively incurred in producing gross income. Cost recovery
    // is a PSC revenue mechanic, distinct from tax-base treatment. Both apply.
    // See ASSESSMENT.md F1, F2.
    const taxableIncome = contractorEntitlement - capitalAllowance - totalOpex - abandonmentCost;
    const pitaTax = Math.max(0, taxableIncome * fiscalConfig.pitaRate);

    // ── STEP 11: Net Cash Flow ────────────────────────────────────────
    // NCF = CostRecoveryAmount + ContractorProfitShare - SP - PITA - CAPEX - OPEX - ABEX
    const netCashFlow =
      costRecoveryAmount +
      contractorProfitShare -
      supplementaryPayment -
      pitaTax -
      totalCapex -
      totalOpex -
      abandonmentCost;

    cumulativeCashFlow += netCashFlow;

    // ── STEP 12: Discounted Cash Flow ─────────────────────────────────
    const discountFactor = Math.pow(1 + DISCOUNT_RATE, yearIndex);
    const discountedCashFlow = netCashFlow / discountFactor;
    cumulativeDiscountedCF += discountedCashFlow;

    // ── Cumulative production (BOE) ───────────────────────────────────
    // Oil + condensate in bbl; gas in MMscf → BOE (6 Mscf/boe = 1 MMscf → ~166.67 boe)
    const yearBoeProd =
      (oilBpd + condBpd) * 365 +
      gasMMscfd * 365 * 1_000_000 / 6_000; // MMscf/d → boe/d conversion
    cumulativeProductionBoe += yearBoeProd;

    // ── Update accumulators for next year's R/C calculation ───────────
    cumulativeContractorRevenue += costRecoveryAmount + contractorProfitShare - supplementaryPayment;
    cumulativeContractorCost += totalCapex + totalOpex + abandonmentCost;
    unrecoveredCostCF = newUnrecoveredCostCF;

    // ── Build result ──────────────────────────────────────────────────
    results.push({
      year,
      grossRevenueOil: usd(grossRevenueOil),
      grossRevenueGas: usd(grossRevenueGasCorrected),
      grossRevenueCond: usd(grossRevenueCond),
      totalGrossRevenue: usd(totalGrossRevenue),
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
      supplementaryPayment: usd(supplementaryPayment),
      taxableIncome: usd(taxableIncome),
      capitalAllowance: usd(capitalAllowance),
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
