// ════════════════════════════════════════════════════════════════════════
// Distribution Samplers for Monte Carlo
// ════════════════════════════════════════════════════════════════════════

/**
 * Sample from a triangular distribution using inverse transform.
 * All values guaranteed within [min, max].
 *
 * Degenerate inputs are handled defensively: when `min === max` (zero
 * spread) the sampler returns `min` rather than dividing by zero, and
 * `mode` is clamped into [min, max] so a malformed config cannot
 * produce NaN that would contaminate downstream percentile math.
 */
export function sampleTriangular(
  prng: () => number,
  min: number,
  mode: number,
  max: number,
): number {
  if (!(max > min)) return min;
  const safeMode = mode < min ? min : mode > max ? max : mode;
  const u = prng();
  const fc = (safeMode - min) / (max - min);

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (safeMode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - safeMode));
  }
}

/**
 * Sample from a normal distribution using Box-Muller transform.
 */
export function sampleNormal(
  prng: () => number,
  mean: number,
  stdDev: number,
): number {
  // Box-Muller: generate two uniform randoms, produce one normal
  let u1 = prng();
  // Avoid log(0)
  while (u1 === 0) u1 = prng();
  const u2 = prng();

  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Sample from a lognormal distribution.
 * Parameters are mu and sigma of the underlying normal distribution.
 */
export function sampleLognormal(
  prng: () => number,
  mu: number,
  sigma: number,
): number {
  return Math.exp(sampleNormal(prng, mu, sigma));
}
