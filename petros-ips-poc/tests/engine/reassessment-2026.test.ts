// ════════════════════════════════════════════════════════════════════════
// September 2026 reassessment — regression pack for the formula fixes and
// the fiscal / market parameter updates. Each block re-derives the
// expected value independently of the engine.
// ════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { ALL_PROJECTS, SK410_INPUTS, SK612_INPUTS, TUKAU_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK, PRICE_DECKS } from '@/data/price-decks';
import { DOWNSTREAM_TAX, LLA_PSC, RC_PSC, DW_PSC, SFA_PSC, RSC_CONTRACT } from '@/data/fiscal-regimes';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import { calculatePscRc } from '@/engine/fiscal/psc-rc';
import { calculatePscLla } from '@/engine/fiscal/psc-lla';
import { calculateDownstream } from '@/engine/fiscal/downstream';
import { AllowancePool, TaxLossPool, workingInterestCosts, computeCosts } from '@/engine/fiscal/shared';
import { calculateProjectEconomics, governmentReceipts } from '@/engine/economics';
import { calculateNPV } from '@/engine/economics/npv';
import { calculateIRR } from '@/engine/economics/irr';
import { npvAtValuationYear } from '@/engine/economics/valuation';
import { optimisePortfolio } from '@/engine/portfolio/optimization';
import { consolidatePortfolio } from '@/engine/portfolio/consolidation';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { buildDebtServiceSchedule } from '@/engine/financial/project-finance';
import { evaluateAcquisition } from '@/engine/financial/ma';
import { generateReservesReconciliation } from '@/engine/reserves/reconciliation';
import { expandValues } from '@/lib/period-granularity';
import { REFERENCE_USD_MYR } from '@/engine/utils/unit-conversion';
import type {
  CostProfile,
  EconomicsResult,
  PriceDeck,
  ProductionProfile,
  ProjectInputs,
  TimeSeriesData,
  USD,
} from '@/engine/types';

const M = 1_000_000;

function series<T extends number>(start: number, end: number, value: number | ((year: number) => number)): TimeSeriesData<T> {
  const s: Record<number, T> = {};
  for (let y = start; y <= end; y++) s[y] = (typeof value === 'function' ? value(y) : value) as T;
  return s;
}

function deck(start: number, end: number, oil: number, gas: number): PriceDeck {
  return {
    oil: series<USD>(start, end, oil),
    gas: series<USD>(start, end, gas),
    condensate: series<USD>(start, end, oil * 0.85),
    exchangeRate: series<number>(start, end, REFERENCE_USD_MYR),
    carbonCredit: series<USD>(start, end, 25),
  };
}

function costs(start: number, end: number, capex: Record<number, number>, opex: number, abex: Record<number, number> = {}): CostProfile {
  const zero = series<USD>(start, end, 0);
  return {
    capexDrilling: series<USD>(start, end, (y) => capex[y] ?? 0),
    capexFacilities: zero,
    capexSubsea: zero,
    capexOther: zero,
    opexFixed: series<USD>(start, end, opex),
    opexVariable: zero,
    abandonmentCost: series<USD>(start, end, (y) => abex[y] ?? 0),
  };
}

// ── Market & fiscal parameters (September 2026) ───────────────────────

describe('Price decks and FX are anchored to current data', () => {
  it('Brent actuals to 2025 (EIA) and the EIA STEO Sep-2026 values for 2026–27', () => {
    for (const d of Object.values(PRICE_DECKS)) {
      expect(d.oil[2022]).toBe(100.93);
      expect(d.oil[2025]).toBe(69.14);
      expect(d.oil[2026]).toBe(91);
      expect(d.exchangeRate[2026]).toBe(REFERENCE_USD_MYR);
    }
    expect(BASE_PRICE_DECK.oil[2027]).toBe(74);
    expect(BASE_PRICE_DECK.oil[2028]).toBeCloseTo(70 * 1.02, 2);
    expect(PRICE_DECKS.high.oil[2030]).toBeGreaterThan(BASE_PRICE_DECK.oil[2030]!);
    expect(PRICE_DECKS.low.oil[2030]).toBeLessThan(BASE_PRICE_DECK.oil[2030]!);
    expect(PRICE_DECKS.stress.oil[2040]).toBe(40);
    expect(REFERENCE_USD_MYR).toBe(4.07);
  });

  it('regime parameters match the published / current terms', () => {
    expect(RC_PSC.pitaRate).toBe(0.38);
    expect(SFA_PSC.researchCessRate).toBe(0); // MPM: not applicable to SFA
    expect(LLA_PSC.pitaRate).toBe(0.25);
    expect(LLA_PSC.exportDutyRate).toBe(0);
    expect(LLA_PSC.researchCessRate).toBe(0);
    expect(RSC_CONTRACT.pitaRate).toBe(0.24); // ITA 1967 corporate rate on RSC fees
    expect(DOWNSTREAM_TAX.taxRate).toBe(0.24);
    expect(DW_PSC.sarawakSstRate).toBe(0.05);
  });
});

