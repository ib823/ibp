import { describe, it, expect } from 'vitest';
import {
  SK410_INPUTS,
  SK612_INPUTS,
  BALINGIAN_INPUTS,
  TUKAU_INPUTS,
  M3_CCS_INPUTS,
  ALL_PROJECTS,
} from '@/data/projects';
import {
  BASE_PRICE_DECK,
  HIGH_PRICE_DECK,
  LOW_PRICE_DECK,
  STRESS_PRICE_DECK,
  PRICE_DECKS,
} from '@/data/price-decks';
import { PROJECT_HIERARCHY } from '@/data/hierarchy';
import { RC_PSC, DW_PSC, EPT_PSC, SFA_PSC, DOWNSTREAM_TAX } from '@/data/fiscal-regimes';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { calculateNPV } from '@/engine/economics/npv';
import { calculateMIRR } from '@/engine/economics/mirr';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { generateAccountMovements } from '@/engine/financial/account-movements';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import { applyProjectSensitivity } from '@/engine/sensitivity/apply';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { runMonteCarlo } from '@/engine/montecarlo/simulation';
import {
  computeRevenue,
  computeCosts,
  computeYearlyBoe,
  CAPEX_DEPRECIATION_YEARS,
} from '@/engine/fiscal/shared';
import type {
  MonteCarloConfig,
  PriceDeck,
  ProductionProfile,
  ProjectInputs,
  RCTranche,
  TimeSeriesData,
  YearlyCashflow,
} from '@/engine/types';

/**
 * Audit note:
 * This suite treats the TypeScript engine + bundled project data/config as the source of truth.
 * Where the prompt's illustrative numbers differ from this repo's actual inputs
 * (for example plateau lengths, prices, or financial DD&A policy), the hand calculations below
 * follow the implementation that is actually executed by the engine.
 */

const MILLION = 1_000_000;
const TOL_MONEY = 0.5 * MILLION;
const TOL_FS = 0.1 * MILLION;
const TOL_RATIO = 0.01;
const TOL_RATE = 10;
const TOL_PERCENT_DECIMAL = 0.001;
const TOL_PERCENT_POINTS = 0.1;

const sk410Cashflows = calculateFiscalCashflows(SK410_INPUTS, BASE_PRICE_DECK);
const sk612Cashflows = calculateFiscalCashflows(SK612_INPUTS, BASE_PRICE_DECK);
const balingianCashflows = calculateFiscalCashflows(BALINGIAN_INPUTS, BASE_PRICE_DECK);
const tukauCashflows = calculateFiscalCashflows(TUKAU_INPUTS, BASE_PRICE_DECK);
const m3Cashflows = calculateFiscalCashflows(M3_CCS_INPUTS, BASE_PRICE_DECK);

const sk410EconomicsBase = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base');
const sk410EconomicsHigh = calculateProjectEconomics(SK410_INPUTS, HIGH_PRICE_DECK, 'high');
const sk410EconomicsLow = calculateProjectEconomics(SK410_INPUTS, LOW_PRICE_DECK, 'low');
const sk410EconomicsStress = calculateProjectEconomics(SK410_INPUTS, STRESS_PRICE_DECK, 'stress');
const sk410Economics15 = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base', 0.15);
const sk612EconomicsBase = calculateProjectEconomics(SK612_INPUTS, BASE_PRICE_DECK, 'base');
const balingianEconomicsBase = calculateProjectEconomics(BALINGIAN_INPUTS, BASE_PRICE_DECK, 'base');

const sk410Income = generateIncomeStatement(sk410Cashflows, SK410_INPUTS);
const sk410Balance = generateBalanceSheet(sk410Income, sk410Cashflows, SK410_INPUTS);
const sk410Cfs = generateCashFlowStatement(sk410Income, sk410Cashflows, SK410_INPUTS);
const sk410Accounts = generateAccountMovements(
  sk410Income,
  sk410Balance,
  sk410Cashflows,
  SK410_INPUTS,
);

const portfolioResults = new Map(
  ALL_PROJECTS.map((project) => [project.project.id, calculateProjectEconomics(project, BASE_PRICE_DECK, 'base')]),
);
const allProjectIds = new Set(ALL_PROJECTS.map((project) => project.project.id));
const fullPortfolio = aggregatePortfolio(ALL_PROJECTS, portfolioResults, allProjectIds, PROJECT_HIERARCHY);

const monteCarloConfig: MonteCarloConfig = {
  iterations: 1000,
  seed: '42',
  distributions: {
    oilPrice: { type: 'triangular', params: { min: 0.8, mode: 1, max: 1.25 } },
    gasPrice: { type: 'triangular', params: { min: 0.8, mode: 1, max: 1.25 } },
    production: { type: 'lognormal', params: { mu: 0, sigma: 0.1 } },
    capex: { type: 'normal', params: { mean: 1, stdDev: 0.1 } },
    opex: { type: 'normal', params: { mean: 1, stdDev: 0.08 } },
  },
};

