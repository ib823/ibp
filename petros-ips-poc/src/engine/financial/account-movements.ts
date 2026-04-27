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
import { generateDecommissioningSchedule, DECOMM_DISCOUNT_RATE } from './decommissioning';
import { generateEESchedule } from './exploration-evaluation';

export function generateAccountMovements(
  incomeStatement: IncomeStatement,
  balanceSheet: BalanceSheet,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): AccountMovements {
  const { costProfile, project: proj } = project;

  // Driver-based schedules (mirrors balance-sheet.ts wiring per Wave 2 D32+D33)
  const decommSchedule = generateDecommissioningSchedule(
    costProfile, proj.startYear, proj.endYear, DECOMM_DISCOUNT_RATE,
  );
  const eeRoll = generateEESchedule(project);

  // ── PP&E Roll-Forward ────────────────────────────────────────────────
  // Per IFRIC 1 §5: ARO initial recognition is capitalised to PPE in
  // addition to physical CAPEX. Per MFRS 6: E&E balance sits in its own
  // line until FID — exclude from PPE base, add reclassified-to-PPE on FID.
  const ppe: PPERollForward[] = [];
  for (let i = 0; i < cashflows.length; i++) {
    const cf = cashflows[i]!;
    const is = incomeStatement.yearly[i]!;
    const opening = i > 0 ? (ppe[i - 1]!.closing as number) : 0;
    const cost = computeCosts(costProfile, cf.year);
    // Physical CAPEX, excluding any portion already routed through E&E
    const physicalCapexLessEE = Math.max(
      0,
      cost.totalCapex - (eeRoll[i]!.additions as number),
    );
    // Add ARO initial PV when first capitalised (IFRIC 1 §5)
    const aroAddition = decommSchedule[i]!.additions as number;
    // Add E&E reclassification at FID (MFRS 6 → reclassified to PPE)
    const eeReclass = eeRoll[i]!.reclassifiedToPPE as number;
    const additions = physicalCapexLessEE + aroAddition + eeReclass;
    const depreciation = is.depreciationAmortisation as number;
    const impairment = 0;
    const disposals = 0;
    const closing = Math.max(0, opening + additions - depreciation - impairment - disposals);

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

  // ── Exploration Assets — wired to MFRS 6 schedule (D33) ─────────────
  const explorationAssets: ExplorationAssetRollForward[] = eeRoll.map((e) => ({
    year: e.year,
    opening: e.opening,
    additions: e.additions,
    writtenOff: e.writtenOff,
    reclassifiedToPPE: e.reclassifiedToPPE,
    closing: e.closing,
  }));

  void balanceSheet; // legacy param retained for API compat (D32+ schedules are authoritative)

  // ── Debt (none for POC) ──────────────────────────────────────────────
  const debt: DebtRollForward[] = cashflows.map((cf) => ({
    year: cf.year,
    opening: usd(0),
    drawdowns: usd(0),
    repayments: usd(0),
    closing: usd(0),
    interestExpense: usd(0),
  }));

  // ── Decommissioning Provision — driver-based per MFRS 137 + IFRIC 1 ──
  // Now sourced directly from `decommSchedule` rather than back-calculated
  // from BS. Eliminates the plug-field pattern. (D32 / Wave 2)
  const decommProv: DecommissioningProvisionRollForward[] = decommSchedule.map((d) => ({
    year: d.year,
    opening: d.opening,
    additions: d.additions,
    unwinding: d.unwinding,
    utilisations: d.utilisations,
    revisions: d.revisions,
    closing: d.closing,
  }));

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
