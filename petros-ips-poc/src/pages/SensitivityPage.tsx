import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';
import { TornadoChart } from '@/components/charts/TornadoChart';
import { SpiderDiagramChart } from '@/components/charts/SpiderDiagramChart';
import { ScenarioBarChart } from '@/components/charts/ScenarioComparisonChart';
import { ScenarioCashFlowOverlay } from '@/components/charts/ScenarioCashFlowOverlay';
import { calculateSpider } from '@/engine/sensitivity/spider';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { BarChart3, Activity, Layers } from 'lucide-react';
import { fmtM, fmtPct, fmtYears } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';
import type { SpiderResult } from '@/engine/sensitivity/spider';

export default function SensitivityPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const sensitivityResults = useProjectStore((s) => s.sensitivityResults);
  const runSensitivity = useProjectStore((s) => s.runSensitivity);
  const priceDecks = useProjectStore((s) => s.priceDecks);
  const activeScenario = useProjectStore((s) => s.activeScenario);

  const [spiderResult, setSpiderResult] = useState<SpiderResult | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<ScenarioVersion, EconomicsResult> | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const tornadoResult = activeProjectId ? sensitivityResults.get(activeProjectId) ?? null : null;
  const activeProject = projects.find((p) => p.project.id === activeProjectId);

  const handleRunAll = useCallback(() => {
    if (!activeProjectId || !activeProject) return;
    setIsRunning(true);

    // Tornado
    runSensitivity(activeProjectId);

    // Spider
    const spider = calculateSpider(
      activeProject,
      priceDecks[activeScenario],
      ['oilPrice', 'gasPrice', 'production', 'capex', 'opex'],
    );
    setSpiderResult(spider);

    // Scenario comparison
    const scenarios = compareScenarios(activeProject, priceDecks);
    setScenarioResults(scenarios);

    setIsRunning(false);
  }, [activeProjectId, activeProject, runSensitivity, priceDecks, activeScenario]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Sensitivity Analysis</h2>
        <div className="flex items-center gap-3">
          <Select
            value={activeProjectId ?? ''}
            onValueChange={(v) => setActiveProject(v)}
          >
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.project.id} value={p.project.id} className="text-xs">
                  {p.project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleRunAll}
            disabled={!activeProjectId || isRunning}
            className="bg-petrol hover:bg-petrol-light text-white text-xs"
          >
            <BarChart3 size={14} className="mr-1.5" />
            Run Sensitivity
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tornado" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tornado" className="text-xs gap-1.5">
            <BarChart3 size={14} /> Tornado
          </TabsTrigger>
          <TabsTrigger value="spider" className="text-xs gap-1.5">
            <Activity size={14} /> Spider
          </TabsTrigger>
          <TabsTrigger value="scenario" className="text-xs gap-1.5">
            <Layers size={14} /> Scenario Comparison
          </TabsTrigger>
        </TabsList>

        {/* TORNADO TAB */}
        <TabsContent value="tornado">
          {!tornadoResult ? (
            <EmptyState message="Click 'Run Sensitivity' to generate tornado chart" />
          ) : (
            <div className="border border-border bg-white p-5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Tornado Chart — NPV Sensitivity at ±30%
              </h4>
              <TornadoChart result={tornadoResult} />
              <div className="flex items-center gap-6 mt-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 inline-block" style={{ backgroundColor: '#E07060' }} />
                  Downside (−30%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 inline-block" style={{ backgroundColor: '#3B8DBD' }} />
                  Upside (+30%)
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* SPIDER TAB */}
        <TabsContent value="spider">
          {!spiderResult ? (
            <EmptyState message="Click 'Run Sensitivity' to generate spider diagram" />
          ) : (
            <div className="border border-border bg-white p-5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Spider Diagram — NPV vs % Change
              </h4>
              <SpiderDiagramChart result={spiderResult} />
              <p className="text-[10px] text-text-muted mt-2">
                Steeper lines indicate higher sensitivity. The intersection at 0% marks the base case NPV.
              </p>
            </div>
          )}
        </TabsContent>

        {/* SCENARIO TAB */}
        <TabsContent value="scenario">
          {!scenarioResults ? (
            <EmptyState message="Click 'Run Sensitivity' to compare scenarios" />
          ) : (
            <div className="space-y-4">
              {/* KPI Comparison Table */}
              <div className="border border-border bg-white p-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                  Key Metrics by Scenario
                </h4>
                <ScenarioKpiTable results={scenarioResults} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* NPV Bar Chart */}
                <div className="border border-border bg-white p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    NPV₁₀ by Scenario
                  </h4>
                  <ScenarioBarChart results={scenarioResults} />
                </div>

                {/* Cumulative NCF Overlay */}
                <div className="border border-border bg-white p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    Cumulative Cash Flow Overlay
                  </h4>
                  <ScenarioCashFlowOverlay results={scenarioResults} />
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 border border-border bg-white">
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

function ScenarioKpiTable({ results }: { results: Record<ScenarioVersion, EconomicsResult> }) {
  const scenarios: ScenarioVersion[] = ['high', 'base', 'low', 'stress'];
  const labels: Record<ScenarioVersion, string> = {
    high: 'High',
    base: 'Base',
    low: 'Low',
    stress: 'Stress',
  };

  const npvs = scenarios.map((s) => results[s].npv10 as number);
  const maxNpv = Math.max(...npvs);
  const minNpv = Math.min(...npvs);

  type HighlightType = 'best' | 'worst' | undefined;
  interface CellVal { text: string; highlight?: HighlightType }

  const rows: { label: string; values: CellVal[] }[] = [
    {
      label: 'NPV₁₀ ($M)',
      values: scenarios.map((s) => ({
        text: fmtM(results[s].npv10 as number),
        highlight: (results[s].npv10 as number) === maxNpv ? 'best' as const :
                   (results[s].npv10 as number) === minNpv ? 'worst' as const : undefined,
      })),
    },
    {
      label: 'IRR',
      values: scenarios.map((s) => ({
        text: results[s].isNonInvestmentPattern
          ? fmtPct(results[s].mirr) + ' (MIRR)'
          : fmtPct(results[s].irr ?? 0),
      })),
    },
    {
      label: 'Payback (yrs)',
      values: scenarios.map((s) => ({ text: fmtYears(results[s].paybackYears) })),
    },
    {
      label: 'PI',
      values: scenarios.map((s) => ({ text: results[s].profitabilityIndex.toFixed(2) })),
    },
    {
      label: 'Govt Take',
      values: scenarios.map((s) => ({ text: results[s].governmentTakePct.toFixed(1) + '%' })),
    },
  ];

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 py-2 w-[140px]">
            Metric
          </th>
          {scenarios.map((s) => (
            <th key={s} className="text-right text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 py-2">
              {labels[s]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-border/50">
            <td className="text-xs text-text-secondary px-3 py-2">{row.label}</td>
            {row.values.map((v, i) => (
              <td
                key={i}
                className={cn(
                  'text-right font-data text-xs px-3 py-2',
                  v.highlight === 'best' && 'text-success font-semibold bg-success/5',
                  v.highlight === 'worst' && 'text-danger font-semibold bg-danger/5',
                )}
              >
                {v.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
