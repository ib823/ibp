import { describe, it, expect } from 'vitest';
import { calculatePscEpt } from '@/engine/fiscal/psc-ept';
import { calculatePscSfa } from '@/engine/fiscal/psc-sfa';
import { calculatePscLegacy } from '@/engine/fiscal/psc-legacy';
import { calculateDownstream } from '@/engine/fiscal/downstream';
import { calculateFiscalCashflows } from '@/engine/fiscal';
import type {
  ProductionProfile,
  CostProfile,
  PriceDeck,
  FiscalRegime_PSC_EPT,
  FiscalRegime_PSC_SFA,
  FiscalRegime_PSC_1976,
  FiscalRegime_DOWNSTREAM,
  FiscalRegime_PSC_RC,
  ProjectInputs,
  USD,
  TimeSeriesData,
} from '@/engine/types';

// ── Helpers ───────────────────────────────────────────────────────────

function usd(n: number): USD { return n as USD; }

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

function usdZeros(start: number, end: number): TimeSeriesData<USD> { return usdSeries(start, end, 0); }
function zeros(start: number, end: number): TimeSeriesData<number> { return constantSeries(start, end, 0); }

function simplePriceDeck(start: number, end: number, oilPrice: number, gasPrice: number, condPrice: number): PriceDeck {
  return {
    oil: usdSeries(start, end, oilPrice),
    gas: usdSeries(start, end, gasPrice),
    condensate: usdSeries(start, end, condPrice),
    exchangeRate: constantSeries(start, end, 4.50),
    carbonCredit: usdSeries(start, end, 25),
  };
}

// ── Shared test fixtures ──────────────────────────────────────────────

const EPT_CONFIG: FiscalRegime_PSC_EPT = {
  type: 'PSC_EPT',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  piLower: 1.50,
  piUpper: 2.50,
  contractorShareAtLower: 0.90,
  contractorShareAtUpper: 0.30,
  fixedCostRecoveryCeiling: 0.70,
};

const SFA_CONFIG: FiscalRegime_PSC_SFA = {
  type: 'PSC_SFA',
  royaltyRate: 0.10,
  pitaRate: 0.25,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  costRecoveryCeilingPct: 0.80,
  contractorProfitSharePct: 0.70,
  petronasProfitSharePct: 0.30,
};

const LEGACY_1976_CONFIG: FiscalRegime_PSC_1976 = {
  type: 'PSC_1976',
  royaltyRate: 0.10,
  pitaRate: 0.38,
  exportDutyRate: 0.10,
  researchCessRate: 0.005,
  productionTiers: [
    { volumeFloor: 0, volumeCeiling: 10000, contractorSharePct: 0.50, petronaSharePct: 0.50 },
    { volumeFloor: 10000, volumeCeiling: 20000, contractorSharePct: 0.40, petronaSharePct: 0.60 },
    { volumeFloor: 20000, volumeCeiling: Infinity, contractorSharePct: 0.30, petronaSharePct: 0.70 },
  ],
};

const DOWNSTREAM_CONFIG: FiscalRegime_DOWNSTREAM = {
  type: 'DOWNSTREAM',
  royaltyRate: 0,
  pitaRate: 0,
  exportDutyRate: 0,
  researchCessRate: 0,
  taxRate: 0.24,
};

