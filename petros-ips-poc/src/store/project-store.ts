// ════════════════════════════════════════════════════════════════════════
// PETROS IPS — Global Application Store (Zustand)
// ════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
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
  DataVersion,
  VersionedProjectData,
  VersionComparisonResult,
  UnitConversion,
  UnitPreferences,
  TimeGranularity,
  PhaseVersionData,
  PhaseComparisonResult,
  ProjectPhaseVersion,
} from '@/engine/types';
import { ALL_PROJECTS } from '@/data/projects';
import { PRICE_DECKS } from '@/data/price-decks';
import { PROJECT_HIERARCHY } from '@/data/hierarchy';
import { buildVersionedDataRegistry } from '@/data/versioned-data';
import { buildPhaseDataRegistry } from '@/data/phase-data';
import { calculateProjectEconomics } from '@/engine/economics/cashflow';
import { compareVersions as engineCompareVersions } from '@/engine/economics/version-comparison';
import { comparePhases as engineComparePhases } from '@/engine/economics/phase-comparison';
import { calculateTornado } from '@/engine/sensitivity/tornado';
import { runMonteCarlo } from '@/engine/montecarlo/simulation';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';
import {
  DEFAULT_CONVERSIONS,
  addConversion as engineAddConv,
  updateConversion as engineUpdateConv,
  removeConversion as engineRemoveConv,
  type NewConversionInput,
} from '@/engine/utils/unit-conversion';

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
  mobileSidebarOpen: boolean;
  isCalculating: boolean;

  // Overrides for what-if analysis
  projectOverrides: Map<string, { productionProfile: ProductionProfile; costProfile: CostProfile }>;

  // Results
  economicsResults: Map<string, Map<ScenarioVersion, EconomicsResult>>;
  sensitivityResults: Map<string, TornadoResult>;
  monteCarloResults: Map<string, MonteCarloResult>;
  portfolioResult: PortfolioResult | null;

  // ── Feature 1: Multi-version data management ────────────────────────
  versionedData: Map<string, Map<DataVersion, VersionedProjectData>>;
  activeDataVersion: DataVersion;
  versionComparisonResults: Map<string, VersionComparisonResult>;

  // ── Feature 2: Configurable unit conversion ─────────────────────────
  unitConversions: UnitConversion[];
  unitPreferences: UnitPreferences;

  // ── Feature 3: Time granularity ─────────────────────────────────────
  activeTimeGranularity: TimeGranularity;

  // ── Feature 4: Phase comparison ─────────────────────────────────────
  phaseData: Map<string, PhaseVersionData[]>;
  phaseComparisonResult: PhaseComparisonResult | null;
}

interface ProjectStoreActions {
  setActiveProject: (id: string | null) => void;
  setActiveScenario: (version: ScenarioVersion) => void;
  toggleProjectInPortfolio: (id: string) => void;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  runProjectEconomics: (projectId: string, scenario: ScenarioVersion) => void;
  runAllProjectEconomics: () => void;
  runSensitivity: (projectId: string) => void;
  runMonteCarlo: (projectId: string, config: MonteCarloConfig) => void;
  updateProjectOverrides: (projectId: string, overrides: { productionProfile: ProductionProfile; costProfile: CostProfile } | null) => void;
  recalculatePortfolio: () => void;
  initialize: () => void;

  // ── Feature 1: Versioned data ───────────────────────────────────────
  setActiveDataVersion: (version: DataVersion) => void;
  compareVersions: (projectId: string, v1: DataVersion, v2: DataVersion) => void;

  // ── Feature 2: Unit conversion ──────────────────────────────────────
  addUnitConversion: (input: NewConversionInput) => void;
  updateUnitConversion: (id: string, factor: number) => void;
  removeUnitConversion: (id: string) => void;
  setUnitPreference: (category: keyof UnitPreferences, unit: string) => void;

  // ── Feature 3: Time granularity ─────────────────────────────────────
  setTimeGranularity: (g: TimeGranularity) => void;

