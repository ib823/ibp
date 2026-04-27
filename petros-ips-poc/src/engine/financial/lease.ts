// ════════════════════════════════════════════════════════════════════════
// MFRS 16 — Right-of-Use Lease Accounting (D34)
// ════════════════════════════════════════════════════════════════════════
//
// MFRS 16 brings most operating leases on-balance-sheet as right-of-use
// (RoU) assets and lease liabilities. Relevant for upstream FPSO leases
// (e.g., SK-612 deepwater), drilling-rig charters, vessel charters, and
// office leases.
//
// Annual evolution per MFRS 16:
//
//   - Initial recognition (lease commencement):
//       RoU asset    = PV of lease payments + initial direct costs
//       Lease liab.  = PV of lease payments at lessee's incremental
//                       borrowing rate (IBR)
//
//   - Each year:
//       Depreciation     = RoU asset / lease term      (operating expense)
//       Interest expense = opening lease liab. × IBR   (finance cost)
//       Lease payment    = scheduled cash payment      (reduces liability)
//       Closing liab.    = opening + interest − payment
//       Closing RoU      = opening − depreciation
//
// Reference: MFRS 16 (Leases) §22-49.
// ════════════════════════════════════════════════════════════════════════

import type { USD } from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';

export interface LeaseInputs {
  /** Annual lease payment (USD). Constant for POC; production system supports
   *  variable schedules. */
  readonly annualPayment: number;
  /** Lease term in years. */
  readonly termYears: number;
  /** Lessee's incremental borrowing rate (IBR). */
  readonly ibr: number;
  /** First lease year. */
  readonly startYear: number;
  /** Initial direct costs (e.g. legal, mobilization) added to RoU asset. */
  readonly initialDirectCosts?: number;
}

export interface LeaseScheduleEntry {
  readonly year: number;
  /** Opening RoU asset balance. */
  readonly rouAssetOpening: USD;
  /** Annual depreciation charge (operating expense). */
  readonly depreciation: USD;
  /** Closing RoU asset balance. */
  readonly rouAssetClosing: USD;
  /** Opening lease liability balance. */
  readonly liabilityOpening: USD;
  /** Interest expense on lease liability (finance cost). */
  readonly interestExpense: USD;
  /** Lease payment (cash outflow). */
  readonly payment: USD;
  /** Closing lease liability balance. */
  readonly liabilityClosing: USD;
}

export interface LeaseResult {
  readonly schedule: readonly LeaseScheduleEntry[];
  readonly totalPV: USD;
  readonly totalDepreciation: USD;
  readonly totalInterest: USD;
}

export function buildLeaseSchedule(inputs: LeaseInputs): LeaseResult {
  const r = inputs.ibr;
  const n = inputs.termYears;
  // PV of annuity for lease liability
  const annuityFactor = r > 0 ? (1 - Math.pow(1 + r, -n)) / r : n;
  const liabilityPV = inputs.annualPayment * annuityFactor;
  const initialRoU = liabilityPV + (inputs.initialDirectCosts ?? 0);
  const annualDepreciation = initialRoU / n;

  const schedule: LeaseScheduleEntry[] = [];
  let rouOpening = initialRoU;
  let liabOpening = liabilityPV;

  for (let i = 0; i < n; i++) {
    const year = inputs.startYear + i;
    const interest = liabOpening * r;
    const principalPayment = inputs.annualPayment - interest;
    const liabClosing = Math.max(0, liabOpening - principalPayment);
    const rouClosing = Math.max(0, rouOpening - annualDepreciation);

    schedule.push({
      year,
      rouAssetOpening: usd(rouOpening),
      depreciation: usd(annualDepreciation),
      rouAssetClosing: usd(rouClosing),
      liabilityOpening: usd(liabOpening),
      interestExpense: usd(interest),
      payment: usd(inputs.annualPayment),
      liabilityClosing: usd(liabClosing),
    });

    rouOpening = rouClosing;
    liabOpening = liabClosing;
  }

  return {
    schedule,
    totalPV: usd(initialRoU),
    totalDepreciation: usd(annualDepreciation * n),
    totalInterest: usd(schedule.reduce((s, e) => s + (e.interestExpense as number), 0)),
  };
}
