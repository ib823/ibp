// ════════════════════════════════════════════════════════════════════════
// Net Present Value Calculation
// ════════════════════════════════════════════════════════════════════════

/**
 * Standard DCF: NPV = Σ cashflow[t] / (1 + r)^t
 * Year 0 (index 0) is not discounted (discount factor = 1).
 */
export function calculateNPV(cashflows: readonly number[], discountRate: number): number {
  if (cashflows.length === 0) return 0;

  let npv = 0;
  for (let t = 0; t < cashflows.length; t++) {
    npv += cashflows[t]! / Math.pow(1 + discountRate, t);
  }
  return npv;
}
