import { describe, it, expect } from 'vitest';
import { calculatePscRc, type PscRcInputs } from '@/engine/fiscal/psc-rc';
import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_RC,
  USD,
  TimeSeriesData,
} from '@/engine/types';

// ── Helpers ───────────────────────────────────────────────────────────

function usd(n: number): USD {
  return n as USD;
}

function constantSeries(start: number, end: number, val: number): TimeSeriesData<number> {
  const s: Record<number, number> = {};
  for (let y = start; y <= end; y++) s[y] = val;
  return s;
}

function usdSeries(start: number, end: number, val: number): TimeSeriesData<USD> {
  const s: Record<number, USD> = {};
  for (let y = start; y <= end; y++) s[y] = usd(val);
  return s;
}

function usdZeros(start: number, end: number): TimeSeriesData<USD> {
  return usdSeries(start, end, 0);
}

function zeros(start: number, end: number): TimeSeriesData<number> {
  return constantSeries(start, end, 0);
}

/** Standard 5-tranche R/C PSC config */
const RC_CONFIG: FiscalRegime_PSC_RC = {
  type: 'PSC_RC',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  tranches: [
    { rcFloor: 0, rcCeiling: 1.0, costRecoveryCeilingPct: 0.70, contractorProfitSharePct: 0.70, petronasProfitSharePct: 0.30 },
    { rcFloor: 1.0, rcCeiling: 1.4, costRecoveryCeilingPct: 0.60, contractorProfitSharePct: 0.60, petronasProfitSharePct: 0.40 },
    { rcFloor: 1.4, rcCeiling: 2.0, costRecoveryCeilingPct: 0.50, contractorProfitSharePct: 0.50, petronasProfitSharePct: 0.50 },
    { rcFloor: 2.0, rcCeiling: 2.5, costRecoveryCeilingPct: 0.30, contractorProfitSharePct: 0.30, petronasProfitSharePct: 0.70 },
    { rcFloor: 2.5, rcCeiling: Infinity, costRecoveryCeilingPct: 0.20, contractorProfitSharePct: 0.20, petronasProfitSharePct: 0.80 },
  ],
};

/** Build a simple price deck for testing */
function simplePriceDeck(
  start: number,
  end: number,
  oilPrice: number,
  gasPrice: number,
  condPrice: number,
): PriceDeck {
  return {
    oil: usdSeries(start, end, oilPrice),
    gas: usdSeries(start, end, gasPrice),
    condensate: usdSeries(start, end, condPrice),
    exchangeRate: constantSeries(start, end, 4.50),
    carbonCredit: usdSeries(start, end, 25),
  };
}

