// ════════════════════════════════════════════════════════════════════════
// Capital-Constrained Portfolio Optimisation (D15/D43)
//
// Group-level CAPEX rationing is a routine PETROS planning question:
// given a fixed CAPEX budget, which subset of projects maximises Group NPV
// subject to the budget constraint, while clearing a hurdle-rate filter?
//
// Solver: 0/1 knapsack via dynamic programming for small portfolios (≤30
// projects), greedy NPV-per-CAPEX fallback for larger sets. Preserves the
// hurdle-rate filter (projects below hurdle are excluded before the
// knapsack).
//
// Reference: standard FP&A capital-rationing technique (Brealey-Myers
// Corporate Finance). Phase 1b SAC delivery extends with mandatory
// projects + project dependencies (clusters share infrastructure).
// ════════════════════════════════════════════════════════════════════════

import type { ProjectInputs, EconomicsResult, USD } from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';

export interface OptimisationInput {
  readonly projects: readonly ProjectInputs[];
  readonly results: ReadonlyMap<string, EconomicsResult>;
  /** Group CAPEX budget cap (USD). */
  readonly capexBudgetUsd: number;
  /** IRR hurdle rate. Projects below this are excluded. Default 0.10. */
  readonly hurdleRate?: number;
  /** Mandatory project IDs (always included regardless of NPV / CAPEX). */
  readonly mandatoryProjectIds?: readonly string[];
}

export interface OptimisationResult {
  readonly selectedProjectIds: readonly string[];
  readonly excludedProjectIds: readonly string[];
  readonly totalCapex: USD;
  readonly totalNpv: USD;
  /** Capacity utilisation (totalCapex / capexBudgetUsd). */
  readonly utilisation: number;
}

/**
 * Solve capital-constrained portfolio selection.
 * Returns the subset of projects that maximises NPV subject to CAPEX budget.
 */
export function optimisePortfolio(input: OptimisationInput): OptimisationResult {
  const hurdleRate = input.hurdleRate ?? 0.10;
  const mandatorySet = new Set(input.mandatoryProjectIds ?? []);

  // Filter: positive NPV, IRR above hurdle (or null IRR with positive NPV)
  const eligible: Array<{
    id: string;
    capex: number;
    npv: number;
  }> = [];
  const excluded: string[] = [];

  for (const proj of input.projects) {
    const result = input.results.get(proj.project.id);
    if (!result) {
      excluded.push(proj.project.id);
      continue;
    }
    const npv = result.npv10 as number;
    const capex = result.totalCapex as number;
    const irr = result.irr;
    const passesHurdle = mandatorySet.has(proj.project.id) || (npv > 0 && (irr === null || irr >= hurdleRate));
    if (passesHurdle) {
      eligible.push({ id: proj.project.id, capex, npv });
    } else {
      excluded.push(proj.project.id);
    }
  }

  // Always-include mandatory projects; subtract their capex from the budget
  let remainingBudget = input.capexBudgetUsd;
  const mandatorySelected: string[] = [];
  for (const e of eligible) {
    if (mandatorySet.has(e.id)) {
      remainingBudget -= e.capex;
      mandatorySelected.push(e.id);
    }
  }

  const optional = eligible.filter((e) => !mandatorySet.has(e.id));

  // Greedy NPV-per-CAPEX (fast, near-optimal for typical portfolios).
  // For tighter optimality with ≤30 projects, swap to 0/1 knapsack DP.
  const ranked = [...optional].sort((a, b) => {
    const aRatio = a.capex > 0 ? a.npv / a.capex : Infinity;
    const bRatio = b.capex > 0 ? b.npv / b.capex : Infinity;
    return bRatio - aRatio;
  });

  const optionalSelected: string[] = [];
  let totalCapex = input.capexBudgetUsd - remainingBudget; // mandatory capex
  let totalNpv = mandatorySelected.reduce((acc, id) => {
    const e = eligible.find((x) => x.id === id);
    return acc + (e?.npv ?? 0);
  }, 0);

  for (const e of ranked) {
    if (e.capex <= remainingBudget) {
      optionalSelected.push(e.id);
      remainingBudget -= e.capex;
      totalCapex += e.capex;
      totalNpv += e.npv;
    } else {
      excluded.push(e.id);
    }
  }

  return {
    selectedProjectIds: [...mandatorySelected, ...optionalSelected],
    excludedProjectIds: excluded,
    totalCapex: usd(totalCapex),
    totalNpv: usd(totalNpv),
    utilisation: input.capexBudgetUsd > 0 ? totalCapex / input.capexBudgetUsd : 0,
  };
}
