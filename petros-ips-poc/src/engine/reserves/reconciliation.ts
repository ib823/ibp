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
  /** Optional economic-revision driver: relative to the recognition baseline,
   *  how much price-deck movement triggers proved-reserves re-tests? Negative
   *  values reduce 1P (low-price scenario shrinks proved); positive values
   *  promote contingent volumes to proved. Default 0 (no economic revision).
   *  See ASSESSMENT.md D27 — closes "integrate with economic evaluation"
   *  per RFP §4. */
  readonly priceDeckScenarioFactor?: number;
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

        // Movements (D27 — integrated with economics).
        // Extensions: small positive on 2P/3P from infill drilling (Phase 1b
        // wires this to project CAPEX tagged 'infill' / 'appraisal').
        const extensions = category === '1P' ? 0 : (opening > 0 ? opening * 0.01 : 0);
        const technicalRevisions = opening > 0 ? opening * 0.005 : 0;
        // Economic revisions flex with the active price-deck scenario.
        // Low-price scenario (factor < 0) shrinks 1P (some proved volumes
        // fail economic-limit re-test → reclassed to contingent).
        // High-price scenario (factor > 0) promotes contingent → 1P.
        // Magnitudes deliberately modest in POC; tunable per PETROS policy.
        const scenarioFactor = input.priceDeckScenarioFactor ?? 0;
        const economicRevisions = category === '1P' && opening > 0
          ? opening * scenarioFactor * 0.05  // 5% of factor's magnitude
          : 0;
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
