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

/** DD&A method per MFRS 116 §60-62.
 *  - 'straight-line' (default, backward-compatible): vintaged SL over remaining field life
 *  - 'unit-of-production' (SPE upstream standard): DD&Aₜ = (Productionₜ / Total Reserves)
 *    × NBV at start of year. Better tracks asset consumption pattern.
 *  See ASSESSMENT.md FS1 / D31. */
export type DdaMethod = 'straight-line' | 'unit-of-production';

export interface IncomeStatementOptions {
  readonly ddaMethod?: DdaMethod;
  /** Required when `ddaMethod === 'unit-of-production'`. Total proved + probable
   *  reserves at start of project life, in BOE. Sourced from the reserves engine. */
  readonly totalReservesBoe?: number;
}

/**
 * Generate income statement from fiscal cashflows and project inputs.
 *
 * Default DD&A: vintaged straight-line over remaining field life (each CAPEX year
 * depreciates from its own vintage forward to end-of-life). UoP option available
 * via `options.ddaMethod = 'unit-of-production'` with `totalReservesBoe` supplied.
 */
export function generateIncomeStatement(
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
  options: IncomeStatementOptions = {},
): IncomeStatement {
  const { costProfile, project: proj } = project;
  const fieldLife = proj.endYear - proj.startYear + 1;
  const ddaMethod: DdaMethod = options.ddaMethod ?? 'straight-line';

  const ddaByYear: number[] = new Array(cashflows.length).fill(0);

  if (ddaMethod === 'unit-of-production') {
    // UoP: DD&Aₜ = (Productionₜ / Total Reserves) × NBV at start of year.
    // Falls back to straight-line if total-reserves not provided.
    const totalReserves = options.totalReservesBoe;
    if (totalReserves && totalReserves > 0) {
      let cumulativeCapex = 0;
      let cumulativeDda = 0;
      for (let i = 0; i < cashflows.length; i++) {
        const cf = cashflows[i]!;
        const cost = computeCosts(costProfile, cf.year);
        cumulativeCapex += cost.totalCapex;
        const nbv = Math.max(0, cumulativeCapex - cumulativeDda);
        // cumulativeProduction is monotonic; compute year delta
        const prevProd = i > 0 ? cashflows[i - 1]!.cumulativeProduction : 0;
        const yearProd = Math.max(0, cf.cumulativeProduction - prevProd);
        const remainingReserves = Math.max(yearProd, totalReserves - prevProd);
        const dda = nbv > 0 && remainingReserves > 0 ? (yearProd / remainingReserves) * nbv : 0;
        ddaByYear[i] = dda;
        cumulativeDda += dda;
      }
    } else {
      // Fall back to SL if reserves not supplied
      computeStraightLineDda(ddaByYear, cashflows, costProfile, fieldLife);
    }
  } else {
    computeStraightLineDda(ddaByYear, cashflows, costProfile, fieldLife);
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

function computeStraightLineDda(
  ddaByYear: number[],
  cashflows: readonly YearlyCashflow[],
  costProfile: ProjectInputs['costProfile'],
  fieldLife: number,
): void {
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
}
