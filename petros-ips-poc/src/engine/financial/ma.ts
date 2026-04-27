// ════════════════════════════════════════════════════════════════════════
// M&A — Acquisition DCF (D6, RFP §5)
// ════════════════════════════════════════════════════════════════════════
//
// Standard acquisition-evaluation framework:
//
//   1. Target standalone DCF — present value of target's own cash flows
//      at target's standalone WACC.
//   2. Synergies DCF — incremental cash flows from combination (revenue
//      synergies + cost synergies − integration costs), discounted at
//      acquirer's WACC.
//   3. Control premium — typical 20-40% over target's standalone equity
//      value to compensate target shareholders for change of control.
//   4. Acquisition price = Standalone Equity Value + Control Premium.
//   5. Accretion / dilution — compare expected combined EPS / cash flow
//      vs. acquirer's standalone (acquirer-perspective filter).
//
// Reference: Brealey-Myers Corporate Finance §35; CFA Level II Equity
// Investments – Mergers & Acquisitions.
// ════════════════════════════════════════════════════════════════════════

import type { USD } from '@/engine/types';
import { calculateNPV } from '@/engine/economics/npv';
import { calculateIRR } from '@/engine/economics/irr';
import { usd } from '@/engine/fiscal/shared';

export interface MAInputs {
  /** Target's standalone NCF time series (USD). */
  readonly targetCashflows: readonly number[];
  /** Target's standalone WACC (e.g. 0.09 = 9%). */
  readonly targetWacc: number;
  /** Annual revenue synergies time series (USD). Positive values. */
  readonly revenueSynergies: readonly number[];
  /** Annual cost synergies time series (USD). Positive values. */
  readonly costSynergies: readonly number[];
  /** Annual integration costs time series (USD). Positive values
   *  (representing outflows). */
  readonly integrationCosts: readonly number[];
  /** Acquirer's WACC for synergy discounting. */
  readonly acquirerWacc: number;
  /** Control premium as a fraction (e.g. 0.30 = 30% premium). */
  readonly controlPremiumPct: number;
  /** Acquirer's standalone NCF time series (for accretion/dilution check). */
  readonly acquirerCashflows: readonly number[];
}

export interface MAResult {
  readonly targetStandaloneEquityValue: USD;
  readonly synergiesValue: USD;
  readonly controlPremium: USD;
  readonly acquisitionPrice: USD;
  /** NPV of the deal to acquirer = synergies value − control premium. */
  readonly dealNpvToAcquirer: USD;
  /** Internal rate of return of the deal cash flows (combined). */
  readonly dealIrr: number | null;
  /** Accretion / dilution: combined NPV / acquirer-standalone NPV − 1.
   *  Positive = accretive; negative = dilutive. */
  readonly accretionDilutionPct: number;
}

/**
 * Run an acquisition-DCF evaluation.
 */
export function evaluateAcquisition(inputs: MAInputs): MAResult {
  const targetEquity = calculateNPV(inputs.targetCashflows, inputs.targetWacc);

  // Combine synergies into a single time-series cash flow (acquirer side).
  const synergiesCf: number[] = [];
  const horizon = Math.max(
    inputs.revenueSynergies.length,
    inputs.costSynergies.length,
    inputs.integrationCosts.length,
  );
  for (let t = 0; t < horizon; t++) {
    synergiesCf.push(
      (inputs.revenueSynergies[t] ?? 0) +
      (inputs.costSynergies[t] ?? 0) -
      (inputs.integrationCosts[t] ?? 0),
    );
  }
  const synergiesValue = calculateNPV(synergiesCf, inputs.acquirerWacc);

  const controlPremium = targetEquity * inputs.controlPremiumPct;
  const acquisitionPrice = targetEquity + controlPremium;
  const dealNpv = synergiesValue - controlPremium;

  // Combined CF for IRR: acquisition outflow at t=0, then synergies stream
  const dealCf: number[] = [-acquisitionPrice, ...synergiesCf];
  const dealIrr = calculateIRR(dealCf);

  const acquirerStandaloneNpv = calculateNPV(inputs.acquirerCashflows, inputs.acquirerWacc);
  // Combined NPV approximation: acquirer-standalone + synergies − premium
  const combinedNpv = acquirerStandaloneNpv + dealNpv;
  const accretionDilution = acquirerStandaloneNpv > 0
    ? combinedNpv / acquirerStandaloneNpv - 1
    : 0;

  return {
    targetStandaloneEquityValue: usd(targetEquity),
    synergiesValue: usd(synergiesValue),
    controlPremium: usd(controlPremium),
    acquisitionPrice: usd(acquisitionPrice),
    dealNpvToAcquirer: usd(dealNpv),
    dealIrr,
    accretionDilutionPct: accretionDilution,
  };
}