// ── Tax pools ─────────────────────────────────────────────────────────

describe('Tax loss and allowance pools', () => {
  it('losses carry forward oldest-first and expire after the limit', () => {
    const pool = new TaxLossPool(2);
    expect(pool.apply(2030, -100)).toEqual({ lossRelief: 0, chargeableIncome: 0 });
    expect(pool.apply(2031, 30)).toEqual({ lossRelief: 30, chargeableIncome: 0 });
    // 2033 is 3 years after the 2030 loss — the remaining 70 has expired.
    expect(pool.apply(2033, 50)).toEqual({ lossRelief: 0, chargeableIncome: 50 });
    const unlimited = new TaxLossPool();
    unlimited.apply(2030, -100);
    expect(unlimited.apply(2045, 150)).toEqual({ lossRelief: 100, chargeableIncome: 50 });
  });

  it('allowance is capped at a share of statutory income and carried forward', () => {
    const pool = new AllowancePool(0.60, 0.70, 10);
    pool.accrue(2030, 100); // 60 earned
    expect(pool.utilise(50)).toBeCloseTo(35, 10); // capped at 70% of 50
    expect(pool.utilise(100)).toBeCloseTo(25, 10); // remaining balance
    pool.accrue(2041, 100); // outside the 10-year window
    expect(pool.utilise(1000)).toBe(0);
  });
});

// ── Fiscal engines ────────────────────────────────────────────────────

