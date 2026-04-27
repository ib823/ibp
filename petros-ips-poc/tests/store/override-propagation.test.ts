import { beforeEach, describe, expect, it } from 'vitest';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { runMonteCarlo as runMonteCarloEngine } from '@/engine/montecarlo/simulation';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import type {
  CostProfile,
  MonteCarloConfig,
  ProductionProfile,
  ProjectInputs,
  ScenarioVersion,
  TimeSeriesData,
} from '@/engine/types';
import { useProjectStore } from '@/store/project-store';
import { resetStore } from '../ui/test-utils';

const MC_CONFIG: MonteCarloConfig = {
  iterations: 250,
  seed: 'override-regression',
  distributions: {
    oilPrice: { type: 'triangular', params: { min: 0.8, mode: 1, max: 1.25 } },
    gasPrice: { type: 'triangular', params: { min: 0.8, mode: 1, max: 1.25 } },
    production: { type: 'lognormal', params: { mu: 0, sigma: 0.1 } },
    capex: { type: 'normal', params: { mean: 1, stdDev: 0.1 } },
    opex: { type: 'normal', params: { mean: 1, stdDev: 0.08 } },
  },
};

function scaleSeries<T extends number>(series: TimeSeriesData<T>, factor: number): TimeSeriesData<T> {
  const scaled: Record<number, T> = {};
  for (const [year, value] of Object.entries(series)) {
    scaled[Number(year)] = (value * factor) as T;
  }
  return scaled;
}

function buildOverride(project: ProjectInputs): {
  productionProfile: ProductionProfile;
  costProfile: CostProfile;
  expectedProject: ProjectInputs;
} {
  const productionProfile: ProductionProfile = {
    oil: scaleSeries(project.productionProfile.oil, 1.08),
    gas: scaleSeries(project.productionProfile.gas, 1.08),
    condensate: scaleSeries(project.productionProfile.condensate, 1.08),
    water: project.productionProfile.water,
  };

  const costProfile: CostProfile = {
    capexDrilling: scaleSeries(project.costProfile.capexDrilling, 1.12),
    capexFacilities: scaleSeries(project.costProfile.capexFacilities, 1.12),
    capexSubsea: scaleSeries(project.costProfile.capexSubsea, 1.12),
    capexOther: scaleSeries(project.costProfile.capexOther, 1.12),
    opexFixed: scaleSeries(project.costProfile.opexFixed, 1.05),
    opexVariable: project.costProfile.opexVariable,
    abandonmentCost: scaleSeries(project.costProfile.abandonmentCost, 1.03),
  };

  return {
    productionProfile,
    costProfile,
    expectedProject: {
      ...project,
      productionProfile,
      costProfile,
    },
  };
}

describe('override propagation regressions', () => {
  beforeEach(() => {
    resetStore({ activeProjectId: 'sk-410' });
  });

  it('recalculates every scenario from the override-adjusted project', () => {
    const state = useProjectStore.getState();
    const baseProject = state.projects.find((project) => project.project.id === 'sk-410');
    expect(baseProject).toBeDefined();

    const override = buildOverride(baseProject!);
    state.updateProjectOverrides('sk-410', {
      productionProfile: override.productionProfile,
      costProfile: override.costProfile,
    });
    state.runAllProjectEconomics();

    const updatedResults = useProjectStore.getState().economicsResults.get('sk-410');
    expect(updatedResults).toBeDefined();

    for (const scenario of ['base', 'high', 'low', 'stress'] as ScenarioVersion[]) {
      const expected = calculateProjectEconomics(
        override.expectedProject,
        state.priceDecks[scenario],
        scenario,
      );
      const actual = updatedResults!.get(scenario);
      expect(actual).toBeDefined();
      expect(actual!.npv10).toBeCloseTo(expected.npv10 as number, 6);
      expect(actual!.totalCapex).toBeCloseTo(expected.totalCapex as number, 6);
      expect(actual!.totalRevenue).toBeCloseTo(expected.totalRevenue as number, 6);
      expect(actual!.yearlyCashflows[0]?.netCashFlow).toBeCloseTo(
        expected.yearlyCashflows[0]?.netCashFlow as number,
        6,
      );
    }
  });

  it('runs sensitivity from the override-adjusted project', () => {
    const state = useProjectStore.getState();
    const baseProject = state.projects.find((project) => project.project.id === 'sk-410');
    expect(baseProject).toBeDefined();

    const override = buildOverride(baseProject!);
    state.updateProjectOverrides('sk-410', {
      productionProfile: override.productionProfile,
      costProfile: override.costProfile,
    });
    state.runSensitivity('sk-410');

    const actual = useProjectStore.getState().sensitivityResults.get('sk-410');
    // Store extended the variable set to include FX / fiscal / reserves (D36/D38/D40).
    const expected = calculateTornado(
      override.expectedProject,
      state.priceDecks[state.activeScenario],
      ['oilPrice', 'gasPrice', 'production', 'capex', 'opex', 'fx', 'pitaRate', 'sarawakSstRate', 'reserves'],
    );
    expect(actual).toBeDefined();
    expect(actual!.baseNpv).toBeCloseTo(expected.baseNpv as number, 6);
    expect(actual!.dataPoints).toHaveLength(expected.dataPoints.length);
    expect(actual!.dataPoints[0]?.npvValue).toBeCloseTo(expected.dataPoints[0]?.npvValue as number, 6);
    expect(actual!.dataPoints.at(-1)?.npvDelta).toBeCloseTo(expected.dataPoints.at(-1)?.npvDelta as number, 6);
  });

  it('runs Monte Carlo from the override-adjusted project with deterministic parity', () => {
    const state = useProjectStore.getState();
    const baseProject = state.projects.find((project) => project.project.id === 'sk-410');
    expect(baseProject).toBeDefined();

    const override = buildOverride(baseProject!);
    state.updateProjectOverrides('sk-410', {
      productionProfile: override.productionProfile,
      costProfile: override.costProfile,
    });
    state.runMonteCarlo('sk-410', MC_CONFIG);

    const actual = useProjectStore.getState().monteCarloResults.get('sk-410');
    const expected = runMonteCarloEngine(
      override.expectedProject,
      state.priceDecks[state.activeScenario],
      MC_CONFIG,
    );
    expect(actual).toBeDefined();
    expect(actual!.p10).toBeCloseTo(expected.p10 as number, 6);
    expect(actual!.p50).toBeCloseTo(expected.p50 as number, 6);
    expect(actual!.p90).toBeCloseTo(expected.p90 as number, 6);
    expect(actual!.mean).toBeCloseTo(expected.mean as number, 6);
    expect(actual!.stdDev).toBeCloseTo(expected.stdDev, 6);
  });
});
