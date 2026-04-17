// ════════════════════════════════════════════════════════════════════════
// Period Granularity — expand annual series into quarters / months
//
// Used by Financial Statements and forecast tables to offer a Year /
// Quarter / Month toggle. For the POC, quarterly and monthly values are
// derived straight-line from annual figures; the production SAC
// implementation will derive them from accrual-based monthly close
// journals in SAP S/4HANA.
// ════════════════════════════════════════════════════════════════════════

export type PeriodGranularity = 'year' | 'quarter' | 'month';

/** How a row's annual total maps onto sub-annual periods.
 *  - flow:  divide equally across periods (revenue, tax, cash flow)
 *  - stock: repeat the year-end value across each period (balance-sheet items) */
export type RowKind = 'flow' | 'stock';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function periodsPerYear(g: PeriodGranularity): number {
  return g === 'year' ? 1 : g === 'quarter' ? 4 : 12;
}

export function expandYearLabels(years: readonly number[], g: PeriodGranularity): string[] {
  if (g === 'year') return years.map((y) => String(y));
  const out: string[] = [];
  if (g === 'quarter') {
    for (const y of years) {
      const suffix = String(y).slice(-2);
      for (let q = 1; q <= 4; q++) out.push(`Q${q}-${suffix}`);
    }
    return out;
  }
  // month
  for (const y of years) {
    const suffix = String(y).slice(-2);
    for (let m = 0; m < 12; m++) out.push(`${MONTH_ABBR[m]}-${suffix}`);
  }
  return out;
}

export function expandValues(values: readonly number[], g: PeriodGranularity, kind: RowKind = 'flow'): number[] {
  if (g === 'year') return [...values];
  const n = periodsPerYear(g);
  const out: number[] = [];
  for (const v of values) {
    const per = kind === 'flow' ? v / n : v;
    for (let i = 0; i < n; i++) out.push(per);
  }
  return out;
}
