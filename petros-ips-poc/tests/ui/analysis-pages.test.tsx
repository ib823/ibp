import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MonteCarloPage from '@/pages/MonteCarloPage';
import SensitivityPage from '@/pages/SensitivityPage';
import { PhaseComparisonView } from '@/components/phase/PhaseComparisonView';
import { VersionComparisonView } from '@/components/version/VersionComparisonView';
import { useProjectStore } from '@/store/project-store';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { compareVersions } from '@/engine/economics/version-comparison';
import { comparePhases } from '@/engine/economics/phase-comparison';
import { formatMoney, fmtYears } from '@/lib/format';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import { renderWithRouter, resetStore } from './test-utils';

function fmtMoney(value: number, accounting = false) {
  return formatMoney(value, {
    currency: 'USD',
    conversions: DEFAULT_CONVERSIONS,
    accounting,
  });
}

describe('analysis page regressions against engine truth', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Sensitivity page scenario table matches compareScenarios output', () => {
    const state = useProjectStore.getState();
    const activeProject = state.projects.find((p) => p.project.id === state.activeProjectId)!;
    const expected = compareScenarios(activeProject, state.priceDecks);

    renderWithRouter(<SensitivityPage />);
    fireEvent.click(screen.getByText('Run Sensitivity'));
    const tabContainer = document.querySelector('ui5-tabcontainer');
    const tabs = document.querySelectorAll('ui5-tab');
    expect(tabContainer).not.toBeNull();
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    fireEvent(
      tabContainer as Element,
      new CustomEvent('tab-select', {
        detail: { tab: tabs[2] },
        bubbles: true,
      }),
    );

    expect(screen.getByText('Key Metrics by Scenario')).toBeInTheDocument();
    expect(screen.getByText(fmtMoney(expected.base.npv10 as number, true))).toBeInTheDocument();
    expect(screen.getByText(fmtYears(expected.stress.paybackYears))).toBeInTheDocument();
  });

  it('Monte Carlo page statistics and percentile cards match the simulation result', async () => {
    renderWithRouter(<MonteCarloPage />);
    fireEvent.click(screen.getByText('Run Simulation'));

    const state = useProjectStore.getState();
    const result = state.monteCarloResults.get(state.activeProjectId!);
    expect(result).toBeDefined();

    expect((await screen.findAllByText(fmtMoney(result!.p50 as number, true))).length).toBeGreaterThan(0);

    const statsTable = screen.getByRole('table');
    const meanRow = within(statsTable).getByText('Mean NPV').closest('tr');
    expect(meanRow).not.toBeNull();
    expect(within(meanRow as HTMLTableRowElement).getByText(fmtMoney(result!.mean as number, true))).toBeInTheDocument();

    const probPositive = (
      result!.npvValues.filter((v) => (v as number) > 0).length / result!.npvValues.length * 100
    ).toFixed(1) + '%';
    const probabilityRow = within(statsTable).getByText('P(NPV > 0)').closest('tr');
    expect(probabilityRow).not.toBeNull();
    expect(within(probabilityRow as HTMLTableRowElement).getByText(probPositive)).toBeInTheDocument();
  });

  it('Version comparison view matches engine-computed delta values', () => {
    resetStore({ activeProjectId: 'sk-410' });
    const state = useProjectStore.getState();
    const project = state.projects.find((p) => p.project.id === 'sk-410')!;
    const versions = state.versionedData.get('sk-410')!;
    const expected = compareVersions(
      project,
      state.priceDecks[state.activeScenario],
      versions.get('budget')!,
      versions.get('forecast')!,
    );

    render(<VersionComparisonView />);
    fireEvent.click(screen.getByText('Compare Versions'));

    expect(screen.getByText('Year-by-Year Variance')).toBeInTheDocument();
    // Variance values may coincidentally render the same money string in
    // multiple cells (e.g. KPI tile + table cell). `getAllByText` tolerates
    // collisions while still asserting visibility. (D29 production shift
    // surfaced this brittleness.)
    expect(screen.getAllByText(fmtMoney(expected.npvVariance, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtMoney(expected.capexVariance, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${(expected.productionVariance / 1e6).toFixed(1)} MMboe`).length).toBeGreaterThan(0);
  });

  it('Phase comparison view matches engine-computed economics deltas', () => {
    resetStore({ activeProjectId: 'sk-612' });
    const state = useProjectStore.getState();
    const project = state.projects.find((p) => p.project.id === 'sk-612')!;
    const phases = state.phaseData.get('sk-612')!;
    const expected = comparePhases(
      project,
      state.priceDecks[state.activeScenario],
      phases[0]!,
      phases[1]!,
    );

    render(<PhaseComparisonView />);
    fireEvent.click(screen.getByText('Compare Phases'));

    expect(screen.getByText('Economics Comparison')).toBeInTheDocument();
    expect(screen.getByText(fmtMoney(expected.economics1.npv10 as number, true))).toBeInTheDocument();
    expect(screen.getByText(fmtMoney(expected.economics2.npv10 as number, true))).toBeInTheDocument();
    expect(screen.getByText(fmtMoney(expected.npvDelta, true))).toBeInTheDocument();
    expect(screen.getByText(`${expected.economics2.profitabilityIndex.toFixed(2)}`)).toBeInTheDocument();
  });
});
