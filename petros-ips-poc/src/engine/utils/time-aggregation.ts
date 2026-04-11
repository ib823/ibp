// ════════════════════════════════════════════════════════════════════════
// Time Granularity Aggregation (DF-02)
// ════════════════════════════════════════════════════════════════════════
//
// Convert between monthly, quarterly, and yearly views of production and
// cost data. Used by the UI to switch table granularity. The fiscal engine
// itself always operates at yearly granularity (PSC R/C, cost recovery,
// and profit split are computed annually) — these aggregations are
// display-only.
// ════════════════════════════════════════════════════════════════════════

import type {
  CostProfile,
  MonthlyCostEntry,
  MonthlyCostProfile,
  MonthlyProductionEntry,
  MonthlyProductionProfile,
  ProductionProfile,
  TimeGranularity,
  TimeSeriesData,
  USD,
} from '@/engine/types';

const usd = (n: number): USD => (Math.round(n * 100) / 100) as USD;

// ── Yearly → Monthly (synthetic) ───────────────────────────────────────

/**
 * Spread yearly daily-rate production evenly across 12 months.
 * Each month within a given year inherits the same daily rate
 * (this is a POC simplification; in production each month would have
 * its own measured rate).
 */
export function yearlyProductionToMonthly(
  yearly: ProductionProfile,
): MonthlyProductionProfile {
  const monthly: MonthlyProductionEntry[] = [];
  const years = new Set<number>([
    ...Object.keys(yearly.oil).map(Number),
    ...Object.keys(yearly.gas).map(Number),
    ...Object.keys(yearly.condensate).map(Number),
  ]);

  for (const year of [...years].sort((a, b) => a - b)) {
    for (let month = 1; month <= 12; month++) {
      monthly.push({
        year,
        month,
        oilBpd: yearly.oil[year] ?? 0,
        gasMmscfd: yearly.gas[year] ?? 0,
        condensateBpd: yearly.condensate[year] ?? 0,
      });
    }
  }
  return { monthly };
}

/**
 * Spread yearly costs evenly across 12 months.
 * CAPEX/OPEX/ABEX are divided by 12 (cumulative-cost simplification).
 */
export function yearlyCostsToMonthly(
  yearly: CostProfile,
): MonthlyCostProfile {
  const monthly: MonthlyCostEntry[] = [];
  const years = new Set<number>([
    ...Object.keys(yearly.capexDrilling).map(Number),
    ...Object.keys(yearly.capexFacilities).map(Number),
    ...Object.keys(yearly.capexSubsea).map(Number),
    ...Object.keys(yearly.capexOther).map(Number),
    ...Object.keys(yearly.opexFixed).map(Number),
    ...Object.keys(yearly.opexVariable).map(Number),
    ...Object.keys(yearly.abandonmentCost).map(Number),
  ]);

  for (const year of [...years].sort((a, b) => a - b)) {
    const yearlyCapex =
      ((yearly.capexDrilling[year] as number) ?? 0) +
      ((yearly.capexFacilities[year] as number) ?? 0) +
      ((yearly.capexSubsea[year] as number) ?? 0) +
      ((yearly.capexOther[year] as number) ?? 0);
    const opexF = (yearly.opexFixed[year] as number) ?? 0;
    const opexV = (yearly.opexVariable[year] as number) ?? 0;
    const abex = (yearly.abandonmentCost[year] as number) ?? 0;

    for (let month = 1; month <= 12; month++) {
      monthly.push({
        year,
        month,
        capex: usd(yearlyCapex / 12),
        opexFixed: usd(opexF / 12),
        opexVariable: usd(opexV / 12),
        abandonmentCost: usd(abex / 12),
      });
    }
  }
  return { monthly };
}

// ── Monthly → Yearly ────────────────────────────────────────────────────

/**
 * Aggregate monthly production back to yearly daily-rate.
 * Production rate (bpd, MMscfd) is averaged across the months in a year.
 */
