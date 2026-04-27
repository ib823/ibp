// ════════════════════════════════════════════════════════════════════════
// Net Present Value Calculation
// ════════════════════════════════════════════════════════════════════════

/** Discounting convention.
 *  - 'end-of-year' (default, backward-compatible): year 0 undiscounted, year t = 1/(1+r)^t
 *  - 'mid-year' (SPE upstream norm): year t = 1/(1+r)^(t+0.5) — better for projects
 *    with roughly continuous cashflow within each year. Reduces NPV for projects
 *    with multi-year negative pre-production by ~5%.
 *  See ASSESSMENT.md F9 / F16 / D23. */
export type DiscountConvention = 'end-of-year' | 'mid-year';

/**
 * Standard DCF: NPV = Σ cashflow[t] / (1 + r)^t
 *
 * Default end-of-year: year 0 (index 0) is not discounted (factor = 1).
 * Optional mid-year (SPE upstream standard): exponent = t + 0.5.
 */
export function calculateNPV(
  cashflows: readonly number[],
  discountRate: number,
  convention: DiscountConvention = 'end-of-year',
): number {
  if (cashflows.length === 0) return 0;

  let npv = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const offset = convention === 'mid-year' ? t + 0.5 : t;
    npv += cashflows[t]! / Math.pow(1 + discountRate, offset);
  }
  return npv;
}