  // ── Feature 4: Phase comparison ─────────────────────────────────────
  comparePhases: (projectId: string, phase1: ProjectPhaseVersion, phase2: ProjectPhaseVersion) => void;
}

type ProjectStore = ProjectStoreState & ProjectStoreActions;

// ── Helper: get active economics result ───────────────────────────────

export function getActiveResult(state: ProjectStoreState): EconomicsResult | null {
  if (!state.activeProjectId) return null;
  const projectResults = state.economicsResults.get(state.activeProjectId);
  return projectResults?.get(state.activeScenario) ?? null;
}

// ── Helpers: effective projects (base + what-if overrides) ───────────
//
// What-if edits live in `projectOverrides`. Any code path that READS
// project data for calculation or display must use these helpers so
// overrides propagate everywhere — not just the per-scenario economics
// the store action computed.
//
// These are pure functions over the relevant slice of state. The hooks
// below wrap them in `useMemo` so consumers get stable references when
// nothing relevant changed (otherwise Zustand's default Object.is
// comparison would treat every render as fresh state and re-render).

type OverrideSlice = Pick<ProjectStoreState, 'projects' | 'projectOverrides'>;

export function getEffectiveProject(
  state: OverrideSlice,
  projectId: string | null,
): ProjectInputs | null {
  if (!projectId) return null;
  const base = state.projects.find((p) => p.project.id === projectId);
  if (!base) return null;
  const overrides = state.projectOverrides.get(projectId);
  if (!overrides) return base;
  return {
    ...base,
    productionProfile: overrides.productionProfile,
    costProfile: overrides.costProfile,
  };
}

export function getEffectiveProjects(
  state: OverrideSlice,
): readonly ProjectInputs[] {
  if (state.projectOverrides.size === 0) return state.projects;
  return state.projects.map((base) => {
    const overrides = state.projectOverrides.get(base.project.id);
    if (!overrides) return base;
    return {
      ...base,
      productionProfile: overrides.productionProfile,
      costProfile: overrides.costProfile,
    };
  });
}

/** Hook — returns the override-merged active project, stable when state is unchanged. */
export function useEffectiveActiveProject(): ProjectInputs | null {
  const projects = useProjectStore((s) => s.projects);
  const projectOverrides = useProjectStore((s) => s.projectOverrides);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  return useMemo(
    () => getEffectiveProject({ projects, projectOverrides }, activeProjectId),
    [projects, projectOverrides, activeProjectId],
  );
}