describe('Fiscal engine fixes', () => {
  it('Deepwater R/C: contractor share switches to the above-THV column past 300 MMstb', () => {
    // 100,000 bpd = 36.5 MMstb/yr → crosses 300 MMstb during year 9.
    const start = 2030;
    const end = 2041;
    const zero = series<number>(start, end, 0);
    const production: ProductionProfile = { oil: series<number>(start, end, 100_000), gas: zero, condensate: zero, water: zero };
    const result = calculatePscRc({
      yearlyProduction: production,
      yearlyCosts: costs(start, end, { [start]: 2_000 * M }, 50 * M),
      priceDeck: deck(start, end, 70, 8),
      fiscalConfig: { ...DW_PSC, type: 'PSC_RC' },
      equityShare: 1,
      startYear: start,
      endYear: end,
    });
    const yearly = 36.5;
    result.forEach((cf, i) => {
      if ((cf.profitOilGas as number) <= 0) return;
      const tranche = DW_PSC.tranches.find((t) => cf.rcIndex >= t.rcFloor && cf.rcIndex < t.rcCeiling) ?? DW_PSC.tranches[0]!;
      const before = yearly * i;
      const after = before + yearly;
      const above = after <= 300 ? 0 : before >= 300 ? 1 : (after - 300) / yearly;
      const expectedShare = tranche.contractorProfitSharePct
        + (tranche.contractorProfitSharePctAboveThv! - tranche.contractorProfitSharePct) * above;
      expect((cf.contractorProfitShare as number) / (cf.profitOilGas as number)).toBeCloseTo(expectedShare, 6);
      expect(cf.supplementaryPayment).toBe(0);
    });
  });

  it('Deepwater SK-612 now carries Sarawak SST and uses the investment allowance', () => {
    const cfs = calculateFiscalCashflows(SK612_INPUTS, BASE_PRICE_DECK);
    for (const cf of cfs) {
      expect(cf.sarawakSst as number).toBeCloseTo((cf.totalGrossRevenue as number) * 0.05, 6);
    }
    expect(cfs.some((cf) => (cf.taxAllowanceUsed as number) > 0)).toBe(true);
    const totalIa = cfs.reduce((s, cf) => s + (cf.taxAllowanceUsed as number), 0);
    const totalCapex = cfs.reduce((s, cf) => s + computeCosts(workingInterestCosts(SK612_INPUTS), cf.year).totalCapex, 0);
    expect(totalIa).toBeLessThanOrEqual(totalCapex * 0.60 + 1);
  });

  it('LLA: cash payment + abandonment cess until the commitment is funded; no cost recovery, cess or ABEX', () => {
    const start = 2030;
    const end = 2037;
    const zero = series<number>(start, end, 0);
    const production: ProductionProfile = { oil: series<number>(start, end, 4_000), gas: zero, condensate: zero, water: zero };
    const commitment = 20 * M;
    const cfs = calculatePscLla({
      yearlyProduction: production,
      yearlyCosts: costs(start, end, { [start]: 10 * M }, 15 * M, { [end]: 25 * M }),
      priceDeck: deck(start, end, 70, 8),
      fiscalConfig: { ...LLA_PSC, abandonmentCessRate: 0.05, abandonmentCostCommitment: commitment },
      equityShare: 1,
      startYear: start,
      endYear: end,
    });
    let cess = 0;
    for (const cf of cfs) {
      const gross = cf.totalGrossRevenue as number;
      expect(cf.royalty as number).toBeCloseTo(gross * 0.10, 6);
      expect(cf.exportDuty).toBe(0);
      expect(cf.researchCess).toBe(0);
      expect(cf.costRecoveryAmount).toBe(0);
      const expectedCess = Math.min(gross * 0.05, commitment - cess);
      cess += expectedCess;
      const take = gross - gross * 0.10 - (cf.sarawakSst as number) - expectedCess;
      expect(cf.contractorEntitlement as number).toBeCloseTo(take, 4);
      // PETRONAS funds decommissioning from the cess — ABEX never hits the contractor.
      const capex = cf.year === start ? 10 * M : 0;
      expect(cf.netCashFlow as number).toBeCloseTo(take - (cf.pitaTax as number) - capex - 15 * M, 4);
    }
    expect(cess).toBeCloseTo(commitment, 4);
    // Two-year accelerated capital allowance: 60% then 40%.
    expect(cfs[0]!.capitalAllowance as number).toBeCloseTo(6 * M, 4);
    expect(cfs[1]!.capitalAllowance as number).toBeCloseTo(4 * M, 4);
    expect(cfs[2]!.capitalAllowance).toBe(0);
  });

  it('CCS income-exemption election exempts 70% of statutory income for 10 years from first revenue', () => {
    const start = 2030;
    const end = 2045;
    const zero = series<number>(start, end, 0);
    const production: ProductionProfile = {
      oil: zero, gas: zero, condensate: zero,
      water: series<number>(start, end, (y) => (y === start ? 0 : 3_000)), // t CO₂/day injected
    };
    const cfs = calculateDownstream({
      yearlyProduction: production,
      yearlyCosts: costs(start, end, { [start]: 20 * M }, 5 * M),
      priceDeck: deck(start, end, 70, 8),
      fiscalConfig: { ...DOWNSTREAM_TAX, ccsIncentive: { type: 'income-exemption', exemptPct: 0.70, periodYears: 10 } },
      equityShare: 1,
      startYear: start,
      endYear: end,
    });
    for (const cf of cfs) {
      const yearsFromFirstRevenue = cf.year - (start + 1);
      const statutory = Math.max(0, cf.taxableIncome as number);
      const expectedExempt = yearsFromFirstRevenue >= 0 && yearsFromFirstRevenue < 10 ? statutory * 0.70 : 0;
      expect(cf.taxAllowanceUsed as number).toBeCloseTo(expectedExempt, 4);
    }
  });

  it('government receipts + contractor NCF = revenue − working-interest costs for every project', () => {
    for (const project of ALL_PROJECTS) {
      const cfs = calculateFiscalCashflows(project, BASE_PRICE_DECK);
      const wi = workingInterestCosts(project);
      for (const cf of cfs) {
        const cost = computeCosts(wi, cf.year);
        expect(governmentReceipts(cf) + (cf.netCashFlow as number)).toBeCloseTo(
          (cf.totalGrossRevenue as number) - cost.totalCapex - cost.totalOpex - cost.abandonmentCost,
          2,
        );
      }
    }
  });

  it('costs are taken at the equity share, like revenue', () => {
    const halfShare: ProjectInputs = { ...SK410_INPUTS, project: { ...SK410_INPUTS.project, equityShare: 0.5 } };
    const full: ProjectInputs = { ...SK410_INPUTS, project: { ...SK410_INPUTS.project, equityShare: 1 } };
    const half = calculateProjectEconomics(halfShare, BASE_PRICE_DECK);
    const whole = calculateProjectEconomics(full, BASE_PRICE_DECK);
    // Fiscal terms are scale-invariant, so NPV scales with the share.
    expect(half.npv10 as number).toBeCloseTo((whole.npv10 as number) * 0.5, 0);
    expect(half.totalCapex as number).toBeCloseTo((whole.totalCapex as number) * 0.5, 0);
  });
});

