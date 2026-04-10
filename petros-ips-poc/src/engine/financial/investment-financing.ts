// ════════════════════════════════════════════════════════════════════════
// Investment & Financing Program
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  EconomicsResult,
  USD,
} from '@/engine/types';
import { usd, computeCosts } from '@/engine/fiscal/shared';

export interface YearlyInvestmentLine {
  readonly year: number;
  readonly capexByDomain: Record<string, USD>;
  readonly totalCapex: USD;
  readonly cashFromOperations: USD;
  readonly surplusDeficit: USD;
  readonly cumulativeCash: USD;
}

export interface InvestmentFinancingProgram {
  readonly yearly: readonly YearlyInvestmentLine[];
  readonly totalInvestment: USD;
}

export function generateInvestmentFinancingProgram(
  projects: readonly ProjectInputs[],
  results: readonly EconomicsResult[],
): InvestmentFinancingProgram {
  // Find global year range
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const p of projects) {
    if (p.project.startYear < minYear) minYear = p.project.startYear;
    if (p.project.endYear > maxYear) maxYear = p.project.endYear;
  }

  let cumulativeCash = 0;
  let totalInvestment = 0;
  const yearly: YearlyInvestmentLine[] = [];

  for (let year = minYear; year <= maxYear; year++) {
    const capexByDomain: Record<string, number> = {};
    let yearCapex = 0;
    let yearCashFromOps = 0;

    for (let pi = 0; pi < projects.length; pi++) {
      const project = projects[pi]!;
      const result = results[pi];
      const domain = project.project.businessSector;

      const cost = computeCosts(project.costProfile, year);
      const capex = cost.totalCapex;
      yearCapex += capex;
      capexByDomain[domain] = (capexByDomain[domain] ?? 0) + capex;

      // Cash from operations = NCF + CAPEX (NCF already has CAPEX subtracted)
      const cfLine = result?.yearlyCashflows.find((cf) => cf.year === year);
      if (cfLine) {
        yearCashFromOps += (cfLine.netCashFlow as number) + capex + cost.abandonmentCost;
      }
    }

    totalInvestment += yearCapex;
    const surplusDeficit = yearCashFromOps - yearCapex;
    cumulativeCash += surplusDeficit;

    const typedCapexByDomain: Record<string, USD> = {};
    for (const [k, v] of Object.entries(capexByDomain)) {
      typedCapexByDomain[k] = usd(v);
    }

    yearly.push({
      year,
      capexByDomain: typedCapexByDomain,
      totalCapex: usd(yearCapex),
      cashFromOperations: usd(yearCashFromOps),
      surplusDeficit: usd(surplusDeficit),
      cumulativeCash: usd(cumulativeCash),
    });
  }

  return { yearly, totalInvestment: usd(totalInvestment) };
}
