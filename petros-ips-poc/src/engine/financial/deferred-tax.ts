// ════════════════════════════════════════════════════════════════════════
// Deferred Tax — MFRS 112 Income Taxes
//
// Recognises the temporary difference between BOOK depreciation
// (vintaged straight-line over remaining field life — see income-statement.ts)
// and TAX capital allowance (5-year SL — see psc-rc.ts CAPEX_DEPRECIATION_YEARS),
// and tracks the resulting deferred-tax liability (DTL) roll-forward.
//
// Mechanic per MFRS 112 §15-20:
//   1. Book DD&A < Tax CA in early years → tax base (NBV_tax) drops faster
//      than carrying amount (NBV_book) → taxable temporary difference grows
//      → DTL grows (charged to deferred tax expense in P&L)
//   2. Book DD&A > Tax CA in late years → reverse: DTL shrinks (deferred
//      tax credit in P&L)
//   3. DTL = (NBV_book − NBV_tax) × tax rate
//
// Reference: MFRS 112 (Income Taxes), Sections 15-20 and 47-52.
// ════════════════════════════════════════════════════════════════════════

import type { CostProfile, IncomeStatement, USD } from '@/engine/types';
import { getVal, usd, CAPEX_DEPRECIATION_YEARS } from '@/engine/fiscal/shared';

export interface DeferredTaxEntry {
  readonly year: number;
  /** Book NBV: accumulated CAPEX − accumulated book DD&A (vintaged SL) */
  readonly nbvBook: USD;
  /** Tax NBV: accumulated CAPEX − accumulated capital allowance (5-yr SL) */
  readonly nbvTax: USD;
  /** Temporary difference = NBV_book − NBV_tax. Positive → taxable diff → DTL. */
  readonly temporaryDifference: USD;
  /** DTL = temporary diff × applicable tax rate (PITA 38% for PSC, 24% downstream). */
  readonly deferredTaxLiability: USD;
  /** Movement in DTL this year (positive = expense to P&L; negative = credit). */
  readonly deferredTaxMovement: USD;
}

/**
 * Build the deferred-tax schedule for a project.
 *
 * @param costProfile  Project cost profile (provides CAPEX vintages).
 * @param incomeStatement  Already-generated income statement (provides book DD&A).
 * @param startYear / endYear  Project life range.
 * @param taxRate  Applicable tax rate (PITA 0.38 for PSC; 0.24 for downstream).
 */
export function generateDeferredTaxSchedule(
  costProfile: CostProfile,
  incomeStatement: IncomeStatement,
  startYear: number,
  endYear: number,
  taxRate: number,
): DeferredTaxEntry[] {
  const schedule: DeferredTaxEntry[] = [];
  let cumCapex = 0;
  let cumBookDda = 0;
  let priorDtl = 0;

  // Build tax-side capital allowance schedule (5-yr SL per vintage)
  const taxAllowanceByYear = new Map<number, number>();
  for (let y = startYear; y <= endYear; y++) {
    const capex =
      getVal(costProfile.capexDrilling, y) +
      getVal(costProfile.capexFacilities, y) +
      getVal(costProfile.capexSubsea, y) +
      getVal(costProfile.capexOther, y);
    if (capex > 0) {
      const annual = capex / CAPEX_DEPRECIATION_YEARS;
      for (let offset = 0; offset < CAPEX_DEPRECIATION_YEARS; offset++) {
        const year = y + offset;
        if (year > endYear) continue;
        taxAllowanceByYear.set(year, (taxAllowanceByYear.get(year) ?? 0) + annual);
      }
    }
  }

  let cumTaxCa = 0;

  for (let i = 0; i < incomeStatement.yearly.length; i++) {
    const isLine = incomeStatement.yearly[i]!;
    const year = isLine.year;

    const yearCapex =
      getVal(costProfile.capexDrilling, year) +
      getVal(costProfile.capexFacilities, year) +
      getVal(costProfile.capexSubsea, year) +
      getVal(costProfile.capexOther, year);

    cumCapex += yearCapex;
    cumBookDda += isLine.depreciationAmortisation as number;
    cumTaxCa += taxAllowanceByYear.get(year) ?? 0;

    const nbvBook = Math.max(0, cumCapex - cumBookDda);
    const nbvTax = Math.max(0, cumCapex - cumTaxCa);
    const temporaryDifference = nbvBook - nbvTax;
    const dtl = Math.max(0, temporaryDifference * taxRate);
    const movement = dtl - priorDtl;

    schedule.push({
      year,
      nbvBook: usd(nbvBook),
      nbvTax: usd(nbvTax),
      temporaryDifference: usd(temporaryDifference),
      deferredTaxLiability: usd(dtl),
      deferredTaxMovement: usd(movement),
    });

    priorDtl = dtl;
  }

  return schedule;
}
