// ════════════════════════════════════════════════════════════════════════
// Portfolio Back-Allocation
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  EconomicsResult,
} from '@/engine/types';

export type AllocationKey = 'npv' | 'capex' | 'production';

/**
 * Distribute a portfolio-level number down to projects proportionally.
 * E.g., allocate $100M corporate overhead by each project's share of total CAPEX.
 */
export function backAllocate(
  portfolioTarget: number,
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  allocationKey: AllocationKey,
): Map<string, number> {
  const allocations = new Map<string, number>();

  // Compute total for the allocation key
  let total = 0;
  const projectValues = new Map<string, number>();

  for (const proj of projects) {
    const result = results.get(proj.project.id);
    if (!result) continue;

    let value: number;
    switch (allocationKey) {
      case 'npv':
        value = Math.abs(result.npv10 as number);
        break;
      case 'capex':
        value = result.totalCapex as number;
        break;
      case 'production': {
        const lastCf = result.yearlyCashflows[result.yearlyCashflows.length - 1];
        value = lastCf?.cumulativeProduction ?? 0;
        break;
      }
    }

    projectValues.set(proj.project.id, value);
    total += value;
  }

  // Allocate proportionally
  for (const [id, value] of projectValues) {
    const share = total > 0 ? value / total : 0;
    allocations.set(id, portfolioTarget * share);
  }

  return allocations;
}
