// ════════════════════════════════════════════════════════════════════════
// SPE PRMS Reserves Classification
// ════════════════════════════════════════════════════════════════════════

import type { ReserveCategory } from '@/engine/types';

/**
 * Initial reserves estimates per project, by category.
 * Oil in MMstb, Gas in Bcf.
 */
export interface ProjectReserves {
  readonly projectId: string;
  readonly oil: Record<ReserveCategory, number>;  // MMstb
  readonly gas: Record<ReserveCategory, number>;  // Bcf
}

// Sample reserves data for POC projects
// 1P = proved, 2P = proved+probable, 3P = proved+probable+possible
export const PROJECT_RESERVES: readonly ProjectReserves[] = [
  {
    projectId: 'sk-410',
    oil: { '1P': 0, '2P': 0, '3P': 0 },       // Gas field, no oil reserves
    gas: { '1P': 180, '2P': 250, '3P': 320 },  // Bcf
  },
  {
    projectId: 'sk-612',
    oil: { '1P': 75, '2P': 120, '3P': 165 },   // MMstb
    gas: { '1P': 15, '2P': 25, '3P': 35 },     // Associated gas, Bcf
  },
  {
    projectId: 'balingian',
    oil: { '1P': 42, '2P': 68, '3P': 85 },     // MMstb remaining (2P)
    gas: { '1P': 5, '2P': 8, '3P': 10 },       // Associated gas, Bcf
  },
  {
    projectId: 'tukau',
    oil: { '1P': 12, '2P': 18, '3P': 24 },     // MMstb
    gas: { '1P': 1, '2P': 2, '3P': 3 },        // Bcf
  },
  {
    projectId: 'm3-ccs',
    oil: { '1P': 0, '2P': 0, '3P': 0 },
    gas: { '1P': 0, '2P': 0, '3P': 0 },        // CCS — no hydrocarbon reserves
  },
];

export function getProjectReserves(projectId: string): ProjectReserves | undefined {
  return PROJECT_RESERVES.find((r) => r.projectId === projectId);
}

/**
 * Convert gas Bcf to oil-equivalent MMboe (6 Mscf/boe → 1 Bcf = 0.1667 MMboe).
 *
 * NOTE: The `mscf-boe` row in the editable Display Unit conversion table
 * also carries the 6:1 ratio but is **display only** — this function
 * hardcodes the divisor and will not respond to user edits. The
 * UnitConversionSection UI flags the corresponding row with a warning badge.
 */
export function gasBcfToMmboe(bcf: number): number {
  return bcf / 6;
}
