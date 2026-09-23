// ════════════════════════════════════════════════════════════════════════
// Capital-Constrained Portfolio Optimisation (D15/D43)
//
// Group-level CAPEX rationing is a routine PETROS planning question:
// given a fixed CAPEX budget, which subset of projects maximises Group NPV
// subject to the budget constraint, while clearing a hurdle-rate filter?
//
// Solver: exact 0/1 knapsack by exhaustive subset search for up to
// EXACT_SEARCH_LIMIT optional projects (2^20 ≈ 1M subsets), greedy
// NPV-per-CAPEX fallback for larger sets. Preserves the hurdle-rate filter
// (projects below hurdle are excluded before the knapsack). Project NPVs
// are taken at the common portfolio valuation year (valuation.ts).
//
// Reference: standard FP&A capital-rationing technique (Brealey-Myers
// Corporate Finance). Phase 1b SAC delivery extends with mandatory
// projects + project dependencies (clusters share infrastructure).
// ════════════════════════════════════════════════════════════════════════

import type { ProjectInputs, EconomicsResult, USD } from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { DEFAULT_VALUATION_YEAR, npvAtValuationYear } from '@/engine/economics/valuation';

const EXACT_SEARCH_LIMIT = 20;

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
    const npv = npvAtValuationYear(result, 0.10, DEFAULT_VALUATION_YEAR);
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

  const optionalSelected: string[] = [];
  let totalCapex = input.capexBudgetUsd - remainingBudget; // mandatory capex
  let totalNpv = mandatorySelected.reduce((acc, id) => {
    const e = eligible.find((x) => x.id === id);
    return acc + (e?.npv ?? 0);
  }, 0);

  const chosen = optional.length <= EXACT_SEARCH_LIMIT
    ? bestSubset(optional, remainingBudget)
    : greedySubset(optional, remainingBudget);

  optional.forEach((e, i) => {
    if (chosen[i]) {
      optionalSelected.push(e.id);
      totalCapex += e.capex;
      totalNpv += e.npv;
    } else {
      excluded.push(e.id);
    }
  });

  return {
    selectedProjectIds: [...mandatorySelected, ...optionalSelected],
    excludedProjectIds: excluded,
    totalCapex: usd(totalCapex),
    totalNpv: usd(totalNpv),
    utilisation: input.capexBudgetUsd > 0 ? totalCapex / input.capexBudgetUsd : 0,
  };
}

type Candidate = { id: string; capex: number; npv: number };

/** Exact 0/1 knapsack: the subset with the highest NPV within budget
 *  (ties → lower capex). */
function bestSubset(items: readonly Candidate[], budget: number): boolean[] {
  let bestMask = 0;
  let bestNpv = 0;
  let bestCapex = 0;
  for (let mask = 1; mask < 1 << items.length; mask++) {
    let capex = 0;
    let npv = 0;
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) {
        capex += items[i]!.capex;
        npv += items[i]!.npv;
      }
    }
    if (capex > budget) continue;
    if (npv > bestNpv || (npv === bestNpv && capex < bestCapex)) {
      bestMask = mask;
      bestNpv = npv;
      bestCapex = capex;
    }
  }
  return items.map((_, i) => (bestMask & (1 << i)) !== 0);
}

/** Greedy NPV-per-CAPEX fallback for large candidate sets. */
function greedySubset(items: readonly Candidate[], budget: number): boolean[] {
  const order = items
    .map((e, i) => ({ i, ratio: e.capex > 0 ? e.npv / e.capex : Infinity }))
    .sort((a, b) => b.ratio - a.ratio);
  const chosen = items.map(() => false);
  let remaining = budget;
  for (const { i } of order) {
    if (items[i]!.capex <= remaining) {
      chosen[i] = true;
      remaining -= items[i]!.capex;
    }
  }
  return chosen;
}
