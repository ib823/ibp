import { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Tabs } from '@/components/ui5/Ui5Tabs';
import { Select } from '@/components/ui5/Ui5Select';
import { Button } from '@/components/ui5/Ui5Button';
import { useProjectStore } from '@/store/project-store';
import { TornadoChart } from '@/components/charts/TornadoChart';
import { SpiderDiagramChart } from '@/components/charts/SpiderDiagramChart';
import { ScenarioBarChart } from '@/components/charts/ScenarioComparisonChart';
import { ScenarioCashFlowOverlay } from '@/components/charts/ScenarioCashFlowOverlay';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { calculateSpider } from '@/engine/sensitivity/spider';
import { compareScenarios } from '@/engine/sensitivity/scenario';
import { fmtPct, fmtYears } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import { getPageEntries } from '@/lib/educational-content';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';
import type { SpiderResult } from '@/engine/sensitivity/spider';

const edu = getPageEntries('sensitivity');

export default function SensitivityPage() {
  usePageTitle('Sensitivity Analysis');
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
    <div className="space-y-4" data-tour="sensitivity-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">Sensitivity Analysis</h2>
          <InfoIcon entry={edu['S-01']!} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <EduTooltip entryId="S-02">
            <Select
              value={activeProjectId ?? ''}
              onValueChange={(v) => setActiveProject(v)}
              options={projects.map((p) => ({ value: p.project.id, label: p.project.name }))}
              placeholder="Select project..."
              className="flex-1 sm:w-[220px] sm:flex-none"
              aria-label="Select project"
            />
          </EduTooltip>
          <EduTooltip entryId="S-03">
            <Button
              size="sm"
              onClick={handleRunAll}
              disabled={!activeProjectId || isRunning}
              icon="horizontal-bar-chart"
              className="text-xs h-10 sm:h-9 shrink-0"
              title="Runs ±30% sensitivity on all input variables"
            >
              Run Sensitivity
            </Button>
          </EduTooltip>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultTab="tornado"
        tabs={[
          {
            key: 'tornado',
            label: 'Tornado',
            icon: 'horizontal-bar-chart',
            content: !tornadoResult ? (
              <EmptyState message="Click 'Run Sensitivity' to generate tornado chart" />
            ) : (
              <div className="border border-border bg-white p-5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                  Tornado Chart — NPV Sensitivity at ±30%
                </h4>
                <SectionHelp entry={edu['S-07']!} />
                <div className="min-h-[300px] sm:min-h-[350px]">
                  <TornadoChart result={tornadoResult} />
                </div>
                <div className="flex items-center gap-6 mt-3 text-[10px] text-text-muted">
                  <EduTooltip entryId="S-08">
                    <span className="flex items-center gap-1.5 cursor-help">
                      <span className="w-3 h-3 inline-block" style={{ backgroundColor: '#E07060' }} />
                      Lower NPV
                    </span>
                  </EduTooltip>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 inline-block" style={{ backgroundColor: '#3B8DBD' }} />
                    Higher NPV
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: 'spider',
            label: 'Spider',
            icon: 'line-chart',
            content: !spiderResult ? (
              <EmptyState message="Click 'Run Sensitivity' to generate spider diagram" />
            ) : (
              <div className="border border-border bg-white p-5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                  Spider Diagram — NPV vs % Change
                </h4>
                <SectionHelp entry={edu['S-09']!} />
                <div className="min-h-[300px] sm:min-h-[350px]">
                  <SpiderDiagramChart result={spiderResult} />
                </div>
                <EduTooltip entryId="S-10">
                  <p className="text-[10px] text-text-muted mt-2 cursor-help">
                    Steeper lines indicate higher sensitivity. The intersection at 0% marks the base case NPV.
                  </p>
                </EduTooltip>
              </div>
            ),
          },
          {
            key: 'scenario',
            label: 'Scenario Comparison',
            icon: 'compare',
            content: !scenarioResults ? (
              <EmptyState message="Click 'Run Sensitivity' to compare scenarios" />
            ) : (
              <div className="space-y-4">
                <div className="border border-border bg-white p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      Key Metrics by Scenario
                    </h4>
                  </div>
                  <SectionHelp entry={edu['S-11']!} />
                  <div className="overflow-x-auto -mx-4 px-4">
                    <ScenarioKpiTable results={scenarioResults} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-border bg-white p-4">
                    <EduTooltip entryId="S-12">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3 cursor-help">
                        NPV₁₀ by Scenario
                      </h4>
                    </EduTooltip>
                    <div className="min-h-[280px]">
                      <ScenarioBarChart results={scenarioResults} />
                    </div>
                  </div>

                  <div className="border border-border bg-white p-4">
                    <EduTooltip entryId="S-13">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3 cursor-help">
                        Cumulative Cash Flow Overlay
                      </h4>
                    </EduTooltip>
                    <div className="min-h-[280px]">
                      <ScenarioCashFlowOverlay results={scenarioResults} />
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
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
  const u = useDisplayUnits();
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

  const rows: { label: string; values: CellVal[]; tooltipId?: string }[] = [
    {
      label: `NPV₁₀ (${u.currencySymbol}M)`,
      tooltipId: 'S-15',
      values: scenarios.map((s) => ({
        text: u.money(results[s].npv10 as number, { accounting: true }),
        highlight: (results[s].npv10 as number) === maxNpv ? 'best' as const :
                   (results[s].npv10 as number) === minNpv ? 'worst' as const : undefined,
      })),
    },
    {
      label: 'IRR',
      tooltipId: 'S-16',
      values: scenarios.map((s) => ({
        text: results[s].isNonInvestmentPattern
          ? fmtPct(results[s].mirr) + ' (MIRR)'
          : fmtPct(results[s].irr ?? 0),
      })),
    },
    {
      label: 'Payback (yrs)',
      tooltipId: 'S-17',
      values: scenarios.map((s) => ({ text: fmtYears(results[s].paybackYears) })),
    },
    {
      label: 'PI',
      tooltipId: 'S-18',
      values: scenarios.map((s) => ({ text: results[s].profitabilityIndex.toFixed(2) })),
    },
    {
      label: 'Govt Take',
      tooltipId: 'S-19',
      values: scenarios.map((s) => ({ text: results[s].governmentTakePct.toFixed(1) + '%' })),
    },
  ];

  return (
    <table className="w-full border-collapse tabular-nums min-w-[500px]">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 py-2 w-[140px]">
            Metric
          </th>
          {scenarios.map((s) => (
            <th key={s} className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider px-3 py-2">
              {labels[s]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-border/50">
            <td className="text-xs text-text-secondary px-3 py-2">
              {row.tooltipId ? (
                <EduTooltip entryId={row.tooltipId}><span className="cursor-help">{row.label}</span></EduTooltip>
              ) : row.label}
            </td>
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
