// ════════════════════════════════════════════════════════════════════════
// Sample Versioned Project Data (FM-04)
// ════════════════════════════════════════════════════════════════════════
//
// For each project we maintain multiple data versions (Budget, Forecast,
// Actuals, Working) so the user can compare planning submissions and run
// gap analysis. Budget always mirrors the canonical sample data; the other
// versions are derived by applying scaling factors.
// ════════════════════════════════════════════════════════════════════════

import type {
  CostProfile,
  DataVersion,
  ProductionProfile,
  ProjectInputs,
  TimeSeriesData,
  USD,
  VersionedProjectData,
} from '@/engine/types';
import { ALL_PROJECTS } from './projects';

const usd = (n: number): USD => (Math.round(n * 100) / 100) as USD;

// ── Helpers ────────────────────────────────────────────────────────────

function scaleNumberSeries(
  series: TimeSeriesData<number>,
  factor: number,
): TimeSeriesData<number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(series)) {
    out[Number(k)] = (v as number) * factor;
  }
  return out;
}

function scaleUsdSeries(
  series: TimeSeriesData<USD>,
  factor: number,
): TimeSeriesData<USD> {
  const out: Record<number, USD> = {};
  for (const [k, v] of Object.entries(series)) {
    out[Number(k)] = usd((v as number) * factor);
  }
  return out;
}

function scaleProduction(
  pp: ProductionProfile,
  factor: number,
): ProductionProfile {
  return {
    oil: scaleNumberSeries(pp.oil, factor),
    gas: scaleNumberSeries(pp.gas, factor),
    condensate: scaleNumberSeries(pp.condensate, factor),
    water: scaleNumberSeries(pp.water, factor),
  };
}

function scaleCosts(
  cp: CostProfile,
  capexFactor: number,
  opexFactor: number,
): CostProfile {
  return {
    capexDrilling: scaleUsdSeries(cp.capexDrilling, capexFactor),
    capexFacilities: scaleUsdSeries(cp.capexFacilities, capexFactor),
    capexSubsea: scaleUsdSeries(cp.capexSubsea, capexFactor),
    capexOther: scaleUsdSeries(cp.capexOther, capexFactor),
    opexFixed: scaleUsdSeries(cp.opexFixed, opexFactor),
    opexVariable: scaleUsdSeries(cp.opexVariable, opexFactor),
    abandonmentCost: cp.abandonmentCost,
  };
}

/**
 * Truncate production and cost profiles to a specific year range,
 * representing only historical years (used for "actuals" version).
 */
function truncateToYears(
  pp: ProductionProfile,
  cp: CostProfile,
  fromYear: number,
  toYear: number,
): { pp: ProductionProfile; cp: CostProfile } {
  const filterNumber = (s: TimeSeriesData<number>): TimeSeriesData<number> => {
    const out: Record<number, number> = {};
    for (const [k, v] of Object.entries(s)) {
      const y = Number(k);
      if (y >= fromYear && y <= toYear) out[y] = v as number;
    }
    return out;
  };
  const filterUsd = (s: TimeSeriesData<USD>): TimeSeriesData<USD> => {
    const out: Record<number, USD> = {};
    for (const [k, v] of Object.entries(s)) {
      const y = Number(k);
      if (y >= fromYear && y <= toYear) out[y] = v as USD;
    }
    return out;
  };
  return {
    pp: {
      oil: filterNumber(pp.oil),
      gas: filterNumber(pp.gas),
      condensate: filterNumber(pp.condensate),
      water: filterNumber(pp.water),
    },
    cp: {
      capexDrilling: filterUsd(cp.capexDrilling),
      capexFacilities: filterUsd(cp.capexFacilities),
      capexSubsea: filterUsd(cp.capexSubsea),
      capexOther: filterUsd(cp.capexOther),
      opexFixed: filterUsd(cp.opexFixed),
      opexVariable: filterUsd(cp.opexVariable),
      abandonmentCost: filterUsd(cp.abandonmentCost),
    },
  };
}

// ── Per-project version generators ─────────────────────────────────────

function buildBudget(project: ProjectInputs): VersionedProjectData {
  return {
    projectId: project.project.id,
    dataVersion: 'budget',
    scenarioVersion: 'base',
    status: 'approved',
    lastModified: '2026-01-15',
    modifiedBy: 'M. Karim (Planning)',
    productionProfile: project.productionProfile,
    costProfile: project.costProfile,
  };
}

function buildForecast(project: ProjectInputs): VersionedProjectData {
  return {
    projectId: project.project.id,
    dataVersion: 'forecast',
    scenarioVersion: 'base',
    status: 'submitted',
    lastModified: '2026-04-01',
    modifiedBy: 'A. Hakim (FP&A)',
    productionProfile: scaleProduction(project.productionProfile, 0.97),
    costProfile: scaleCosts(project.costProfile, 1.08, 1.02),
  };
}

function buildActualsForBalingian(project: ProjectInputs): VersionedProjectData {
  // Balingian started producing in 2022; we have actuals 2022-2025.
  const truncated = truncateToYears(
    project.productionProfile,
    project.costProfile,
    2022,
    2025,
  );
  return {
    projectId: project.project.id,
    dataVersion: 'actuals',
    scenarioVersion: 'base',
    status: 'approved',
    lastModified: '2026-02-28',
    modifiedBy: 'SAP S/4HANA Sync',
    productionProfile: scaleProduction(truncated.pp, 0.94), // 6% below forecast
    costProfile: scaleCosts(truncated.cp, 1.0, 1.04),       // 4% OPEX overrun
  };
}

function buildWorkingForSk410(project: ProjectInputs): VersionedProjectData {
  return {
    projectId: project.project.id,
    dataVersion: 'working',
    scenarioVersion: 'base',
    status: 'open',
    lastModified: '2026-04-08',
    modifiedBy: 'L. Tan (Reservoir)',
    productionProfile: scaleProduction(project.productionProfile, 1.10),
    costProfile: scaleCosts(project.costProfile, 0.95, 1.0),
  };
}

// ── Build the full versioned-data registry ─────────────────────────────

/**
 * Map<projectId, Map<DataVersion, VersionedProjectData>>
 *
 * Every project has at minimum a Budget and a Forecast version.
 * Balingian additionally has Actuals.
 * SK-410 additionally has a Working draft.
 */
export function buildVersionedDataRegistry(): Map<
  string,
  Map<DataVersion, VersionedProjectData>
> {
  const registry = new Map<string, Map<DataVersion, VersionedProjectData>>();

  for (const project of ALL_PROJECTS) {
    const versions = new Map<DataVersion, VersionedProjectData>();
    versions.set('budget', buildBudget(project));
    versions.set('forecast', buildForecast(project));

    if (project.project.id === 'balingian') {
      versions.set('actuals', buildActualsForBalingian(project));
    }
    if (project.project.id === 'sk-410') {
      versions.set('working', buildWorkingForSk410(project));
    }

    registry.set(project.project.id, versions);
  }

  return registry;
}
