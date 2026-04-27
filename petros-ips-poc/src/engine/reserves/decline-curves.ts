// ════════════════════════════════════════════════════════════════════════
// Arps Decline Curve Family (D29)
// ════════════════════════════════════════════════════════════════════════
//
// Per Arps J.J. (1945), "Analysis of Decline Curves" (Trans. AIME, 160).
// The Arps b-parameter governs the decline shape:
//
//   b = 0   → exponential decline:  q(t) = q₀ × e^(−D×t)
//   0<b<1   → hyperbolic decline:   q(t) = q₀ / (1 + b×D×t)^(1/b)
//   b = 1   → harmonic decline:     q(t) = q₀ / (1 + D×t)
//
// Reservoir-driver mapping (rule of thumb):
//   - Solution-gas drive          → b ≈ 0.0   (exponential)
//   - Tight gas / shale           → b ≈ 0.4–0.6
//   - Water-drive oil             → b ≈ 0.5–0.7
//   - Mature waterflood           → b → 1.0   (harmonic)
//
// Reference: Arps 1945; SPE PRMS 2018 §7.3.
// ════════════════════════════════════════════════════════════════════════

import type { TimeSeriesData } from '@/engine/types';

export type ArpsB = number; // 0 ≤ b ≤ 1

/** Project a single year's rate forward from a peak/plateau value. */
export function arpsRate(
  q0: number,
  declineRate: number,
  t: number,
  b: ArpsB = 0,
): number {
  if (t <= 0) return q0;
  if (b === 0) return q0 * Math.exp(-declineRate * t);
  if (b === 1) return q0 / (1 + declineRate * t);
  return q0 / Math.pow(1 + b * declineRate * t, 1 / b);
}

/**
 * Build a TimeSeriesData<number> applying the full Arps family.
 *
 * Pre-plateau years: 0 production.
 * Plateau years (plateauStartYear..plateauEndYear): plateauRate.
 * Post-plateau: Arps decline with the supplied b parameter.
 */
export function arpsDeclineCurve(
  startYear: number,
  endYear: number,
  plateauStartYear: number,
  plateauEndYear: number,
  plateauRate: number,
  declineRate: number,
  b: ArpsB = 0,
): TimeSeriesData<number> {
  const s: Record<number, number> = {};
  for (let y = startYear; y <= endYear; y++) {
    if (y < plateauStartYear) {
      s[y] = 0;
    } else if (y <= plateauEndYear) {
      s[y] = Math.round(plateauRate * 100) / 100;
    } else {
      const t = y - plateauEndYear;
      s[y] = Math.round(arpsRate(plateauRate, declineRate, t, b) * 100) / 100;
    }
  }
  return s;
}
