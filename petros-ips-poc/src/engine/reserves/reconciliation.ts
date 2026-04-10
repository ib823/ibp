// ════════════════════════════════════════════════════════════════════════
// Reserves Reconciliation (SPE PRMS Waterfall)
// ════════════════════════════════════════════════════════════════════════

import type {
  ReservesReconciliation,
  ReservesMovement,
  ReserveCategory,
  HydrocarbonType,
  ProjectInputs,
} from '@/engine/types';
import { getVal } from '@/engine/fiscal/shared';
import { PROJECT_RESERVES } from './prms';

interface ReconciliationInput {
  readonly projects: readonly ProjectInputs[];
  readonly years: readonly number[];
}

/**
 * Generate reserves reconciliation waterfall for given years.
 * Aggregates across all projects, by category and hydrocarbon type.
 *
 * For the POC, production is derived from project profiles.
 * Extensions, revisions, acquisitions, dispositions use illustrative values.
 */
export function generateReservesReconciliation(
  input: ReconciliationInput,
): ReservesReconciliation {
  const { projects, years } = input;
  const movements: ReservesMovement[] = [];

  const categories: ReserveCategory[] = ['1P', '2P', '3P'];
  const hcTypes: HydrocarbonType[] = ['oil', 'gas'];

  for (const category of categories) {
    for (const hcType of hcTypes) {
      // Compute initial opening from project reserves
      let opening = 0;
      for (const proj of projects) {
        const reserves = PROJECT_RESERVES.find((r) => r.projectId === proj.project.id);
        if (reserves) {
          opening += hcType === 'oil' ? reserves.oil[category] : reserves.gas[category];
        }
      }

      for (const year of years) {
        // Annual production: aggregate across projects
        let production = 0;
        for (const proj of projects) {
          if (hcType === 'oil') {
            // Oil bpd → MMstb/yr
            const oilBpd = getVal(proj.productionProfile.oil, year);
            const condBpd = getVal(proj.productionProfile.condensate, year);
            production += ((oilBpd + condBpd) * 365) / 1e6;
          } else {
            // Gas MMscfd → Bcf/yr
            const gasMMscfd = getVal(proj.productionProfile.gas, year);
            production += (gasMMscfd * 365) / 1e3;
          }
        }

        // Illustrative movements for POC
        // Small positive extensions for 2P/3P categories
        const extensions = category === '1P' ? 0 : (opening > 0 ? opening * 0.01 : 0);
        const technicalRevisions = opening > 0 ? opening * 0.005 : 0;
        const economicRevisions = 0;
        const acquisitions = 0;
        const dispositions = 0;

        const closing = opening + extensions + technicalRevisions + economicRevisions
          + acquisitions - dispositions - production;

        movements.push({
          year,
          category,
          hydrocarbonType: hcType,
          opening,
          extensions,
          technicalRevisions,
          economicRevisions,
          acquisitions,
          dispositions,
          production,
          closing: Math.max(0, closing),
        });

        // Next year's opening = this year's closing
        opening = Math.max(0, closing);
      }
    }
  }

  return { movements };
}
