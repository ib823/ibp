// ════════════════════════════════════════════════════════════════════════
// PETROS IPS — Global Application Store (Zustand)
// ════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import type {
  ProjectInputs,
  ProductionProfile,
  CostProfile,
  PriceDeck,
  ScenarioVersion,
  EconomicsResult,
  TornadoResult,
  MonteCarloResult,
  MonteCarloConfig,
  PortfolioResult,
  OrgHierarchy,
} from '@/engine/types';
import { ALL_PROJECTS } from '@/data/projects';
import { PRICE_DECKS } from '@/data/price-decks';
import { PROJECT_HIERARCHY } from '@/data/hierarchy';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import { runMonteCarlo } from '@/engine/montecarlo/simulation';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';

// ── State Shape ───────────────────────────────────────────────────────

interface ProjectStoreState {
  // Data
  projects: readonly ProjectInputs[];
  priceDecks: Record<ScenarioVersion, PriceDeck>;
  hierarchy: readonly OrgHierarchy[];

  // UI State
  activeProjectId: string | null;
  activeScenario: ScenarioVersion;
  portfolioSelection: Set<string>;
  sidebarCollapsed: boolean;
  isCalculating: boolean;

  // Overrides for what-if analysis
  projectOverrides: Map<string, { productionProfile: ProductionProfile; costProfile: CostProfile }>;

  // Results
  economicsResults: Map<string, Map<ScenarioVersion, EconomicsResult>>;
  sensitivityResults: Map<string, TornadoResult>;
  monteCarloResults: Map<string, MonteCarloResult>;
  portfolioResult: PortfolioResult | null;
}

interface ProjectStoreActions {
  setActiveProject: (id: string | null) => void;
  setActiveScenario: (version: ScenarioVersion) => void;
  toggleProjectInPortfolio: (id: string) => void;
  toggleSidebar: () => void;
  runProjectEconomics: (projectId: string, scenario: ScenarioVersion) => void;
  runAllProjectEconomics: () => void;
  runSensitivity: (projectId: string) => void;
  runMonteCarlo: (projectId: string, config: MonteCarloConfig) => void;
  updateProjectOverrides: (projectId: string, overrides: { productionProfile: ProductionProfile; costProfile: CostProfile } | null) => void;
  recalculatePortfolio: () => void;
  initialize: () => void;
}

type ProjectStore = ProjectStoreState & ProjectStoreActions;

// ── Helper: get active economics result ───────────────────────────────

export function getActiveResult(state: ProjectStoreState): EconomicsResult | null {
  if (!state.activeProjectId) return null;
  const projectResults = state.economicsResults.get(state.activeProjectId);
  return projectResults?.get(state.activeScenario) ?? null;
}

// ── Store ─────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // Initial data
  projects: ALL_PROJECTS,
  priceDecks: PRICE_DECKS,
  hierarchy: PROJECT_HIERARCHY,

  // UI defaults
  activeProjectId: ALL_PROJECTS[0]?.project.id ?? null,
  activeScenario: 'base',
  portfolioSelection: new Set(ALL_PROJECTS.map((p) => p.project.id)),
  sidebarCollapsed: false,
  isCalculating: false,

  // Overrides
  projectOverrides: new Map(),

  // Empty results
  economicsResults: new Map(),
  sensitivityResults: new Map(),
  monteCarloResults: new Map(),
  portfolioResult: null,

  // ── Actions ─────────────────────────────────────────────────────────

  setActiveProject: (id) => set({ activeProjectId: id }),

  setActiveScenario: (version) => { set({ activeScenario: version }); get().recalculatePortfolio(); },

  toggleProjectInPortfolio: (id) => {
    const selection = new Set(get().portfolioSelection);
    if (selection.has(id)) {
      selection.delete(id);
    } else {
      selection.add(id);
    }
    set({ portfolioSelection: selection });
    get().recalculatePortfolio();
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  updateProjectOverrides: (projectId, overrides) => {
    const updated = new Map(get().projectOverrides);
    if (overrides) {
      updated.set(projectId, overrides);
    } else {
      updated.delete(projectId);
    }
    set({ projectOverrides: updated });
  },

  runProjectEconomics: (projectId, scenario) => {
    const state = get();
    const baseProject = state.projects.find((p) => p.project.id === projectId);
    if (!baseProject) return;

    // Apply overrides if any
    const overrides = state.projectOverrides.get(projectId);
    const project: ProjectInputs = overrides
      ? { ...baseProject, productionProfile: overrides.productionProfile, costProfile: overrides.costProfile }
      : baseProject;

    const priceDeck = state.priceDecks[scenario];
    const result = calculateProjectEconomics(project, priceDeck, scenario);

    const updatedResults = new Map(state.economicsResults);
    const projectResults = new Map(updatedResults.get(projectId) ?? new Map());
    projectResults.set(scenario, result);
    updatedResults.set(projectId, projectResults);

    set({ economicsResults: updatedResults });
  },

  runAllProjectEconomics: () => {
    set({ isCalculating: true });
    const state = get();
    const allResults = new Map<string, Map<ScenarioVersion, EconomicsResult>>();

    for (const project of state.projects) {
      const projectResults = new Map<ScenarioVersion, EconomicsResult>();
      for (const scenario of ['base', 'high', 'low', 'stress'] as const) {
        const priceDeck = state.priceDecks[scenario];
        projectResults.set(scenario, calculateProjectEconomics(project, priceDeck, scenario));
      }
      allResults.set(project.project.id, projectResults);
    }

    set({ economicsResults: allResults, isCalculating: false });
    get().recalculatePortfolio();
  },

  runSensitivity: (projectId) => {
    const state = get();
    const project = state.projects.find((p) => p.project.id === projectId);
    if (!project) return;

    const result = calculateTornado(project, state.priceDecks[state.activeScenario]);
    const updated = new Map(state.sensitivityResults);
    updated.set(projectId, result);
    set({ sensitivityResults: updated });
  },

  runMonteCarlo: (projectId, config) => {
    const state = get();
    const project = state.projects.find((p) => p.project.id === projectId);
    if (!project) return;

    set({ isCalculating: true });
    const result = runMonteCarlo(project, state.priceDecks[state.activeScenario], config);
    const updated = new Map(state.monteCarloResults);
    updated.set(projectId, result);
    set({ monteCarloResults: updated, isCalculating: false });
  },

  recalculatePortfolio: () => {
    const state = get();
    const resultsForScenario = new Map<string, EconomicsResult>();
    for (const [id, scenarioMap] of state.economicsResults) {
      const result = scenarioMap.get(state.activeScenario);
      if (result) resultsForScenario.set(id, result);
    }

    const portfolioResult = aggregatePortfolio(
      state.projects,
      resultsForScenario,
      state.portfolioSelection,
      state.hierarchy,
    );

    set({ portfolioResult });
  },

  initialize: () => {
    get().runAllProjectEconomics();
  },
}));
