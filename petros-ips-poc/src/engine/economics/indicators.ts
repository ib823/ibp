// ════════════════════════════════════════════════════════════════════════
// Economic Indicators (Payback, PI, Government Take)
// ════════════════════════════════════════════════════════════════════════

import type { YearlyCashflow, CostProfile, USD } from '@/engine/types';
import { calculateNPV } from './npv';
import { getVal } from '@/engine/fiscal/shared';

function usd(n: number): USD {
  return n as USD;
}

export interface IndicatorInputs {
  readonly cashflows: readonly YearlyCashflow[];
  readonly costProfile: CostProfile;
  readonly discountRate: number;
}

export interface EconomicIndicators {
  readonly paybackYears: number;
  readonly discountedPaybackYears: number;
  readonly profitabilityIndex: number;
  readonly governmentTakePct: number;
  readonly contractorTakePct: number;
  readonly peakFunding: USD;
  readonly totalCapex: USD;
  readonly totalOpex: USD;
  readonly totalRevenue: USD;
  readonly totalTax: USD;
}

/**
 * Payback year with linear interpolation for fractional year.
 * Returns the year at which cumulative values first cross zero.
 * If never crosses, returns field life length.
 */
function computePayback(values: readonly number[]): number {
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const curr = values[i]!;
    if (prev < 0 && curr >= 0) {
      // Linear interpolation: fraction = |prev| / (|prev| + curr)
      const fraction = Math.abs(prev) / (Math.abs(prev) + curr);
      return (i - 1) + fraction;
    }
  }
  // Never turned positive — return total years
  return values.length;
}

export function calculateIndicators(inputs: IndicatorInputs): EconomicIndicators {
  const { cashflows, costProfile, discountRate } = inputs;

  if (cashflows.length === 0) {
    return {
      paybackYears: 0,
      discountedPaybackYears: 0,
      profitabilityIndex: 0,
      governmentTakePct: 0,
      contractorTakePct: 0,
      peakFunding: usd(0),
      totalCapex: usd(0),
      totalOpex: usd(0),
      totalRevenue: usd(0),
      totalTax: usd(0),
    };
  }

  // Cumulative NCF series (for payback)
  const cumulativeNcf: number[] = [];
  let cumNcf = 0;
  for (const cf of cashflows) {
    cumNcf += cf.netCashFlow;
    cumulativeNcf.push(cumNcf);
  }

  // Cumulative discounted CF series (for discounted payback)
  const cumulativeDcf: number[] = [];
  let cumDcf = 0;
  for (const cf of cashflows) {
    cumDcf += cf.discountedCashFlow;
    cumulativeDcf.push(cumDcf);
  }

  const paybackYears = computePayback(cumulativeNcf);
  const discountedPaybackYears = computePayback(cumulativeDcf);

  // Totals from cost profile
  let totalCapex = 0;
  let totalOpex = 0;
  for (const cf of cashflows) {
    const year = cf.year;
    totalCapex +=
      getVal(costProfile.capexDrilling, year) +
      getVal(costProfile.capexFacilities, year) +
      getVal(costProfile.capexSubsea, year) +
      getVal(costProfile.capexOther, year);
    totalOpex +=
      getVal(costProfile.opexFixed, year) +
      getVal(costProfile.opexVariable, year);
  }

  const totalRevenue = cashflows.reduce((s, cf) => s + cf.totalGrossRevenue, 0);
  const totalTax = cashflows.reduce((s, cf) => s + cf.pitaTax, 0);

  // Government take: standard petroleum economics definition
  // Govt receipts = Royalty + Export Duty + Research Cess + PETRONAS Profit Share + SP + PITA Tax
  // Divided by pre-tax project cash flow (Revenue - CAPEX - OPEX - ABEX)
  const totalGovtReceipts = cashflows.reduce(
    (s, cf) => s + cf.royalty + cf.exportDuty + cf.researchCess + cf.petronasProfitShare + cf.supplementaryPayment + cf.pitaTax, 0,
  );
  let totalAbex = 0;
  for (const cf of cashflows) {
    totalAbex += getVal(costProfile.abandonmentCost, cf.year);
  }
  const totalPreTaxCashFlow = totalRevenue - totalCapex - totalOpex - totalAbex;

  const governmentTakePct = totalPreTaxCashFlow > 0
    ? (totalGovtReceipts / totalPreTaxCashFlow) * 100
    : 0;
  const contractorTakePct = totalPreTaxCashFlow > 0
    ? 100 - governmentTakePct
    : 0;

  // Peak funding — most negative point in cumulative cashflow
  let peakFunding = 0;
  let cumForPeak = 0;
  for (const cf of cashflows) {
    cumForPeak += cf.netCashFlow;
    if (cumForPeak < peakFunding) {
      peakFunding = cumForPeak;
    }
  }

  // Profitability Index = NPV / PV(CAPEX)
  // PV(CAPEX) = sum of yearly capex discounted
  const capexByYear: number[] = [];
  for (const cf of cashflows) {
    const year = cf.year;
    capexByYear.push(
      getVal(costProfile.capexDrilling, year) +
      getVal(costProfile.capexFacilities, year) +
      getVal(costProfile.capexSubsea, year) +
      getVal(costProfile.capexOther, year),
    );
  }
  const pvCapex = calculateNPV(capexByYear, discountRate);

  const ncfArray = cashflows.map((cf) => cf.netCashFlow as number);
  const npv = calculateNPV(ncfArray, discountRate);
  const profitabilityIndex = pvCapex > 0 ? npv / pvCapex : 0;

  return {
    paybackYears,
    discountedPaybackYears,
    profitabilityIndex,
    governmentTakePct,
    contractorTakePct,
    peakFunding: usd(peakFunding),
    totalCapex: usd(totalCapex),
    totalOpex: usd(totalOpex),
    totalRevenue: usd(totalRevenue),
    totalTax: usd(totalTax),
  };
}
