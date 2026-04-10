import { describe, it, expect } from 'vitest';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';
import { calculateIncremental } from '@/engine/portfolio/incremental';
import { backAllocate } from '@/engine/portfolio/back-allocation';
import { calculateDownstreamEconomics } from '@/engine/portfolio/downstream-margin';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { ALL_PROJECTS, SK410_INPUTS, SK612_INPUTS, BALINGIAN_INPUTS, TUKAU_INPUTS, M3_CCS_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { PROJECT_HIERARCHY } from '@/data/hierarchy';
import type { EconomicsResult, DownstreamInputs, USD } from '@/engine/types';

// ── Shared setup ──────────────────────────────────────────────────────

const allResults = new Map<string, EconomicsResult>();
for (const proj of ALL_PROJECTS) {
  const result = calculateProjectEconomics(proj, BASE_PRICE_DECK);
  allResults.set(proj.project.id, result);
}

const allIds = new Set(ALL_PROJECTS.map((p) => p.project.id));

// ════════════════════════════════════════════════════════════════════════
// TEST 1: Portfolio NPV = sum of included project NPVs
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: Portfolio NPV = sum of included project NPVs', () => {
  // Include only first 3 projects
  const threeIds = new Set(['sk-410', 'sk-612', 'balingian']);
  const portfolio = aggregatePortfolio(ALL_PROJECTS, allResults, threeIds, PROJECT_HIERARCHY);

  it('totalNpv = sum of 3 project NPVs', () => {
    let expectedNpv = 0;
    for (const id of threeIds) {
      expectedNpv += allResults.get(id)!.npv10 as number;
    }
    expect(portfolio.totalNpv as number).toBeCloseTo(expectedNpv, 2);
  });

  it('totalCapex = sum of 3 project CAPEX', () => {
    let expectedCapex = 0;
    for (const id of threeIds) {
      expectedCapex += allResults.get(id)!.totalCapex as number;
    }
    expect(portfolio.totalCapex as number).toBeCloseTo(expectedCapex, 2);
  });

  it('projectResults contains only active projects', () => {
    expect(portfolio.projectResults.size).toBe(3);
    for (const id of threeIds) {
      expect(portfolio.projectResults.has(id)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: Removing a project reduces portfolio NPV by that project's NPV
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: Removing a project reduces portfolio NPV', () => {
  const fullPortfolio = aggregatePortfolio(ALL_PROJECTS, allResults, allIds, PROJECT_HIERARCHY);

  const withoutSk410 = new Set(allIds);
  withoutSk410.delete('sk-410');
  const reducedPortfolio = aggregatePortfolio(ALL_PROJECTS, allResults, withoutSk410, PROJECT_HIERARCHY);

  it('delta = removed project NPV', () => {
    const sk410Npv = allResults.get('sk-410')!.npv10 as number;
    const delta = (fullPortfolio.totalNpv as number) - (reducedPortfolio.totalNpv as number);
    expect(delta).toBeCloseTo(sk410Npv, 2);
  });

  it('reduced portfolio has one fewer project', () => {
    expect(reducedPortfolio.projectResults.size).toBe(allIds.size - 1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: Incremental analysis returns correct delta
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: Incremental analysis', () => {
  // Base: 3 projects (sk-410, sk-612, balingian)
  const baseIds = new Set(['sk-410', 'sk-612', 'balingian']);
  const basePortfolio = aggregatePortfolio(ALL_PROJECTS, allResults, baseIds, PROJECT_HIERARCHY);

  const tukauResult = allResults.get('tukau')!;
  const incremental = calculateIncremental(basePortfolio, tukauResult);

  it('incrementalNpv = tukau NPV', () => {
    expect(incremental.incrementalNpv as number).toBeCloseTo(tukauResult.npv10 as number, 2);
  });

  it('withProjectNpv = baseNpv + tukau NPV', () => {
    const expected = (incremental.basePortfolioNpv as number) + (tukauResult.npv10 as number);
    expect(incremental.withProjectNpv as number).toBeCloseTo(expected, 2);
  });

  it('projectId is tukau', () => {
    expect(incremental.projectId).toBe('tukau');
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: Back-allocation sums to portfolio total
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: Back-allocation sums to portfolio total', () => {
  const target = 100_000_000; // $100M

  it('CAPEX allocation sums to target', () => {
    const allocations = backAllocate(target, ALL_PROJECTS, allResults, 'capex');
    const total = [...allocations.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(target, 0);
  });

  it('NPV allocation sums to target', () => {
    const allocations = backAllocate(target, ALL_PROJECTS, allResults, 'npv');
    const total = [...allocations.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(target, 0);
  });

  it('production allocation sums to target', () => {
    const allocations = backAllocate(target, ALL_PROJECTS, allResults, 'production');
    const total = [...allocations.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(target, 0);
  });

  it('each project gets a non-negative allocation', () => {
    const allocations = backAllocate(target, ALL_PROJECTS, allResults, 'capex');
    for (const v of allocations.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Hierarchy aggregation groups correctly
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Hierarchy aggregation', () => {
  const portfolio = aggregatePortfolio(ALL_PROJECTS, allResults, allIds, PROJECT_HIERARCHY);
  const root = portfolio.hierarchyAggregation;

  it('root is businessEntity level', () => {
    expect(root.level).toBe('businessEntity');
    expect(root.key).toBe('PETROS Group');
  });

  it('root NPV = portfolio totalNpv', () => {
    expect(root.npv as number).toBeCloseTo(portfolio.totalNpv as number, 2);
  });

  it('has Upstream and CCS sector children', () => {
    const sectorKeys = root.children.map((c) => c.key);
    expect(sectorKeys).toContain('Upstream');
    expect(sectorKeys).toContain('CCS');
  });

  it('upstream sector aggregates 4 projects', () => {
    const upstream = root.children.find((c) => c.key === 'Upstream')!;
    expect(upstream).toBeDefined();
    // Upstream > Operated > 4 projects
    const operated = upstream.children.find((c) => c.key === 'Operated')!;
    expect(operated.children).toHaveLength(4);
  });

  it('CCS sector has 1 project', () => {
    const ccs = root.children.find((c) => c.key === 'CCS')!;
    expect(ccs).toBeDefined();
    const operated = ccs.children.find((c) => c.key === 'Operated')!;
    expect(operated.children).toHaveLength(1);
    expect(operated.children[0]!.key).toBe('M3 CCS Storage');
  });

  it('upstream NPV + CCS NPV = root NPV', () => {
    const sectorNpvSum = root.children.reduce((s, c) => s + (c.npv as number), 0);
    expect(sectorNpvSum).toBeCloseTo(root.npv as number, 2);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Downstream break-even feedstock price is plausible
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Downstream break-even feedstock price', () => {
  const dsInputs: DownstreamInputs = {
    feedstockVolume: 500_000,         // tonnes/yr
    feedstockPrice: 300 as USD,       // $/tonne
    productVolumes: new Map([
      ['LNG', 400_000],               // tonnes/yr
      ['NGL', 50_000],
    ]),
    productPrices: new Map([
      ['LNG', 500 as USD],            // $/tonne
      ['NGL', 600 as USD],
    ]),
    fixedOpex: 20_000_000 as USD,     // $20M/yr
    variableOpex: 15 as USD,          // $/tonne throughput
    plantUtilization: 0.90,
    plantCapacity: 500_000,           // tonnes/yr
  };

  const result = calculateDownstreamEconomics(dsInputs);

  it('gross margin is positive', () => {
    expect(result.grossMargin as number).toBeGreaterThan(0);
  });

  it('net margin is positive', () => {
    expect(result.netMargin as number).toBeGreaterThan(0);
  });

  it('NPV is positive for profitable margin', () => {
    expect(result.npv10 as number).toBeGreaterThan(0);
  });

  it('break-even feedstock price > 0', () => {
    expect(result.breakEvenFeedstockPrice as number).toBeGreaterThan(0);
  });

  it('break-even feedstock price > market feedstock price (margin absorbs costs)', () => {
    // Break-even feedstock price should be higher than current price
    // because at break-even, NPV = 0, meaning we can afford a higher feedstock price
    expect(result.breakEvenFeedstockPrice as number).toBeGreaterThan(dsInputs.feedstockPrice as number);
  });

  it('break-even product price is positive and less than market price', () => {
    // Break-even product price should be lower than current — we can sell cheaper and still break even
    expect(result.breakEvenProductPrice as number).toBeGreaterThan(0);
    expect(result.breakEvenProductPrice as number).toBeLessThan(500);
  });
});