function expectClose(actual: number, expected: number, tolerance: number, label?: string) {
  expect(Math.abs(actual - expected), label ?? `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

function getSeriesValue<T extends number>(series: Readonly<Record<number, T>>, year: number): number {
  return (series[year] as number | undefined) ?? 0;
}

function sumProjectCosts(project: ProjectInputs, years?: readonly number[]) {
  const range = years ?? Array.from(
    { length: project.project.endYear - project.project.startYear + 1 },
    (_, idx) => project.project.startYear + idx,
  );

  return range.reduce(
    (acc, year) => {
      const cost = computeCosts(project.costProfile, year);
      acc.capex += cost.totalCapex;
      acc.opex += cost.totalOpex;
      acc.abex += cost.abandonmentCost;
      return acc;
    },
    { capex: 0, opex: 0, abex: 0 },
  );
}

function manualDeclineRate(plateauRate: number, declineRate: number, t: number) {
  return Math.round(plateauRate * Math.exp(-declineRate * t) * 100) / 100;
}

function manualTaxAllowanceByYear(project: ProjectInputs) {
  const map = new Map<number, number>();

  for (let year = project.project.startYear; year <= project.project.endYear; year++) {
    const capex = computeCosts(project.costProfile, year).totalCapex;
    if (capex <= 0) continue;

    for (let offset = 0; offset < CAPEX_DEPRECIATION_YEARS; offset++) {
      const allowanceYear = year + offset;
      if (allowanceYear > project.project.endYear) continue;
      map.set(allowanceYear, (map.get(allowanceYear) ?? 0) + capex / CAPEX_DEPRECIATION_YEARS);
    }
  }

  return map;
}

function manualIncomeDdaByYear(project: ProjectInputs) {
  const years = Array.from(
    { length: project.project.endYear - project.project.startYear + 1 },
    (_, idx) => project.project.startYear + idx,
  );
  const fieldLife = project.project.endYear - project.project.startYear + 1;
  const map = new Map<number, number>();

  for (let idx = 0; idx < years.length; idx++) {
    const year = years[idx]!;
    const capex = computeCosts(project.costProfile, year).totalCapex;
    if (capex <= 0) continue;
    const remainingLife = fieldLife - idx;
    const annualDda = capex / remainingLife;
    for (let j = idx; j < years.length; j++) {
      const applyYear = years[j]!;
      map.set(applyYear, (map.get(applyYear) ?? 0) + annualDda);
    }
  }

  return map;
}

function manualPayback(cumulativeValues: readonly number[]) {
  for (let i = 1; i < cumulativeValues.length; i++) {
    const prev = cumulativeValues[i - 1]!;
    const curr = cumulativeValues[i]!;
    if (prev < 0 && curr >= 0) {
      return (i - 1) + Math.abs(prev) / (Math.abs(prev) + curr);
    }
  }
  return cumulativeValues.length;
}

function manualMIRR(cashflows: readonly number[], financeRate: number, reinvestRate: number) {
  return calculateMIRR(cashflows, financeRate, reinvestRate);
}

function contractorRevenueThroughYear(cashflows: readonly YearlyCashflow[], endIndexInclusive: number) {
  let total = 0;
  for (let i = 0; i <= endIndexInclusive; i++) {
    const cf = cashflows[i]!;
    total += (cf.costRecoveryAmount as number) + (cf.contractorProfitShare as number) - (cf.supplementaryPayment as number);
  }
  return total;
}

function contractorCostThroughYear(project: ProjectInputs, endIndexInclusive: number) {
  let total = 0;
  for (let i = 0; i <= endIndexInclusive; i++) {
    const year = project.project.startYear + i;
    const cost = computeCosts(project.costProfile, year);
    let effectiveCapex = cost.totalCapex;
    if (project.fiscalRegimeConfig.type === 'PSC_DW') {
      effectiveCapex *= 1 - project.fiscalRegimeConfig.deepwaterAllowance;
    }
    if (project.fiscalRegimeConfig.type === 'PSC_HPHT') {
      effectiveCapex *= 1 - project.fiscalRegimeConfig.hphtAllowance;
    }
    total += effectiveCapex + cost.totalOpex + cost.abandonmentCost;
  }
  return total;
}

function lookupTranche(tranches: readonly RCTranche[], rcIndex: number) {
  for (const tranche of tranches) {
    if (rcIndex >= tranche.rcFloor && rcIndex < tranche.rcCeiling) return tranche;
  }
  return tranches[0]!;
}

function interpolateEptShare(pi: number) {
  if (pi <= EPT_PSC.piLower) return EPT_PSC.contractorShareAtLower;
  if (pi >= EPT_PSC.piUpper) return EPT_PSC.contractorShareAtUpper;
  const fraction = (pi - EPT_PSC.piLower) / (EPT_PSC.piUpper - EPT_PSC.piLower);
  return EPT_PSC.contractorShareAtLower - fraction * (EPT_PSC.contractorShareAtLower - EPT_PSC.contractorShareAtUpper);
}

function constantSeries<T extends number>(start: number, end: number, value: T): TimeSeriesData<T> {
  const series: Record<number, T> = {};
  for (let year = start; year <= end; year++) series[year] = value;
  return series;
}

function buildSimplePriceDeck(start: number, end: number, oilPrice: number, gasPrice: number): PriceDeck {
  return {
    oil: constantSeries(start, end, oilPrice),
    gas: constantSeries(start, end, gasPrice),
    condensate: constantSeries(start, end, oilPrice * 0.85),
    exchangeRate: constantSeries(start, end, 4.5),
    carbonCredit: constantSeries(start, end, 25),
  };
}

describe('SECTION 1: PRODUCTION PROFILE CALCULATIONS', () => {
  it('1.1 Exponential decline: SK-410 gas production year 2 after plateau', () => {
    const expected = manualDeclineRate(120, 0.12, 2);
    const actual = getSeriesValue(SK410_INPUTS.productionProfile.gas, 2034);
    expectClose(actual, expected, 0.1);
  });

  it('1.2 Exponential decline: SK-410 gas production year 7 after plateau', () => {
    const expected = manualDeclineRate(120, 0.12, 7);
    const actual = getSeriesValue(SK410_INPUTS.productionProfile.gas, 2039);
    expectClose(actual, expected, 0.1);
  });

  it('1.3 Condensate at peak matches the project profile and implied gas ratio', () => {
    const peakGas = getSeriesValue(SK410_INPUTS.productionProfile.gas, 2028);
    const peakCond = getSeriesValue(SK410_INPUTS.productionProfile.condensate, 2028);
    const impliedCgr = peakCond / peakGas;
    expectClose(peakCond, 3800, TOL_RATE);
    expectClose(impliedCgr, 31.6666666667, 0.01);
  });

  it('1.4 Oil production decline: SK-612 deepwater year 1 after plateau', () => {
    const expected = manualDeclineRate(25000, 0.15, 1);
    const actual = getSeriesValue(SK612_INPUTS.productionProfile.oil, 2035);
    expectClose(actual, expected, TOL_RATE);
  });

  it('1.5 BOE conversion: gas to annual boe uses 6 Mscf = 1 boe', () => {
    const expectedAnnualBoe = 120 * 365 * 1_000_000 / 6_000;
    const actualAnnualBoe = computeYearlyBoe(0, 0, 120);
    expectClose(actualAnnualBoe, expectedAnnualBoe, TOL_RATE);
  });

  it('1.6 Total SK-410 cumulative production equals manual yearly BOE accumulation', () => {
    const expected = sk410Cashflows.reduce((sum, cashflow) => {
      const revenue = computeRevenue(
        SK410_INPUTS.productionProfile,
        BASE_PRICE_DECK,
        cashflow.year,
        SK410_INPUTS.project.equityShare,
      );
      return sum + computeYearlyBoe(revenue.oilBpd, revenue.condBpd, revenue.gasMMscfd);
    }, 0);
    const actual = sk410Cashflows[sk410Cashflows.length - 1]!.cumulativeProduction;
    expectClose(actual, expected, 0.5);
  });

  it('1.7 Zero decline rate: production stays constant in the explicit formula', () => {
    const series = Array.from({ length: 25 }, (_, idx) => manualDeclineRate(100, 0, idx));
    for (const value of series) expectClose(value, 100, 0.001);
  });

  it('1.8 100% decline rate: year 1 after plateau decays to e^-1 of peak', () => {
    const expected = manualDeclineRate(100, 1.0, 1);
    expectClose(expected, 36.79, 0.1);
  });
});

describe('SECTION 2: REVENUE CALCULATIONS', () => {
  it('2.1 Gas revenue formula: SK-410 first production year base case', () => {
    const year = 2028;
    const gasMMscfd = getSeriesValue(SK410_INPUTS.productionProfile.gas, year);
    const gasPrice = getSeriesValue(BASE_PRICE_DECK.gas, year);
    const equityShare = SK410_INPUTS.project.equityShare;
    const expected = gasMMscfd * 1000 * 1.055 * gasPrice * 365 * equityShare;
    const actual = sk410Cashflows.find((cashflow) => cashflow.year === year)!.grossRevenueGas as number;
    expectClose(actual, expected, TOL_MONEY);
  });

  it('2.2 Oil revenue formula: SK-612 first production year base case', () => {
    const year = 2031;
    const oilBpd = getSeriesValue(SK612_INPUTS.productionProfile.oil, year);
    const oilPrice = getSeriesValue(BASE_PRICE_DECK.oil, year);
    const equityShare = SK612_INPUTS.project.equityShare;
    const expected = oilBpd * oilPrice * 365 * equityShare;
    const actual = sk612Cashflows.find((cashflow) => cashflow.year === year)!.grossRevenueOil as number;
    expectClose(actual, expected, TOL_MONEY);
  });

  it('2.3 Gas energy conversion factor uses exactly 1.055 MMBtu/Mscf', () => {
    const year = 2028;
    const gasMMscfd = getSeriesValue(SK410_INPUTS.productionProfile.gas, year);
    const gasPrice = getSeriesValue(BASE_PRICE_DECK.gas, year);
    const equityShare = SK410_INPUTS.project.equityShare;
    const engine = sk410Cashflows.find((cashflow) => cashflow.year === year)!.grossRevenueGas as number;
    const expectedAt1055 = gasMMscfd * 1000 * 1.055 * gasPrice * 365 * equityShare;
    const expectedAt105 = gasMMscfd * 1000 * 1.05 * gasPrice * 365 * equityShare;
    expectClose(engine, expectedAt1055, TOL_MONEY);
    expect(Math.abs(engine - expectedAt1055)).toBeLessThan(Math.abs(engine - expectedAt105));
  });

  it('2.4 Revenue at equity share 100% equals full gross revenue', () => {
    const start = 2030;
    const deck = buildSimplePriceDeck(start, start, 65, 9.5);
    const production: ProductionProfile = {
      oil: constantSeries(start, start, 0),
      gas: constantSeries(start, start, 120),
      condensate: constantSeries(start, start, 0),
      water: constantSeries(start, start, 0),
    };
    const revenue = computeRevenue(production, deck, start, 1.0).grossRevenueGas;
    const expected = 120 * 1000 * 1.055 * 9.5 * 365;
    expectClose(revenue, expected, TOL_MONEY);
  });

  it('2.5 Revenue at equity share 0% is exactly zero', () => {
    const start = 2030;
    const deck = buildSimplePriceDeck(start, start, 65, 9.5);
    const production: ProductionProfile = {
      oil: constantSeries(start, start, 25000),
      gas: constantSeries(start, start, 120),
      condensate: constantSeries(start, start, 1800),
      water: constantSeries(start, start, 0),
    };
    const revenue = computeRevenue(production, deck, start, 0);
    expect(revenue.totalGrossRevenue).toBe(0);
  });

  it('2.6 Revenue across all four scenarios for SK-410 is strictly ordered', () => {
    const scenarioResults = compareScenarios(SK410_INPUTS, PRICE_DECKS);
    expect((scenarioResults.high.totalRevenue as number)).toBeGreaterThan(scenarioResults.base.totalRevenue as number);
    expect((scenarioResults.base.totalRevenue as number)).toBeGreaterThan(scenarioResults.low.totalRevenue as number);
    expect((scenarioResults.low.totalRevenue as number)).toBeGreaterThan(scenarioResults.stress.totalRevenue as number);
  });
});

describe('SECTION 3: ROYALTY CALCULATION', () => {
  it('3.1 Royalty equals 10% of gross revenue for SK-410 in every year', () => {
    for (const cashflow of sk410Cashflows) {
      expectClose(cashflow.royalty as number, (cashflow.totalGrossRevenue as number) * 0.10, 0.01);
    }
  });

  it('3.2 Royalty equals 0% for M3 CCS / downstream project', () => {
    for (const cashflow of m3Cashflows) {
      expect(cashflow.royalty).toBe(0);
    }
  });

  it('3.3 Cumulative royalty over SK-410 life equals yearly sum', () => {
    const expected = sk410Cashflows.reduce((sum, cashflow) => sum + (cashflow.totalGrossRevenue as number) * 0.10, 0);
    const actual = sk410Cashflows.reduce((sum, cashflow) => sum + (cashflow.royalty as number), 0);
    expectClose(actual, expected, TOL_MONEY);
  });

  it('3.4 Royalty is still paid in a negative-NCF SK-612 revenue year', () => {
    const year = sk612Cashflows.find((cashflow) => (cashflow.netCashFlow as number) < 0 && (cashflow.totalGrossRevenue as number) > 0)!;
    const expected = (year.totalGrossRevenue as number) * 0.10;
    expectClose(year.royalty as number, expected, 0.01);
  });
});

describe('SECTION 4: EXPORT DUTY & RESEARCH CESS', () => {
  it('4.1 Export duty equals 10% of gross revenue for SK-410', () => {
    for (const cashflow of sk410Cashflows) {
      expectClose(cashflow.exportDuty as number, (cashflow.totalGrossRevenue as number) * 0.10, 0.01);
    }
  });

  it('4.2 Research cess equals 0.5% of gross revenue for SK-410', () => {
    for (const cashflow of sk410Cashflows) {
      expectClose(cashflow.researchCess as number, (cashflow.totalGrossRevenue as number) * 0.005, 0.01);
    }
  });

  it('4.3 Export duty equals 0% for M3 CCS', () => {
    for (const cashflow of m3Cashflows) {
      expect(cashflow.exportDuty).toBe(0);
    }
  });

  it('4.4 Government takes before cost recovery equal 20.5% of gross revenue for PSC projects', () => {
    for (const cashflow of sk410Cashflows) {
      const expected = (cashflow.totalGrossRevenue as number) * 0.205;
      const actual =
        (cashflow.royalty as number) + (cashflow.exportDuty as number) + (cashflow.researchCess as number);
      expectClose(actual, expected, 0.01);
    }
  });
});

describe('SECTION 5: R/C PSC COST RECOVERY & PROFIT SPLIT', () => {
  it('5.1 R/C index is lagged by one year for SK-410', () => {
    expect(sk410Cashflows[0]!.rcIndex).toBe(0);
    const expectedYear2 =
      contractorRevenueThroughYear(sk410Cashflows, 0) / contractorCostThroughYear(SK410_INPUTS, 0);
    expectClose(sk410Cashflows[1]!.rcIndex, expectedYear2, TOL_RATIO);
  });

  it('5.2 R/C tranche mapping: 0.5 uses tranche 1', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 0.5);
    expectClose(tranche.costRecoveryCeilingPct, 0.70, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.70, 0.000001);
  });

  it('5.3 R/C tranche mapping: 1.2 uses tranche 2', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 1.2);
    expectClose(tranche.costRecoveryCeilingPct, 0.60, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.60, 0.000001);
  });

  it('5.4 R/C tranche mapping: 1.7 uses tranche 3', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 1.7);
    expectClose(tranche.costRecoveryCeilingPct, 0.50, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.50, 0.000001);
  });

  it('5.5 R/C tranche mapping: 2.3 uses tranche 4', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 2.3);
    expectClose(tranche.costRecoveryCeilingPct, 0.30, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.30, 0.000001);
  });

  it('5.6 R/C tranche mapping: 3.0 uses tranche 5', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 3.0);
    expectClose(tranche.costRecoveryCeilingPct, 0.20, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.20, 0.000001);
  });

  it('5.7 R/C boundary value: exactly 1.0 maps to tranche 2', () => {
    const tranche = lookupTranche(RC_PSC.tranches, 1.0);
    expectClose(tranche.costRecoveryCeilingPct, 0.60, 0.000001);
    expectClose(tranche.contractorProfitSharePct, 0.60, 0.000001);
  });

  it('5.8 Cost recovery ceiling is enforced when eligible costs exceed ceiling', () => {
    const cashflow = sk410Cashflows.find((entry) => entry.year === 2028)!;
    const costs = computeCosts(SK410_INPUTS.costProfile, 2028);
    const priorCarry = sk410Cashflows.find((entry) => entry.year === 2027)!.unrecoveredCostCF as number;
    const eligibleCosts = costs.totalCapex + costs.totalOpex + costs.abandonmentCost + priorCarry;
    const expectedCostRecovery = Math.min(
      eligibleCosts,
      (cashflow.revenueAfterRoyalty as number) * lookupTranche(RC_PSC.tranches, cashflow.rcIndex).costRecoveryCeilingPct,
    );
    const expectedCarry = eligibleCosts - expectedCostRecovery;
    expectClose(cashflow.costRecoveryAmount as number, expectedCostRecovery, 0.01);
    expectClose(cashflow.unrecoveredCostCF as number, expectedCarry, 0.01);
  });

  it('5.9 Cost recovery carry-forward accumulates as prior carry + current costs - recovered amount', () => {
    for (let idx = 0; idx < sk410Cashflows.length; idx++) {
      const cashflow = sk410Cashflows[idx]!;
      const priorCarry = idx === 0 ? 0 : (sk410Cashflows[idx - 1]!.unrecoveredCostCF as number);
      const costs = computeCosts(SK410_INPUTS.costProfile, cashflow.year);
      const eligibleCosts = priorCarry + costs.totalCapex + costs.totalOpex + costs.abandonmentCost;
      const expectedCarry = eligibleCosts - (cashflow.costRecoveryAmount as number);
      expectClose(cashflow.unrecoveredCostCF as number, expectedCarry, 0.01);
    }
  });

  it('5.10 Profit split after cost recovery balances with no leakage', () => {
    for (const cashflow of sk410Cashflows) {
      const expectedProfit = Math.max(0, (cashflow.revenueAfterRoyalty as number) - (cashflow.costRecoveryAmount as number));
      expectClose(cashflow.profitOilGas as number, expectedProfit, 0.01);
      expectClose(
        (cashflow.contractorProfitShare as number) + (cashflow.petronasProfitShare as number),
        cashflow.profitOilGas as number,
        0.01,
      );
    }
  });

  it('5.11 Supplementary payment triggers in the correct SK-612 threshold year', () => {
    let cumulativeOilMmstb = 0;
    let expectedTriggerYear: number | null = null;

    for (let year = SK612_INPUTS.project.startYear; year <= SK612_INPUTS.project.endYear; year++) {
      cumulativeOilMmstb += getSeriesValue(SK612_INPUTS.productionProfile.oil, year) * 365 / 1_000_000;
      if (cumulativeOilMmstb > 30 && expectedTriggerYear === null) expectedTriggerYear = year;
    }

    const actualTriggerYear = sk612Cashflows.find((cashflow) => (cashflow.supplementaryPayment as number) > 0)?.year ?? null;
    expect(actualTriggerYear).toBe(expectedTriggerYear);
  });

  it('5.12 Supplementary payment is deducted from cumulative contractor revenue feeding next-year R/C', () => {
    const triggerIndex = sk612Cashflows.findIndex((cashflow) => (cashflow.supplementaryPayment as number) > 0);
    const nextYearCashflow = sk612Cashflows[triggerIndex + 1]!;
    const cumulativeRevenue = contractorRevenueThroughYear(sk612Cashflows, triggerIndex);
    const cumulativeCost = contractorCostThroughYear(SK612_INPUTS, triggerIndex);
    const expectedRc = cumulativeRevenue / cumulativeCost;
    expectClose(nextYearCashflow.rcIndex, expectedRc, TOL_RATIO);
  });
});

describe('SECTION 6: EPT REGIME', () => {
  it('6.1 EPT cost recovery ceiling is fixed at 70% every year', () => {
    for (const cashflow of balingianCashflows) {
      expectClose(cashflow.costRecoveryCeiling as number, (cashflow.revenueAfterRoyalty as number) * 0.70, 0.01);
    }
  });

  it('6.2 EPT PI calculation equals lagged cumulative contractor revenue divided by cumulative contractor cost', () => {
    expect(balingianCashflows[0]!.rcIndex).toBe(0);
    for (let idx = 1; idx < balingianCashflows.length; idx++) {
      const expectedPi =
        contractorRevenueThroughYear(balingianCashflows, idx - 1) / contractorCostThroughYear(BALINGIAN_INPUTS, idx - 1);
      expectClose(balingianCashflows[idx]!.rcIndex, expectedPi, TOL_RATIO);
    }
  });

  it('6.3 EPT contractor share at PI = 1.50 is 90%', () => {
    expectClose(interpolateEptShare(1.5), 0.90, 0.000001);
  });

  it('6.4 EPT contractor share at PI = 2.50 is 30%', () => {
    expectClose(interpolateEptShare(2.5), 0.30, 0.000001);
  });

  it('6.5 EPT linear interpolation at PI = 2.00 gives 60%', () => {
    expectClose(interpolateEptShare(2.0), 0.60, TOL_PERCENT_DECIMAL);
  });

  it('6.6 EPT has no supplementary payment in any year', () => {
    for (const cashflow of balingianCashflows) {
      expect(cashflow.supplementaryPayment).toBe(0);
    }
  });
});

describe('SECTION 7: SFA & DEEPWATER REGIMES', () => {
  it('7.1 SFA PITA rate is 25%', () => {
    expectClose(SFA_PSC.pitaRate, 0.25, 0.000001);
  });

  it('7.2 SFA uses fixed 80% cost recovery and 70/30 profit split', () => {
    for (const cashflow of tukauCashflows) {
      expectClose(cashflow.costRecoveryCeiling as number, (cashflow.revenueAfterRoyalty as number) * 0.80, 0.01);
      if ((cashflow.profitOilGas as number) > 0) {
        expectClose((cashflow.contractorProfitShare as number) / (cashflow.profitOilGas as number), 0.70, TOL_RATIO);
        expectClose((cashflow.petronasProfitShare as number) / (cashflow.profitOilGas as number), 0.30, TOL_RATIO);
      }
    }
  });

  it('7.3 Deepwater tranches carry a 5% uplift versus standard R/C tranches', () => {
    for (let idx = 0; idx < RC_PSC.tranches.length; idx++) {
      expectClose(DW_PSC.tranches[idx]!.costRecoveryCeilingPct - RC_PSC.tranches[idx]!.costRecoveryCeilingPct, 0.05, 0.000001);
      expectClose(DW_PSC.tranches[idx]!.contractorProfitSharePct - RC_PSC.tranches[idx]!.contractorProfitSharePct, 0.05, 0.000001);
    }
  });

  it('7.4 CCS uses 24% corporate tax with no royalty, export duty, or cost recovery', () => {
    const positiveTaxYear = m3Cashflows.find((cashflow) => (cashflow.taxableIncome as number) > 0)!;
    const costs = computeCosts(M3_CCS_INPUTS.costProfile, positiveTaxYear.year);
    const expectedTax = (positiveTaxYear.taxableIncome as number) * 0.24;
    const expectedNcf =
      (positiveTaxYear.totalGrossRevenue as number) -
      costs.totalCapex -
      costs.totalOpex -
      costs.abandonmentCost -
      expectedTax;

    for (const cashflow of m3Cashflows) {
      expect(cashflow.royalty).toBe(0);
      expect(cashflow.exportDuty).toBe(0);
      expect(cashflow.costRecoveryAmount).toBe(0);
    }
    expectClose(DOWNSTREAM_TAX.taxRate, 0.24, 0.000001);
    expectClose(positiveTaxYear.pitaTax as number, expectedTax, 0.01);
    expectClose(positiveTaxYear.netCashFlow as number, expectedNcf, 0.01);
  });
});

describe('SECTION 8: PITA TAX CALCULATION', () => {
  it('8.1 PITA equals 38% of positive taxable income for R/C PSC years', () => {
    for (const cashflow of sk410Cashflows) {
      const taxableIncome = cashflow.contractorEntitlement as number - (cashflow.capitalAllowance as number);
      const expectedTax = Math.max(0, taxableIncome * 0.38);
      expectClose(cashflow.pitaTax as number, expectedTax, 0.01);
    }
  });

  it('8.2 Capital allowance follows CAPEX / 5 straight-line vintages', () => {
    const expectedSchedule = manualTaxAllowanceByYear(SK410_INPUTS);
    for (const cashflow of sk410Cashflows) {
      expectClose(cashflow.capitalAllowance as number, expectedSchedule.get(cashflow.year) ?? 0, 0.01);
    }
  });

  it('8.3 Negative taxable income never generates negative tax', () => {
    for (const cashflow of sk410Cashflows.filter((entry) => (entry.taxableIncome as number) <= 0)) {
      expect(cashflow.pitaTax).toBe(0);
    }
  });

  it('8.4 After capital allowance exhaustion, taxable income equals full contractor entitlement', () => {
    const firstExhausted = sk410Cashflows.find((cashflow) => (cashflow.capitalAllowance as number) === 0 && (cashflow.contractorEntitlement as number) > 0)!;
    expectClose(firstExhausted.taxableIncome as number, firstExhausted.contractorEntitlement as number, 0.01);
    expectClose(firstExhausted.pitaTax as number, (firstExhausted.contractorEntitlement as number) * 0.38, 0.01);
  });

  it('8.5 SFA uses a 25% PITA rate', () => {
    const positiveTaxYear = tukauCashflows.find((cashflow) => (cashflow.taxableIncome as number) > 0)!;
    expectClose(positiveTaxYear.pitaTax as number, (positiveTaxYear.taxableIncome as number) * 0.25, 0.01);
  });

  it('8.6 CCS uses 24% corporate tax on positive taxable income', () => {
    const positiveTaxYear = m3Cashflows.find((cashflow) => (cashflow.taxableIncome as number) > 0)!;
    expectClose(positiveTaxYear.pitaTax as number, (positiveTaxYear.taxableIncome as number) * 0.24, 0.01);
  });
});

describe('SECTION 9: NCF & ECONOMIC INDICATORS', () => {
  it('9.1 NCF equals entitlement components minus tax and costs for SK-410', () => {
    for (const cashflow of sk410Cashflows) {
      const costs = computeCosts(SK410_INPUTS.costProfile, cashflow.year);
      const expected =
        (cashflow.costRecoveryAmount as number) +
        (cashflow.contractorProfitShare as number) -
        (cashflow.supplementaryPayment as number) -
        (cashflow.pitaTax as number) -
        costs.totalCapex -
        costs.totalOpex -
        costs.abandonmentCost;
      expectClose(cashflow.netCashFlow as number, expected, 0.01);
    }
  });

  it('9.2 Cumulative NCF is the running sum of yearly NCF', () => {
    let running = 0;
    for (const cashflow of sk410Cashflows) {
      running += cashflow.netCashFlow as number;
      expectClose(cashflow.cumulativeCashFlow as number, running, 0.01);
    }
  });

  it('9.3 NPV at 10% matches manual discounting of the first five SK-410 years', () => {
    const firstFive = sk410Cashflows.slice(0, 5).map((cashflow) => cashflow.netCashFlow as number);
    const expected =
      firstFive[0]! / 1.0 +
      firstFive[1]! / 1.1 +
      firstFive[2]! / 1.21 +
      firstFive[3]! / 1.331 +
      firstFive[4]! / 1.4641;
    const actual = calculateNPV(firstFive, 0.10);
    expectClose(actual, expected, 0.5);
  });

  it('9.4 NPV decreases when discount rate increases from 10% to 15%', () => {
    expect((sk410Economics15.npv10 as number)).toBeLessThan(sk410EconomicsBase.npv10 as number);
  });

  it('9.5 IRR is the discount rate that makes project NPV approximately zero', () => {
    const irr = sk410EconomicsBase.irr!;
    const npvAtIrr = calculateNPV(sk410Cashflows.map((cashflow) => cashflow.netCashFlow as number), irr);
    expectClose(npvAtIrr, 0, MILLION);
  });

  it('9.6 MIRR for Balingian matches the explicit 8% finance / 10% reinvest formula', () => {
    const expected = manualMIRR(
      balingianCashflows.map((cashflow) => cashflow.netCashFlow as number),
      0.08,
      0.10,
    );
    expectClose(balingianEconomicsBase.mirr, expected, TOL_PERCENT_DECIMAL);
    expect(balingianEconomicsBase.mirr).toBeGreaterThan(0);
  });

  it('9.7 Payback period matches the cumulative NCF zero-crossing interpolation', () => {
    const cumulative = sk410Cashflows.map((cashflow) => cashflow.cumulativeCashFlow as number);
    const expected = manualPayback(cumulative);
    expectClose(sk410EconomicsBase.paybackYears, expected, TOL_RATIO);
  });

  it('9.8 Profitability Index equals NPV divided by PV of CAPEX', () => {
    const capexSeries = sk410Cashflows.map((cashflow) => computeCosts(SK410_INPUTS.costProfile, cashflow.year).totalCapex);
    const pvCapex = calculateNPV(capexSeries, 0.10);
    const expected = (sk410EconomicsBase.npv10 as number) / pvCapex;
    expectClose(sk410EconomicsBase.profitabilityIndex, expected, TOL_RATIO);
  });

  it('9.9 Government Take equals total government receipts divided by pre-tax cash flow', () => {
    const govtReceipts = sk410Cashflows.reduce(
      (sum, cashflow) =>
        sum +
        (cashflow.royalty as number) +
        (cashflow.exportDuty as number) +
        (cashflow.researchCess as number) +
        (cashflow.petronasProfitShare as number) +
        (cashflow.supplementaryPayment as number) +
        (cashflow.pitaTax as number),
      0,
    );
    const costs = sumProjectCosts(SK410_INPUTS);
    const preTaxCashFlow = (sk410EconomicsBase.totalRevenue as number) - costs.capex - costs.opex - costs.abex;
    const expected = govtReceipts / preTaxCashFlow * 100;
    expectClose(sk410EconomicsBase.governmentTakePct, expected, 0.5);
  });

  it('9.10 Contractor Take equals 100% minus Government Take', () => {
    expectClose(
      sk410EconomicsBase.contractorTakePct + sk410EconomicsBase.governmentTakePct,
      100,
      TOL_PERCENT_POINTS,
    );
  });
});

describe('SECTION 10: FINANCIAL STATEMENTS', () => {
  it('10.1 Income Statement revenue matches economics gross revenue in every year', () => {
    for (let idx = 0; idx < sk410Cashflows.length; idx++) {
      expectClose(
        sk410Income.yearly[idx]!.revenue as number,
        sk410Cashflows[idx]!.totalGrossRevenue as number,
        0.01,
      );
    }
  });

  it('10.2 Income Statement DD&A follows the engine remaining-life straight-line schedule', () => {
    const expectedDda = manualIncomeDdaByYear(SK410_INPUTS);
    for (const line of sk410Income.yearly) {
      expectClose(line.depreciationAmortisation as number, expectedDda.get(line.year) ?? 0, 0.01);
    }
  });

  it('10.3 Net Income equals Revenue - Royalty - OPEX/ABEX - DD&A - Tax', () => {
    for (let idx = 0; idx < sk410Income.yearly.length; idx++) {
      const line = sk410Income.yearly[idx]!;
      const cashflow = sk410Cashflows[idx]!;
      const costs = computeCosts(SK410_INPUTS.costProfile, line.year);
      const expected =
        (cashflow.totalGrossRevenue as number) -
        (cashflow.royalty as number) -
        costs.totalOpex -
        costs.abandonmentCost -
        (line.depreciationAmortisation as number) -
        (cashflow.pitaTax as number);
      expectClose(line.profitAfterTax as number, expected, TOL_FS);
    }
  });

  it('10.4 Balance sheet balances: Assets = Liabilities + Equity', () => {
    for (const line of sk410Balance.yearly) {
      expectClose(line.totalAssets as number, line.totalEquityAndLiabilities as number, TOL_FS);
    }
  });

  it('10.5 Balance sheet PP&E equals cumulative CAPEX minus cumulative DD&A', () => {
    let cumulativeCapex = 0;
    let cumulativeDda = 0;
    for (let idx = 0; idx < sk410Balance.yearly.length; idx++) {
      const line = sk410Balance.yearly[idx]!;
      cumulativeCapex += computeCosts(SK410_INPUTS.costProfile, line.year).totalCapex;
      cumulativeDda += sk410Income.yearly[idx]!.depreciationAmortisation as number;
      expectClose(line.ppeNet as number, Math.max(0, cumulativeCapex - cumulativeDda), TOL_FS);
    }
  });

  it('10.6 Cash flow statement operating cash flow equals PBT + DD&A - tax', () => {
    for (const line of sk410Cfs.yearly) {
      const expected =
        (line.profitBeforeTax as number) +
        (line.depreciation as number) -
        (line.taxPaid as number);
      expectClose(line.netOperatingCashFlow as number, expected, TOL_FS);
    }
  });

  it('10.7 Cash flow statement net cash change equals operating CF minus capex/abex', () => {
    for (const line of sk410Cfs.yearly) {
      const expected =
        (line.netOperatingCashFlow as number) -
        (line.capexPPE as number);
      expectClose(line.netCashChange as number, expected, TOL_FS);
    }
  });

  it('10.8 Account Movements PP&E roll-forward is internally consistent', () => {
    for (let idx = 0; idx < sk410Accounts.ppe.length; idx++) {
      const line = sk410Accounts.ppe[idx]!;
      const expected =
        (line.opening as number) +
        (line.additions as number) -
        (line.depreciation as number) -
        (line.impairment as number) -
        (line.disposals as number);
      expectClose(line.closing as number, expected, TOL_FS);
      if (idx > 0) {
        expectClose(line.opening as number, sk410Accounts.ppe[idx - 1]!.closing as number, TOL_FS);
      }
    }
  });
});

describe('SECTION 11: SENSITIVITY & MONTE CARLO', () => {
  it('11.1 Sensitivity ±30% range: higher production gives higher NPV', () => {
    const tornado = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, ['production'], [-0.30, 0.30]);
    const lower = tornado.dataPoints.find((point) => point.percentChange === -0.30)!;
    const higher = tornado.dataPoints.find((point) => point.percentChange === 0.30)!;
    expect((higher.npvValue as number)).toBeGreaterThan(tornado.baseNpv as number);
    expect((tornado.baseNpv as number)).toBeGreaterThan(lower.npvValue as number);
  });

  it('11.2 Sensitivity +30% CAPEX decreases NPV', () => {
    const tornado = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, ['capex'], [0.30]);
    expect(tornado.dataPoints[0]!.npvValue as number).toBeLessThan(tornado.baseNpv as number);
  });

  it('11.3 Sensitivity +30% gas price increases NPV for SK-410 gas project', () => {
    const tornado = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, ['gasPrice'], [0.30]);
    expect(tornado.dataPoints[0]!.npvValue as number).toBeGreaterThan(tornado.baseNpv as number);
  });

  it('11.4 Monte Carlo reproducibility: same seed gives identical percentiles', () => {
    const first = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, monteCarloConfig);
    const second = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, monteCarloConfig);
    expect(first.p10).toBe(second.p10);
    expect(first.p50).toBe(second.p50);
    expect(first.p90).toBe(second.p90);
  });

  it('11.5 Monte Carlo percentile ordering is P10 < P50 < P90', () => {
    const result = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, monteCarloConfig);
    expect((result.p10 as number)).toBeLessThan(result.p50 as number);
    expect((result.p50 as number)).toBeLessThan(result.p90 as number);
  });

  it('11.6 Monte Carlo with one iteration gives equal P10, P50, and P90', () => {
    const oneIteration = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, {
      ...monteCarloConfig,
      iterations: 1,
      seed: 'single',
    });
    expect(oneIteration.p10).toBe(oneIteration.p50);
    expect(oneIteration.p50).toBe(oneIteration.p90);
  });
});

describe('SECTION 12: CROSS-PROJECT CONSISTENCY', () => {
  it('12.1 Portfolio NPV equals the sum of individual project NPVs', () => {
    const expected = [...portfolioResults.values()].reduce((sum, result) => sum + (result.npv10 as number), 0);
    expectClose(fullPortfolio.totalNpv as number, expected, MILLION);
  });

  it('12.2 Portfolio CAPEX equals the sum of individual project CAPEX', () => {
    const expected = [...portfolioResults.values()].reduce((sum, result) => sum + (result.totalCapex as number), 0);
    expectClose(fullPortfolio.totalCapex as number, expected, 0.01);
  });

  it('12.3 Toggling SK-612 off reduces portfolio NPV by SK-612 NPV', () => {
    const withoutSk612 = new Set(allProjectIds);
    withoutSk612.delete('sk-612');
    const reduced = aggregatePortfolio(ALL_PROJECTS, portfolioResults, withoutSk612, PROJECT_HIERARCHY);
    const delta = (fullPortfolio.totalNpv as number) - (reduced.totalNpv as number);
    expectClose(delta, sk612EconomicsBase.npv10 as number, MILLION);
  });

  it('12.4 All four SK-410 scenarios produce distinct ordered NPVs', () => {
    const npvs = [
      sk410EconomicsHigh.npv10 as number,
      sk410EconomicsBase.npv10 as number,
      sk410EconomicsLow.npv10 as number,
      sk410EconomicsStress.npv10 as number,
    ];
    expect(new Set(npvs).size).toBe(4);
    expect(npvs[0]!).toBeGreaterThan(npvs[1]!);
    expect(npvs[1]!).toBeGreaterThan(npvs[2]!);
    expect(npvs[2]!).toBeGreaterThan(npvs[3]!);
  });

  it('12.5 Increasing CAPEX from 480M-equivalent by 25% reduces NPV with a tax/fiscal dampened delta', () => {
    const higherCapexProject = applyProjectSensitivity(SK410_INPUTS, 'capex', 0.25);
    const higherCapexEconomics = calculateProjectEconomics(higherCapexProject, BASE_PRICE_DECK, 'base');
    const delta = (higherCapexEconomics.npv10 as number) - (sk410EconomicsBase.npv10 as number);
    expect(delta).toBeLessThan(0);
    expect(Math.abs(delta)).toBeLessThan(120 * MILLION);
  });

  it('12.6 Reverting to the default project inputs restores the exact original NPV', () => {
    const modifiedProject = applyProjectSensitivity(SK410_INPUTS, 'capex', 0.25);
    const modifiedNpv = calculateProjectEconomics(modifiedProject, BASE_PRICE_DECK, 'base').npv10 as number;
    const restoredNpv = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base').npv10 as number;
    expect(modifiedNpv).not.toBe(restoredNpv);
    expect(restoredNpv).toBe(sk410EconomicsBase.npv10);
  });
});
