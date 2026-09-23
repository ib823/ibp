// ════════════════════════════════════════════════════════════════════════
// Income Statement Generator
// ════════════════════════════════════════════════════════════════════════
//
// Contractor's working-interest P&L on the entitlement method — see
// accounting-drivers.ts for the recognition rules shared with the balance
// sheet, cash flow statement and roll-forwards.
// ════════════════════════════════════════════════════════════════════════

import type {
  YearlyCashflow,
  ProjectInputs,
  IncomeStatement,
  IncomeStatementLine,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import {
  accountingDrivers,
  netDeferredTax,
  ppeClosingBalances,
  type AccountingDrivers,
} from './accounting-drivers';

/** DD&A method per MFRS 116 §60-62.
 *  - 'straight-line' (default): each addition depreciated evenly from the
 *    year the asset is available for use to the end of field life
 *  - 'unit-of-production' (SPE upstream standard): DD&Aₜ = (Productionₜ /
 *    remaining reserves) × (opening NBV + additions). Better tracks asset
 *    consumption pattern.
 *  See ASSESSMENT.md FS1 / D31. */
export type DdaMethod = 'straight-line' | 'unit-of-production';

export interface IncomeStatementOptions {
  readonly ddaMethod?: DdaMethod;
  /** For `ddaMethod === 'unit-of-production'`: booked reserves (BOE) at the
   *  start of project life, e.g. PRMS 2P. If they are lower than the
   *  production the plan assumes, the plan's production is used as the
   *  depletion base so the asset is not written off before production
   *  ends. Omit to deplete over the plan's production. */
  readonly totalReservesBoe?: number;
}

/**
 * Generate the income statement from fiscal cashflows and project inputs.
 */
export function generateIncomeStatement(
  cashflows: readonly YearlyCashflow[],
  project: ProjectInputs,
  options: IncomeStatementOptions = {},
): IncomeStatement {
  const drivers = accountingDrivers(cashflows, project);
  const dda = computeDda(drivers, cashflows, options);
  const deferred = netDeferredTax(drivers, ppeClosingBalances(drivers, dda));

  const yearly: IncomeStatementLine[] = drivers.years.map((d, idx) => {
    const revenue = d.revenue;
    const costOfSales = d.costOfSales;
    const grossProfit = revenue - costOfSales;
    const explorationExpense = d.eeWrittenOff;
    const depreciation = dda[idx]!;
    const adminExpense = 0;
    const otherOperatingIncome = 0;
    const operatingProfit = grossProfit - depreciation - explorationExpense - adminExpense + otherOperatingIncome;
    const financeIncome = 0;
    // Unwinding of the decommissioning discount (MFRS 137 §60)
    const financeCost = d.unwinding;
    const profitBeforeTax = operatingProfit + financeIncome - financeCost;
    // Current tax + movement in deferred tax (MFRS 112 §58)
    const deferredTaxExpense = deferred[idx]! - (idx > 0 ? deferred[idx - 1]! : 0);
    const taxExpense = d.currentTax + deferredTaxExpense;
    const profitAfterTax = profitBeforeTax - taxExpense;

    return {
      year: d.year,
      revenue: usd(revenue),
      costOfSales: usd(costOfSales),
      grossProfit: usd(grossProfit),
      explorationExpense: usd(explorationExpense),
      depreciationAmortisation: usd(depreciation),
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

function computeDda(
  drivers: AccountingDrivers,
  cashflows: readonly YearlyCashflow[],
  options: IncomeStatementOptions,
): number[] {
  const production = cashflows.map((cf, i) =>
    Math.max(0, (cf.cumulativeProduction as number) - (i > 0 ? (cashflows[i - 1]!.cumulativeProduction as number) : 0)),
  );
  const totalProduction = production.reduce((s, p) => s + p, 0);
  if (options.ddaMethod === 'unit-of-production' && totalProduction > 0) {
    return unitOfProductionDda(drivers, production, Math.max(options.totalReservesBoe ?? 0, totalProduction));
  }
  return straightLineDda(drivers);
}

/** Each year's additions depreciate evenly from the later of the addition
 *  year and the first year of availability to the end of field life. */
function straightLineDda(drivers: AccountingDrivers): number[] {
  const n = drivers.years.length;
  const dda: number[] = new Array<number>(n).fill(0);
  drivers.years.forEach((d, i) => {
    const additions = d.ppeCapexAdditions + d.aroAddition;
    if (additions <= 0) return;
    const start = Math.max(i, drivers.firstAvailableIdx);
    const years = n - start;
    for (let j = start; j < n; j++) dda[j]! += additions / years;
  });
  return dda;
}

/** DD&Aₜ = (opening NBV + additions) × productionₜ / remaining reserves. */
function unitOfProductionDda(
  drivers: AccountingDrivers,
  production: readonly number[],
  depletionBase: number,
): number[] {
  let nbv = 0;
  let produced = 0;
  return drivers.years.map((d, i) => {
    nbv += d.ppeCapexAdditions + d.aroAddition;
    const remaining = depletionBase - produced;
    const rate = remaining > 0 ? Math.min(1, production[i]! / remaining) : 0;
    // Anything left in the final year is fully depreciated.
    const dda = i === drivers.years.length - 1 ? nbv : nbv * rate;
    nbv -= dda;
    produced += production[i]!;
    return dda;
  });
}
