import React from 'react';
import { act, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { useProjectStore } from '@/store/project-store';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import type { ScenarioVersion, ProjectInputs } from '@/engine/types';

const DEFAULT_UNIT_PREFERENCES = {
  oilVolume: 'bbl',
  gasVolume: 'MMscf',
  mass: 'tonne',
  currency: 'USD',
  energy: 'MMBtu',
} as const;

export function resetStore(options?: {
  activeProjectId?: string | null;
  activeScenario?: ScenarioVersion;
  selectedProjectIds?: string[];
}) {
  const state = useProjectStore.getState();
  const projects = state.projects;
  const activeProjectId = options?.activeProjectId ?? projects[0]?.project.id ?? null;
  const selectedProjectIds = options?.selectedProjectIds ?? projects.map((p) => p.project.id);

  act(() => {
    useProjectStore.setState({
      activeProjectId,
      activeScenario: options?.activeScenario ?? 'base',
      portfolioSelection: new Set(selectedProjectIds),
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      isCalculating: false,
      projectOverrides: new Map(),
      economicsResults: new Map(),
      sensitivityResults: new Map(),
      monteCarloResults: new Map(),
      portfolioResult: null,
      activeDataVersion: 'budget',
      versionComparisonResults: new Map(),
      unitConversions: [...DEFAULT_CONVERSIONS],
      unitPreferences: { ...DEFAULT_UNIT_PREFERENCES },
      activeTimeGranularity: 'yearly',
      phaseComparisonResult: null,
    });
  });

  act(() => {
    useProjectStore.getState().runAllProjectEconomics();
  });
}

export function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

export function getActiveProject(): ProjectInputs {
  const state = useProjectStore.getState();
  const project = state.projects.find((p) => p.project.id === state.activeProjectId);
  if (!project) throw new Error('Expected an active project in test store');
  return project;
}
