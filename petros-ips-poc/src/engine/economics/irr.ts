// ════════════════════════════════════════════════════════════════════════
// Internal Rate of Return — Brent's Method
// ════════════════════════════════════════════════════════════════════════

import { calculateNPV } from './npv';

/**
 * Calculate IRR using bracket-finding + Brent's method.
 * Returns the smallest positive root, or null if no real IRR exists.
 */
export function calculateIRR(
  cashflows: readonly number[],
  maxIterations: number = 100,
  tolerance: number = 1e-7,
): number | null {
  if (cashflows.length < 2) return null;

  // Edge case: all positive or all negative → no IRR
  const hasPositive = cashflows.some((cf) => cf > 0);
  const hasNegative = cashflows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) return null;

  // Step 1: Bracket finding — scan from -50% to 200% in 1% increments
  const brackets: Array<[number, number]> = [];
  const directRoots: number[] = [];
  const scanMin = -0.50;
  const scanMax = 2.00;
  const scanStep = 0.01;

  let prevRate = scanMin;
  let prevNpv = calculateNPV(cashflows, prevRate);

  for (let rate = scanMin + scanStep; rate <= scanMax + scanStep / 2; rate += scanStep) {
    const npv = calculateNPV(cashflows, rate);

    // Direct root detection: NPV ≈ 0 at this rate
    if (Math.abs(npv) < tolerance * 1000) {
      directRoots.push(rate);
    } else if (prevNpv * npv < 0) {
      brackets.push([prevRate, rate]);
    }

    prevRate = rate;
    prevNpv = npv;
  }

  if (brackets.length === 0 && directRoots.length === 0) return null;

  // Step 2: Brent's method on each bracket, plus direct roots
  const roots: number[] = [...directRoots];

  for (const [a0, b0] of brackets) {
    const root = brentsMethod(
      (r) => calculateNPV(cashflows, r),
      a0,
      b0,
      maxIterations,
      tolerance,
    );
    if (root !== null) {
      roots.push(root);
    }
  }

  if (roots.length === 0) return null;

  // Step 3: Return smallest positive root
  const positiveRoots = roots.filter((r) => r > -0.999);
  positiveRoots.sort((a, b) => a - b);

  // Prefer smallest positive root; if none, return smallest root overall
  const firstPositive = positiveRoots.find((r) => r >= 0);
  return firstPositive ?? positiveRoots[0] ?? roots[0]!;
}

/**
 * Brent's root-finding method.
 * Guaranteed convergence for continuous functions on a bracketed interval.
 */
function brentsMethod(
  f: (x: number) => number,
  a: number,
  b: number,
  maxIter: number,
  tol: number,
): number | null {
  let fa = f(a);
  let fb = f(b);

  if (fa * fb > 0) return null; // Not bracketed

  if (Math.abs(fa) < Math.abs(fb)) {
    [a, b] = [b, a];
    [fa, fb] = [fb, fa];
  }

  let c = a;
  let fc = fa;
  let d = b - a;
  let mflag = true;

  for (let i = 0; i < maxIter; i++) {
    if (Math.abs(fb) < tol) return b;
    if (Math.abs(b - a) < tol) return b;

    let s: number;

    if (fa !== fc && fb !== fc) {
      // Inverse quadratic interpolation
      s =
        (a * fb * fc) / ((fa - fb) * (fa - fc)) +
        (b * fa * fc) / ((fb - fa) * (fb - fc)) +
        (c * fa * fb) / ((fc - fa) * (fc - fb));
    } else {
      // Secant method
      s = b - fb * (b - a) / (fb - fa);
    }

    // Conditions for bisection
    const cond1 = !(s > (3 * a + b) / 4 && s < b) && !(s < (3 * a + b) / 4 && s > b);
    const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
    const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
    const cond4 = mflag && Math.abs(b - c) < tol;
    const cond5 = !mflag && Math.abs(c - d) < tol;

    if (cond1 || cond2 || cond3 || cond4 || cond5) {
      s = (a + b) / 2;
      mflag = true;
    } else {
      mflag = false;
    }

    const fs = f(s);
    d = c;
    c = b;
    fc = fb;

    if (fa * fs < 0) {
      b = s;
      fb = fs;
    } else {
      a = s;
      fa = fs;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }
  }

  return b;
}
