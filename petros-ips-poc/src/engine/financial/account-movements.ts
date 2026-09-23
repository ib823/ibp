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
import { usd, workingInterestCosts } from '@/engine/fiscal/shared';
import { generateDecommissioningSchedule, DECOMM_DISCOUNT_RATE } from './decommissioning';
import { accountingDrivers } from './accounting-drivers';

export function generateAccountMovements(
  incomeStatement: IncomeStatement,
  balanceSheet: BalanceSheet,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): AccountMovements {
  const drivers = accountingDrivers(cashflows, project);

  // ── PP&E Roll-Forward ────────────────────────────────────────────────
  // Per IFRIC 1 §5: the decommissioning asset is capitalised to PPE in
  // addition to physical CAPEX. Per MFRS 6: E&E sits in its own line until
  // FID, then is reclassified to PPE. Same drivers as the balance sheet.
  const ppe: PPERollForward[] = [];
  for (let i = 0; i < drivers.years.length; i++) {
    const d = drivers.years[i]!;
    const is = incomeStatement.yearly[i]!;
    const opening = i > 0 ? (ppe[i - 1]!.closing as number) : 0;
    const additions = d.ppeCapexAdditions + d.aroAddition;
    const depreciation = is.depreciationAmortisation as number;
    const impairment = 0;
    const disposals = 0;
    const closing = opening + additions - depreciation - impairment - disposals;

    ppe.push({
      year: d.year,
      opening: usd(opening),
      additions: usd(additions),
      depreciation: usd(depreciation),
      impairment: usd(impairment),
      disposals: usd(disposals),
      closing: usd(closing),
    });
  }

  // ── Exploration Assets — wired to MFRS 6 schedule (D33) ─────────────
  const explorationAssets: ExplorationAssetRollForward[] = drivers.years.map((d, i) => ({
    year: d.year,
    opening: usd(i > 0 ? drivers.years[i - 1]!.eeClosing : 0),
    additions: usd(d.eeAdditions),
    writtenOff: usd(d.eeWrittenOff),
    reclassifiedToPPE: usd(d.eeReclassified),
    closing: usd(d.eeClosing),
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
  // Sourced from the IFRIC 1 schedule; empty under an LLA PSC, where
  // PETRONAS assumes decommissioning (see accounting-drivers.ts).
  const { project: proj } = project;
  const decommSchedule = project.fiscalRegimeConfig.type === 'PSC_LLA'
    ? null
    : generateDecommissioningSchedule(
        workingInterestCosts(project), proj.startYear, proj.endYear, DECOMM_DISCOUNT_RATE,
      );
  const decommProv: DecommissioningProvisionRollForward[] = drivers.years.map((d, i) => {
    const entry = decommSchedule?.[i];
    return {
      year: d.year,
      opening: entry?.opening ?? usd(0),
      additions: entry?.additions ?? usd(0),
      unwinding: entry?.unwinding ?? usd(0),
      utilisations: entry?.utilisations ?? usd(0),
      revisions: entry?.revisions ?? usd(0),
      closing: entry?.closing ?? usd(0),
    };
  });

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
