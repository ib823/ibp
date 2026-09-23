// ════════════════════════════════════════════════════════════════════════
// Balance Sheet Generator — driver-based per MFRS (D14 / D32 / D33 / D34)
// ════════════════════════════════════════════════════════════════════════
//
//   - PP&E                      — capex + E&E reclassified + capitalised
//                                  decommissioning asset (IFRIC 1 §5) − DD&A
//   - E&E assets                — MFRS 6 schedule, reclassified to PP&E at FID
//   - Cash                      — cumulative net cash flow
//   - Decommissioning provision — MFRS 137 / IFRIC 1 schedule
//   - Deferred tax              — MFRS 112 net position (DTL, or DTA in
//                                  other non-current assets)
//   - Right-of-use assets       — optional MFRS 16 lease schedule
//
// With every movement driven by the same schedules as the income statement
// (accounting-drivers.ts) the sheet balances by construction.
// `otherReserves` carries any residual for diagnostics — it is zero unless
// an MFRS 16 lease is supplied, whose payments are not in the fiscal cash
// flows.
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  BalanceSheet,
  BalanceSheetLine,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { accountingDrivers, netDeferredTax, ppeClosingBalances } from './accounting-drivers';
import { buildLeaseSchedule, type LeaseInputs } from './lease';

export interface BalanceSheetOptions {
  /** Optional FPSO / equipment lease schedule per MFRS 16 (D34).
   *  When provided, lease-liability + RoU asset are added to the BS. */
  readonly lease?: LeaseInputs;
}

/**
 * Generate balance sheet from income statement, cashflows, and project inputs.
 */
export function generateBalanceSheet(
  incomeStatement: IncomeStatement,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
  options: BalanceSheetOptions = {},
): BalanceSheet {
  const drivers = accountingDrivers(cashflows, project);
  const dda = incomeStatement.yearly.map((l) => l.depreciationAmortisation as number);
  const ppeClosing = ppeClosingBalances(drivers, dda);
  const deferred = netDeferredTax(drivers, ppeClosing);
  const leaseScheduleRaw = options.lease ? buildLeaseSchedule(options.lease) : null;

  let cumulativeCash = 0;
  let cumulativeRetainedEarnings = 0;

  const yearly: BalanceSheetLine[] = drivers.years.map((d, idx) => {
    const isLine = incomeStatement.yearly[idx]!;
    cumulativeCash += d.netCashFlow;
    cumulativeRetainedEarnings += isLine.profitAfterTax as number;

    const ppeNet = ppeClosing[idx]!;
    const explorationAssets = d.eeClosing;

    // Right-of-use asset + lease liability per MFRS 16 (D34)
    const leaseEntry = leaseScheduleRaw
      ? leaseScheduleRaw.schedule.find((e) => e.year === d.year)
      : null;
    const rightOfUseAssets = (leaseEntry?.rouAssetClosing as number) ?? 0;
    const leaseLiability = (leaseEntry?.liabilityClosing as number) ?? 0;

    // Net deferred tax per MFRS 112 (D14): liability, or asset if negative
    const deferredTaxLiability = Math.max(0, deferred[idx]!);
    const deferredTaxAsset = Math.max(0, -deferred[idx]!);

    const cash = cumulativeCash;
    const totalNonCurrentAssets = ppeNet + explorationAssets + rightOfUseAssets + deferredTaxAsset;
    const totalCurrentAssets = cash;
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    const decommProvision = d.provisionClosing;
    const totalNonCurrentLiabilities = decommProvision + leaseLiability + deferredTaxLiability;
    const totalCurrentLiabilities = 0;
    const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

    const retainedEarnings = cumulativeRetainedEarnings;

    // Residual — zero by construction without a lease (see header).
    const reconDifference = totalAssets - (retainedEarnings + totalLiabilities);

    const totalEquity = retainedEarnings + reconDifference;
    const totalEquityAndLiabilities = totalEquity + totalLiabilities;

    return {
      year: d.year,
      ppeNet: usd(ppeNet),
      explorationAssets: usd(explorationAssets),
      rightOfUseAssets: usd(rightOfUseAssets),
      otherNonCurrentAssets: usd(deferredTaxAsset),
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
