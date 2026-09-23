// ════════════════════════════════════════════════════════════════════════
// Net Present Value Calculation
// ════════════════════════════════════════════════════════════════════════

/** Discounting convention. Both value the cash flows at the same date —
 *  the end of the first project year (index 0) — so they are comparable.
 *  - 'end-of-year' (default): each year's cash flow arrives at year end;
 *    year t factor = 1/(1+r)^t, year 0 undiscounted.
 *  - 'mid-year' (SPE upstream norm): cash flow arrives evenly through the
 *    year, i.e. at mid-year; factor = 1/(1+r)^(t−0.5). Every year is
 *    brought half a year closer, so NPV = end-of-year NPV × (1+r)^0.5.
 *  See ASSESSMENT.md F9 / F16 / D23. */
export type DiscountConvention = 'end-of-year' | 'mid-year';

/**
 * Standard DCF: NPV = Σ cashflow[t] / (1 + r)^t
 *
 * Default end-of-year: year 0 (index 0) is not discounted (factor = 1).
 * Optional mid-year (SPE upstream standard): exponent = t − 0.5.
 */
export function calculateNPV(
  cashflows: readonly number[],
  discountRate: number,
  convention: DiscountConvention = 'end-of-year',
): number {
  if (cashflows.length === 0) return 0;

  let npv = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const offset = convention === 'mid-year' ? t - 0.5 : t;
    npv += cashflows[t]! / Math.pow(1 + discountRate, offset);
  }
  return npv;
}
