// ════════════════════════════════════════════════════════════════════════
// Balance Sheet Generator
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  BalanceSheet,
  BalanceSheetLine,
} from '@/engine/types';
import { usd, computeCosts, getVal } from '@/engine/fiscal/shared';

const DECOMM_DISCOUNT_RATE = 0.08;

/**
 * Generate balance sheet from income statement, cashflows, and project inputs.
 *
 * Retained earnings is accumulated from income statement PAT (proper accounting).
 * The balance sheet includes a reconciliation difference field (otherReserves)
 * that captures any gap between assets and equity+liabilities — this should
 * be zero if all calculations are consistent; non-zero flags an issue.
 */
export function generateBalanceSheet(
  incomeStatement: IncomeStatement,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): BalanceSheet {
  const { costProfile, project: proj } = project;

  // Compute total abandonment cost for decommissioning provision
  let totalAbandonment = 0;
  for (let y = proj.startYear; y <= proj.endYear; y++) {
    totalAbandonment += getVal(costProfile.abandonmentCost, y);
  }

  let cumulativeCapex = 0;
  let cumulativeDda = 0;
  let cumulativeCash = 0;
  let cumulativeRetainedEarnings = 0;
  let decommUsed = 0;

  const yearly: BalanceSheetLine[] = cashflows.map((cf, idx) => {
    const isLine = incomeStatement.yearly[idx]!;
    const cost = computeCosts(costProfile, cf.year);

    cumulativeCapex += cost.totalCapex;
    cumulativeDda += isLine.depreciationAmortisation as number;
    cumulativeCash += cf.netCashFlow as number;
    cumulativeRetainedEarnings += isLine.profitAfterTax as number;

    // Assets
    const ppeNet = Math.max(0, cumulativeCapex - cumulativeDda);
    const cash = cumulativeCash;
    const totalNonCurrentAssets = ppeNet;
    const totalCurrentAssets = cash;
    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    // Liabilities
    const yearsToEnd = proj.endYear - cf.year;
    const abexThisYear = cost.abandonmentCost;
    decommUsed += abexThisYear;
    const remainingAbandonment = totalAbandonment - decommUsed;
    const decommProvision = yearsToEnd > 0
      ? remainingAbandonment / Math.pow(1 + DECOMM_DISCOUNT_RATE, yearsToEnd)
      : remainingAbandonment;

    const totalNonCurrentLiabilities = decommProvision;
    const totalCurrentLiabilities = 0;
    const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;

    // Equity — accumulated from income statement
    const retainedEarnings = cumulativeRetainedEarnings;

    // Reconciliation difference: captures gap between assets and (equity + liabilities).
    // In a fully consistent model this would be zero; non-zero indicates the income
    // statement accounting (DD&A, tax) differs from the cash-based economics model.
    const reconDifference = totalAssets - (retainedEarnings + totalLiabilities);

    const totalEquity = retainedEarnings + reconDifference;
    const totalEquityAndLiabilities = totalEquity + totalLiabilities;

    return {
      year: cf.year,
      ppeNet: usd(ppeNet),
      explorationAssets: usd(0),
      rightOfUseAssets: usd(0),
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
      deferredTaxLiability: usd(0),
      otherNonCurrentLiabilities: usd(0),
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
