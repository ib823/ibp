// ════════════════════════════════════════════════════════════════════════
// Version Comparison Engine (FM-04)
// ════════════════════════════════════════════════════════════════════════
//
// Compare two data versions of the same project (e.g. Budget vs Forecast,
// Budget vs Actuals) and produce per-year variances plus a price/volume/
// cost decomposition of the total NCF variance.
// ════════════════════════════════════════════════════════════════════════

import type {
  EconomicsResult,
  PriceDeck,
  ProjectInputs,
  VersionComparisonResult,
  VersionedProjectData,
  YearlyCashflow,
  YearlyVariance,
} from '@/engine/types';
import { calculateProjectEconomics } from './cashflow';

/** Sum oil + gas (boe) production from a yearly cashflow row */
function ncfRevenue(cf: YearlyCashflow): number {
  return (cf.totalGrossRevenue as number) ?? 0;
}

/**
 * Apply versioned production/cost data to a project, returning a new
 * ProjectInputs ready for the calculator.
 */
export function applyVersionData(
  project: ProjectInputs,
  data: VersionedProjectData,
): ProjectInputs {
  return {
    ...project,
    productionProfile: data.productionProfile,
    costProfile: data.costProfile,
  };
}

/**
 * Sum total CAPEX from a CostProfile.
 */
function totalCapex(project: ProjectInputs): number {
  const cp = project.costProfile;
  let total = 0;
  for (const series of [
    cp.capexDrilling,
    cp.capexFacilities,
    cp.capexSubsea,
    cp.capexOther,
  ]) {
    for (const v of Object.values(series)) total += v as number;
  }
  return total;
}

/**
 * Sum total OPEX from a CostProfile.
 */
function totalOpex(project: ProjectInputs): number {
  const cp = project.costProfile;
  let total = 0;
  for (const v of Object.values(cp.opexFixed)) total += v as number;
  for (const v of Object.values(cp.opexVariable)) total += v as number;
  return total;
}

/** Total cumulative production in boe across all years (6 Mscf gas = 1 boe) */
function totalProductionBoe(project: ProjectInputs): number {
  const pp = project.productionProfile;
  let total = 0;
  for (const v of Object.values(pp.oil)) total += (v as number) * 365;
  for (const v of Object.values(pp.condensate)) total += (v as number) * 365;
  // gas MMscfd → boe: MMscf * 1000 = Mscf, ÷6 = boe
  for (const v of Object.values(pp.gas)) total += ((v as number) * 365 * 1000) / 6;
  return total;
}

/** Daily-rate production in boe/d for a given year */
function yearlyProductionBoeRate(
  project: ProjectInputs,
  year: number,
): number {
  const pp = project.productionProfile;
  const oil = (pp.oil[year] as number) ?? 0;
  const cond = (pp.condensate[year] as number) ?? 0;
  const gas = (pp.gas[year] as number) ?? 0;
  return oil + cond + (gas * 1000) / 6;
}

/** Sum CAPEX for a single year */
function yearlyCapex(project: ProjectInputs, year: number): number {
  const cp = project.costProfile;
  return (
    ((cp.capexDrilling[year] as number) ?? 0) +
    ((cp.capexFacilities[year] as number) ?? 0) +
    ((cp.capexSubsea[year] as number) ?? 0) +
    ((cp.capexOther[year] as number) ?? 0)
  );
}

/** Sum OPEX for a single year */
function yearlyOpex(project: ProjectInputs, year: number): number {
  const cp = project.costProfile;
  return ((cp.opexFixed[year] as number) ?? 0) + ((cp.opexVariable[year] as number) ?? 0);
}

/**
 * Build per-year variance rows by aligning the two cashflow streams on year.
 */
