// ════════════════════════════════════════════════════════════════════════
// Income Statement Generator
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  IncomeStatementLine,
} from '@/engine/types';
import { usd, computeCosts } from '@/engine/fiscal/shared';

/**
 * Generate income statement from fiscal cashflows and project inputs.
 * DD&A uses straight-line over remaining field life from each CAPEX year.
 */
export function generateIncomeStatement(
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
): IncomeStatement {
  const { costProfile, project: proj } = project;
  const fieldLife = proj.endYear - proj.startYear + 1;

  // Build cumulative CAPEX and DD&A schedule
  // Each year's CAPEX depreciates straight-line over remaining field life
  const ddaByYear: number[] = new Array(cashflows.length).fill(0);
  for (let i = 0; i < cashflows.length; i++) {
    const year = cashflows[i]!.year;
    const cost = computeCosts(costProfile, year);
    const capex = cost.totalCapex;
    if (capex > 0) {
      const remainingLife = fieldLife - i;
      if (remainingLife > 0) {
        const annualDda = capex / remainingLife;
        for (let j = i; j < cashflows.length; j++) {
          ddaByYear[j]! += annualDda;
        }
      }
    }
  }

  const yearly: IncomeStatementLine[] = cashflows.map((cf, idx) => {
    const cost = computeCosts(costProfile, cf.year);
    const revenue = cf.totalGrossRevenue as number;
    const royaltyExpense = cf.royalty as number;
    const costOfSales = cost.totalOpex + cost.abandonmentCost;
    const grossProfit = revenue - royaltyExpense - costOfSales;
    const dda = ddaByYear[idx]!;
    const explorationExpense = 0; // Simplified for POC
    const adminExpense = 0;
    const otherOperatingIncome = 0;
    const operatingProfit = grossProfit - dda - explorationExpense - adminExpense + otherOperatingIncome;
    const financeIncome = 0;
    const financeCost = 0;
    const profitBeforeTax = operatingProfit + financeIncome - financeCost;
    const taxExpense = cf.pitaTax as number;
    const profitAfterTax = profitBeforeTax - taxExpense;

    return {
      year: cf.year,
      revenue: usd(revenue),
      costOfSales: usd(costOfSales),
      grossProfit: usd(grossProfit),
      explorationExpense: usd(explorationExpense),
      depreciationAmortisation: usd(dda),
      adminExpense: usd(adminExpense),
      otherOperatingIncome: usd(otherOperatingIncome),
      operatingProfit: usd(operatingProfit),
      financeIncome: usd(financeIncome),
      financeCost: usd(financeCost),
      profitBeforeTax: usd(profitBeforeTax),
      taxExpense: usd(taxExpense),
      profitAfterTax: usd(profitAfterTax),
    };
  });

  return { yearly };
}
