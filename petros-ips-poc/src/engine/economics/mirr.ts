// ════════════════════════════════════════════════════════════════════════
// Modified Internal Rate of Return
// ════════════════════════════════════════════════════════════════════════

/**
 * MIRR = (FV of positive CFs at reinvestRate / PV of negative CFs at financeRate)^(1/n) - 1
 *
 * @param cashflows Array of cash flows (index 0 = year 0)
 * @param financeRate Rate to discount negative cash flows (e.g. WACC)
 * @param reinvestRate Rate to compound positive cash flows (e.g. hurdle rate)
 */
export function calculateMIRR(
  cashflows: readonly number[],
  financeRate: number,
  reinvestRate: number,
): number {
  const n = cashflows.length - 1;
  if (n <= 0) return 0;

  // PV of negative cash flows (discounted at finance rate)
  let pvNegative = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const cf = cashflows[t]!;
    if (cf < 0) {
      pvNegative += cf / Math.pow(1 + financeRate, t);
    }
  }

  // FV of positive cash flows (compounded at reinvest rate to terminal year)
  let fvPositive = 0;
  for (let t = 0; t < cashflows.length; t++) {
    const cf = cashflows[t]!;
    if (cf > 0) {
      fvPositive += cf * Math.pow(1 + reinvestRate, n - t);
    }
  }

  // Edge cases
  if (pvNegative === 0) return 0;
  if (fvPositive === 0) return -1;

  // MIRR formula
  const absRatio = fvPositive / Math.abs(pvNegative);
  return Math.pow(absRatio, 1 / n) - 1;
}
