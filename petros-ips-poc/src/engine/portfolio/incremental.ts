// ════════════════════════════════════════════════════════════════════════
// Incremental Analysis
// ════════════════════════════════════════════════════════════════════════

import type {
  PortfolioResult,
  EconomicsResult,
  IncrementalAnalysis,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';

/**
 * Calculate the incremental impact of adding a project to a portfolio.
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
