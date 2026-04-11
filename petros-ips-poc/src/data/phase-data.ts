// ════════════════════════════════════════════════════════════════════════
// Sample Phase Version Data (DF-04)
// ════════════════════════════════════════════════════════════════════════
//
// Pre-FID and Post-FID snapshots for projects in the portfolio.
// Each project's phase versions reflect how production and cost estimates
// evolved as the project matured from concept selection through sanction.
// ════════════════════════════════════════════════════════════════════════

import type {
  CostProfile,
  PhaseVersionData,
  ProductionProfile,
  ProjectInputs,
  TimeSeriesData,
  USD,
} from '@/engine/types';
import { ALL_PROJECTS } from './projects';

const usd = (n: number): USD => (Math.round(n * 100) / 100) as USD;

function scaleNumber(s: TimeSeriesData<number>, f: number): TimeSeriesData<number> {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(s)) out[Number(k)] = (v as number) * f;
  return out;
}

function scaleUsd(s: TimeSeriesData<USD>, f: number): TimeSeriesData<USD> {
  const out: Record<number, USD> = {};
  for (const [k, v] of Object.entries(s)) out[Number(k)] = usd((v as number) * f);
  return out;
}

function scaleProduction(p: ProductionProfile, f: number): ProductionProfile {
  return {
    oil: scaleNumber(p.oil, f),
    gas: scaleNumber(p.gas, f),
    condensate: scaleNumber(p.condensate, f),
    water: scaleNumber(p.water, f),
  };
}

function scaleCosts(c: CostProfile, capexF: number, opexF: number): CostProfile {
  return {
    capexDrilling: scaleUsd(c.capexDrilling, capexF),
    capexFacilities: scaleUsd(c.capexFacilities, capexF),
    capexSubsea: scaleUsd(c.capexSubsea, capexF),
    capexOther: scaleUsd(c.capexOther, capexF),
    opexFixed: scaleUsd(c.opexFixed, opexF),
    opexVariable: scaleUsd(c.opexVariable, opexF),
    abandonmentCost: c.abandonmentCost,
  };
}

// ── SK-612 Deepwater: Pre-FID vs Post-FID ──────────────────────────────

function sk612PhaseVersions(project: ProjectInputs): PhaseVersionData[] {
  // Pre-FID: lower-confidence Concept Select estimate
  const preFid: PhaseVersionData = {
    projectId: project.project.id,
    phase: 'pre_fid',
    label: 'Concept Select (2025)',
    createdDate: '2025-06-15',
    assumptions:
      'Based on initial well test data. Two FPSO options under evaluation. ' +
      '2P reserves 120 MMbbl. Peak 25,000 bpd. Decline 15%/yr. CAPEX $1,200M.',
    productionProfile: scaleProduction(project.productionProfile, 0.83), // 25k → 20.75k
    costProfile: scaleCosts(project.costProfile, 0.83, 1.0),
    reservesMmboe: 120,
  };

  // Post-FID: revised after appraisal well + FPSO selection
  const postFid: PhaseVersionData = {
    projectId: project.project.id,
    phase: 'post_fid',
    label: 'Sanction Case (2026 FID)',
    createdDate: '2026-03-20',
    assumptions:
      'Post-appraisal. FPSO selected (lease option). 12 production wells confirmed. ' +
      '2P reserves revised up to 135 MMbbl. Peak 30,000 bpd. Decline 13%/yr. CAPEX $1,450M.',
    productionProfile: scaleProduction(project.productionProfile, 1.20), // 25k → 30k
    costProfile: scaleCosts(project.costProfile, 1.21, 1.05),
    reservesMmboe: 135,
  };

  return [preFid, postFid];
}

// ── Tukau Marginal: Pre-FID vs Post-FID ────────────────────────────────

function tukauPhaseVersions(project: ProjectInputs): PhaseVersionData[] {
  const preFid: PhaseVersionData = {
    projectId: project.project.id,
    phase: 'pre_fid',
    label: 'Screening (2024)',
    createdDate: '2024-11-10',
    assumptions:
      '2P reserves 15 MMbbl (initial estimate). Peak 4,000 bpd. CAPEX $120M. ' +
      'Single well-pad concept under SFA terms.',
    productionProfile: scaleProduction(project.productionProfile, 0.80), // 5k → 4k
    costProfile: scaleCosts(project.costProfile, 0.80, 0.90),
    reservesMmboe: 15,
  };

  const postFid: PhaseVersionData = {
    projectId: project.project.id,
    phase: 'post_fid',
    label: 'Sanction Case (2027)',
    createdDate: '2027-02-05',
    assumptions:
      '2P reserves 18 MMbbl (post-appraisal). Peak 5,000 bpd. CAPEX $150M. ' +
      'Final development plan: 2 wells from existing minimum facility.',
    productionProfile: project.productionProfile,
    costProfile: project.costProfile,
    reservesMmboe: 18,
  };

  return [preFid, postFid];
}

// ── Build the full phase-data registry ─────────────────────────────────

/** Map<projectId, PhaseVersionData[]> */
export function buildPhaseDataRegistry(): Map<string, PhaseVersionData[]> {
  const registry = new Map<string, PhaseVersionData[]>();
  for (const project of ALL_PROJECTS) {
    if (project.project.id === 'sk-612') {
      registry.set(project.project.id, sk612PhaseVersions(project));
    } else if (project.project.id === 'tukau') {
      registry.set(project.project.id, tukauPhaseVersions(project));
    }
  }
  return registry;
}
