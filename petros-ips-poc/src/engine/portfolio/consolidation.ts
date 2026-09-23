// ════════════════════════════════════════════════════════════════════════
// Portfolio Consolidation — MFRS 10 / 11 / 28 + MFRS 121
// ════════════════════════════════════════════════════════════════════════
//
// Replaces the linear equity-share-only aggregation in `aggregation.ts` with
// full consolidation-method discrimination:
//
//   - Full consolidation (subsidiary, >50% control + power): 100% lines,
//     minority-interest carved out as separate equity element. Per MFRS 10.
//   - Proportional consolidation (joint operation): equity-share lines.
//     Per MFRS 11. POC default.
//   - Equity method (associate, 20-50% with significant influence): single
//     "Investment in Associate" line + share of profit/loss. Per MFRS 28.
//
// FX revaluation per MFRS 121: USD-functional projects translate to MYR
// at closing rate (BS) / average rate (P&L) when consolidating to a
// MYR-reporting Group.
//
// Reference: MFRS 10, 11, 28, 121.
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  EconomicsResult,
  ConsolidationMethod,
  USD,
  MYR,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { REFERENCE_USD_MYR } from '@/engine/utils/unit-conversion';

export interface ConsolidatedLine {
  readonly projectId: string;
  readonly method: ConsolidationMethod;
  readonly equityShare: number;
  /** NPV contribution to Group consolidation (USD). */
  readonly npvContribution: USD;
  /** Minority interest (full-consol projects only) — share NOT belonging
   *  to PETROS Group. */
  readonly minorityInterest: USD;
  /** NPV in MYR if functional currency != reporting currency. */
  readonly npvContributionMyr: MYR;
}

export interface ConsolidationResult {
  readonly lines: readonly ConsolidatedLine[];
  /** Group-level NPV in USD (sum of consolidated contributions). */
  readonly groupNpvUsd: USD;
  /** Group-level NPV in MYR at translation rate. */
  readonly groupNpvMyr: MYR;
  /** Total minority interest carved out (full-consol). */
  readonly totalMinorityInterest: USD;
}

const myr = (n: number): MYR => n as MYR;

/**
 * Apply MFRS-compliant consolidation to a portfolio of projects.
 *
 * @param projects  Project inputs (carry consolidationMethod + functionalCurrency).
 * @param results   Per-project economics results.
 * @param fxRate    USD/MYR FX rate for MFRS 121 translation (typically the
 *                  closing rate at consolidation date; defaults to
 *                  REFERENCE_USD_MYR).
 */
export function consolidatePortfolio(
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  fxRate: number = REFERENCE_USD_MYR,
): ConsolidationResult {
  const lines: ConsolidatedLine[] = [];
  let groupNpvUsd = 0;
  let totalMinorityInterest = 0;

  for (const proj of projects) {
    const result = results.get(proj.project.id);
    if (!result) continue;

    const method: ConsolidationMethod = proj.project.consolidationMethod ?? 'proportional';
    const equity = proj.project.equityShare;
    // Project economics are already at PETROS's equity (working-interest)
    // share — see fiscal/shared.ts workingInterestCosts.
    const netNpv = result.npv10 as number;

    let npvContribution = 0;
    let minorityInterest = 0;

    switch (method) {
      case 'full': {
        // 100% to Group; carve out the non-controlling interest separately.
        const grossNpv = equity > 0 ? netNpv / equity : 0;
        npvContribution = grossNpv;
        minorityInterest = grossNpv * (1 - equity);
        break;
      }
      case 'proportional':
        // Joint operation: PETROS's share of each line (POC default).
        npvContribution = netNpv;
        minorityInterest = 0;
        break;
      case 'equity':
        // Single-line equity method: share of net result only.
        npvContribution = netNpv;
        minorityInterest = 0;
        break;
    }

    // MFRS 121 translation — engine values are USD, so every line is
    // translated to the MYR presentation currency at fxRate. Functional
    // currency decides where the translation difference is recognised
    // (OCI vs P&L), not the translated amount.
    const npvContributionMyr = npvContribution * fxRate;

    lines.push({
      projectId: proj.project.id,
      method,
      equityShare: equity,
      npvContribution: usd(npvContribution),
      minorityInterest: usd(minorityInterest),
      npvContributionMyr: myr(npvContributionMyr),
    });

    groupNpvUsd += npvContribution;
    totalMinorityInterest += minorityInterest;
  }

  const groupNpvMyr = lines.reduce((sum, l) => sum + (l.npvContributionMyr as number), 0);

  return {
    lines,
    groupNpvUsd: usd(groupNpvUsd),
    groupNpvMyr: myr(groupNpvMyr),
    totalMinorityInterest: usd(totalMinorityInterest),
  };
}
