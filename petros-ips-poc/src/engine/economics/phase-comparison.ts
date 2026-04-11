// ════════════════════════════════════════════════════════════════════════
// Phase Comparison Engine (DF-04)
// ════════════════════════════════════════════════════════════════════════
//
// Compare two project phase versions (e.g. Pre-FID vs Post-FID) and surface
// key economic deltas. Phase versions store snapshots of the production and
// cost profiles as the project matures through its lifecycle.
// ════════════════════════════════════════════════════════════════════════

import type {
  PhaseComparisonResult,
  PhaseVersionData,
  PriceDeck,
  ProjectInputs,
  ProductionProfile,
} from '@/engine/types';
import { calculateProjectEconomics } from './cashflow';

/** Apply phase data to a project, swapping in the phase's production and cost profiles. */
export function applyPhaseData(
  project: ProjectInputs,
  data: PhaseVersionData,
): ProjectInputs {
  return {
    ...project,
    productionProfile: data.productionProfile,
    costProfile: data.costProfile,
  };
}

/** Find the maximum daily boe rate (oil + condensate + gas/6) across all years */
function peakProductionBoeRate(profile: ProductionProfile): number {
  const years = new Set<number>([
    ...Object.keys(profile.oil).map(Number),
    ...Object.keys(profile.gas).map(Number),
    ...Object.keys(profile.condensate).map(Number),
  ]);
  let peak = 0;
  for (const y of years) {
    const oil = (profile.oil[y] as number) ?? 0;
    const cond = (profile.condensate[y] as number) ?? 0;
    const gas = (profile.gas[y] as number) ?? 0;
    const boe = oil + cond + (gas * 1000) / 6;
    if (boe > peak) peak = boe;
  }
  return peak;
}

/**
 * Compare two phase versions of the same project. Returns full economics
 * for both phases plus headline deltas.
 */
export function comparePhases(
  project: ProjectInputs,
  priceDeck: PriceDeck,
  phase1Data: PhaseVersionData,
  phase2Data: PhaseVersionData,
): PhaseComparisonResult {
  const proj1 = applyPhaseData(project, phase1Data);
  const proj2 = applyPhaseData(project, phase2Data);

  const economics1 = calculateProjectEconomics(proj1, priceDeck);
  const economics2 = calculateProjectEconomics(proj2, priceDeck);

  const peak1 = peakProductionBoeRate(phase1Data.productionProfile);
  const peak2 = peakProductionBoeRate(phase2Data.productionProfile);

  const reserves1 = phase1Data.reservesMmboe ?? 0;
  const reserves2 = phase2Data.reservesMmboe ?? 0;

  return {
    projectId: project.project.id,
    phase1: phase1Data.phase,
    phase1Label: phase1Data.label,
    phase2: phase2Data.phase,
    phase2Label: phase2Data.label,
    economics1,
    economics2,
    npvDelta: (economics2.npv10 as number) - (economics1.npv10 as number),
    irrDelta:
      economics2.irr !== null && economics1.irr !== null
        ? economics2.irr - economics1.irr
        : null,
    capexDelta: (economics2.totalCapex as number) - (economics1.totalCapex as number),
    reservesDelta: reserves2 - reserves1,
    peakProductionDelta: peak2 - peak1,
  };
}
