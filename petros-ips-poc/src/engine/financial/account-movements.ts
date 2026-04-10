// ════════════════════════════════════════════════════════════════════════
// Account Movements / Roll-Forward Schedules
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  BalanceSheet,
  AccountMovements,
  PPERollForward,
  ExplorationAssetRollForward,
  DebtRollForward,
  DecommissioningProvisionRollForward,
  RetainedEarningsRollForward,
} from '@/engine/types';
import { usd, computeCosts } from '@/engine/fiscal/shared';

const DECOMM_DISCOUNT_RATE = 0.08;

export function generateAccountMovements(
  incomeStatement: IncomeStatement,
  balanceSheet: BalanceSheet,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): AccountMovements {
  const { costProfile } = project;

  // ── PP&E Roll-Forward ────────────────────────────────────────────────
  const ppe: PPERollForward[] = [];
  for (let i = 0; i < cashflows.length; i++) {
    const cf = cashflows[i]!;
    const is = incomeStatement.yearly[i]!;
    const opening = i > 0 ? (ppe[i - 1]!.closing as number) : 0;
    const cost = computeCosts(costProfile, cf.year);
    const additions = cost.totalCapex;
    const depreciation = is.depreciationAmortisation as number;
    const impairment = 0;
    const disposals = 0;
    const closing = opening + additions - depreciation - impairment - disposals;

    ppe.push({
      year: cf.year,
      opening: usd(opening),
      additions: usd(additions),
      depreciation: usd(depreciation),
      impairment: usd(impairment),
      disposals: usd(disposals),
      closing: usd(closing),
    });
  }

  // ── Exploration Assets (simplified — none for POC) ───────────────────
  const explorationAssets: ExplorationAssetRollForward[] = cashflows.map((cf) => ({
    year: cf.year,
    opening: usd(0),
    additions: usd(0),
    writtenOff: usd(0),
    reclassifiedToPPE: usd(0),
    closing: usd(0),
  }));

  // ── Debt (none for POC) ──────────────────────────────────────────────
  const debt: DebtRollForward[] = cashflows.map((cf) => ({
    year: cf.year,
    opening: usd(0),
    drawdowns: usd(0),
    repayments: usd(0),
    closing: usd(0),
    interestExpense: usd(0),
  }));

  // ── Decommissioning Provision ────────────────────────────────────────
  const decommProv: DecommissioningProvisionRollForward[] = [];
  for (let i = 0; i < cashflows.length; i++) {
    const cf = cashflows[i]!;
    const bs = balanceSheet.yearly[i]!;
    const opening = i > 0 ? (decommProv[i - 1]!.closing as number) : 0;
    const closing = bs.decommissioningProvision as number;
    const cost = computeCosts(costProfile, cf.year);
    const utilisations = cost.abandonmentCost;
    // Unwinding = discount accretion on opening balance
    const unwinding = opening * DECOMM_DISCOUNT_RATE;
    // Additions + revisions = closing - opening - unwinding + utilisations
    const additionsAndRevisions = closing - opening - unwinding + utilisations;
    const additions = Math.max(0, additionsAndRevisions);
    const revisions = additionsAndRevisions < 0 ? additionsAndRevisions : 0;

    decommProv.push({
      year: cf.year,
      opening: usd(opening),
      additions: usd(additions),
      unwinding: usd(unwinding),
      utilisations: usd(utilisations),
      revisions: usd(revisions),
      closing: usd(closing),
    });
  }

  // ── Retained Earnings ────────────────────────────────────────────────
  const retainedEarnings: RetainedEarningsRollForward[] = [];
  for (let i = 0; i < cashflows.length; i++) {
    const cf = cashflows[i]!;
    const is = incomeStatement.yearly[i]!;
    const opening = i > 0 ? (retainedEarnings[i - 1]!.closing as number) : 0;
    const profitAfterTax = is.profitAfterTax as number;
    const dividends = 0;
    const otherMovements = 0;
    const closing = opening + profitAfterTax - dividends + otherMovements;

    retainedEarnings.push({
      year: cf.year,
      opening: usd(opening),
      profitAfterTax: usd(profitAfterTax),
      dividends: usd(dividends),
      otherMovements: usd(otherMovements),
      closing: usd(closing),
    });
  }

  return {
    ppe,
    explorationAssets,
    debt,
    decommissioningProvision: decommProv,
    retainedEarnings,
  };
}
