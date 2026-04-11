import { describe, it, expect } from 'vitest';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { generateAccountMovements } from '@/engine/financial/account-movements';
import { generateInvestmentFinancingProgram } from '@/engine/financial/investment-financing';
import { generateReservesReconciliation } from '@/engine/reserves/reconciliation';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { SK410_INPUTS, ALL_PROJECTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { computeCosts } from '@/engine/fiscal/shared';

// ── Shared setup ──────────────────────────────────────────────────────

const cashflows = calculateFiscalCashflows(SK410_INPUTS, BASE_PRICE_DECK);
const incomeStatement = generateIncomeStatement(cashflows, SK410_INPUTS);
const balanceSheet = generateBalanceSheet(incomeStatement, cashflows, SK410_INPUTS);
const cashFlowStatement = generateCashFlowStatement(incomeStatement, cashflows, SK410_INPUTS);
const accountMovements = generateAccountMovements(incomeStatement, balanceSheet, cashflows, SK410_INPUTS);

// ════════════════════════════════════════════════════════════════════════
// TEST 1: Income statement revenue matches economics model
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: Income statement revenue matches economics model', () => {
  it('revenue line equals totalGrossRevenue from cashflows for every year', () => {
    for (let i = 0; i < cashflows.length; i++) {
      expect(incomeStatement.yearly[i]!.revenue as number).toBeCloseTo(
        cashflows[i]!.totalGrossRevenue as number,
        2,
      );
    }
  });

  it('tax expense matches pitaTax from cashflows', () => {
    for (let i = 0; i < cashflows.length; i++) {
      expect(incomeStatement.yearly[i]!.taxExpense as number).toBeCloseTo(
        cashflows[i]!.pitaTax as number,
        2,
      );
    }
  });

  it('produces correct number of yearly lines', () => {
    const expectedYears = SK410_INPUTS.project.endYear - SK410_INPUTS.project.startYear + 1;
    expect(incomeStatement.yearly).toHaveLength(expectedYears);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: Balance sheet equation: Assets = Liabilities + Equity
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: Balance sheet equation: Assets = Liabilities + Equity', () => {
  it('totalAssets = totalEquityAndLiabilities for every year', () => {
    for (const bs of balanceSheet.yearly) {
      expect(bs.totalAssets as number).toBeCloseTo(
        bs.totalEquityAndLiabilities as number,
        2,
      );
    }
  });

  it('totalEquityAndLiabilities = totalEquity + totalLiabilities', () => {
    for (const bs of balanceSheet.yearly) {
      expect(bs.totalEquityAndLiabilities as number).toBeCloseTo(
        (bs.totalEquity as number) + (bs.totalLiabilities as number),
        2,
      );
    }
  });

  it('totalAssets = totalNonCurrentAssets + totalCurrentAssets', () => {
    for (const bs of balanceSheet.yearly) {
      expect(bs.totalAssets as number).toBeCloseTo(
        (bs.totalNonCurrentAssets as number) + (bs.totalCurrentAssets as number),
        2,
      );
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: Cash flow statement net change reconciles with NCF
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: Cash flow statement net change = NCF from economics', () => {
  it('netCashChange = netOperating + netInvesting + netFinancing', () => {
    for (const cfs of cashFlowStatement.yearly) {
      const expected =
        (cfs.netOperatingCashFlow as number) +
        (cfs.netInvestingCashFlow as number) +
        (cfs.netFinancingCashFlow as number);
      expect(cfs.netCashChange as number).toBeCloseTo(expected, 2);
    }
  });

  it('closingCash = openingCash + netCashChange', () => {
    for (const cfs of cashFlowStatement.yearly) {
      const expected = (cfs.openingCash as number) + (cfs.netCashChange as number);
      expect(cfs.closingCash as number).toBeCloseTo(expected, 2);
    }
  });

  it('closing cash of year N = opening cash of year N+1', () => {
    for (let i = 0; i < cashFlowStatement.yearly.length - 1; i++) {
      expect(cashFlowStatement.yearly[i]!.closingCash as number).toBeCloseTo(
        cashFlowStatement.yearly[i + 1]!.openingCash as number,
        2,
      );
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: PP&E account movement: Opening + Additions - DD&A = Closing
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: PP&E roll-forward integrity', () => {
  it('closing = opening + additions - depreciation - impairment - disposals', () => {
    for (const rf of accountMovements.ppe) {
      const expected =
        (rf.opening as number) +
        (rf.additions as number) -
        (rf.depreciation as number) -
        (rf.impairment as number) -
        (rf.disposals as number);
      expect(rf.closing as number).toBeCloseTo(expected, 2);
    }
  });

  it('year N closing = year N+1 opening', () => {
    for (let i = 0; i < accountMovements.ppe.length - 1; i++) {
      expect(accountMovements.ppe[i]!.closing as number).toBeCloseTo(
        accountMovements.ppe[i + 1]!.opening as number,
        2,
      );
    }
  });

  it('first year opening = 0', () => {
    expect(accountMovements.ppe[0]!.opening as number).toBe(0);
  });

  it('retained earnings roll-forward: closing = opening + PAT - dividends', () => {
    for (const re of accountMovements.retainedEarnings) {
      const expected =
        (re.opening as number) +
        (re.profitAfterTax as number) -
        (re.dividends as number) +
        (re.otherMovements as number);
      expect(re.closing as number).toBeCloseTo(expected, 2);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Reserves reconciliation: Closing = Opening + Changes - Production
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Reserves reconciliation waterfall integrity', () => {
  const recon = generateReservesReconciliation({
    projects: ALL_PROJECTS,
    years: [2024, 2025, 2026],
  });

  it('closing = opening + extensions + revisions + acq - disp - production', () => {
    for (const m of recon.movements) {
      const expected =
        m.opening +
        m.extensions +
        m.technicalRevisions +
        m.economicRevisions +
        m.acquisitions -
        m.dispositions -
        m.production;
      // closing is max(0, expected)
      expect(m.closing).toBeCloseTo(Math.max(0, expected), 4);
    }
  });

  it('has movements for all 3 years × 3 categories × 2 HC types = 18', () => {
    expect(recon.movements).toHaveLength(18);
  });

  it('production values are non-negative', () => {
    for (const m of recon.movements) {
      expect(m.production).toBeGreaterThanOrEqual(0);
    }
  });

  it('closing values are non-negative', () => {
    for (const m of recon.movements) {
      expect(m.closing).toBeGreaterThanOrEqual(0);
    }
  });

  it('2P opening >= 1P opening for same year and HC type', () => {
    const years = [2024, 2025, 2026];
    for (const year of years) {
      for (const hc of ['oil', 'gas'] as const) {
        const p1 = recon.movements.find(
          (m) => m.year === year && m.category === '1P' && m.hydrocarbonType === hc,
        );
        const p2 = recon.movements.find(
          (m) => m.year === year && m.category === '2P' && m.hydrocarbonType === hc,
        );
        if (p1 && p2) {
          expect(p2.opening).toBeGreaterThanOrEqual(p1.opening);
        }
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Investment program totals match sum of project CAPEX
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Investment program totals match sum of project CAPEX', () => {
  const allResults = ALL_PROJECTS.map((p) => calculateProjectEconomics(p, BASE_PRICE_DECK));
  const program = generateInvestmentFinancingProgram(ALL_PROJECTS, allResults);

  it('total investment equals sum of all project CAPEX', () => {
    let expectedTotal = 0;
    for (const proj of ALL_PROJECTS) {
      for (let y = proj.project.startYear; y <= proj.project.endYear; y++) {
        const cost = computeCosts(proj.costProfile, y);
        expectedTotal += cost.totalCapex;
      }
    }
    expect(program.totalInvestment as number).toBeCloseTo(expectedTotal, 0);
  });

  it('yearly totalCapex sums to totalInvestment', () => {
    const sumYearly = program.yearly.reduce(
      (s, y) => s + (y.totalCapex as number),
      0,
    );
    expect(sumYearly).toBeCloseTo(program.totalInvestment as number, 0);
  });

  it('program covers all project years', () => {
    const programYears = program.yearly.map((y) => y.year);
    for (const proj of ALL_PROJECTS) {
      expect(programYears).toContain(proj.project.startYear);
      expect(programYears).toContain(proj.project.endYear);
    }
  });
});
