// ════════════════════════════════════════════════════════════════════════
// Cash Flow Statement Generator
// ════════════════════════════════════════════════════════════════════════

import type {
  IncomeStatement,
  YearlyCashflow,
  ProjectInputs,
  CashFlowStatement,
  CashFlowStatementLine,
} from '@/engine/types';
import { usd, computeCosts } from '@/engine/fiscal/shared';

export function generateCashFlowStatement(
  incomeStatement: IncomeStatement,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): CashFlowStatement {
  const { costProfile } = project;
  let runningCash = 0;

  const yearly: CashFlowStatementLine[] = cashflows.map((cf, idx) => {
    const is = incomeStatement.yearly[idx]!;
    const cost = computeCosts(costProfile, cf.year);

    const openingCash = runningCash;

    // Operating: PBT + add back DD&A (non-cash) - tax paid
    const profitBeforeTax = is.profitBeforeTax as number;
    const depreciation = is.depreciationAmortisation as number;
    const workingCapitalChanges = 0;
    const taxPaid = is.taxExpense as number;
    const otherOperatingAdjustments = 0;
    const netOperatingCashFlow = profitBeforeTax + depreciation + workingCapitalChanges - taxPaid + otherOperatingAdjustments;

    // Investing
    const capexPPE = cost.totalCapex + cost.abandonmentCost;
    const capexExploration = 0;
    const disposalProceeds = 0;
    const otherInvesting = 0;
    const netInvestingCashFlow = -capexPPE - capexExploration + disposalProceeds + otherInvesting;

    // Financing (none for POC)
    const debtDrawdown = 0;
    const debtRepayment = 0;
    const dividendsPaid = 0;
    const otherFinancing = 0;
    const netFinancingCashFlow = debtDrawdown - debtRepayment - dividendsPaid + otherFinancing;

    const netCashChange = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;
    const closingCash = openingCash + netCashChange;
    runningCash = closingCash;

    return {
      year: cf.year,
      profitBeforeTax: usd(profitBeforeTax),
      depreciation: usd(depreciation),
      workingCapitalChanges: usd(workingCapitalChanges),
      taxPaid: usd(taxPaid),
      otherOperatingAdjustments: usd(otherOperatingAdjustments),
      netOperatingCashFlow: usd(netOperatingCashFlow),
      capexPPE: usd(capexPPE),
      capexExploration: usd(capexExploration),
      disposalProceeds: usd(disposalProceeds),
      otherInvesting: usd(otherInvesting),
      netInvestingCashFlow: usd(netInvestingCashFlow),
      debtDrawdown: usd(debtDrawdown),
      debtRepayment: usd(debtRepayment),
      dividendsPaid: usd(dividendsPaid),
      otherFinancing: usd(otherFinancing),
      netFinancingCashFlow: usd(netFinancingCashFlow),
      netCashChange: usd(netCashChange),
      openingCash: usd(openingCash),
      closingCash: usd(closingCash),
    };
  });

  return { yearly };
}