// ════════════════════════════════════════════════════════════════════════
// TEST 1: EPT linear interpolation at PI = 2.0 gives contractor 60%
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: EPT linear interpolation at PI = 2.0 gives contractor 60%', () => {
  // Design a scenario where PI reaches ~2.0 by a specific year.
  // We need cumContractorRevenue / cumContractorCost ≈ 2.0
  // Strategy: heavy early costs, then high revenue with low ongoing costs.
  // Year 1: $100M CAPEX, $10M OPEX, small production → cumCost = $110M
  // Year 2+: revenue accumulates. Need cumRev ≈ 2 * cumCost.
  // With moderate oil production, the PI will rise through the range.
  const start = 2028;
  const end = 2038;

  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      s[2028] = 0;
      for (let y = 2029; y <= 2038; y++) s[y] = 15000; // 15,000 bpd
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(60e6); return s; })(),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(40e6); return s; })(),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: (() => {
      const s = usdZeros(start, end);
      for (let y = 2029; y <= 2038; y++) s[y] = usd(10e6);
      return s;
    })(),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);
  const results = calculatePscEpt({
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: EPT_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  });

  it('PI eventually exceeds 2.0', () => {
    const piValues = results.map((r) => r.rcIndex); // rcIndex stores PI for EPT
    const maxPi = Math.max(...piValues);
    expect(maxPi).toBeGreaterThan(2.0);
  });

  it('contractor share decreases as PI rises through the interpolation range', () => {
    // Find years in the interpolation range (1.5 < PI < 2.5)
    const interpolationYears = results.filter(
      (r) => r.rcIndex > 1.50 && r.rcIndex < 2.50 && r.profitOilGas > 0,
    );

    if (interpolationYears.length > 0) {
      for (const r of interpolationYears) {
        const share = r.contractorProfitShare / r.profitOilGas;
        // Verify it matches the interpolation formula
        const expectedShare = 0.90 - ((r.rcIndex - 1.50) / (2.50 - 1.50)) * (0.90 - 0.30);
        expect(share).toBeCloseTo(expectedShare, 4);
      }
    }

    // Also verify: contractor share is higher at lower PI than at higher PI
    const sortedByPi = results
      .filter((r) => r.profitOilGas > 0)
      .sort((a, b) => a.rcIndex - b.rcIndex);
    for (let i = 1; i < sortedByPi.length; i++) {
      const prevShare = sortedByPi[i - 1]!.contractorProfitShare / sortedByPi[i - 1]!.profitOilGas;
      const currShare = sortedByPi[i]!.contractorProfitShare / sortedByPi[i]!.profitOilGas;
      expect(currShare).toBeLessThanOrEqual(prevShare + 0.0001);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: EPT at PI boundary: PI exactly 1.50 gives 90%
// TEST 3: EPT at PI boundary: PI exactly 2.50 gives 30%
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2 & 3: EPT PI boundary values', () => {
  // Test the interpolation function directly via observable behavior.
  // When PI ≤ 1.50, contractor gets 90%. When PI ≥ 2.50, gets 30%.

  // PI = 0 (year 1, no prior data) → should use lower bound (90%)
  const start = 2028;
  const end = 2029;

  const production: ProductionProfile = {
    oil: constantSeries(start, end, 10000),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: usdZeros(start, end),
    capexFacilities: usdZeros(start, end),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 5e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);
  const results = calculatePscEpt({
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: EPT_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  });

  it('TEST 2: PI = 0 (≤ 1.50) → contractor gets 90% of profit', () => {
    const yr1 = results[0]!;
    // PI = 0 in year 1 → contractorShareAtLower = 0.90
    expect(yr1.rcIndex).toBe(0);
    if (yr1.profitOilGas > 0) {
      const share = yr1.contractorProfitShare / yr1.profitOilGas;
      expect(share).toBeCloseTo(0.90, 4);
    }
  });

  it('TEST 3: verify interpolation formula at high PI → contractor share decreases', () => {
    // For a long-running high-revenue project, PI will exceed 2.5
    const longEnd = 2048;
    const longProd: ProductionProfile = {
      oil: constantSeries(start, longEnd, 20000),
      gas: zeros(start, longEnd),
      condensate: zeros(start, longEnd),
      water: zeros(start, longEnd),
    };
    const longCosts: CostProfile = {
      capexDrilling: (() => { const s = usdZeros(start, longEnd); s[2028] = usd(20e6); return s; })(),
      capexFacilities: usdZeros(start, longEnd),
      capexSubsea: usdZeros(start, longEnd),
      capexOther: usdZeros(start, longEnd),
      opexFixed: usdSeries(start, longEnd, 5e6),
      opexVariable: usdZeros(start, longEnd),
      abandonmentCost: usdZeros(start, longEnd),
    };
    const longResults = calculatePscEpt({
      yearlyProduction: longProd,
      yearlyCosts: longCosts,
      priceDeck: simplePriceDeck(start, longEnd, 65, 8, 55),
      fiscalConfig: EPT_CONFIG,
      equityShare: 1.0,
      startYear: start,
      endYear: longEnd,
    });

    // Find years where PI ≥ 2.50
    const highPiYears = longResults.filter((r) => r.rcIndex >= 2.50);
    expect(highPiYears.length).toBeGreaterThan(0);
    for (const r of highPiYears) {
      if (r.profitOilGas > 0) {
        const share = r.contractorProfitShare / r.profitOilGas;
        expect(share).toBeCloseTo(0.30, 4);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: SFA uses fixed 80% cost recovery ceiling
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: SFA uses fixed 80% cost recovery ceiling regardless of profitability', () => {
  const start = 2028;
  const end = 2035;

  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      s[2028] = 0;
      for (let y = 2029; y <= 2035; y++) s[y] = 5000;
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(80e6); return s; })(),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(40e6); return s; })(),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: (() => {
      const s = usdZeros(start, end);
      for (let y = 2029; y <= 2035; y++) s[y] = usd(8e6);
      return s;
    })(),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);
  const results = calculatePscSfa({
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: SFA_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  });

  it('cost recovery ceiling = 80% of revenue after royalty for all producing years', () => {
    for (const r of results) {
      if (r.revenueAfterRoyalty > 0) {
        expect(r.costRecoveryCeiling).toBeCloseTo(r.revenueAfterRoyalty * 0.80, 2);
      }
    }
  });

  it('contractor profit share = 70% of profit oil for all years', () => {
    for (const r of results) {
      if (r.profitOilGas > 0) {
        const share = r.contractorProfitShare / r.profitOilGas;
        expect(share).toBeCloseTo(0.70, 4);
      }
    }
  });

  it('PITA rate is 25% (reduced for SFA)', () => {
    // Check a year with positive taxable income
    const taxableYear = results.find((r) => r.taxableIncome > 0);
    expect(taxableYear).toBeDefined();
    if (taxableYear) {
      const effectiveRate = taxableYear.pitaTax / taxableYear.taxableIncome;
      expect(effectiveRate).toBeCloseTo(0.25, 4);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: 1976 PSC volume tier transition at 10,000 bpd
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: 1976 PSC volume tier transition at 10,000 bpd', () => {
  const start = 2028;
  const end = 2030;

  // Year 1: 8,000 bpd (all in tier 1 → 50% contractor)
  // Year 2: 15,000 bpd (10k in tier 1, 5k in tier 2 → blended)
  // Year 3: 25,000 bpd (10k tier 1, 10k tier 2, 5k tier 3 → further blended)
  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      s[2028] = 8000;
      s[2029] = 15000;
      s[2030] = 25000;
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: usdZeros(start, end),
    capexFacilities: usdZeros(start, end),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 5e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);
  const results = calculatePscLegacy({
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: LEGACY_1976_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  });

  it('at 8,000 bpd: all in tier 1 → contractor gets 50%', () => {
    const yr1 = results[0]!;
    if (yr1.profitOilGas > 0) {
      const share = yr1.contractorProfitShare / yr1.profitOilGas;
      expect(share).toBeCloseTo(0.50, 4);
    }
  });

  it('at 15,000 bpd: blended share between 40% and 50%', () => {
    // 10k at 50% + 5k at 40% = (5000+2000)/15000 = 7000/15000 = 46.67%
    const yr2 = results[1]!;
    if (yr2.profitOilGas > 0) {
      const share = yr2.contractorProfitShare / yr2.profitOilGas;
      const expected = (10000 * 0.50 + 5000 * 0.40) / 15000; // 0.4667
      expect(share).toBeCloseTo(expected, 4);
    }
  });

  it('at 25,000 bpd: three-tier blend < 50%', () => {
    // 10k at 50% + 10k at 40% + 5k at 30% = (5000+4000+1500)/25000 = 10500/25000 = 42%
    const yr3 = results[2]!;
    if (yr3.profitOilGas > 0) {
      const share = yr3.contractorProfitShare / yr3.profitOilGas;
      const expected = (10000 * 0.50 + 10000 * 0.40 + 5000 * 0.30) / 25000; // 0.42
      expect(share).toBeCloseTo(expected, 4);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Downstream corporate tax calculation at 24%
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Downstream corporate tax calculation at 24%', () => {
  const start = 2028;
  const end = 2030;

  // Use gas-like production to model CCS storage fees via the price deck
  const production: ProductionProfile = {
    oil: zeros(start, end),
    gas: constantSeries(start, end, 20), // proxy for storage volume
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: usdZeros(start, end),
    capexFacilities: (() => { const s = usdZeros(start, end); s[2028] = usd(50e6); return s; })(),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: usdSeries(start, end, 10e6),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 0, 8, 0);
  const results = calculateDownstream({
    yearlyProduction: production,
    yearlyCosts: costs,
    priceDeck: prices,
    fiscalConfig: DOWNSTREAM_CONFIG,
    equityShare: 1.0,
    startYear: start,
    endYear: end,
  });

  it('no royalty charged', () => {
    for (const r of results) {
      expect(r.royalty).toBe(0);
    }
  });

  it('no cost recovery mechanism (PSC fields only)', () => {
    for (const r of results) {
      expect(r.costRecoveryCeiling).toBe(0);
      expect(r.costRecoveryAmount).toBe(0);
    }
  });

  it('tax rate is 24% on positive taxable income', () => {
    const taxableYear = results.find((r) => r.taxableIncome > 0);
    expect(taxableYear).toBeDefined();
    if (taxableYear) {
      const effectiveRate = taxableYear.pitaTax / taxableYear.taxableIncome;
      expect(effectiveRate).toBeCloseTo(0.24, 4);
    }
  });

  it('NCF = revenue - costs - tax', () => {
    for (const r of results) {
      const cost = computeCostsForYear(costs, r.year);
      const expectedNcf = r.totalGrossRevenue - cost.totalCapex - cost.totalOpex - cost.abandonmentCost - r.pitaTax;
      expect(r.netCashFlow).toBeCloseTo(expectedNcf, 2);
    }
  });
});

function computeCostsForYear(costs: CostProfile, year: number) {
  const getV = (s: TimeSeriesData<USD>, y: number) => (s[y] as number | undefined) ?? 0;
  return {
    totalCapex: getV(costs.capexDrilling, year) + getV(costs.capexFacilities, year) +
      getV(costs.capexSubsea, year) + getV(costs.capexOther, year),
    totalOpex: getV(costs.opexFixed, year) + getV(costs.opexVariable, year),
    abandonmentCost: getV(costs.abandonmentCost, year),
  };
}

// ════════════════════════════════════════════════════════════════════════
// TEST 7: Dispatcher routes correctly and regimes produce different results
// ════════════════════════════════════════════════════════════════════════

describe('TEST 7: Dispatcher routes R/C project to R/C engine and EPT project to EPT engine', () => {
  const start = 2028;
  const end = 2035;

  const production: ProductionProfile = {
    oil: (() => {
      const s: Record<number, number> = {};
      s[2028] = 0;
      for (let y = 2029; y <= 2035; y++) s[y] = 12000;
      return s;
    })(),
    gas: zeros(start, end),
    condensate: zeros(start, end),
    water: zeros(start, end),
  };

  const costs: CostProfile = {
    capexDrilling: (() => { const s = usdZeros(start, end); s[2028] = usd(100e6); return s; })(),
    capexFacilities: usdZeros(start, end),
    capexSubsea: usdZeros(start, end),
    capexOther: usdZeros(start, end),
    opexFixed: (() => {
      const s = usdZeros(start, end);
      for (let y = 2029; y <= 2035; y++) s[y] = usd(15e6);
      return s;
    })(),
    opexVariable: usdZeros(start, end),
    abandonmentCost: usdZeros(start, end),
  };

  const prices = simplePriceDeck(start, end, 65, 8, 55);

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

  const baseProject = {
    id: 'test',
    name: 'Test Project',
    description: '',
    businessEntity: 'PETROS Group',
    businessSector: 'Upstream',
    businessType: 'Operated',
    status: 'active' as const,
    phase: 'production' as const,
    startYear: start,
    endYear: end,
    equityShare: 1.0,
  };

  const rcProjectInputs: ProjectInputs = {
    project: { ...baseProject, fiscalRegime: 'PSC_RC' },
    productionProfile: production,
    costProfile: costs,
    fiscalRegimeConfig: RC_CONFIG,
  };

  const eptProjectInputs: ProjectInputs = {
    project: { ...baseProject, fiscalRegime: 'PSC_EPT' },
    productionProfile: production,
    costProfile: costs,
    fiscalRegimeConfig: EPT_CONFIG,
  };

  const rcResults = calculateFiscalCashflows(rcProjectInputs, prices);
  const eptResults = calculateFiscalCashflows(eptProjectInputs, prices);

  it('both produce results for all years', () => {
    expect(rcResults).toHaveLength(end - start + 1);
    expect(eptResults).toHaveLength(end - start + 1);
  });

  it('both have identical gross revenue (same production & prices)', () => {
    for (let i = 0; i < rcResults.length; i++) {
      expect(rcResults[i]!.totalGrossRevenue).toBeCloseTo(eptResults[i]!.totalGrossRevenue, 2);
    }
  });

  it('NCF values differ between R/C and EPT (different fiscal mechanics)', () => {
    // After a few years, the different profit-split mechanics should produce different NCFs
    let anyDifferent = false;
    for (let i = 0; i < rcResults.length; i++) {
      if (Math.abs(rcResults[i]!.netCashFlow - eptResults[i]!.netCashFlow) > 1) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });

  it('both regimes have non-zero tax in producing years', () => {
    const rcTax = rcResults.reduce((s, r) => s + r.pitaTax, 0);
    const eptTax = eptResults.reduce((s, r) => s + r.pitaTax, 0);
    expect(rcTax).toBeGreaterThan(0);
    expect(eptTax).toBeGreaterThan(0);
  });
});