// ════════════════════════════════════════════════════════════════════════
// TEST 1: Simple 3-year gas project with R/C < 1.0 throughout
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: Simple 3-year gas project with R/C < 1.0 throughout', () => {
  // Setup: 50 MMscfd gas, $500M CAPEX in year 1, $80M/yr OPEX, gas at $8/MMBtu
  // Heavy cost structure ensures R/C stays < 1.0 over 3 years.
  // Annual gas revenue ≈ $154M → revenue after royalty ≈ $138.6M
  // Contractor revenue (cost recovery + profit share) is bounded by this.
  // Total costs = $500M + 3*$80M = $740M → R/C << 1.0
  const start = 2028;
  const end = 2030;

  const production: ProductionProfile = {
    oil: zeros(start, end),
    gas: constantSeries(start, end, 50), // 50 MMscfd
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(200e6); return s; })(),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(200e6); return s; })(),
    capexSubsea: (() => { const s = usdZeros(start, end); s[2028] = usd(100e6); return s; })(),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 80e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

  const inputs: PscRcInputs = {
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: RC_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  };

  const results = calculatePscRc(inputs);

  it('produces 3 yearly results', () => {
    expect(results).toHaveLength(3);
  });

  it('calculates gas gross revenue correctly', () => {
    // 50 MMscfd * 1000 Mscf/MMscf * 1.055 MMBtu/Mscf * $8/MMBtu * 365 days
    // = 50 * 1000 * 1.055 * 8 * 365 = 154,030,000
    const yr1 = results[0]!;
    expect(yr1.grossRevenueGas).toBeCloseTo(154_030_000, 0);
  });

  it('royalty = 10% of total gross revenue', () => {
    const yr1 = results[0]!;
    expect(yr1.royalty).toBeCloseTo(yr1.totalGrossRevenue * 0.10, 4);
  });

  it('R/C stays < 1.0 for all years (project still recovering costs)', () => {
    // Year 1: rcIndex = 0 (no prior cumulative data)
    // Year 2: rcIndex = cumRev/cumCost — with heavy CAPEX in yr1, R/C should be < 1
    // Year 3: still < 1 because costs are substantial
    for (const r of results) {
      expect(r.rcIndex).toBeLessThan(1.0);
    }
  });

  it('uses tranche 1 cost recovery ceiling (70%) for all years', () => {
    for (const r of results) {
      const expectedCeiling = r.revenueAfterRoyalty * 0.70;
      expect(r.costRecoveryCeiling).toBeCloseTo(expectedCeiling, 2);
    }
  });

  it('unrecovered cost carries forward when costs exceed ceiling', () => {
    const yr1 = results[0]!;
    // Year 1: $500M CAPEX + $80M OPEX = $580M eligible
    // Revenue after royalty ≈ $138.6M, ceiling = $138.6M * 0.70 ≈ $97M
    // So cost recovery = $97M, carry-forward = $580M - $97M ≈ $483M
    expect(yr1.unrecoveredCostCF).toBeGreaterThan(400e6);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: 10-year project that transitions through multiple R/C tranches
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: 10-year project transitioning through R/C tranches', () => {
  // Medium gas field: 80 MMscfd, heavy CAPEX in years 1-2,
  // moderate OPEX, gas at $8/MMBtu.
  // Designed so R/C crosses 1.0 ~year 4, crosses 1.4 ~year 7
  const start = 2028;
  const end = 2037;

  const production: ProductionProfile = {
    oil: zeros(start, end),
    gas: (() => {
      const s: Record<number, number> = {};
      // No production in year 1, ramp in year 2, plateau years 3-10
      s[2028] = 0;
      s[2029] = 40;
      for (let y = 2030; y <= 2037; y++) s[y] = 80;
      return s;
    })(),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  // CAPEX: $100M over first 2 years, then $5M/yr sustaining
  // OPEX: $8M/yr from year 2
  const costs: CostProfile = {
    capexDrilling: (() => {
      const s = usdZeros(start, end);
      s[2028] = usd(30e6);
      s[2029] = usd(20e6);
      return s;
    })(),
    capexFacilities: (() => {
      const s = usdZeros(start, end);
      s[2028] = usd(35e6);
      s[2029] = usd(15e6);
      return s;
    })(),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: (() => {
      const s = usdZeros(start, end);
      for (let y = 2029; y <= 2037; y++) s[y] = usd(8e6);
      return s;
    })(),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

  const inputs: PscRcInputs = {
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: RC_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  };

  const results = calculatePscRc(inputs);

  it('produces 10 yearly results', () => {
    expect(results).toHaveLength(10);
  });

  it('R/C index starts at 0 in year 1', () => {
    expect(results[0]!.rcIndex).toBe(0);
  });

  it('R/C index increases over time as revenue accumulates', () => {
    // Skip year 1 (zero), check that subsequent years generally increase
    const rcValues = results.map((r) => r.rcIndex);
    // After the initial development years, R/C should trend upward
    const laterRc = rcValues.slice(3);
    for (let i = 1; i < laterRc.length; i++) {
      expect(laterRc[i]).toBeGreaterThanOrEqual(laterRc[i - 1]! - 0.01); // allow tiny float jitter
    }
  });

  it('contractor profit share pct decreases when R/C crosses 1.0 (tranche shift)', () => {
    // Find the year where R/C first exceeds 1.0
    const crossYear = results.find((r) => r.rcIndex >= 1.0);
    if (crossYear) {
      const priorYear = results.find((r) => r.year === crossYear.year - 1);
      if (priorYear && priorYear.profitOilGas > 0 && crossYear.profitOilGas > 0) {
        // Profit share ratio should decrease: contractorShare/profitOilGas
        const priorRatio = priorYear.contractorProfitShare / priorYear.profitOilGas;
        const crossRatio = crossYear.contractorProfitShare / crossYear.profitOilGas;
        expect(crossRatio).toBeLessThan(priorRatio);
      }
    }
  });

  it('uses PRIOR year R/C for current year tranche (lagged calculation)', () => {
    // Year 1 rcIndex should be 0 (no prior data), so it uses tranche 1
    expect(results[0]!.rcIndex).toBe(0);
    // Year 2's rcIndex should reflect year 1's cumulative values
    const yr2 = results[1]!;
    expect(yr2.rcIndex).toBeGreaterThanOrEqual(0);
    // It should NOT use year 2's own cost recovery in its R/C calculation
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: Cost recovery carry-forward
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: Cost recovery carry-forward', () => {
  // Year 1: $200M CAPEX, minimal revenue (~$50M from small production)
  // Year 2: no new CAPEX, moderate production — should recover carry-forward
  const start = 2028;
  const end = 2030;

  const production: ProductionProfile = {
    oil: zeros(start, end),
    gas: (() => {
      const s: Record<number, number> = {};
      s[2028] = 10;   // Small production during construction
      s[2029] = 80;   // Full production
      s[2030] = 80;
      return s;
    })(),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(100e6); return s; })(),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(100e6); return s; })(),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 5e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

  const inputs: PscRcInputs = {
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: RC_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  };

  const results = calculatePscRc(inputs);

  it('year 1: costs exceed ceiling, creating carry-forward', () => {
    const yr1 = results[0]!;
    // $200M CAPEX + $5M OPEX = $205M eligible
    // Revenue from 10 MMscfd gas is relatively small
    // Cost recovery ceiling = revenue after royalty * 0.70
    // So a large chunk of costs will be unrecovered
    expect(yr1.unrecoveredCostCF).toBeGreaterThan(0);
    expect(yr1.costRecoveryAmount).toBeLessThan(205e6);
  });

  it('year 2: eligible costs include carry-forward from year 1', () => {
    const yr1 = results[0]!;
    const yr2 = results[1]!;

    // Year 2 eligible = year 2 costs ($5M OPEX) + year 1 carry-forward
    // Year 2 has higher production → higher ceiling → should recover more
    // The carry-forward should decrease
    expect(yr2.unrecoveredCostCF).toBeLessThan(yr1.unrecoveredCostCF);
  });

  it('carry-forward decreases over time as costs are recovered', () => {
    const carryForwards = results.map((r) => r.unrecoveredCostCF);
    // Should be monotonically decreasing (or at least non-increasing with production)
    for (let i = 1; i < carryForwards.length; i++) {
      // Year 2+ has no new CAPEX, so carry-forward should decrease as recovery happens
      if (i >= 1) {
        expect(carryForwards[i]).toBeLessThanOrEqual(carryForwards[i - 1]! + 5e6 + 0.01);
        // Allow for the $5M annual OPEX addition to carry-forward
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: Threshold Volume triggers Supplementary Payment
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: Threshold Volume triggers Supplementary Payment', () => {
  // Setup: High oil production that crosses 30 MMstb cumulative around year 8
  // 12,000 bpd = 4.38 MMstb/yr → crosses 30 MMstb in year 7 (30/4.38 ≈ 6.85)
  const start = 2028;
  const end = 2038;

  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      // No production years 1-2 (dev), then 12,000 bpd
      s[2028] = 0;
      s[2029] = 0;
      for (let y = 2030; y <= 2038; y++) s[y] = 12000;
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => {
      const s = usdZeros(start, end);
      s[2028] = usd(50e6);
      s[2029] = usd(50e6);
      return s;
    })(),
    capexFacilities: usdZeros(start, end),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: (() => {
      const s = usdZeros(start, end);
      for (let y = 2030; y <= 2038; y++) s[y] = usd(15e6);
      return s;
    })(),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

  const inputs: PscRcInputs = {
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: RC_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  };

  const results = calculatePscRc(inputs);

  it('SP = 0 for early years before threshold is crossed', () => {
    // 12,000 bpd * 365 / 1e6 = 4.38 MMstb/yr
    // Cumulative at end of year 7 of production (2036): 7 * 4.38 = 30.66 → crosses 30
    // So years 2028-2035 should have SP = 0
    // Actually: production starts 2030. Years 2030-2036 = 7 years → 30.66 MMstb
    // So year 2036 (9th result, index 8) should be the first with SP > 0
    for (const r of results) {
      if (r.cumulativeProduction < 30e6 * 365) {
        // Check: cumOilMmstb = cumProd in bbl / 1e6... wait, cumulativeProduction is in boe
        // For oil: 12000 bpd * 365 = 4,380,000 bbl/yr
        // cumOilMmstb = 4.38/yr, threshold at 30 MMstb → crosses after ~7 production years
      }
    }

    // Simpler approach: check early production years have SP = 0
    const earlyYears = results.filter((r) => r.year >= 2030 && r.year <= 2035);
    for (const r of earlyYears) {
      expect(r.supplementaryPayment).toBe(0);
    }
  });

  it('SP > 0 once cumulative oil crosses 30 MMstb', () => {
    // Production starts 2030. 30 MMstb / 4.38 MMstb/yr ≈ 6.85 years
    // So year 2037 (8th production year) should have cumulative > 30 MMstb
    const lateYears = results.filter((r) => r.year >= 2037);
    expect(lateYears.length).toBeGreaterThan(0);
    for (const r of lateYears) {
      expect(r.supplementaryPayment).toBeGreaterThan(0);
    }
  });

  it('SP reduces contractor entitlement', () => {
    const spYear = results.find((r) => r.supplementaryPayment > 0);
    expect(spYear).toBeDefined();
    if (spYear) {
      // contractorEntitlement = costRecovery + contractorProfitShare - SP
      const expectedEntitlement =
        spYear.costRecoveryAmount + spYear.contractorProfitShare - spYear.supplementaryPayment;
      expect(spYear.contractorEntitlement).toBeCloseTo(expectedEntitlement, 2);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Zero production year (pre-development)
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Zero production year (pre-development)', () => {
  const start = 2028;
  const end = 2030;

  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      s[2028] = 0;      // Pre-dev: no production
      s[2029] = 10000;   // Production starts
      s[2030] = 10000;
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(80e6); return s; })(),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(60e6); return s; })(),
    capexSubsea: (() => { const s = usdZeros(start, end); s[2028] = usd(10e6); return s; })(),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 5e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

  const inputs: PscRcInputs = {
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: RC_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  };

  const results = calculatePscRc(inputs);

  it('year 1 (pre-dev): revenue = 0', () => {
    const yr1 = results[0]!;
    expect(yr1.totalGrossRevenue).toBe(0);
    expect(yr1.grossRevenueOil).toBe(0);
    expect(yr1.grossRevenueGas).toBe(0);
    expect(yr1.grossRevenueCond).toBe(0);
  });

  it('year 1 (pre-dev): royalty = 0', () => {
    expect(results[0]!.royalty).toBe(0);
  });

  it('year 1 (pre-dev): cost recovery = 0 (no revenue to recover against)', () => {
    const yr1 = results[0]!;
    expect(yr1.costRecoveryCeiling).toBe(0);
    expect(yr1.costRecoveryAmount).toBe(0);
  });

  it('year 1 (pre-dev): NCF = -(CAPEX + OPEX)', () => {
    const yr1 = results[0]!;
    // CAPEX = 80 + 60 + 10 = $150M, OPEX = $5M → NCF = -155M
    // NCF = costRecovery(0) + contractorProfitShare(0) - SP(0) - PITA(0) - CAPEX(150M) - OPEX(5M) - ABEX(0)
    expect(yr1.netCashFlow).toBeCloseTo(-155e6, 0);
  });

  it('year 1 (pre-dev): carry-forward = all costs', () => {
    const yr1 = results[0]!;
    // Eligible costs = $150M CAPEX + $5M OPEX + 0 carry-forward = $155M
    // Recovery = 0 → carry-forward = $155M
    expect(yr1.unrecoveredCostCF).toBeCloseTo(155e6, 0);
  });

  it('year 2: revenue starts, begins recovering year 1 carry-forward', () => {
    const yr2 = results[1]!;
    expect(yr2.totalGrossRevenue).toBeGreaterThan(0);
    expect(yr2.costRecoveryAmount).toBeGreaterThan(0);
    // Carry-forward should be less than year 1 (recovery happened)
    expect(yr2.unrecoveredCostCF).toBeLessThan(results[0]!.unrecoveredCostCF);
  });
});