// ── Economic indicators & portfolio ───────────────────────────────────

describe('Indicator fixes', () => {
  it('IRR resolves above 200% and is null when no root exists', () => {
    expect(calculateIRR([-100, 400])).toBeCloseTo(3.0, 6);
    expect(calculateIRR([-100, -50])).toBeNull();
    expect(calculateIRR([-100, 10, 10])).toBeNull(); // NPV < 0 at every rate ≥ −50%
  });

  it('mid-year NPV = end-of-year NPV × (1 + r)^0.5', () => {
    const cfs = [-100, 30, 40, 50, 60];
    expect(calculateNPV(cfs, 0.10, 'mid-year')).toBeCloseTo(calculateNPV(cfs, 0.10) * Math.sqrt(1.10), 8);
  });

  it('payback is 0 when the cumulative cash position is never negative', () => {
    const producing = calculateProjectEconomics(
      { ...TUKAU_INPUTS, costProfile: { ...TUKAU_INPUTS.costProfile, capexDrilling: {}, capexFacilities: {}, capexSubsea: {}, capexOther: {} } },
      BASE_PRICE_DECK,
    );
    expect(producing.yearlyCashflows.every((cf) => (cf.cumulativeCashFlow as number) >= 0)).toBe(true);
    expect(producing.paybackYears).toBe(0);
  });

  it('portfolio NPV values every project at the 2026 valuation year, forward cash flows only', () => {
    const result = calculateProjectEconomics(TUKAU_INPUTS, BASE_PRICE_DECK); // starts 2027
    expect(npvAtValuationYear(result, 0.10, 2026)).toBeCloseTo((result.npv10 as number) / 1.10, 2);
  });

  it('the optimiser finds the best subset, not the greedy ranking', () => {
    const mk = (id: string, capex: number, npv: number) => ({
      project: { ...SK410_INPUTS, project: { ...SK410_INPUTS.project, id } } as ProjectInputs,
      result: {
        irr: 0.20,
        totalCapex: capex as USD,
        yearlyCashflows: [{ year: 2026, netCashFlow: npv as USD }],
      } as unknown as EconomicsResult,
    });
    const items = [mk('a', 60, 70), mk('b', 50, 55), mk('c', 50, 55)];
    const out = optimisePortfolio({
      projects: items.map((i) => i.project),
      results: new Map(items.map((i) => [i.project.project.id, i.result])),
      capexBudgetUsd: 100,
    });
    expect([...out.selectedProjectIds].sort()).toEqual(['b', 'c']);
    expect(out.totalNpv as number).toBe(110);
  });

  it('proportional consolidation does not apply the equity share twice', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK);
    const consolidated = consolidatePortfolio([SK410_INPUTS], new Map([['sk-410', result]]), 4.07);
    expect(consolidated.groupNpvUsd as number).toBeCloseTo(result.npv10 as number, 2);
    expect(consolidated.groupNpvMyr as number).toBeCloseTo((result.npv10 as number) * 4.07, 2);
  });
});

// ── Financial statements ──────────────────────────────────────────────

describe('Financial statements reconcile by construction', () => {
  for (const project of ALL_PROJECTS) {
    for (const ddaMethod of ['straight-line', 'unit-of-production'] as const) {
      it(`${project.project.id} (${ddaMethod}): BS balances, cash ties, lifetime profit = lifetime NCF`, () => {
        const cfs = calculateFiscalCashflows(project, BASE_PRICE_DECK);
        const is = generateIncomeStatement(cfs, project, { ddaMethod });
        const bs = generateBalanceSheet(is, cfs, project);
        const cfStmt = generateCashFlowStatement(is, cfs, project);
        bs.yearly.forEach((line, i) => {
          expect(Math.abs(line.otherReserves as number)).toBeLessThan(1);
          expect(line.cash as number).toBeCloseTo(cfStmt.yearly[i]!.closingCash as number, 2);
          expect(line.ppeNet as number).toBeGreaterThan(-1);
        });
        const profit = is.yearly.reduce((s, l) => s + (l.profitAfterTax as number), 0);
        const ncf = cfs.reduce((s, cf) => s + (cf.netCashFlow as number), 0);
        expect(profit).toBeCloseTo(ncf, 0);
        const last = bs.yearly[bs.yearly.length - 1]!;
        expect(Math.abs(last.ppeNet as number)).toBeLessThan(1);
        expect(Math.abs(last.decommissioningProvision as number)).toBeLessThan(1);
      });
    }
  }
});