export function monthlyProductionToYearly(
  monthly: MonthlyProductionProfile,
): ProductionProfile {
  const oil: TimeSeriesData<number> = {};
  const gas: TimeSeriesData<number> = {};
  const cond: TimeSeriesData<number> = {};
  const water: TimeSeriesData<number> = {};
  const counts: Record<number, number> = {};

  for (const e of monthly.monthly) {
    oil[e.year] = (oil[e.year] ?? 0) + e.oilBpd;
    gas[e.year] = (gas[e.year] ?? 0) + e.gasMmscfd;
    cond[e.year] = (cond[e.year] ?? 0) + e.condensateBpd;
    counts[e.year] = (counts[e.year] ?? 0) + 1;
  }
  for (const yKey of Object.keys(counts)) {
    const y = Number(yKey);
    const n = counts[y] ?? 12;
    oil[y] = (oil[y] ?? 0) / n;
    gas[y] = (gas[y] ?? 0) / n;
    cond[y] = (cond[y] ?? 0) / n;
    water[y] = 0;
  }
  return { oil, gas, condensate: cond, water };
}

// ── Quarterly view ──────────────────────────────────────────────────────

export interface QuarterlyProductionEntry {
  readonly year: number;
  readonly quarter: number; // 1-4
  readonly oilBpd: number;
  readonly gasMmscfd: number;
  readonly condensateBpd: number;
}

/**
 * Aggregate monthly production to quarterly daily-rate.
 * Daily rates are averaged across the 3 months in each quarter.
 */
export function aggregateToQuarterly(
  monthly: MonthlyProductionProfile,
): QuarterlyProductionEntry[] {
  const buckets = new Map<string, { oil: number; gas: number; cond: number; n: number }>();

  for (const e of monthly.monthly) {
    const q = Math.ceil(e.month / 3);
    const key = `${e.year}-${q}`;
    const cur = buckets.get(key) ?? { oil: 0, gas: 0, cond: 0, n: 0 };
    cur.oil += e.oilBpd;
    cur.gas += e.gasMmscfd;
    cur.cond += e.condensateBpd;
    cur.n += 1;
    buckets.set(key, cur);
  }

  const result: QuarterlyProductionEntry[] = [];
  for (const [key, v] of buckets) {
    const [yStr, qStr] = key.split('-');
    result.push({
      year: Number(yStr),
      quarter: Number(qStr),
      oilBpd: v.oil / v.n,
      gasMmscfd: v.gas / v.n,
      condensateBpd: v.cond / v.n,
    });
  }
  return result.sort((a, b) =>
    a.year === b.year ? a.quarter - b.quarter : a.year - b.year,
  );
}

// ── Generic dispatcher ──────────────────────────────────────────────────

export interface AggregatedProductionRow {
  readonly label: string;     // "2025", "2025 Q1", "2025-01"
  readonly year: number;
  readonly periodIndex: number; // 0-11 for month, 0-3 for quarter, 0 for year
  readonly oilBpd: number;
  readonly gasMmscfd: number;
  readonly condensateBpd: number;
}

/**
 * Aggregate a monthly profile to the requested granularity, returning a
 * label-friendly array suitable for table rendering.
 */
export function aggregateProduction(
  monthly: MonthlyProductionProfile,
  granularity: TimeGranularity,
): AggregatedProductionRow[] {
  if (granularity === 'monthly') {
    return monthly.monthly.map((m) => ({
      label: `${m.year}-${String(m.month).padStart(2, '0')}`,
      year: m.year,
      periodIndex: m.month - 1,
      oilBpd: m.oilBpd,
      gasMmscfd: m.gasMmscfd,
      condensateBpd: m.condensateBpd,
    }));
  }

  if (granularity === 'quarterly') {
    return aggregateToQuarterly(monthly).map((q) => ({
      label: `${q.year} Q${q.quarter}`,
      year: q.year,
      periodIndex: q.quarter - 1,
      oilBpd: q.oilBpd,
      gasMmscfd: q.gasMmscfd,
      condensateBpd: q.condensateBpd,
    }));
  }

  // Yearly
  const yearly = monthlyProductionToYearly(monthly);
  const years = Object.keys(yearly.oil).map(Number).sort((a, b) => a - b);
  return years.map((year) => ({
    label: String(year),
    year,
    periodIndex: 0,
    oilBpd: yearly.oil[year] ?? 0,
    gasMmscfd: yearly.gas[year] ?? 0,
    condensateBpd: yearly.condensate[year] ?? 0,
  }));
}