function buildYearlyVariances(
  proj1: ProjectInputs,
  proj2: ProjectInputs,
  result1: EconomicsResult,
  result2: EconomicsResult,
): YearlyVariance[] {
  const years = new Set<number>();
  for (const cf of result1.yearlyCashflows) years.add(cf.year);
  for (const cf of result2.yearlyCashflows) years.add(cf.year);

  const map1 = new Map(result1.yearlyCashflows.map((cf) => [cf.year, cf]));
  const map2 = new Map(result2.yearlyCashflows.map((cf) => [cf.year, cf]));

  const result: YearlyVariance[] = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    const cf1 = map1.get(year);
    const cf2 = map2.get(year);
    const revB = cf1 ? ncfRevenue(cf1) : 0;
    const revA = cf2 ? ncfRevenue(cf2) : 0;
    const capexB = yearlyCapex(proj1, year);
    const capexA = yearlyCapex(proj2, year);
    const opexB = yearlyOpex(proj1, year);
    const opexA = yearlyOpex(proj2, year);
    const ncfB = cf1 ? (cf1.netCashFlow as number) : 0;
    const ncfA = cf2 ? (cf2.netCashFlow as number) : 0;
    const prodB = yearlyProductionBoeRate(proj1, year);
    const prodA = yearlyProductionBoeRate(proj2, year);

    result.push({
      year,
      revenueBudget: revB,
      revenueActual: revA,
      revenueVariance: revA - revB,
      revenueVariancePct: revB !== 0 ? ((revA - revB) / Math.abs(revB)) * 100 : 0,
      capexBudget: capexB,
      capexActual: capexA,
      capexVariance: capexA - capexB,
      opexBudget: opexB,
      opexActual: opexA,
      opexVariance: opexA - opexB,
      ncfBudget: ncfB,
      ncfActual: ncfA,
      ncfVariance: ncfA - ncfB,
      productionBudget: prodB,
      productionActual: prodA,
      productionVariance: prodA - prodB,
    });
  }
  return result;
}

/**
 * Compare two versioned data sets and return a complete comparison result.
 *
 * The variance decomposition uses a standard price/volume/cost split:
 *   priceVariance  = (price2 - price1) × volume2  ≈ revenue2 - revenue1 with volume held at version2
 *   volumeVariance = (volume2 - volume1) × price1 ≈ revenue contribution of changed volume at version1 prices
 *   costVariance   = (cost1 + opex1) - (cost2 + opex2)
 *
 * Because prices come from the SAME priceDeck for both versions in this POC
 * (the data version overrides only production and costs), the priceVariance
 * is 0 by construction. Volume and cost variances dominate.
 */
export function compareVersions(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  version1Data: VersionedProjectData,
  version2Data: VersionedProjectData,
): VersionComparisonResult {
  const proj1 = applyVersionData(project, version1Data);
  const proj2 = applyVersionData(project, version2Data);

  const result1 = calculateProjectEconomics(proj1, priceDeck, version1Data.scenarioVersion);
  const result2 = calculateProjectEconomics(proj2, priceDeck, version2Data.scenarioVersion);

  const yearlyVariances = buildYearlyVariances(proj1, proj2, result1, result2);

  // Decomposition (POC: prices identical, so priceVariance = 0)
  const totalRevenueDelta = (result2.totalRevenue as number) - (result1.totalRevenue as number);
  const totalCostDelta =
    (totalCapex(proj2) - totalCapex(proj1)) + (totalOpex(proj2) - totalOpex(proj1));
  const priceVariance = 0;
  const volumeVariance = totalRevenueDelta;
  const costVariance = -totalCostDelta;

  return {
    projectId: project.project.id,
    version1: version1Data.dataVersion,
    version2: version2Data.dataVersion,
    yearlyVariances,
    npvVariance: (result2.npv10 as number) - (result1.npv10 as number),
    irrVariance:
      result2.irr !== null && result1.irr !== null ? result2.irr - result1.irr : null,
    capexVariance: (result2.totalCapex as number) - (result1.totalCapex as number),
    productionVariance: totalProductionBoe(proj2) - totalProductionBoe(proj1),
    revenueVariance: totalRevenueDelta,
    priceVariance,
    volumeVariance,
    costVariance,
  };
}
