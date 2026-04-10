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

/**
 * Aggregate portfolio results across active projects.
 * Builds hierarchy tree for drill-down reporting.
 */
export function aggregatePortfolio(
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
  activeProjectIds: ReadonlySet<string>,
  hierarchy: readonly OrgHierarchy[],
): PortfolioResult {
  // Filter to active projects only
  const activeResults = new Map<string, EconomicsResult>();
  let totalNpv = 0;
  let totalCapex = 0;
  let totalProduction = 0;

  for (const [id, result] of results) {
    if (activeProjectIds.has(id)) {
      activeResults.set(id, result);
      totalNpv += result.npv10 as number;
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
    activeHierarchy, projects, activeResults,
  );

  return {
    totalNpv: usd(totalNpv),
    totalCapex: usd(totalCapex),
    totalProduction,
    projectResults: activeResults,
    hierarchyAggregation,
  };
}

function buildHierarchyTree(
  hierarchy: readonly OrgHierarchy[],
  projects: readonly ProjectInputs[],
  results: ReadonlyMap<string, EconomicsResult>,
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
          npv: usd(result ? (result.npv10 as number) : 0),
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
