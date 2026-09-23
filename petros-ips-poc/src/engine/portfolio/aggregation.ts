// ════════════════════════════════════════════════════════════════════════
// Portfolio Aggregation Engine
// ════════════════════════════════════════════════════════════════════════

import type {
  ProjectInputs,
  EconomicsResult,
  OrgHierarchy,
  PortfolioResult,
  HierarchyAggregation,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import {
  DEFAULT_VALUATION_YEAR,
  npvAtValuationYear,
  portfolioIrr,
} from '@/engine/economics/valuation';

const PORTFOLIO_DISCOUNT_RATE = 0.10;

/**
 * Aggregate portfolio results across active projects.
 * Builds hierarchy tree for drill-down reporting.
 *
 * NPVs are re-valued at a common valuation year (forward cash flows only)
 * before summing — see engine/economics/valuation.ts.
 */
export function aggregatePortfolio(
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  activeProjectIds: ReadonlySet<string>,
  hierarchy: readonly OrgHierarchy[],
  valuationYear: number = DEFAULT_VALUATION_YEAR,
): PortfolioResult {
  // Filter to active projects only
  const activeResults = new Map<string, EconomicsResult>();
  let totalNpv = 0;
  let totalCapex = 0;
  let totalProduction = 0;

  for (const [id, result] of results) {
    if (activeProjectIds.has(id)) {
      activeResults.set(id, result);
      totalNpv += npvAtValuationYear(result, PORTFOLIO_DISCOUNT_RATE, valuationYear);
      totalCapex += result.totalCapex as number;
      totalProduction += result.yearlyCashflows.reduce(
        (sum, cf) => sum + cf.cumulativeProduction, 0,
      ) > 0
        ? result.yearlyCashflows[result.yearlyCashflows.length - 1]!.cumulativeProduction
        : 0;
    }
  }

  // Build hierarchy aggregation
  const activeHierarchy = hierarchy.filter((h) => {
    const project = projects.find((p) => p.project.name === h.projectName);
    return project && activeProjectIds.has(project.project.id);
  });

  const hierarchyAggregation = buildHierarchyTree(
    activeHierarchy, projects, activeResults, valuationYear,
  );

  return {
    totalNpv: usd(totalNpv),
    totalCapex: usd(totalCapex),
    totalProduction,
    projectResults: activeResults,
    hierarchyAggregation,
    valuationYear,
    portfolioIrr: portfolioIrr(activeResults.values(), valuationYear),
  };
}

function buildHierarchyTree(
  hierarchy: readonly OrgHierarchy[],
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  valuationYear: number,
): HierarchyAggregation {
  // Group by sector
  const sectorGroups = new Map<string, OrgHierarchy[]>();
  for (const h of hierarchy) {
    const list = sectorGroups.get(h.businessSector) ?? [];
    list.push(h);
    sectorGroups.set(h.businessSector, list);
  }

  const sectorChildren: HierarchyAggregation[] = [];

  for (const [sector, sectorItems] of sectorGroups) {
    // Group by business type within sector
    const typeGroups = new Map<string, OrgHierarchy[]>();
    for (const h of sectorItems) {
      const list = typeGroups.get(h.businessType) ?? [];
      list.push(h);
      typeGroups.set(h.businessType, list);
    }

    const typeChildren: HierarchyAggregation[] = [];

    for (const [type, typeItems] of typeGroups) {
      const projectChildren: HierarchyAggregation[] = [];

      for (const h of typeItems) {
        const project = projects.find((p) => p.project.name === h.projectName);
        const result = project ? results.get(project.project.id) : undefined;

        projectChildren.push({
          level: 'projectName',
          key: h.projectName,
          npv: usd(result ? npvAtValuationYear(result, PORTFOLIO_DISCOUNT_RATE, valuationYear) : 0),
          totalCapex: usd(result ? (result.totalCapex as number) : 0),
          totalProduction: result?.yearlyCashflows[result.yearlyCashflows.length - 1]?.cumulativeProduction ?? 0,
          children: [],
        });
      }

      typeChildren.push({
        level: 'businessType',
        key: type,
        npv: usd(projectChildren.reduce((s, c) => s + (c.npv as number), 0)),
        totalCapex: usd(projectChildren.reduce((s, c) => s + (c.totalCapex as number), 0)),
        totalProduction: projectChildren.reduce((s, c) => s + c.totalProduction, 0),
        children: projectChildren,
      });
    }

    sectorChildren.push({
      level: 'businessSector',
      key: sector,
      npv: usd(typeChildren.reduce((s, c) => s + (c.npv as number), 0)),
      totalCapex: usd(typeChildren.reduce((s, c) => s + (c.totalCapex as number), 0)),
      totalProduction: typeChildren.reduce((s, c) => s + c.totalProduction, 0),
      children: typeChildren,
    });
  }

  // Root entity node
  return {
    level: 'businessEntity',
    key: hierarchy[0]?.businessEntity ?? 'PETROS Group',
    npv: usd(sectorChildren.reduce((s, c) => s + (c.npv as number), 0)),
    totalCapex: usd(sectorChildren.reduce((s, c) => s + (c.totalCapex as number), 0)),
    totalProduction: sectorChildren.reduce((s, c) => s + c.totalProduction, 0),
    children: sectorChildren,
  };
}
