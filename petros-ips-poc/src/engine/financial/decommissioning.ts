// ════════════════════════════════════════════════════════════════════════
// Decommissioning Provision — MFRS 137 + IFRIC 1 driver-based mechanic
//
// Replaces the snapshot-PV approach in balance-sheet.ts with the standard
// IFRIC 1 evolution:
//
//   1. Initial recognition (year obligation arises, typically first
//      development CAPEX year):
//        provision₀ = PV of expected abandonment outflows discounted at
//                     credit-adjusted risk-free rate
//        capitalised to PPE as part of asset cost
//
//   2. Each subsequent year:
//        unwinding   = opening provision × discount rate
//                      (charged to finance cost on the income statement)
//        utilisation = actual abandonment cash spent this year
//        revisions   = change in expected outflow estimate (rare in POC)
//        closing     = opening + unwinding - utilisation + revisions
//
// Reference: MFRS 137 §45-60; IFRIC 1 §3-10.
// ════════════════════════════════════════════════════════════════════════

import type { CostProfile, USD } from '@/engine/types';
import { getVal, usd } from '@/engine/fiscal/shared';

/** Credit-adjusted risk-free rate. Should be tuned per entity per MFRS 137 §47.
 *  POC uses 8% (industry-typical for upstream entities in BBB-A credit range). */
export const DECOMM_DISCOUNT_RATE = 0.08;

export interface DecommissioningEntry {
  readonly year: number;
  readonly opening: USD;
  /** Initial-recognition or revision additions in this year. */
  readonly additions: USD;
  /** Annual unwinding (accretion) — charged to finance cost. */
  readonly unwinding: USD;
  /** Actual abandonment cash spent this year (utilisation of provision). */
  readonly utilisations: USD;
  /** Change in estimate per IFRIC 1 — typically zero year-on-year for POC. */
  readonly revisions: USD;
  readonly closing: USD;
}

/**
 * Build the IFRIC 1 driver-based decommissioning provision schedule.
 *
 * Initial recognition: at the first development CAPEX year, recognise
 * PV of total expected abex outflows at the credit-adjusted risk-free rate.
 * Capitalised to PPE in parallel (handled by the consumer; this module
 * only emits the provision schedule).
 *
 * The schedule's `additions` in year 0 equals the initial PV (which the
 * income statement records as a corresponding PPE addition, NOT a P&L hit).
 * `unwinding` each year is the genuine P&L finance cost.
 * `utilisations` mirror the abandonment cash outflow.
 *
 * @returns Year-by-year IFRIC 1 schedule including initial recognition.
 */
export function generateDecommissioningSchedule(
  costProfile: CostProfile,
  startYear: number,
  endYear: number,
  discountRate: number = DECOMM_DISCOUNT_RATE,
): DecommissioningEntry[] {
  // Compute total expected abandonment outflow + present-value at start year
  const abexByYear: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    abexByYear.push(getVal(costProfile.abandonmentCost, y));
  }
  const initialPV = abexByYear.reduce((acc, abex, idx) => {
    return acc + abex / Math.pow(1 + discountRate, idx);
  }, 0);

  // Find first dev-capex year as the obligation-arises year
  let initialRecognitionIdx = 0;
  for (let i = 0; i < abexByYear.length; i++) {
    const year = startYear + i;
    const capex =
      getVal(costProfile.capexDrilling, year) +
      getVal(costProfile.capexFacilities, year) +
      getVal(costProfile.capexSubsea, year) +
      getVal(costProfile.capexOther, year);
    if (capex > 0) { initialRecognitionIdx = i; break; }
  }

  const schedule: DecommissioningEntry[] = [];
  let opening = 0;

  for (let i = 0; i < abexByYear.length; i++) {
    const year = startYear + i;
    const utilisations = abexByYear[i]!;

    // Initial-recognition addition: lands in the first dev-capex year.
    // We re-PV the remaining expected outflows from that year forward to keep
    // the recognition at PV of the obligation as it arose at that date.
    let additions = 0;
    if (i === initialRecognitionIdx) {
      let pvFromHere = 0;
      for (let j = i; j < abexByYear.length; j++) {
        pvFromHere += abexByYear[j]! / Math.pow(1 + discountRate, j - i);
      }
      additions = pvFromHere;
    }

    const unwinding = opening * discountRate;
    const revisions = 0; // POC: no in-life estimate revisions
    const closing = Math.max(0, opening + additions + unwinding + revisions - utilisations);

    schedule.push({
      year,
      opening: usd(opening),
      additions: usd(additions),
      unwinding: usd(unwinding),
      utilisations: usd(utilisations),
      revisions: usd(revisions),
      closing: usd(closing),
    });

    opening = closing;
  }

  // Reference initialPV in a no-op so the audit-trail comment compiles.
  void initialPV;

  return schedule;
}
