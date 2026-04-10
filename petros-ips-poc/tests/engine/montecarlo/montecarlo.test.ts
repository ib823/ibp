import { describe, it, expect } from 'vitest';
import { createPRNG } from '@/engine/montecarlo/prng';
import { sampleTriangular, sampleNormal } from '@/engine/montecarlo/distributions';
import { runMonteCarlo } from '@/engine/montecarlo/simulation';
import { SK410_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import type { MonteCarloConfig } from '@/engine/types';

// ── Shared MC config ──────────────────────────────────────────────────

const MC_CONFIG: MonteCarloConfig = {
  iterations: 500,
  seed: '42',
  distributions: {
    oilPrice: { type: 'triangular', params: { min: 0.80, mode: 1.00, max: 1.25 } },
    gasPrice: { type: 'triangular', params: { min: 0.80, mode: 1.00, max: 1.25 } },
    production: { type: 'lognormal', params: { mu: 0.0, sigma: 0.10 } },
    capex: { type: 'normal', params: { mean: 1.00, stdDev: 0.10 } },
    opex: { type: 'normal', params: { mean: 1.00, stdDev: 0.08 } },
  },
};

// ════════════════════════════════════════════════════════════════════════
// TEST 1: PRNG with same seed produces identical sequence
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: PRNG reproducibility with same seed', () => {
  it('two PRNGs with seed=42 produce identical 100-number sequences', () => {
    const prng1 = createPRNG(42);
    const prng2 = createPRNG(42);

    const seq1 = Array.from({ length: 100 }, () => prng1());
    const seq2 = Array.from({ length: 100 }, () => prng2());

    expect(seq1).toEqual(seq2);
  });

  it('all values are in [0, 1)', () => {
    const prng = createPRNG(42);
    for (let i = 0; i < 1000; i++) {
      const v = prng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: PRNG with different seeds produces different sequence
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: PRNG different seeds diverge', () => {
  it('seed=42 vs seed=43 produce different first 10 numbers', () => {
    const prng1 = createPRNG(42);
    const prng2 = createPRNG(43);

    const seq1 = Array.from({ length: 10 }, () => prng1());
    const seq2 = Array.from({ length: 10 }, () => prng2());

    // At least one value should differ
    const anyDiff = seq1.some((v, i) => v !== seq2[i]);
    expect(anyDiff).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: Triangular distribution respects min/max bounds
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: Triangular distribution bounds and mean', () => {
  const prng = createPRNG(123);
  const N = 10000;
  const samples = Array.from({ length: N }, () => sampleTriangular(prng, 40, 65, 90));

  it('all values >= min (40)', () => {
    expect(samples.every((v) => v >= 40)).toBe(true);
  });

  it('all values <= max (90)', () => {
    expect(samples.every((v) => v <= 90)).toBe(true);
  });

  it('mean ≈ (min+mode+max)/3 = 65 (within 5%)', () => {
    const mean = samples.reduce((s, v) => s + v, 0) / N;
    const expectedMean = (40 + 65 + 90) / 3; // 65
    expect(mean).toBeCloseTo(expectedMean, -1); // within ~5
    expect(Math.abs(mean - expectedMean) / expectedMean).toBeLessThan(0.05);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: Normal distribution has correct mean and stddev
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: Normal distribution statistics', () => {
  const prng = createPRNG(456);
  const N = 10000;
  const samples = Array.from({ length: N }, () => sampleNormal(prng, 500, 75));

  it('sample mean within 5% of 500', () => {
    const mean = samples.reduce((s, v) => s + v, 0) / N;
    expect(Math.abs(mean - 500) / 500).toBeLessThan(0.05);
  });

  it('sample stdDev within 10% of 75', () => {
    const mean = samples.reduce((s, v) => s + v, 0) / N;
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / N;
    const stdDev = Math.sqrt(variance);
    expect(Math.abs(stdDev - 75) / 75).toBeLessThan(0.10);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Monte Carlo with seed=42 is reproducible
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Monte Carlo reproducibility', () => {
  it('two runs with seed="42" produce identical p50', () => {
    const result1 = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, MC_CONFIG);
    const result2 = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, MC_CONFIG);

    // Bit-for-bit identical
    expect(result1.p50).toBe(result2.p50);
    expect(result1.p10).toBe(result2.p10);
    expect(result1.p90).toBe(result2.p90);
    expect(result1.mean).toBe(result2.mean);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Monte Carlo P10 < P50 < P90
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Monte Carlo percentile ordering', () => {
  const result = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, MC_CONFIG);

  it('P10 < P50 < P90', () => {
    expect(result.p10 as number).toBeLessThan(result.p50 as number);
    expect(result.p50 as number).toBeLessThan(result.p90 as number);
  });

  it('mean is between P10 and P90', () => {
    expect(result.mean as number).toBeGreaterThan(result.p10 as number);
    expect(result.mean as number).toBeLessThan(result.p90 as number);
  });

  it('stdDev is positive', () => {
    expect(result.stdDev).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 7: Monte Carlo histogram bins sum to total iterations
// ════════════════════════════════════════════════════════════════════════

describe('TEST 7: Monte Carlo histogram', () => {
  const result = runMonteCarlo(SK410_INPUTS, BASE_PRICE_DECK, MC_CONFIG);

  it('histogram bin counts sum to iterations', () => {
    const totalCount = result.histogram.reduce((s, bin) => s + bin.count, 0);
    expect(totalCount).toBe(MC_CONFIG.iterations);
  });

  it('histogram has bins', () => {
    expect(result.histogram.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeLessThanOrEqual(50);
  });

  it('bin edges are monotonically increasing', () => {
    for (let i = 1; i < result.histogram.length; i++) {
      expect(result.histogram[i]!.edgeLow).toBeGreaterThanOrEqual(result.histogram[i - 1]!.edgeLow);
    }
  });

  it('npvValues array has correct length', () => {
    expect(result.npvValues).toHaveLength(MC_CONFIG.iterations);
  });
});
