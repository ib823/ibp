// ════════════════════════════════════════════════════════════════════════
// Portfolio valuation date
// ════════════════════════════════════════════════════════════════════════
//
// Project NPVs are discounted to each project's own start year, so they
// cannot be added up directly: Balingian (first year 2022) would be valued
// at 2022 including four years of already-realised cash flow, SK-410 at
// 2026, the rest at 2027. Portfolio figures therefore re-value every
// project at one common valuation year, forward-looking only — cash flows
// before that year are actuals (sunk) and are excluded.
// ════════════════════════════════════════════════════════════════════════

import type { EconomicsResult } from '@/engine/types';
import { calculateIRR } from './irr';

/** First year of the current planning cycle. Actuals are loaded through
 *  2025 (`data/versioned-data.ts`), so the 2026 plan is valued at 2026. */
export const DEFAULT_VALUATION_YEAR = 2026;

/**
 * NPV of a project's cash flows from `valuationYear` onward, discounted to
 * `valuationYear` with the same end-of-year convention as `calculateNPV`
 * (the valuation-year cash flow is undiscounted). A project starting after
 * the valuation year is discounted back to it.
 */
export function npvAtValuationYear(
  result: EconomicsResult,
  discountRate: number,
  valuationYear: number = DEFAULT_VALUATION_YEAR,
): number {
  let npv = 0;
  for (const cf of result.yearlyCashflows) {
    if (cf.year < valuationYear) continue;
    npv += (cf.netCashFlow as number) / Math.pow(1 + discountRate, cf.year - valuationYear);
  }
  return npv;
}

/** Sum project net cash flows by calendar year from `valuationYear` on. */
export function portfolioNcfSeries(
  results: Iterable<EconomicsResult>,
  valuationYear: number = DEFAULT_VALUATION_YEAR,
): { years: number[]; ncf: number[] } {
  const byYear = new Map<number, number>();
  for (const r of results) {
    for (const cf of r.yearlyCashflows) {
      if (cf.year < valuationYear) continue;
      byYear.set(cf.year, (byYear.get(cf.year) ?? 0) + (cf.netCashFlow as number));
    }
  }
  if (byYear.size === 0) return { years: [], ncf: [] };
  const last = Math.max(...byYear.keys());
  const years: number[] = [];
  const ncf: number[] = [];
  for (let y = valuationYear; y <= last; y++) {
    years.push(y);
    ncf.push(byYear.get(y) ?? 0);
  }
  return { years, ncf };
}

/** IRR of the combined forward portfolio cash flow (null when undefined).
 *  Unlike a capex-weighted average of project IRRs, this is the rate at
 *  which the portfolio's own NPV is zero. */
export function portfolioIrr(
  results: Iterable<EconomicsResult>,
  valuationYear: number = DEFAULT_VALUATION_YEAR,
): number | null {
  const { ncf } = portfolioNcfSeries(results, valuationYear);
  return calculateIRR(ncf);
}
