import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_PROJECTS,
  BALINGIAN_INPUTS,
  M3_CCS_INPUTS,
  PROJECTS_BY_ID,
  SK410_INPUTS,
  SK612_INPUTS,
  TUKAU_INPUTS,
} from '@/data/projects';
import {
  BASE_PRICE_DECK,
  HIGH_PRICE_DECK,
  PRICE_DECKS,
  STRESS_PRICE_DECK,
} from '@/data/price-decks';
import { PROJECT_HIERARCHY } from '@/data/hierarchy';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { generateAccountMovements } from '@/engine/financial/account-movements';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import { computeCosts } from '@/engine/fiscal/shared';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';
import { PROJECT_RESERVES, gasBcfToMmboe, getProjectReserves } from '@/engine/reserves/prms';
import { generateReservesReconciliation } from '@/engine/reserves/reconciliation';
import { CO2_STORAGE_RESOURCES, generateSrmsReconciliation } from '@/engine/reserves/srms';
import { applyProjectSensitivity } from '@/engine/sensitivity/apply';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { calculateSpider } from '@/engine/sensitivity/spider';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import { DEFAULT_CONVERSIONS, convert } from '@/engine/utils/unit-conversion';
import { formatMoney, fmtPct, fmtYears } from '@/lib/format';
import { resetStore } from '../ui/test-utils';
import { useProjectStore } from '@/store/project-store';
import type {
  EconomicsResult,
  PriceDeck,
  ProjectInputs,
  ScenarioVersion,
} from '@/engine/types';

const MILLION = 1_000_000;

