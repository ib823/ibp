// ════════════════════════════════════════════════════════════════════════
// Balance Sheet Generator — driver-based per MFRS (D14 / D32 / D33 / D34)
// ════════════════════════════════════════════════════════════════════════
//
// Replaces the snapshot-PV / plug-field approach with driver-based
// mechanics from dedicated MFRS modules:
//
//   - PPE                       — accumulated CAPEX − accumulated book DD&A,
//                                  PLUS initial decommissioning capitalisation
//                                  per IFRIC 1 §5.
//   - Decommissioning provision — generateDecommissioningSchedule (IFRIC 1)
//   - E&E assets                — generateEESchedule (MFRS 6) for projects
//                                  in exploration phase; reclassified to PPE
//                                  at FID.
//   - Right-of-use assets       — buildLeaseSchedule (MFRS 16) for projects
//                                  with FPSO / equipment leases.
//   - Deferred tax liability    — generateDeferredTaxSchedule (MFRS 112)
//
// The plug field (`otherReserves` / `reconDifference`) is retained as a
// safety net but should be ≈ 0 once all driver-based pieces are wired.
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  BalanceSheet,
  BalanceSheetLine,
} from '@/engine/types';
import { usd, computeCosts } from '@/engine/fiscal/shared';
import { generateDecommissioningSchedule, DECOMM_DISCOUNT_RATE } from './decommissioning';
import { generateEESchedule } from './exploration-evaluation';
import { generateDeferredTaxSchedule } from './deferred-tax';
import { buildLeaseSchedule, type LeaseInputs } from './lease';

export interface BalanceSheetOptions {
  /** Optional FPSO / equipment lease schedule per MFRS 16 (D34).
   *  When provided, lease-liability + RoU asset are added to the BS. */
  readonly lease?: LeaseInputs;
}

/**
 * Generate balance sheet from income statement, cashflows, and project inputs.
 * Uses driver-based MFRS mechanics — no plug field required when data is
 * complete; reconciliation difference retained for diagnostic purposes.
 */
export function generateBalanceSheet(
  incomeStatement: IncomeStatement,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
  options: BalanceSheetOptions = {},
): BalanceSheet {
  const { costProfile, project: proj } = project;

  // Driver-based schedules
  const decommSchedule = generateDecommissioningSchedule(
    costProfile,
    proj.startYear,
    proj.endYear,
    DECOMM_DISCOUNT_RATE,
  );
  const eeSchedule = generateEESchedule(project);
  const dtlSchedule = generateDeferredTaxSchedule(
    costProfile,
    incomeStatement,
    proj.startYear,
    proj.endYear,
    // Use 38% PITA for upstream PSC; 24% for downstream/CCS
    proj.fiscalRegime === 'DOWNSTREAM' ? 0.24 : 0.38,
  );
  const leaseScheduleRaw = options.lease ? buildLeaseSchedule(options.lease) : null;

  let cumulativeCapex = 0;
  let cumulativeDda = 0;
  let cumulativeCash = 0;
  let cumulativeRetainedEarnings = 0;
  let cumulativeAroCapitalisation = 0; // tracks ARO additions to PPE over time

  const yearly: BalanceSheetLine[] = cashflows.map((cf, idx) => {
    const isLine = incomeStatement.yearly[idx]!;
    const cost = computeCosts(costProfile, cf.year);

    cumulativeCapex += cost.totalCapex;
    cumulativeDda += isLine.depreciationAmortisation as number;
    cumulativeCash += cf.netCashFlow as number;
    cumulativeRetainedEarnings += isLine.profitAfterTax as number;

    // Decommissioning — driver-based per IFRIC 1
    const decomm = decommSchedule[idx]!;
    const decommProvision = decomm.closing as number;
    // Initial recognition capitalisation accumulates onto PPE over time
    // (additions fire once, but the asset stays on PPE until depreciated /
    // disposed). Track cumulatively.
    cumulativeAroCapitalisation += decomm.additions as number;

    // E&E asset — for exploration-phase projects (MFRS 6). For non-E&E
    // projects this returns 0.
    const ee = eeSchedule[idx]!;
    const explorationAssets = ee.closing as number;
    // E&E balance is excluded from PPE (it sits as its own asset class until FID).
    const ppeNet = Math.max(0, cumulativeCapex - cumulativeDda + cumulativeAroCapitalisation - explorationAssets);

    // Right-of-use asset + lease liability per MFRS 16 (D34)
    const leaseEntry = leaseScheduleRaw
      ? leaseScheduleRaw.schedule.find((e) => e.year === cf.year)
      : null;
    const rightOfUseAssets = (leaseEntry?.rouAssetClosing as number) ?? 0;
    const leaseLiability = (leaseEntry?.liabilityClosing as number) ?? 0;

    // Deferred tax liability per MFRS 112 (D14)
    const dtl = dtlSchedule[idx]!;
    const deferredTaxLiability = dtl.deferredTaxLiability as number;

    const cash = cumulativeCash;
    const totalNonCurrentAssets = ppeNet + explorationAssets + rightOfUseAssets;
    const totalCurrentAssets = cash;
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    // Liabilities
    const totalNonCurrentLiabilities = decommProvision + leaseLiability + deferredTaxLiability;
    const totalCurrentLiabilities = 0;
    const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

    const retainedEarnings = cumulativeRetainedEarnings;

    // Reconciliation difference — should now be ≈ 0 with the proper drivers.
    // Retained for diagnostic visibility on residual book/cash mismatches.
    const reconDifference = totalAssets - (retainedEarnings + totalLiabilities);

    const totalEquity = retainedEarnings + reconDifference;
    const totalEquityAndLiabilities = totalEquity + totalLiabilities;

    return {
      year: cf.year,
      ppeNet: usd(ppeNet),
      explorationAssets: usd(explorationAssets),
      rightOfUseAssets: usd(rightOfUseAssets),
      otherNonCurrentAssets: usd(0),
      totalNonCurrentAssets: usd(totalNonCurrentAssets),
      cash: usd(cash),
      tradeReceivables: usd(0),
      inventories: usd(0),
      otherCurrentAssets: usd(0),
      totalCurrentAssets: usd(totalCurrentAssets),
      totalAssets: usd(totalAssets),
      shareCapital: usd(0),
      retainedEarnings: usd(retainedEarnings),
      otherReserves: usd(reconDifference),
      totalEquity: usd(totalEquity),
      longTermDebt: usd(0),
      decommissioningProvision: usd(decommProvision),
      deferredTaxLiability: usd(deferredTaxLiability),
      otherNonCurrentLiabilities: usd(leaseLiability),
      totalNonCurrentLiabilities: usd(totalNonCurrentLiabilities),
      shortTermDebt: usd(0),
      tradePayables: usd(0),
      currentTaxLiability: usd(0),
      otherCurrentLiabilities: usd(0),
      totalCurrentLiabilities: usd(totalCurrentLiabilities),
      totalLiabilities: usd(totalLiabilities),
      totalEquityAndLiabilities: usd(totalEquityAndLiabilities),
    };
  });

  return { yearly };
}
