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
 *  - flow:    divide equally across periods (revenue, tax, cash flow)
 *  - stock:   a year-END balance (closing balance, balance-sheet item):
 *             moves in equal steps from the prior year-end to this year-end,
 *             so the last period equals the annual figure
 *  - opening: a year-START balance: moves in equal steps from this value to
 *             the year's closing balance (pass `closingValues`; otherwise
 *             the next year's opening is used), so each period's opening
 *             equals the previous period's closing
 *  Straight-line flows and linearly-stepped balances reconcile: opening +
 *  the period's flows = closing, in every sub-period. */
export type RowKind = 'flow' | 'stock' | 'opening';

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

export function expandValues(
  values: readonly number[],
  g: PeriodGranularity,
  kind: RowKind = 'flow',
  closingValues?: readonly number[],
): number[] {
  if (g === 'year') return [...values];
  const n = periodsPerYear(g);
  const out: number[] = [];
  values.forEach((v, y) => {
    for (let i = 0; i < n; i++) {
      if (kind === 'flow') {
        out.push(v / n);
      } else if (kind === 'stock') {
        // First year's opening balance is taken as zero (new project).
        const prev = y > 0 ? values[y - 1]! : 0;
        out.push(prev + ((v - prev) * (i + 1)) / n);
      } else {
        const next = closingValues?.[y] ?? (y < values.length - 1 ? values[y + 1]! : v);
        out.push(v + ((next - v) * i) / n);
      }
    }
  });
  return out;
}
