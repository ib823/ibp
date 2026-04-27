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
 *                  closing rate at consolidation date; POC defaults to 4.50).
 */
export function consolidatePortfolio(
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  fxRate: number = 4.50,
): ConsolidationResult {
  const lines: ConsolidatedLine[] = [];
  let groupNpvUsd = 0;
  let totalMinorityInterest = 0;

  for (const proj of projects) {
    const result = results.get(proj.project.id);
    if (!result) continue;

    const method: ConsolidationMethod = proj.project.consolidationMethod ?? 'proportional';
    const equity = proj.project.equityShare;
    const projectNpv = result.npv10 as number;

    let npvContribution = 0;
    let minorityInterest = 0;

    switch (method) {
      case 'full':
        // 100% to Group; carve out minority interest separately.
        npvContribution = projectNpv;
        minorityInterest = projectNpv * (1 - equity);
        break;
      case 'proportional':
        // Equity-share lines (POC default; matches existing aggregation behaviour).
        npvContribution = projectNpv * equity;
        minorityInterest = 0;
        break;
      case 'equity':
        // Single-line equity method: share of net profit/loss only.
        // For NPV-in-Group, equity-method contribution ≈ equity-share × NPV.
        npvContribution = projectNpv * equity;
        minorityInterest = 0;
        break;
    }

    // MFRS 121 translation — USD-functional projects translate at fxRate.
    const npvContributionMyr =
      proj.project.functionalCurrency === 'MYR'
        ? npvContribution
        : npvContribution * fxRate;

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

  const groupNpvMyr = groupNpvUsd * fxRate;

  return {
    lines,
    groupNpvUsd: usd(groupNpvUsd),
    groupNpvMyr: myr(groupNpvMyr),
    totalMinorityInterest: usd(totalMinorityInterest),
  };
}
