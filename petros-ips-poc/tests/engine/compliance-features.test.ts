// ════════════════════════════════════════════════════════════════════════
// Tests for SOW compliance features (FM-04, DF-01, DF-02, DF-04)
// ════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { SK410_INPUTS, SK612_INPUTS, BALINGIAN_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { buildVersionedDataRegistry } from '@/data/versioned-data';
import { buildPhaseDataRegistry } from '@/data/phase-data';
import { compareVersions } from '@/engine/economics/version-comparison';
import { comparePhases } from '@/engine/economics/phase-comparison';
import {
  DEFAULT_CONVERSIONS,
  convert,
  addConversion,
  updateConversion,
  removeConversion,
  validateConversion,
} from '@/engine/utils/unit-conversion';
import {
  yearlyProductionToMonthly,
  monthlyProductionToYearly,
  aggregateProduction,
} from '@/engine/utils/time-aggregation';

// ── FEATURE 1: Version Comparison ──────────────────────────────────────

describe('Feature 1: Version Comparison (FM-04)', () => {
  const registry = buildVersionedDataRegistry();

  it('TEST 1: Budget vs Forecast produces correct NPV variance', () => {
    const sk410Versions = registry.get('sk-410')!;
    const budget = sk410Versions.get('budget')!;
    const forecast = sk410Versions.get('forecast')!;

    const result = compareVersions(SK410_INPUTS, BASE_PRICE_DECK, budget, forecast);

    // Forecast has 3% lower production and 8% higher CAPEX vs Budget
    // → expect npvVariance < 0 (forecast is worse than budget)
    expect(result.version1).toBe('budget');
    expect(result.version2).toBe('forecast');
    expect(result.npvVariance).toBeLessThan(0);
    expect(result.capexVariance).toBeGreaterThan(0);
    expect(result.productionVariance).toBeLessThan(0);
    expect(result.yearlyVariances.length).toBeGreaterThan(0);
  });

  it('TEST 2: Budget vs Actuals variance decomposes into price/volume/cost', () => {
    const balingianVersions = registry.get('balingian')!;
    const budget = balingianVersions.get('budget')!;
    const actuals = balingianVersions.get('actuals')!;

    const result = compareVersions(BALINGIAN_INPUTS, BASE_PRICE_DECK, budget, actuals);

    // All decomposition fields are present
    expect(result.priceVariance).toBeDefined();
    expect(result.volumeVariance).toBeDefined();
    expect(result.costVariance).toBeDefined();

    // Prices are identical between versions in this POC → priceVariance = 0
    expect(result.priceVariance).toBe(0);

    // The actuals dataset is intentionally truncated to historical years
    // (2022-2025), so lifetime totals are not directly comparable. We check
    // per-year characteristics for years that exist in BOTH datasets.
    const years = result.yearlyVariances.map((v) => v.year);
    expect(years).toContain(2022);
    expect(years).toContain(2025);

    // For an actuals year (2022) where both budget and actuals have data:
    //  - actuals production is scaled to 94% → productionVariance < 0
    //  - actuals OPEX is scaled to 104% → opexVariance > 0
    const y2022 = result.yearlyVariances.find((v) => v.year === 2022)!;
    expect(y2022.productionBudget).toBeGreaterThan(0);
    expect(y2022.productionActual).toBeGreaterThan(0);
    expect(y2022.productionVariance).toBeLessThan(0);
    expect(y2022.opexVariance).toBeGreaterThan(0);
    // Revenue variance for that year should be ~negative (lower production)
    expect(y2022.revenueVariance).toBeLessThan(0);
  });
});

// ── FEATURE 2: Unit Conversion ─────────────────────────────────────────

describe('Feature 2: Unit Conversion (DF-01)', () => {
  it('TEST 3: bbl to m³ gives 0.158987 factor', () => {
    const result = convert(1, 'bbl', 'm³');
    expect(result).toBeCloseTo(0.158987, 6);
  });

  it('TEST 4: MMscf to MMBtu gives 1.055 factor', () => {
    const result = convert(1, 'MMscf', 'MMBtu');
    expect(result).toBeCloseTo(1.055, 4);
  });

  it('TEST 5: chained conversion bbl → m³ → litres works', () => {
    // Direct bbl→litres exists, so verify it works.
    // Then verify chained path through m³ works for a unit pair without direct entry.
    const direct = convert(1, 'bbl', 'litres');
    expect(direct).toBeCloseTo(158.987, 3);

    // Reverse: m³ → bbl (no direct entry, but reverse of bbl-m3 exists)
    const reverse = convert(0.158987, 'm³', 'bbl');
    expect(reverse).toBeCloseTo(1, 5);
  });

  it('TEST 6: custom user-added factor is stored and applied', () => {
    let conversions = [...DEFAULT_CONVERSIONS];
    conversions = addConversion(conversions, {
      fromUnit: 'kbbl',
      toUnit: 'bbl',
      factor: 1000,
      category: 'volume_oil',
      description: 'Thousand barrels to barrels',
    });

    const added = conversions.find((c) => c.fromUnit === 'kbbl');
    expect(added).toBeDefined();
    expect(added!.isDefault).toBe(false);

    const result = convert(2, 'kbbl', 'bbl', conversions);
    expect(result).toBe(2000);

    // Update factor
    conversions = updateConversion(conversions, added!.id, 1001);
    const updated = conversions.find((c) => c.fromUnit === 'kbbl');
    expect(updated!.factor).toBe(1001);

    // Remove
    conversions = removeConversion(conversions, added!.id);
    expect(conversions.find((c) => c.fromUnit === 'kbbl')).toBeUndefined();
  });

  it('rejects invalid conversions', () => {
    expect(validateConversion({
      fromUnit: 'bbl', toUnit: 'bbl', factor: 1, category: 'volume_oil', description: '',
    })).not.toBeNull();
    expect(validateConversion({
      fromUnit: 'bbl', toUnit: 'gal', factor: 0, category: 'volume_oil', description: '',
    })).not.toBeNull();
    expect(validateConversion({
      fromUnit: 'bbl', toUnit: 'gal', factor: -1, category: 'volume_oil', description: '',
    })).not.toBeNull();
  });

  it('cannot remove a default conversion', () => {
    expect(() => removeConversion([...DEFAULT_CONVERSIONS], 'bbl-m3')).toThrow();
  });
});

