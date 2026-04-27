// ════════════════════════════════════════════════════════════════════════
// Incremental Analysis (D13/D43)
// ════════════════════════════════════════════════════════════════════════
//
// Two flavours:
//
//   1. `calculateIncremental` — additive incremental NPV: simply adds the
//      candidate project's standalone NPV. Correct for fully-additive
//      portfolios with no shared resources.
//
//   2. `calculateConstrainedIncremental` — capital-constraint-aware
//      incremental: re-runs portfolio optimisation with and without the
//      candidate, captures the displacement effect (which project the new
//      addition pushes out under a fixed CAPEX budget). For PETROS Group
//      capital rationing this is the operationally-correct measure.

import type {
  PortfolioResult,
  EconomicsResult,
  IncrementalAnalysis,
  ProjectInputs,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { optimisePortfolio } from './optimization';

/**
 * Additive incremental: adds candidate's standalone NPV. Correct for
 * unconstrained portfolios; not for capital-rationed ones.
 */
export function calculateIncremental(
  basePortfolio: PortfolioResult,
  projectToAdd: EconomicsResult,
): IncrementalAnalysis {
  const baseNpv = basePortfolio.totalNpv as number;
  const projectNpv = projectToAdd.npv10 as number;
  const withProjectNpv = baseNpv + projectNpv;

  return {
    basePortfolioNpv: usd(baseNpv),
    withProjectNpv: usd(withProjectNpv),
    incrementalNpv: usd(projectNpv),
    projectId: projectToAdd.projectId,
  };
}

export interface ConstrainedIncrementalResult {
  readonly projectId: string;
  /** NPV achievable WITHOUT the candidate within the budget. */
  readonly baselineNpv: number;
  /** NPV achievable WITH the candidate within the budget. */
  readonly withCandidateNpv: number;
  /** True incremental NPV under capital constraint. */
  readonly incrementalNpv: number;
  /** Project IDs displaced by including the candidate. */
  readonly displacedProjectIds: readonly string[];
}

/**
 * Capital-constrained incremental analysis (D43).
 *
 * Re-runs portfolio optimisation with and without the candidate project,
 * given a fixed CAPEX budget. Returns the genuine incremental NPV after
 * accounting for displacement of marginal projects.
 */
export function calculateConstrainedIncremental(
  candidate: ProjectInputs,
  candidateResult: EconomicsResult,
  basePortfolio: readonly ProjectInputs[],
  baseResults: ReadonlyMap<string, EconomicsResult>,
  capexBudgetUsd: number,
  hurdleRate: number = 0.10,
): ConstrainedIncrementalResult {
  // Baseline: without candidate
  const baseline = optimisePortfolio({
    projects: basePortfolio,
    results: baseResults,
    capexBudgetUsd,
    hurdleRate,
  });

  // With candidate: include in the optimisation
  const augmentedProjects = [...basePortfolio, candidate];
  const augmentedResults = new Map(baseResults);
  augmentedResults.set(candidate.project.id, candidateResult);
  const withCandidate = optimisePortfolio({
    projects: augmentedProjects,
    results: augmentedResults,
    capexBudgetUsd,
    hurdleRate,
  });

  const baselineSet = new Set(baseline.selectedProjectIds);
  const withSet = new Set(withCandidate.selectedProjectIds);

  // Displaced = in baseline but not in with-candidate
  const displaced: string[] = [];
  for (const id of baselineSet) {
    if (!withSet.has(id)) displaced.push(id);
  }

  return {
    projectId: candidate.project.id,
    baselineNpv: baseline.totalNpv as number,
    withCandidateNpv: withCandidate.totalNpv as number,
    incrementalNpv: (withCandidate.totalNpv as number) - (baseline.totalNpv as number),
    displacedProjectIds: displaced,
  };
}