/** Hook — returns the override-merged project array. Stable when unchanged. */
export function useEffectiveProjects(): readonly ProjectInputs[] {
  const projects = useProjectStore((s) => s.projects);
  const projectOverrides = useProjectStore((s) => s.projectOverrides);
  return useMemo(
    () => getEffectiveProjects({ projects, projectOverrides }),
    [projects, projectOverrides],
  );
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
  mobileSidebarOpen: false,
  isCalculating: false,

  // Overrides
  projectOverrides: new Map(),

  // Empty results
  economicsResults: new Map(),
  sensitivityResults: new Map(),
  monteCarloResults: new Map(),
  portfolioResult: null,

  // Feature 1: versioned data registry
  versionedData: buildVersionedDataRegistry(),
  activeDataVersion: 'budget' as DataVersion,
  versionComparisonResults: new Map(),

  // Feature 2: unit conversions and preferences
  unitConversions: [...DEFAULT_CONVERSIONS],
  unitPreferences: {
    oilVolume: 'bbl',
    gasVolume: 'MMscf',
    mass: 'tonne',
    currency: 'USD',
    energy: 'MMBtu',
  },

  // Feature 3: time granularity
  activeTimeGranularity: 'yearly' as TimeGranularity,

  // Feature 4: phase data
  phaseData: buildPhaseDataRegistry(),
  phaseComparisonResult: null,

  // ── Actions ─────────────────────────────────────────────────────────

  setActiveProject: (id) => set({ activeProjectId: id }),

  setActiveScenario: (version) => {
    // Cached version/phase comparison results used the old scenario's
    // price deck; drop them so the UI forces a fresh run under the new
    // scenario instead of showing stale numbers.
    set({
      activeScenario: version,
      versionComparisonResults: new Map(),
      phaseComparisonResult: null,
    });
    get().recalculatePortfolio();
  },

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

  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

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

    for (const baseProject of state.projects) {
      // Apply any what-if overrides the user has set on the Economics page
      // so Recalculate All refreshes every scenario consistently with the
      // per-project Calculate button.
      const overrides = state.projectOverrides.get(baseProject.project.id);
      const project: ProjectInputs = overrides
        ? {
            ...baseProject,
            productionProfile: overrides.productionProfile,
            costProfile: overrides.costProfile,
          }
        : baseProject;

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
    const project = getEffectiveProject(state, projectId);
    if (!project) return;

    const result = calculateTornado(project, state.priceDecks[state.activeScenario]);
    const updated = new Map(state.sensitivityResults);
    updated.set(projectId, result);
    set({ sensitivityResults: updated });
  },

  runMonteCarlo: (projectId, config) => {
    const state = get();
    const project = getEffectiveProject(state, projectId);
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

  // ── Feature 1: Versioned data actions ──────────────────────────────

  setActiveDataVersion: (version) => {
    set({ activeDataVersion: version });
    // Re-run economics for the active project under the new data version's
    // production/cost profile.
    const state = get();
    if (state.activeProjectId) {
      const projVersions = state.versionedData.get(state.activeProjectId);
      const data = projVersions?.get(version);
      if (data) {
        state.updateProjectOverrides(state.activeProjectId, {
          productionProfile: data.productionProfile,
          costProfile: data.costProfile,
        });
        state.runProjectEconomics(state.activeProjectId, state.activeScenario);
      }
    }
  },

  compareVersions: (projectId, v1, v2) => {
    const state = get();
    const projVersions = state.versionedData.get(projectId);
    if (!projVersions) return;
    const d1 = projVersions.get(v1);
    const d2 = projVersions.get(v2);
    if (!d1 || !d2) return;
    const baseProject = state.projects.find((p) => p.project.id === projectId);
    if (!baseProject) return;

    const result = engineCompareVersions(
      baseProject,
      state.priceDecks[state.activeScenario],
      d1,
      d2,
    );
    const updated = new Map(state.versionComparisonResults);
    updated.set(projectId, result);
    set({ versionComparisonResults: updated });
  },

  // ── Feature 2: Unit conversion actions ─────────────────────────────

  addUnitConversion: (input) => {
    set((s) => ({ unitConversions: engineAddConv(s.unitConversions, input) }));
  },

  updateUnitConversion: (id, factor) => {
    set((s) => ({ unitConversions: engineUpdateConv(s.unitConversions, id, factor) }));
  },

  removeUnitConversion: (id) => {
    set((s) => ({ unitConversions: engineRemoveConv(s.unitConversions, id) }));
  },

  setUnitPreference: (category, unit) => {
    set((s) => ({ unitPreferences: { ...s.unitPreferences, [category]: unit } }));
  },

  // ── Feature 3: Time granularity action ─────────────────────────────

  setTimeGranularity: (g) => set({ activeTimeGranularity: g }),

  // ── Feature 4: Phase comparison action ─────────────────────────────

  comparePhases: (projectId, phase1, phase2) => {
    const state = get();
    const phases = state.phaseData.get(projectId);
    if (!phases) return;
    const p1 = phases.find((p) => p.phase === phase1);
    const p2 = phases.find((p) => p.phase === phase2);
    if (!p1 || !p2) return;
    const baseProject = state.projects.find((p) => p.project.id === projectId);
    if (!baseProject) return;

    const result = engineComparePhases(
      baseProject,
      state.priceDecks[state.activeScenario],
      p1,
      p2,
    );
    set({ phaseComparisonResult: result });
  },
}));
