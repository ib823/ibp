// ════════════════════════════════════════════════════════════════════════
// CO2 Storage Resources Management System (SPE SRMS 2025)
// ════════════════════════════════════════════════════════════════════════

import type {
  CO2StorageResource,
  CO2StorageReconciliation,
  ProjectInputs,
} from '@/engine/types';
import { getVal } from '@/engine/fiscal/shared';

// ── Sample Storage Resource Data ──────────────────────────────────────

export const CO2_STORAGE_RESOURCES: readonly CO2StorageResource[] = [
  {
    projectId: 'm3-ccs',
    siteName: 'M3 Depleted Reservoir',
    lowEstimate: 10,      // MT CO2
    bestEstimate: 15,     // MT CO2
    highEstimate: 22,     // MT CO2
    resourceClass: 'contingent',
    // Pre-FID development phase (per `data/projects.ts:421`); SRMS
    // "approved" reserved for projects that have authority approvals
    // in place. M3 CCS is at "Development Pending" → SRMS pending. (D30)
    maturitySubclass: 'pending',
  },
];

export function getStorageResource(projectId: string): CO2StorageResource | undefined {
  return CO2_STORAGE_RESOURCES.find((r) => r.projectId === projectId);
}

// ── Reconciliation ────────────────────────────────────────────────────

interface SrmsReconciliationInput {
  readonly resource: CO2StorageResource;
  readonly project: ProjectInputs;
  readonly years: readonly number[];
}

/**
 * Generate CO2 storage capacity reconciliation waterfall.
 * Injection volumes derived from the project's water profile (used as CO2 proxy).
 * Opening capacity = bestEstimate. Each year: closing = opening - injected + revisions.
 */
export function generateSrmsReconciliation(
  input: SrmsReconciliationInput,
): CO2StorageReconciliation[] {
  const { resource, project, years } = input;
  const movements: CO2StorageReconciliation[] = [];

  let opening = resource.bestEstimate;

  for (const year of years) {
    // CO2 injection: water profile stores daily tonnes; convert to MT/yr
    const dailyTonnes = getVal(project.productionProfile.water, year);
    const injectedMt = (dailyTonnes * 365) / 1e6;

    // Illustrative small positive revision from ongoing characterization
    const technicalRevisions = opening > 0 ? opening * 0.005 : 0;
    const newAssessments = 0;

    const closing = Math.max(0, opening + newAssessments + technicalRevisions - injectedMt);

    movements.push({
      year,
      projectId: resource.projectId,
      opening,
      newAssessments,
      technicalRevisions,
      injected: injectedMt,
      closing,
    });

    opening = closing;
  }

  return movements;
}
