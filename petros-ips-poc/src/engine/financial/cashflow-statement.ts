// ════════════════════════════════════════════════════════════════════════
// Cash Flow Statement Generator (MFRS 107, indirect method)
// ════════════════════════════════════════════════════════════════════════
//
// Operating: profit before tax + non-cash items (DD&A, E&E write-off,
// provision unwinding) − tax paid. Investing: capex (PP&E and E&E) and
// decommissioning spend. The net change equals the fiscal net cash flow,
// so closing cash ties to the balance sheet.
// ════════════════════════════════════════════════════════════════════════

import type {
  IncomeStatement,
  YearlyCashflow,
  ProjectInputs,
  CashFlowStatement,
  CashFlowStatementLine,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { accountingDrivers } from './accounting-drivers';

export function generateCashFlowStatement(
  incomeStatement: IncomeStatement,
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): CashFlowStatement {
  const drivers = accountingDrivers(cashflows, project);
  let runningCash = 0;

  const yearly: CashFlowStatementLine[] = drivers.years.map((d, idx) => {
    const is = incomeStatement.yearly[idx]!;
    const openingCash = runningCash;

    // Operating: PBT + non-cash charges − tax paid (current tax only)
    const profitBeforeTax = is.profitBeforeTax as number;
    const depreciation = is.depreciationAmortisation as number;
    const workingCapitalChanges = 0;
    const taxPaid = d.currentTax;
    const otherOperatingAdjustments = d.eeWrittenOff + d.unwinding;
    const netOperatingCashFlow =
      profitBeforeTax + depreciation + workingCapitalChanges - taxPaid + otherOperatingAdjustments;

    // Investing: capex split between PP&E and E&E; decommissioning spend
    const capexExploration = d.eeAdditions;
    const capexPPE = d.capex - d.eeAdditions;
    const disposalProceeds = 0;
    const otherInvesting = -d.abandonmentSpend;
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
      year: d.year,
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
