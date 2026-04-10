// ════════════════════════════════════════════════════════════════════════
// Monte Carlo Simulation Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  PriceDeck,
  MonteCarloConfig,
  MonteCarloResult,
  DistributionConfig,
  HistogramBin,
  SensitivityVariable,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { applyPriceSensitivity, applyProjectSensitivity } from '@/engine/sensitivity/apply';
import { createPRNG, hashSeed } from './prng';
import { sampleTriangular, sampleNormal, sampleLognormal } from './distributions';

const HISTOGRAM_BINS = 50;

/**
 * Sample a multiplier factor from a distribution config.
 * The factor is meant to multiply the base value (i.e., 1.0 = no change).
 */
function sampleFactor(prng: () => number, config: DistributionConfig): number {
  switch (config.type) {
    case 'triangular': {
      const p = config.params as { min: number; mode: number; max: number };
      return sampleTriangular(prng, p.min, p.mode, p.max);
    }
    case 'normal': {
      const p = config.params as { mean: number; stdDev: number };
      return sampleNormal(prng, p.mean, p.stdDev);
    }
    case 'lognormal': {
      const p = config.params as { mu: number; sigma: number };
      return sampleLognormal(prng, p.mu, p.sigma);
    }
  }
}

/**
 * Apply sampled factors to project and price deck.
 * Each factor is a multiplier (e.g., 1.10 = +10%).
 */
function applyFactors(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  factors: Record<SensitivityVariable, number>,
): { project: ProjectInputs; priceDeck: PriceDeck } {
  let modProject = project;
  let modPriceDeck = priceDeck;

  // Price factors as percentage change (factor - 1)
  const oilPct = factors.oilPrice - 1;
  const gasPct = factors.gasPrice - 1;

  if (Math.abs(oilPct) > 1e-10) {
    modPriceDeck = applyPriceSensitivity(modPriceDeck, 'oilPrice', oilPct);
  }
  if (Math.abs(gasPct) > 1e-10) {
    modPriceDeck = applyPriceSensitivity(modPriceDeck, 'gasPrice', gasPct);
  }

  const prodPct = factors.production - 1;
  const capexPct = factors.capex - 1;
  const opexPct = factors.opex - 1;

  if (Math.abs(prodPct) > 1e-10) {
    modProject = applyProjectSensitivity(modProject, 'production', prodPct);
  }
  if (Math.abs(capexPct) > 1e-10) {
    modProject = applyProjectSensitivity(modProject, 'capex', capexPct);
  }
  if (Math.abs(opexPct) > 1e-10) {
    modProject = applyProjectSensitivity(modProject, 'opex', opexPct);
  }

  return { project: modProject, priceDeck: modPriceDeck };
}

function buildHistogram(values: readonly number[], numBins: number): HistogramBin[] {
  if (values.length === 0) return [];

  const min = values[0]!;
  const max = values[values.length - 1]!;

  // Handle edge case: all values identical
  if (max === min) {
    return [{ edgeLow: min, edgeHigh: max, count: values.length }];
  }

  const binWidth = (max - min) / numBins;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const edgeLow = min + i * binWidth;
    const edgeHigh = i === numBins - 1 ? max : min + (i + 1) * binWidth;
    bins.push({ edgeLow, edgeHigh, count: 0 });
  }

  // Count values into bins
  for (const v of values) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    if (idx < 0) idx = 0;
    (bins[idx] as { count: number }).count++;
  }

  return bins;
}

export function runMonteCarlo(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  config: MonteCarloConfig,
): MonteCarloResult {
  const prng = createPRNG(hashSeed(config.seed));
  const npvValues: number[] = [];

  for (let i = 0; i < config.iterations; i++) {
    // Sample factors for each variable
    const factors: Record<SensitivityVariable, number> = {
      oilPrice: sampleFactor(prng, config.distributions.oilPrice),
      gasPrice: sampleFactor(prng, config.distributions.gasPrice),
      production: sampleFactor(prng, config.distributions.production),
      capex: sampleFactor(prng, config.distributions.capex),
      opex: sampleFactor(prng, config.distributions.opex),
    };

    const modified = applyFactors(project, priceDeck, factors);
    const result = calculateProjectEconomics(modified.project, modified.priceDeck);
    npvValues.push(result.npv10 as number);
  }

  // Sort for percentile calculation
  npvValues.sort((a, b) => a - b);

  const n = npvValues.length;
  const p10 = npvValues[Math.floor(0.10 * n)]!;
  const p50 = npvValues[Math.floor(0.50 * n)]!;
  const p90 = npvValues[Math.floor(0.90 * n)]!;

  const sum = npvValues.reduce((s, v) => s + v, 0);
  const mean = sum / n;

  const variance = npvValues.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const histogram = buildHistogram(npvValues, HISTOGRAM_BINS);

  return {
    npvValues: npvValues.map((v) => usd(v)),
    p10: usd(p10),
    p50: usd(p50),
    p90: usd(p90),
    mean: usd(mean),
    stdDev,
    histogram,
  };
}
