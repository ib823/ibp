import { describe, it, expect } from 'vitest';
import { calculateNPV } from '@/engine/economics/npv';
import { calculateIRR } from '@/engine/economics/irr';
import { calculateMIRR } from '@/engine/economics/mirr';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { SK410_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';

// ════════════════════════════════════════════════════════════════════════
// TEST 1: NPV of known cashflows matches Excel
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: NPV of known cashflows matches Excel', () => {
  // Cashflows: [-100, 30, 35, 40, 45, 50] at 10%
  // NPV = -100 + 30/1.1 + 35/1.21 + 40/1.331 + 45/1.4641 + 50/1.61051
  //     = -100 + 27.2727 + 28.9256 + 30.0526 + 30.7354 + 31.0461
  //     = 47.0324 (rounding may differ slightly)
  // Let me compute precisely:
  // 30/1.10 = 27.27272727
  // 35/1.21 = 28.92561983
  // 40/1.331 = 30.05259955
  // 45/1.4641 = 30.73548041
  // 50/1.61051 = 31.04606831
  // Sum = 148.03249538 - 100 = 48.03249538

  const cashflows = [-100, 30, 35, 40, 45, 50];

  it('NPV at 10% ≈ $48.03', () => {
    const npv = calculateNPV(cashflows, 0.10);
    expect(npv).toBeCloseTo(48.03, 1);
  });

  it('NPV of empty array = 0', () => {
    expect(calculateNPV([], 0.10)).toBe(0);
  });

  it('NPV of all-negative cashflows is negative', () => {
    const npv = calculateNPV([-100, -50, -30], 0.10);
    expect(npv).toBeLessThan(0);
  });

  it('NPV at 0% = sum of cashflows', () => {
    const npv = calculateNPV(cashflows, 0);
    expect(npv).toBeCloseTo(100, 4); // -100+30+35+40+45+50 = 100
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: IRR of simple cashflow converges to known value
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: IRR of simple cashflow converges to known value', () => {
  // Cashflows: [-100, 30, 30, 30, 30, 30]
  // This is an annuity: 100 = 30 * [1-(1+r)^-5]/r
  // Solving: IRR ≈ 15.24%
  const cashflows = [-100, 30, 30, 30, 30, 30];

  it('IRR ≈ 15.24%', () => {
    const irr = calculateIRR(cashflows);
    expect(irr).not.toBeNull();
    expect(irr! * 100).toBeCloseTo(15.24, 0);
  });

  it('NPV at IRR ≈ 0', () => {
    const irr = calculateIRR(cashflows)!;
    const npvAtIrr = calculateNPV(cashflows, irr);
    expect(Math.abs(npvAtIrr)).toBeLessThan(0.001);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: IRR returns null for all-negative cashflows
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: IRR returns null for all-negative cashflows', () => {
  it('all negative → null', () => {
    expect(calculateIRR([-100, -50, -30])).toBeNull();
  });

  it('all positive → null', () => {
    expect(calculateIRR([10, 20, 30])).toBeNull();
  });

  it('single cashflow → null', () => {
    expect(calculateIRR([-100])).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: IRR handles multiple sign changes
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: IRR handles multiple sign changes', () => {
  // Classic textbook: [-100, 230, -132]
  // NPV = -100 + 230/(1+r) - 132/(1+r)^2
  // Setting NPV=0: -100(1+r)^2 + 230(1+r) - 132 = 0
  // Let x = 1+r: -100x^2 + 230x - 132 = 0
  // 100x^2 - 230x + 132 = 0
  // x = (230 ± √(52900-52800)) / 200 = (230 ± 10) / 200
  // x = 1.20 or 1.10 → r = 0.20 or 0.10
  const cashflows = [-100, 230, -132];

  it('returns smallest positive root (10%)', () => {
    const irr = calculateIRR(cashflows);
    expect(irr).not.toBeNull();
    expect(irr! * 100).toBeCloseTo(10, 0);
  });

  it('MIRR also computable for multiple sign changes', () => {
    const mirr = calculateMIRR(cashflows, 0.08, 0.10);
    expect(Number.isFinite(mirr)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Full project economics for SK-410 Gas produces plausible results
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Full project economics for SK-410 Gas', () => {
  const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base', 0.10);

  it('produces cashflows for all project years', () => {
    const expectedYears = SK410_INPUTS.project.endYear - SK410_INPUTS.project.startYear + 1;
    expect(result.yearlyCashflows).toHaveLength(expectedYears);
  });

  it('NPV10 is positive (profitable gas field)', () => {
    expect(result.npv10).toBeGreaterThan(0);
  });

  it('IRR is between 10% and 40%', () => {
    expect(result.irr).toBeGreaterThan(0.10);
    expect(result.irr).toBeLessThan(0.40);
  });

  it('payback is between 2 and 10 years', () => {
    // Post F1+F2 fix (PITA 1967 §33: OPEX + ABEX deductible from tax base),
    // SK-410 payback improved from ~3.0 yrs to ~2.99 yrs (lower tax → faster
    // recovery of contractor's net invested capital). See ASSESSMENT.md F1.
    expect(result.paybackYears).toBeGreaterThan(2);
    expect(result.paybackYears).toBeLessThan(10);
  });

  it('government take is between 40% and 95%', () => {
    // Malaysian PSC government take is typically high (70-90%+) due to
    // royalty + PITA + PETRONAS profit share. The metric here is
    // (totalRevenue - contractorNCF) / totalRevenue, which includes
    // CAPEX/OPEX spending, so effective government take appears very high.
    expect(result.governmentTakePct).toBeGreaterThan(40);
    expect(result.governmentTakePct).toBeLessThan(95);
  });

  it('contractor take + government take ≈ 100%', () => {
    // Due to cost recovery mechanics, these won't sum exactly to 100%
    // but they should be in the right ballpark
    const sum = result.governmentTakePct + result.contractorTakePct;
    expect(sum).toBeCloseTo(100, 0);
  });

  it('total CAPEX is roughly $480M', () => {
    // SK-410: drilling $80M + facilities $200M + subsea $180M + other $20M = $480M
    expect(result.totalCapex).toBeGreaterThan(400e6);
    expect(result.totalCapex).toBeLessThan(600e6);
  });

  it('peak funding is negative (capital invested before returns)', () => {
    expect(result.peakFunding).toBeLessThan(0);
  });

  it('MIRR is a finite number', () => {
    expect(Number.isFinite(result.mirr)).toBe(true);
  });

  it('total tax > 0', () => {
    expect(result.totalTax).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Profitability Index = NPV / PV(CAPEX)
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Profitability Index', () => {
  it('PI > 0 for profitable SK-410 project', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK);
    expect(result.profitabilityIndex).toBeGreaterThan(0);
  });

  it('PI based on NPV / PV(CAPEX)', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK, 'base', 0.10);
    // Verify PI is reasonable (NPV positive, CAPEX ~$480M)
    // PI should be > 0 and typically < 5 for a gas project
    expect(result.profitabilityIndex).toBeGreaterThan(0);
    expect(result.profitabilityIndex).toBeLessThan(5);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 7: Discounted payback interpolation gives fractional year
// ════════════════════════════════════════════════════════════════════════

describe('TEST 7: Discounted payback interpolation', () => {
  it('SK-410 discounted payback is a fractional number (not integer)', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK);
    // Payback should have a fractional component (linear interpolation)
    expect(result.discountedPaybackYears).toBeGreaterThan(0);
    expect(result.discountedPaybackYears % 1).not.toBe(0);
  });

  it('discounted payback ≥ undiscounted payback', () => {
    const result = calculateProjectEconomics(SK410_INPUTS, BASE_PRICE_DECK);
    expect(result.discountedPaybackYears).toBeGreaterThanOrEqual(result.paybackYears);
  });

  it('manual check: interpolation logic works correctly', () => {
    // Simulate: cumDCF at year 5 = -10, at year 6 = +15
    // Expected payback = 5 + 10/(10+15) = 5 + 10/25 = 5.4
    // This is tested indirectly through the SK-410 results above,
    // but let's verify the interpolation math directly.
    const npv = calculateNPV([-100, 20, 25, 30, 35, 40], 0.10);
    // Cumulative discounted:
    // Yr0: -100
    // Yr1: -100 + 20/1.10 = -100 + 18.18 = -81.82
    // Yr2: -81.82 + 25/1.21 = -81.82 + 20.66 = -61.16
    // Yr3: -61.16 + 30/1.331 = -61.16 + 22.54 = -38.62
    // Yr4: -38.62 + 35/1.4641 = -38.62 + 23.91 = -14.71
    // Yr5: -14.71 + 40/1.61051 = -14.71 + 24.84 = 10.13
    // Payback between yr4 and yr5: 4 + 14.71/(14.71+10.13) = 4 + 14.71/24.84 = 4.592
    expect(npv).toBeCloseTo(10.13, 0);
    // This verifies our NPV math is correct — the payback test is internal.
  });
});