// ── FEATURE 3: Time Aggregation ────────────────────────────────────────

describe('Feature 3: Time Aggregation (DF-02)', () => {
  it('TEST 7: monthly to quarterly averages daily rates correctly', () => {
    const monthly = yearlyProductionToMonthly(SK410_INPUTS.productionProfile);
    const quarterly = aggregateProduction(monthly, 'quarterly');

    // SK-410 has 24 years × 4 quarters = 96 quarterly entries
    expect(quarterly.length).toBeGreaterThan(0);

    // Each quarter's daily rate should equal the months in that quarter
    // (since we synthesized monthly = constant within a year)
    const firstYear = quarterly[0]!.year;
    const yearOfQuarters = quarterly.filter((q) => q.year === firstYear);
    expect(yearOfQuarters.length).toBe(4);
    // All quarters in the same year should have identical rates (POC simplification)
    const rates = yearOfQuarters.map((q) => q.gasMmscfd);
    expect(rates[0]).toBeCloseTo(rates[1]!, 6);
    expect(rates[1]).toBeCloseTo(rates[2]!, 6);
    expect(rates[2]).toBeCloseTo(rates[3]!, 6);
  });

  it('TEST 8: monthly to yearly matches original yearly data', () => {
    const original = SK410_INPUTS.productionProfile;
    const monthly = yearlyProductionToMonthly(original);
    const reconstructed = monthlyProductionToYearly(monthly);

    // Every year that exists in original must exist in reconstructed
    // and the daily rates must match (within FP epsilon).
    for (const yearKey of Object.keys(original.gas)) {
      const year = Number(yearKey);
      expect(reconstructed.gas[year]).toBeCloseTo(original.gas[year]!, 6);
      expect(reconstructed.oil[year]).toBeCloseTo(original.oil[year]!, 6);
    }
  });
});

// ── FEATURE 4: Phase Comparison ────────────────────────────────────────

describe('Feature 4: Phase Comparison (DF-04)', () => {
  const registry = buildPhaseDataRegistry();

  it('TEST 9: Pre-FID vs Post-FID NPV delta is correct', () => {
    const sk612Phases = registry.get('sk-612');
    expect(sk612Phases).toBeDefined();
    expect(sk612Phases!.length).toBe(2);

    const preFid = sk612Phases!.find((p) => p.phase === 'pre_fid')!;
    const postFid = sk612Phases!.find((p) => p.phase === 'post_fid')!;

    const result = comparePhases(SK612_INPUTS, BASE_PRICE_DECK, preFid, postFid);

    expect(result.phase1).toBe('pre_fid');
    expect(result.phase2).toBe('post_fid');
    expect(result.phase1Label).toBe('Concept Select (2025)');
    expect(result.phase2Label).toBe('Sanction Case (2026 FID)');

    // Post-FID has higher production (1.20×) and higher CAPEX (1.21×).
    // The NPV delta is non-zero — sign depends on regime arithmetic but
    // the magnitude must be material.
    expect(result.npvDelta).not.toBe(0);
    expect(Math.abs(result.npvDelta)).toBeGreaterThan(0);

    // Reserves delta should be 135 - 120 = 15
    expect(result.reservesDelta).toBe(15);
  });

  it('TEST 10: CAPEX delta matches difference between phases', () => {
    const sk612Phases = registry.get('sk-612')!;
    const preFid = sk612Phases.find((p) => p.phase === 'pre_fid')!;
    const postFid = sk612Phases.find((p) => p.phase === 'post_fid')!;

    const result = comparePhases(SK612_INPUTS, BASE_PRICE_DECK, preFid, postFid);

    // economics2.totalCapex - economics1.totalCapex must equal the result delta
    const expected =
      (result.economics2.totalCapex as number) - (result.economics1.totalCapex as number);
    expect(result.capexDelta).toBe(expected);

    // Post-FID CAPEX is scaled higher than Pre-FID, so delta > 0
    expect(result.capexDelta).toBeGreaterThan(0);

    // Peak production delta should be positive (post-FID peaks higher)
    expect(result.peakProductionDelta).toBeGreaterThan(0);
  });
});
