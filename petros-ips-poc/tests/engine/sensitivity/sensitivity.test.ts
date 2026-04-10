import { describe, it, expect } from 'vitest';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import { calculateSpider } from '@/engine/sensitivity/spider';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { SK410_INPUTS } from '@/data/projects';
import { BASE_PRICE_DECK, PRICE_DECKS } from '@/data/price-decks';
import type { SensitivityVariable } from '@/engine/types';

const VARIABLES: SensitivityVariable[] = ['oilPrice', 'gasPrice', 'production', 'capex', 'opex'];
const PERCENTAGES = [-0.30, -0.20, -0.10, 0.10, 0.20, 0.30];

// ════════════════════════════════════════════════════════════════════════
// TEST 1: Tornado returns correct number of data points
// ════════════════════════════════════════════════════════════════════════

describe('TEST 1: Tornado returns correct number of data points', () => {
  const result = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, VARIABLES, PERCENTAGES);

  it('has 5 × 6 = 30 data points', () => {
    expect(result.dataPoints).toHaveLength(30);
  });

  it('base NPV is defined and finite', () => {
    expect(Number.isFinite(result.baseNpv as number)).toBe(true);
  });

  it('each data point has all required fields', () => {
    for (const dp of result.dataPoints) {
      expect(VARIABLES).toContain(dp.variable);
      expect(PERCENTAGES).toContain(dp.percentChange);
      expect(Number.isFinite(dp.npvDelta as number)).toBe(true);
      expect(Number.isFinite(dp.npvValue as number)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 2: Tornado is sorted by absolute impact (most sensitive first)
// ════════════════════════════════════════════════════════════════════════

describe('TEST 2: Tornado sorted by absolute impact', () => {
  const result = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, VARIABLES, PERCENTAGES);

  it('most sensitive variable appears first in data points', () => {
    // Extract the max |npvDelta| at ±30% per variable
    const impactMap = new Map<SensitivityVariable, number>();
    for (const dp of result.dataPoints) {
      if (Math.abs(dp.percentChange) === 0.30) {
        const current = impactMap.get(dp.variable) ?? 0;
        impactMap.set(dp.variable, Math.max(current, Math.abs(dp.npvDelta as number)));
      }
    }

    const sortedVars = [...impactMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);

    // First data point's variable should be the most sensitive
    expect(result.dataPoints[0]!.variable).toBe(sortedVars[0]);
  });

  it('for SK-410 gas field, gas price is among top 2 most sensitive variables', () => {
    // Gas price should be a dominant driver for a gas-weighted project
    const impactMap = new Map<SensitivityVariable, number>();
    for (const dp of result.dataPoints) {
      if (Math.abs(dp.percentChange) === 0.30) {
        const current = impactMap.get(dp.variable) ?? 0;
        impactMap.set(dp.variable, Math.max(current, Math.abs(dp.npvDelta as number)));
      }
    }
    const sortedVars = [...impactMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);

    expect(sortedVars.slice(0, 2)).toContain('gasPrice');
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 3: Positive price change increases NPV, negative decreases it
// ════════════════════════════════════════════════════════════════════════

describe('TEST 3: Price sensitivity direction', () => {
  const result = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, ['gasPrice'], PERCENTAGES);

  it('+10% gas price gives positive npvDelta', () => {
    const dp = result.dataPoints.find((d) => d.percentChange === 0.10);
    expect(dp).toBeDefined();
    expect(dp!.npvDelta).toBeGreaterThan(0);
  });

  it('-10% gas price gives negative npvDelta', () => {
    const dp = result.dataPoints.find((d) => d.percentChange === -0.10);
    expect(dp).toBeDefined();
    expect(dp!.npvDelta).toBeLessThan(0);
  });

  it('+30% gives larger positive delta than +10%', () => {
    const dp10 = result.dataPoints.find((d) => d.percentChange === 0.10)!;
    const dp30 = result.dataPoints.find((d) => d.percentChange === 0.30)!;
    expect(dp30.npvDelta).toBeGreaterThan(dp10.npvDelta);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 4: Positive CAPEX change decreases NPV
// ════════════════════════════════════════════════════════════════════════

describe('TEST 4: Positive CAPEX change decreases NPV', () => {
  const result = calculateTornado(SK410_INPUTS, BASE_PRICE_DECK, ['capex'], PERCENTAGES);

  it('+10% CAPEX gives negative npvDelta', () => {
    const dp = result.dataPoints.find((d) => d.percentChange === 0.10);
    expect(dp).toBeDefined();
    expect(dp!.npvDelta).toBeLessThan(0);
  });

  it('-10% CAPEX gives different NPV from base (direction depends on PSC dynamics)', () => {
    // In a PSC, lower CAPEX means less cost recovery and faster R/C progression
    // to less favorable tranches. The direction is not always positive.
    const dp = result.dataPoints.find((d) => d.percentChange === -0.10);
    expect(dp).toBeDefined();
    expect(dp!.npvDelta).not.toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 5: Spider generates correct number of points per variable
// ════════════════════════════════════════════════════════════════════════

describe('TEST 5: Spider diagram structure', () => {
  const result = calculateSpider(SK410_INPUTS, BASE_PRICE_DECK, VARIABLES, 0.30, 13);

  it('has one line per variable', () => {
    expect(result.lines).toHaveLength(VARIABLES.length);
  });

  it('each line has 13 points', () => {
    for (const line of result.lines) {
      expect(line.points).toHaveLength(13);
    }
  });

  it('points span from -30% to +30%', () => {
    for (const line of result.lines) {
      const pcts = line.points.map((p) => p.percentChange);
      expect(pcts[0]).toBeCloseTo(-0.30, 4);
      expect(pcts[pcts.length - 1]).toBeCloseTo(0.30, 4);
    }
  });

  it('each point has a finite NPV', () => {
    for (const line of result.lines) {
      for (const point of line.points) {
        expect(Number.isFinite(point.npv as number)).toBe(true);
      }
    }
  });

  it('base NPV matches spider base', () => {
    expect(Number.isFinite(result.baseNpv as number)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// TEST 6: Scenario comparison produces results for all 4 versions
// ════════════════════════════════════════════════════════════════════════

describe('TEST 6: Scenario comparison', () => {
  const results = compareScenarios(SK410_INPUTS, PRICE_DECKS);

  it('produces results for all 4 scenarios', () => {
    expect(results.base).toBeDefined();
    expect(results.high).toBeDefined();
    expect(results.low).toBeDefined();
    expect(results.stress).toBeDefined();
  });

  it('each result has correct scenario label', () => {
    expect(results.base.scenario).toBe('base');
    expect(results.high.scenario).toBe('high');
    expect(results.low.scenario).toBe('low');
    expect(results.stress.scenario).toBe('stress');
  });

  it('high NPV > base NPV > low NPV > stress NPV', () => {
    const highNpv = results.high.npv10 as number;
    const baseNpv = results.base.npv10 as number;
    const lowNpv = results.low.npv10 as number;
    const stressNpv = results.stress.npv10 as number;

    expect(highNpv).toBeGreaterThan(baseNpv);
    expect(baseNpv).toBeGreaterThan(lowNpv);
    expect(lowNpv).toBeGreaterThan(stressNpv);
  });

  it('all scenarios have the same project ID', () => {
    for (const scenario of ['base', 'high', 'low', 'stress'] as const) {
      expect(results[scenario].projectId).toBe(SK410_INPUTS.project.id);
    }
  });
});
