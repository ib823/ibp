// ════════════════════════════════════════════════════════════════════════
// Distribution Samplers for Monte Carlo
// ════════════════════════════════════════════════════════════════════════

/**
 * Sample from a triangular distribution using inverse transform.
 * All values guaranteed within [min, max].
 */
export function sampleTriangular(
  prng: () => number,
  min: number,
  mode: number,
  max: number,
): number {
  const u = prng();
  const fc = (mode - min) / (max - min);

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
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