// ── Project finance & M&A ─────────────────────────────────────────────

describe('Project finance coverage ratios', () => {
  it('LLCR is 1.00 when CFADS exactly equals the level debt service', () => {
    const r = 0.10;
    const n = 5;
    const debt = 100;
    const pmt = debt * (r * (1 + r) ** n) / ((1 + r) ** n - 1);
    // No construction period effect: debt fully drawn in year 0 with the
    // construction interest capitalised, so size CFADS on that balance.
    const cod = debt * (1 + r / 2);
    const pmtCod = cod * (r * (1 + r) ** n) / ((1 + r) ** n - 1);
    const pf = buildDebtServiceSchedule({
      cfads: [0, ...Array<number>(n).fill(pmtCod)],
      totalCapex: debt,
      debtFraction: 1,
      interestRate: r,
      tenorYears: n,
      constructionYears: 1,
      taxRate: 0.38,
      cashSweepThreshold: 99, // no sweep
    });
    expect(pmt).toBeGreaterThan(0);
    expect(pf.llcr).toBeCloseTo(1.0, 6);
    expect(pf.minDscr).toBeCloseTo(1.0, 6);
    expect(pf.avgDscr).toBeCloseTo(1.0, 6);
  });

  it('negative DSCR years count toward the minimum; years without debt service are excluded', () => {
    const pf = buildDebtServiceSchedule({
      cfads: [0, -20, 60, 60, 60, 60],
      totalCapex: 100,
      debtFraction: 0.6,
      interestRate: 0.07,
      tenorYears: 5,
      constructionYears: 1,
      taxRate: 0.38,
    });
    expect(pf.minDscr).toBeLessThan(0);
    expect(Number.isNaN(pf.schedule[0]!.dscr)).toBe(true);
    expect(pf.avgDscr).toBeLessThan(10);
  });
});

describe('M&A deal IRR', () => {
  it('paying fair value with no premium or synergies returns the target WACC', () => {
    const result = evaluateAcquisition({
      targetCashflows: [0, 40, 40, 40, 40, 40],
      targetWacc: 0.09,
      revenueSynergies: [],
      costSynergies: [],
      integrationCosts: [],
      acquirerWacc: 0.09,
      controlPremiumPct: 0,
      acquirerCashflows: [0, 100, 100],
    });
    expect(result.dealIrr).toBeCloseTo(0.09, 6);
  });
});

// ── Reserves & period views ───────────────────────────────────────────

describe('Reserves reconciliation and sub-annual views', () => {
  it('reconciliation always satisfies opening + movements − production = closing', () => {
    const { movements } = generateReservesReconciliation({
      projects: ALL_PROJECTS,
      years: Array.from({ length: 25 }, (_, i) => 2026 + i),
    });
    for (const m of movements) {
      const expected = m.opening + m.extensions + m.technicalRevisions + m.economicRevisions
        + m.acquisitions - m.dispositions - m.production;
      expect(m.closing).toBeCloseTo(expected, 6);
      expect(m.closing).toBeGreaterThanOrEqual(0);
    }
  });

  it('quarterly balances step from opening to closing in line with the flows', () => {
    const opening = [0, 100];
    const flow = [100, -40];
    const closing = [100, 60];
    const qOpen = expandValues(opening, 'quarter', 'opening', closing);
    const qFlow = expandValues(flow, 'quarter', 'flow');
    const qClose = expandValues(closing, 'quarter', 'stock');
    for (let i = 0; i < qFlow.length; i++) {
      expect(qOpen[i]! + qFlow[i]!).toBeCloseTo(qClose[i]!, 10);
      if (i > 0) expect(qOpen[i]!).toBeCloseTo(qClose[i - 1]!, 10);
    }
  });
});