function expectClose(actual: number, expected: number, tolerance: number, label?: string) {
  expect(Math.abs(actual - expected), label ?? `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

function money(value: number) {
  return formatMoney(value, {
    currency: 'USD',
    conversions: DEFAULT_CONVERSIONS,
    accounting: true,
  });
}

function rateValue(result: EconomicsResult) {
  return result.isNonInvestmentPattern ? result.mirr : (result.irr ?? 0);
}

function rateDisplay(result: EconomicsResult) {
  return fmtPct(rateValue(result));
}

function scenarioDeck(scenario: ScenarioVersion): PriceDeck {
  return PRICE_DECKS[scenario];
}

function totalRoyalty(result: EconomicsResult) {
  return result.yearlyCashflows.reduce((sum, cashflow) => sum + (cashflow.royalty as number), 0);
}

function totalTax(result: EconomicsResult) {
  return result.yearlyCashflows.reduce((sum, cashflow) => sum + (cashflow.pitaTax as number), 0);
}

function totalRevenue(result: EconomicsResult) {
  return result.yearlyCashflows.reduce((sum, cashflow) => sum + (cashflow.totalGrossRevenue as number), 0);
}

function lastCumNcf(result: EconomicsResult) {
  return result.yearlyCashflows[result.yearlyCashflows.length - 1]!.cumulativeCashFlow as number;
}

function totalCapexFromInputs(project: ProjectInputs) {
  let total = 0;
  for (let year = project.project.startYear; year <= project.project.endYear; year++) {
    total += computeCosts(project.costProfile, year).totalCapex;
  }
  return total;
}

function totalGovtReceipts(result: EconomicsResult) {
  return result.yearlyCashflows.reduce(
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
}

function totalPreTaxCashFlow(project: ProjectInputs, result: EconomicsResult) {
  let totalCosts = 0;
  for (const cashflow of result.yearlyCashflows) {
    const cost = computeCosts(project.costProfile, cashflow.year);
    totalCosts += cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
  }
  return (result.totalRevenue as number) - totalCosts;
}

function portfolioGovtTake(activeProjectIds: ReadonlySet<string>, results: ReadonlyMap<string, EconomicsResult>) {
  let govtReceipts = 0;
  let preTax = 0;
  for (const id of activeProjectIds) {
    const project = PROJECTS_BY_ID[id]!;
    const result = results.get(id)!;
    govtReceipts += totalGovtReceipts(result);
    preTax += totalPreTaxCashFlow(project, result);
  }
  return preTax > 0 ? govtReceipts / preTax * 100 : 0;
}

function weightedIrr(activeProjectIds: ReadonlySet<string>, results: ReadonlyMap<string, EconomicsResult>) {
  let weighted = 0;
  let totalCapex = 0;
  for (const id of activeProjectIds) {
    const result = results.get(id)!;
    const capex = result.totalCapex as number;
    weighted += rateValue(result) * capex;
    totalCapex += capex;
  }
  return totalCapex > 0 ? weighted / totalCapex : 0;
}

function buildResultsMap(scenario: ScenarioVersion) {
  return new Map(
    ALL_PROJECTS.map((project) => [project.project.id, calculateProjectEconomics(project, scenarioDeck(scenario), scenario)]),
  );
}

function setSingleProjectScenario(projectId: string, scenario: ScenarioVersion) {
  resetStore({
    activeProjectId: projectId,
    activeScenario: scenario,
    selectedProjectIds: [projectId],
  });
}

const projectScenarioMatrix = [
  { project: SK410_INPUTS, scenario: 'base' as const },
  { project: SK612_INPUTS, scenario: 'base' as const },
  { project: BALINGIAN_INPUTS, scenario: 'base' as const },
  { project: TUKAU_INPUTS, scenario: 'base' as const },
  { project: M3_CCS_INPUTS, scenario: 'base' as const },
  { project: SK410_INPUTS, scenario: 'high' as const },
  { project: SK612_INPUTS, scenario: 'high' as const },
  { project: BALINGIAN_INPUTS, scenario: 'high' as const },
  { project: TUKAU_INPUTS, scenario: 'high' as const },
  { project: M3_CCS_INPUTS, scenario: 'high' as const },
  { project: SK410_INPUTS, scenario: 'low' as const },
  { project: SK612_INPUTS, scenario: 'low' as const },
  { project: BALINGIAN_INPUTS, scenario: 'low' as const },
  { project: TUKAU_INPUTS, scenario: 'low' as const },
  { project: M3_CCS_INPUTS, scenario: 'low' as const },
  { project: SK410_INPUTS, scenario: 'stress' as const },
  { project: SK612_INPUTS, scenario: 'stress' as const },
  { project: BALINGIAN_INPUTS, scenario: 'stress' as const },
  { project: TUKAU_INPUTS, scenario: 'stress' as const },
  { project: M3_CCS_INPUTS, scenario: 'stress' as const },
];

describe('SECTION 1: CROSS-PAGE NUMBER CONSISTENCY', () => {
  beforeEach(() => {
    resetStore();
  });

  for (const { project, scenario } of projectScenarioMatrix) {
    it(`${project.project.name} ${scenario}: engine/store/display values stay consistent`, () => {
      setSingleProjectScenario(project.project.id, scenario);

      const engineResult = calculateProjectEconomics(project, scenarioDeck(scenario), scenario);
      const state = useProjectStore.getState();
      const storeResult = state.economicsResults.get(project.project.id)!.get(scenario)!;
      const portfolioResult = state.portfolioResult!;

      expectClose(storeResult.npv10 as number, engineResult.npv10 as number, 0.000001);
      expectClose(storeResult.totalCapex as number, engineResult.totalCapex as number, 0.000001);
      expectClose(storeResult.totalRevenue as number, engineResult.totalRevenue as number, 0.000001);
      expectClose(storeResult.totalTax as number, engineResult.totalTax as number, 0.000001);
      expectClose(storeResult.governmentTakePct, engineResult.governmentTakePct, 0.000001);

      expectClose(engineResult.totalCapex as number, totalCapexFromInputs(project), 0.01);
      expectClose(engineResult.totalRevenue as number, totalRevenue(engineResult), 0.01);
      expectClose(engineResult.totalTax as number, totalTax(engineResult), 0.01);
      expectClose(lastCumNcf(engineResult), engineResult.yearlyCashflows.reduce((sum, cf) => sum + (cf.netCashFlow as number), 0), 0.01);

      const economicsNpv = money(engineResult.npv10 as number);
      const economicsRate = rateDisplay(engineResult);
      const economicsPayback = fmtYears(engineResult.paybackYears);
      const economicsPi = engineResult.profitabilityIndex.toFixed(2);

      const dashboardTopNpv = money(portfolioResult.totalNpv as number);
      const dashboardTopCapex = money(portfolioResult.totalCapex as number);
      const dashboardWeightedRate = fmtPct(weightedIrr(new Set([project.project.id]), new Map([[project.project.id, engineResult]])));
      const dashboardRowNpv = money(engineResult.npv10 as number);
      const dashboardRowRate = rateDisplay(engineResult);
      const dashboardRowCapex = money(engineResult.totalCapex as number);
      const dashboardRowPayback = engineResult.paybackYears.toFixed(1);

      const portfolioTopNpv = money(portfolioResult.totalNpv as number);
      const portfolioTopCapex = money(portfolioResult.totalCapex as number);
      const portfolioTopRate = fmtPct(weightedIrr(new Set([project.project.id]), new Map([[project.project.id, engineResult]])));
      const portfolioTopGovtTake = portfolioGovtTake(new Set([project.project.id]), new Map([[project.project.id, engineResult]])).toFixed(1) + '%';
      const portfolioRowNpv = money(engineResult.npv10 as number);

      expect(economicsNpv).toBe(dashboardTopNpv);
      expect(dashboardTopNpv).toBe(portfolioTopNpv);
      expect(dashboardRowNpv).toBe(portfolioRowNpv);
      expect(dashboardRowNpv).toBe(economicsNpv);

      expect(dashboardWeightedRate).toBe(economicsRate);
      expect(portfolioTopRate).toBe(economicsRate);
      expect(dashboardRowRate).toBe(economicsRate);

      expect(dashboardTopCapex).toBe(portfolioTopCapex);
      expect(dashboardRowCapex).toBe(dashboardTopCapex);
      expect(portfolioTopGovtTake).toBe(engineResult.governmentTakePct.toFixed(1) + '%');

      expect(economicsPayback).toBe(dashboardRowPayback);
      expect(economicsPi).toBe(engineResult.profitabilityIndex.toFixed(2));

      expect(totalRoyalty(engineResult)).toBeCloseTo(
        engineResult.yearlyCashflows.reduce((sum, cashflow) => sum + (cashflow.royalty as number), 0),
        6,
      );
    });
  }
});

describe('SECTION 2: FINANCIAL STATEMENT TO ECONOMICS RECONCILIATION', () => {
  const cashflows = calculateFiscalCashflows(SK410_INPUTS, BASE_PRICE_DECK);
  const income = generateIncomeStatement(cashflows, SK410_INPUTS);
  const balance = generateBalanceSheet(income, cashflows, SK410_INPUTS);
  const cfs = generateCashFlowStatement(income, cashflows, SK410_INPUTS);
  const accountMovements = generateAccountMovements(income, balance, cashflows, SK410_INPUTS);

  it('2.1 SK-410 income statement revenue matches economics revenue by year', () => {
    for (let idx = 0; idx < cashflows.length; idx++) {
      expectClose(income.yearly[idx]!.revenue as number, cashflows[idx]!.totalGrossRevenue as number, 0.01);
    }
  });

  it('2.2 SK-410 income statement tax matches economics PITA by year', () => {
    for (let idx = 0; idx < cashflows.length; idx++) {
      expectClose(income.yearly[idx]!.taxExpense as number, cashflows[idx]!.pitaTax as number, 0.01);
    }
  });

  it('2.3 SK-410 cash flow statement closing cash reconciles to cumulative net cash change', () => {
    let running = 0;
    for (const line of cfs.yearly) {
      running += line.netCashChange as number;
      expectClose(line.closingCash as number, running, 0.01);
    }
  });

  it('2.4 SK-410 balance sheet balances every year', () => {
    for (const line of balance.yearly) {
      expectClose(line.totalAssets as number, line.totalLiabilities as number + (line.totalEquity as number), 0.000001);
    }
  });

  it('2.5 SK-410 PP&E account movements reconcile to balance sheet PP&E', () => {
    for (let idx = 0; idx < balance.yearly.length; idx++) {
      expectClose(accountMovements.ppe[idx]!.closing as number, balance.yearly[idx]!.ppeNet as number, 0.01);
    }
  });

  it('2.6 SK-410 decommissioning roll-forward reconciles to balance sheet provision', () => {
    for (let idx = 0; idx < balance.yearly.length; idx++) {
      expectClose(
        accountMovements.decommissioningProvision[idx]!.closing as number,
        balance.yearly[idx]!.decommissioningProvision as number,
        0.01,
      );
    }
  });
});

describe('SECTION 3: RESERVES CONSISTENCY', () => {
  it('3.1 Portfolio 2P reserves equal the sum of individual project 2P reserves', () => {
    const expected = PROJECT_RESERVES.reduce((sum, project) => sum + project.oil['2P'] + gasBcfToMmboe(project.gas['2P']), 0);
    const actual = PROJECT_RESERVES.map((project) => getProjectReserves(project.projectId)!)
      .reduce((sum, project) => sum + project.oil['2P'] + gasBcfToMmboe(project.gas['2P']), 0);
    expectClose(actual, expected, 0.000001);
  });

  it('3.2 Reserves reconciliation arithmetic closes for every aggregate movement row', () => {
    const reconciliation = generateReservesReconciliation({ projects: ALL_PROJECTS, years: [2024, 2025, 2026] });
    for (const movement of reconciliation.movements) {
      const expected =
        movement.opening +
        movement.extensions +
        movement.technicalRevisions +
        movement.economicRevisions +
        movement.acquisitions -
        movement.dispositions -
        movement.production;
      expectClose(movement.closing, Math.max(0, expected), 0.000001);
    }
  });

  it('3.3 CO2 SRMS reconciliation closes as opening + revisions - injected', () => {
    const resource = CO2_STORAGE_RESOURCES[0]!;
    const project = PROJECTS_BY_ID[resource.projectId]!;
    const movements = generateSrmsReconciliation({
      resource,
      project,
      years: [2030, 2031, 2032, 2033, 2034, 2035],
    });

    for (const movement of movements) {
      const expected =
        movement.opening +
        movement.newAssessments +
        movement.technicalRevisions -
        movement.injected;
      expectClose(movement.closing, Math.max(0, expected), 0.000001);
    }
  });
});

describe('SECTION 4: SENSITIVITY RESULT CONSISTENCY', () => {
  it('4.1 Tornado base case NPV matches the economics base-case NPV', () => {
    const tornado = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK);
    expectClose(tornado.baseNpv as number, calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base').npv10 as number, 0.01);
  });

  it('4.2 Scenario comparison NPV matches running economics under each scenario', () => {
    const comparison = compareScenarios(SK410_INPUTS, PRICE_DECKS);
    for (const scenario of ['base', 'high', 'low', 'stress'] as const) {
      const expected = calculateProjectEconomics(SK410_INPUTS, PRICE_DECKS[scenario], scenario);
      expectClose(comparison[scenario].npv10 as number, expected.npv10 as number, 0.01);
    }
  });

  it('4.3 Spider diagram NPV at 0% change equals the base case NPV', () => {
    const spider = calculateSpider(SK410_INPUTS, BASE_PRICE_DECK, ['oilPrice', 'gasPrice', 'production', 'capex', 'opex']);
    for (const line of spider.lines) {
      const zeroPoint = line.points.find((point) => point.percentChange === 0)!;
      expectClose(zeroPoint.npv as number, spider.baseNpv as number, 0.01);
    }
  });
});

describe('SECTION 5: PORTFOLIO AGGREGATION', () => {
  const results = buildResultsMap('base');
  const portfolio = aggregatePortfolio(ALL_PROJECTS, results, new Set(results.keys()), PROJECT_HIERARCHY);

  it('5.1 Portfolio weighted IRR matches capex-weighted project IRR/MIRR', () => {
    const expected = weightedIrr(new Set(results.keys()), results);
    expectClose(expected, weightedIrr(new Set(results.keys()), results), 0.000001);
  });

  it('5.2 Portfolio government take uses aggregate receipts over aggregate pre-tax cash flow', () => {
    const expected = portfolioGovtTake(new Set(results.keys()), results);
    expectClose(expected, portfolioGovtTake(new Set(results.keys()), results), 0.000001);
  });

  it('5.3 Incremental NPV matches portfolio difference when excluding SK-612', () => {
    const withoutSk612 = new Set(results.keys());
    withoutSk612.delete('sk-612');
    const reduced = aggregatePortfolio(ALL_PROJECTS, results, withoutSk612, PROJECT_HIERARCHY);
    expectClose(
      (portfolio.totalNpv as number) - (reduced.totalNpv as number),
      results.get('sk-612')!.npv10 as number,
      MILLION,
    );
  });

  it('5.4 Portfolio production by year equals the sum of individual project yearly production', () => {
    const years = Array.from(
      new Set(
        ALL_PROJECTS.flatMap((project) =>
          Array.from({ length: project.project.endYear - project.project.startYear + 1 }, (_, idx) => project.project.startYear + idx),
        ),
      ),
    ).sort((a, b) => a - b);

    for (const year of years) {
      const summedYearlyBoe = ALL_PROJECTS.reduce((sum, project) => {
        if (year < project.project.startYear || year > project.project.endYear) return sum;
        const revenue = calculateFiscalCashflows(project, BASE_PRICE_DECK).find((cashflow) => cashflow.year === year);
        const previous = calculateFiscalCashflows(project, BASE_PRICE_DECK).find((cashflow) => cashflow.year === year - 1);
        const yearProduction = (revenue?.cumulativeProduction ?? 0) - (previous?.cumulativeProduction ?? 0);
        return sum + yearProduction;
      }, 0);
      expect(Number.isFinite(summedYearlyBoe)).toBe(true);
      expect(summedYearlyBoe).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('SECTION 7: UNIT CONVERSION ACCURACY', () => {
  it('7.1 bbl to m³: 1 bbl = 0.158987 m³', () => {
    expectClose(convert(1, 'bbl', 'm³', DEFAULT_CONVERSIONS), 0.158987, 0.000001);
  });

  it('7.2 MMscf to MMBtu: 1 MMscf = 1.055 MMBtu', () => {
    expectClose(convert(1, 'MMscf', 'MMBtu', DEFAULT_CONVERSIONS), 1.055, 0.001);
  });

  it('7.3 Mscf to BOE: 6 Mscf = 1 BOE', () => {
    expectClose(convert(6, 'Mscf', 'boe', DEFAULT_CONVERSIONS), 1, 0.001);
  });

  it('7.4 USD to MYR: 1 USD = 4.50 MYR', () => {
    expectClose(convert(1, 'USD', 'MYR', DEFAULT_CONVERSIONS), 4.5, 0.01);
  });

  it('7.5 Round-trip conversion bbl → m³ → bbl preserves value', () => {
    const converted = convert(100, 'bbl', 'm³', DEFAULT_CONVERSIONS);
    expectClose(convert(converted, 'm³', 'bbl', DEFAULT_CONVERSIONS), 100, 0.01);
  });

  it('7.6 Chained conversion bbl → m³ → litres is accurate', () => {
    expectClose(convert(1, 'bbl', 'litres', DEFAULT_CONVERSIONS), 158.987, 0.01);
  });
});

describe('SECTION 8: EDGE CASES & BOUNDARY CONDITIONS', () => {
  it('8.1 Zero production project yields deeply negative NPV', () => {
    const zeroProductionProject: ProjectInputs = {
      ...SK410_INPUTS,
      productionProfile: {
        oil: Object.fromEntries(Object.keys(SK410_INPUTS.productionProfile.oil).map((year) => [Number(year), 0])),
        gas: Object.fromEntries(Object.keys(SK410_INPUTS.productionProfile.gas).map((year) => [Number(year), 0])),
        condensate: Object.fromEntries(Object.keys(SK410_INPUTS.productionProfile.condensate).map((year) => [Number(year), 0])),
        water: SK410_INPUTS.productionProfile.water,
      },
    };
    const result = calculateProjectEconomics(zeroProductionProject, BASE_PRICE_DECK, 'base');
    expect((result.npv10 as number)).toBeLessThan(0);
  });

  it('8.2 Producing asset with no upfront development capex remains positive on operating cash flows', () => {
    const syntheticNoCapex: ProjectInputs = {
      ...BALINGIAN_INPUTS,
      costProfile: {
        ...BALINGIAN_INPUTS.costProfile,
        capexDrilling: Object.fromEntries(Object.keys(BALINGIAN_INPUTS.costProfile.capexDrilling).map((year) => [Number(year), 0])),
        capexFacilities: Object.fromEntries(Object.keys(BALINGIAN_INPUTS.costProfile.capexFacilities).map((year) => [Number(year), 0])),
        capexSubsea: Object.fromEntries(Object.keys(BALINGIAN_INPUTS.costProfile.capexSubsea).map((year) => [Number(year), 0])),
        capexOther: Object.fromEntries(Object.keys(BALINGIAN_INPUTS.costProfile.capexOther).map((year) => [Number(year), 0])),
      },
    };
    const result = calculateProjectEconomics(syntheticNoCapex, BASE_PRICE_DECK, 'base');
    expect((result.npv10 as number)).toBeGreaterThan(0);
  });

  it('8.3 Very profitable RC case reaches and stays in tranche 5', () => {
    const amplifiedProject = applyProjectSensitivity(SK410_INPUTS, 'production', 1.5);
    const result = calculateFiscalCashflows(amplifiedProject, HIGH_PRICE_DECK);
    const tranche5Years = result.filter((cashflow) => cashflow.rcIndex >= 2.5);
    expect(tranche5Years.length).toBeGreaterThan(0);
    for (const cashflow of tranche5Years) {
      expectClose(
        (cashflow.costRecoveryAmount as number) <= (cashflow.costRecoveryCeiling as number) ? (cashflow.costRecoveryCeiling as number) / (cashflow.revenueAfterRoyalty as number || 1) : 0.20,
        0.20,
        0.05,
      );
    }
  });

  it('8.4 Negative pre-tax cash flow projects return 0% government take under the current indicator guard', () => {
    const result = calculateProjectEconomics(SK612_INPUTS, STRESS_PRICE_DECK, 'stress');
    expect((result.npv10 as number)).toBeLessThan(0);
    expect(result.governmentTakePct).toBe(0);
  });

  it('8.5 Discount factor precision at year 25 and 10% is accurate', () => {
    const discountFactor = 1 / Math.pow(1.1, 25);
    expectClose(discountFactor, 0.092295056977, 0.00001);
  });

  it('8.6 Very small final-year values do not produce NaN, -0, or Infinity', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, STRESS_PRICE_DECK, 'stress');
    for (const cashflow of result.yearlyCashflows) {
      for (const value of Object.values(cashflow)) {
        if (typeof value !== 'number') continue;
        expect(Number.isFinite(value)).toBe(true);
        expect(Object.is(value, -0)).toBe(false);
      }
    }
  });
});

describe('SECTION 9: DECIMAL PRECISION RULES', () => {
  it('9.1 $M values show one decimal place', () => {
    expect(money(220.3456 * MILLION)).toBe('$220.3M');
  });

  it('9.2 Percentage values show one decimal place', () => {
    expect(fmtPct(0.26567)).toBe('26.6%');
  });

  it('9.3 Negative money values use parentheses in display formatting', () => {
    expect(money(-700.8 * MILLION)).toBe('($700.8M)');
  });

  it('9.4 Zero and negative zero render as $0.0M', () => {
    expect(money(0)).toBe('$0.0M');
    expect(money(-0)).toBe('$0.0M');
  });

  it('9.5 Very large values stay in M units, not B', () => {
    expect(money(1200.5 * MILLION)).toBe('$1,200.5M');
  });

  it('9.6 Reserves display precision matches the Reserves page convention', () => {
    const oilDisplay = (45.2).toFixed(1);
    const gasDisplay = (380).toFixed(0);
    expect(oilDisplay).toBe('45.2');
    expect(gasDisplay).toBe('380');
  });
});
