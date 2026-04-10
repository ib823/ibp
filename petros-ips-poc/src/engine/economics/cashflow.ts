// ════════════════════════════════════════════════════════════════════════
// Project Economics Orchestrator
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  EconomicsResult,
  ScenarioVersion,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import { calculateNPV } from './npv';
import { calculateIRR } from './irr';
import { calculateMIRR } from './mirr';
import { calculateIndicators } from './indicators';

const DEFAULT_DISCOUNT_RATE = 0.10;
const MIRR_FINANCE_RATE = 0.08;
const MIRR_REINVEST_RATE = 0.10;

/**
 * Full project economics calculation.
 * Orchestrates: fiscal engine → NPV → IRR → MIRR → indicators → EconomicsResult
 */
export function calculateProjectEconomics(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  scenario: ScenarioVersion = 'base',
  discountRate: number = DEFAULT_DISCOUNT_RATE,
): EconomicsResult {
  // Step 1: Run fiscal engine
  const yearlyCashflows = calculateFiscalCashflows(project, priceDeck);

  // Step 2: Extract NCF array for NPV/IRR calculations
  const ncfArray = yearlyCashflows.map((cf) => cf.netCashFlow as number);

  // Step 3: Calculate NPV
  const npv10 = calculateNPV(ncfArray, discountRate);

  // Step 4: Calculate IRR
  // Detect non-investment cash flow pattern (first NCF is positive — e.g. producing asset)
  const isNonInvestmentPattern = ncfArray.length > 0 && (ncfArray[0] ?? 0) > 0;
  const rawIrr = calculateIRR(ncfArray);
  // For non-investment patterns, IRR is not economically meaningful
  const irr = isNonInvestmentPattern ? null : (rawIrr ?? 0);

  // Step 5: Calculate MIRR
  const mirr = calculateMIRR(ncfArray, MIRR_FINANCE_RATE, MIRR_REINVEST_RATE);

  // Step 6: Calculate indicators
  const indicators = calculateIndicators({
    cashflows: yearlyCashflows,
    costProfile: project.costProfile,
    discountRate,
  });

  // Step 7: Package result
  return {
    projectId: project.project.id,
    scenario,
    yearlyCashflows,
    npv10: usd(npv10),
    irr,
    mirr,
    isNonInvestmentPattern,
    paybackYears: indicators.paybackYears,
    discountedPaybackYears: indicators.discountedPaybackYears,
    profitabilityIndex: indicators.profitabilityIndex,
    governmentTakePct: indicators.governmentTakePct,
    contractorTakePct: indicators.contractorTakePct,
    totalCapex: indicators.totalCapex,
    totalOpex: indicators.totalOpex,
    totalRevenue: indicators.totalRevenue,
    peakFunding: indicators.peakFunding,
    totalTax: indicators.totalTax,
  };
}
