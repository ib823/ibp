// ════════════════════════════════════════════════════════════════════════
// MFRS 6 — Exploration & Evaluation Assets (D33)
// ════════════════════════════════════════════════════════════════════════
//
// MFRS 6 governs the accounting treatment of expenditure incurred during
// the exploration and evaluation phase of mineral resources. It allows two
// policies (PETROS to confirm in Phase 1a):
//
//   - Successful efforts modified: capitalise E&E expenditure as a
//     separate asset class until commerciality is determined; on FID,
//     reclassify to PP&E; on failure determination, write off through
//     income statement.
//
//   - Expense as incurred: charge all E&E to P&L immediately.
//
// This module implements the SUCCESSFUL EFFORTS approach (industry-typical
// for upstream majors). Project's `phase: 'exploration'` triggers E&E
// classification; `phase: 'development'` after FID triggers reclassification.
//
// Reference: MFRS 6 (Exploration for and Evaluation of Mineral Resources).
// ════════════════════════════════════════════════════════════════════════

import type { ProjectInputs, USD } from '@/engine/types';
import { getVal, usd } from '@/engine/fiscal/shared';

export interface EERollForward {
  readonly year: number;
  readonly opening: USD;
  readonly additions: USD;
  readonly reclassifiedToPPE: USD;
  readonly writtenOff: USD;
  readonly closing: USD;
}

export interface EEPolicyOptions {
  /** Year in which FID occurs and E&E reclassifies to PPE.
   *  Defaults to project.startYear + (years to commerciality).
   *  POC heuristic: end of explicit "exploration" phase = year of first
   *  significant production cashflow. Pass explicit year for precise control. */
  readonly fidYear?: number;
  /** If exploration is determined unsuccessful, year of write-off. */
  readonly writeOffYear?: number;
}

/**
 * Build E&E asset roll-forward for a project.
 *
 * For projects with `phase: 'exploration'`, all CAPEX in years before FID
 * accumulates as E&E asset. At FID year, E&E asset reclassifies to PPE
 * (zero-out E&E, add to PPE additions).
 *
 * For projects with `phase: 'development'` or later, this module returns
 * a zero schedule (E&E concept does not apply; CAPEX flows to PPE directly).
 */
export function generateEESchedule(
  project: ProjectInputs,
  options: EEPolicyOptions = {},
): EERollForward[] {
  const out: EERollForward[] = [];
  const inExplorationPhase = project.project.phase === 'exploration';

  if (!inExplorationPhase) {
    // E&E does not apply — return zero schedule for parity
    for (let y = project.project.startYear; y <= project.project.endYear; y++) {
      out.push({
        year: y,
        opening: usd(0),
        additions: usd(0),
        reclassifiedToPPE: usd(0),
        writtenOff: usd(0),
        closing: usd(0),
      });
    }
    return out;
  }

  // Heuristic: FID is the first year with non-trivial production
  // (oilBpd + gasMMscfd > 0). Override with options.fidYear if provided.
  let fidYear = options.fidYear ?? project.project.startYear;
  if (!options.fidYear) {
    for (let y = project.project.startYear; y <= project.project.endYear; y++) {
      const oil = getVal(project.productionProfile.oil, y);
      const gas = getVal(project.productionProfile.gas, y);
      if (oil > 0 || gas > 0) { fidYear = y; break; }
    }
  }

  let opening = 0;
  for (let y = project.project.startYear; y <= project.project.endYear; y++) {
    const yearCapex =
      getVal(project.costProfile.capexDrilling, y) +
      getVal(project.costProfile.capexFacilities, y) +
      getVal(project.costProfile.capexSubsea, y) +
      getVal(project.costProfile.capexOther, y);

    let additions = 0;
    let reclassifiedToPPE = 0;
    let writtenOff = 0;

    if (y < fidYear) {
      // Pre-FID: capitalise CAPEX as E&E asset
      additions = yearCapex;
    } else if (y === fidYear) {
      // FID year: this year's CAPEX still goes E&E (becomes PPE on transfer)
      additions = yearCapex;
      // ...then transfer the entire E&E balance to PPE
      reclassifiedToPPE = opening + additions;
    }
    // post-FID: E&E balance is zero; new CAPEX goes directly to PPE

    if (options.writeOffYear === y) {
      writtenOff = opening + additions;
    }

    const closing = Math.max(0, opening + additions - reclassifiedToPPE - writtenOff);
    out.push({
      year: y,
      opening: usd(opening),
      additions: usd(additions),
      reclassifiedToPPE: usd(reclassifiedToPPE),
      writtenOff: usd(writtenOff),
      closing: usd(closing),
    });
    opening = closing;
  }

  return out;
}
