import { useCallback, useMemo } from 'react';
import { useProjectStore, getActiveResult, useEffectiveActiveProject } from '@/store/project-store';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ProjectInputForm } from '@/components/forms/ProjectInputForm';
import { KpiCard } from '@/components/shared/KpiCard';
import { WaterfallChart } from '@/components/charts/WaterfallChart';
import { ProductionChart } from '@/components/charts/ProductionChart';
import { AnnualCashFlowChart } from '@/components/charts/AnnualCashFlowChart';
import { GovernmentTakeChart } from '@/components/charts/GovernmentTakeChart';
import { EconomicsTable } from '@/components/tables/EconomicsTable';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { GranularityToggle } from '@/components/shared/GranularityToggle';
import { VersionComparisonView } from '@/components/version/VersionComparisonView';
import { PhaseComparisonView } from '@/components/phase/PhaseComparisonView';
import { Tabs } from '@/components/ui5/Ui5Tabs';
import { fmtPct, fmtYears } from '@/lib/format';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { exportEconomicsToExcel } from '@/lib/excel-export';
import { getPageEntries } from '@/lib/educational-content';
import { Button } from '@/components/ui5/Ui5Button';
import type { TimeGranularity, YearlyCashflow } from '@/engine/types';

const edu = getPageEntries('economics');

export default function EconomicsPage() {
  usePageTitle('Economics');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const projects = useProjectStore((s) => s.projects);
  const runProjectEconomics = useProjectStore((s) => s.runProjectEconomics);
  const result = useProjectStore((s) => getActiveResult(s));
  const activeTimeGranularity = useProjectStore((s) => s.activeTimeGranularity);
  const setTimeGranularity = useProjectStore((s) => s.setTimeGranularity);

  // Base project for dropdown lookups + form reset semantics (form must
  // reset to base defaults, not current override state).
  const baseActiveProject = projects.find((p) => p.project.id === activeProjectId);
  // Override-merged project for chart data reads so what-if edits
  // propagate to the Production + Annual Cash Flow charts immediately.
  const activeProject = useEffectiveActiveProject() ?? baseActiveProject;
  const u = useDisplayUnits();

  const handleCalculate = useCallback(() => {
    if (activeProjectId) {
      runProjectEconomics(activeProjectId, activeScenario);
    }
  }, [activeProjectId, activeScenario, runProjectEconomics]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      {/* LEFT PANEL — Inputs */}
      <div className="w-full lg:w-[320px] lg:shrink-0" data-tour="economics-inputs">
        <div className="border border-border bg-white p-4 lg:sticky lg:top-0">
          <h1 className="text-lg font-semibold text-text-primary mb-4">
            Project Economics
          </h1>
          <ProjectInputForm onCalculate={handleCalculate} />
        </div>
      </div>

      {/* RIGHT PANEL — Results with tabs */}
      <div className="flex-1 min-w-0 space-y-4">
        <Tabs
          defaultTab="economics"
          tabs={[
            {
              key: 'economics',
              label: 'Economics',
              icon: 'simulate',
              content: (
                <div className="space-y-4">
                  {!result && (
                    <div className="flex items-center justify-center h-64 border border-border bg-white">
                      <p className="text-sm text-text-muted">
                        Select a project and click Calculate to view results
                      </p>
                    </div>
                  )}

                  {result && (
                    <>
                      <div className="flex justify-end mb-1">
                        <EduTooltip entryId="E-16">
                          <Button
                            data-tour="export-excel"
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            icon="download"
                            title="Downloads year-by-year economics as an Excel workbook"
                            onClick={() =>
                              activeProject &&
                              exportEconomicsToExcel(
                                activeProject.project.name,
                                activeScenario,
                                result,
                                { currency: u.currencyCode, conversions: u.conversions },
                              )
                            }
                          >
                            Export to Excel
                          </Button>
                        </EduTooltip>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiCard
                          label="NPV₁₀"
                          value={u.money(result.npv10 as number, { accounting: true })}
                          className={
                            (result.npv10 as number) >= 0
                              ? 'border-l-2 border-l-success'
                              : 'border-l-2 border-l-danger'
                          }
                          eduEntry={edu['E-17']}
                        />
                        <KpiCard
                          label={result.isNonInvestmentPattern ? 'MIRR' : 'IRR'}
                          value={
                            result.isNonInvestmentPattern
                              ? fmtPct(result.mirr)
                              : fmtPct(result.irr ?? 0)
                          }
                          className={
                            (result.isNonInvestmentPattern ? result.mirr : (result.irr ?? 0)) >= 0.15
                              ? 'border-l-2 border-l-success'
                              : (result.isNonInvestmentPattern ? result.mirr : (result.irr ?? 0)) >= 0.10
                                ? 'border-l-2 border-l-amber'
                                : 'border-l-2 border-l-danger'
                          }
                          eduEntry={edu['E-18']}
                        />
                        <KpiCard
                          label="Payback"
                          value={fmtYears(result.paybackYears)}
                          unit="years"
                          eduEntry={edu['E-19']}
                        />
                        <KpiCard
                          label="PI"
                          value={result.profitabilityIndex.toFixed(2)}
                          eduEntry={edu['E-20']}
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div
                          className="lg:col-span-2 border border-border bg-white p-4 min-h-[280px]"
                          data-tour="fiscal-waterfall"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                              Fiscal Cashflow Waterfall (Lifecycle)
                            </h4>
                          </div>
                          <SectionHelp entry={edu['E-21']!} />
                          <WaterfallChart cashflows={result.yearlyCashflows} />
                        </div>
                        <div className="border border-border bg-white p-4 pr-2">
                          <div className="flex items-center gap-1.5 mb-3">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                              Govt / Contractor Take
                            </h4>
                            <InfoIcon entry={edu['E-28']!} />
                          </div>
                          <GovernmentTakeChart
                            governmentTakePct={result.governmentTakePct}
                            contractorTakePct={result.contractorTakePct}
                          />
                          <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                            <div>
                              <EduTooltip entryId="E-29">
                                <div className="text-[10px] text-text-muted cursor-help">Total Tax</div>
                              </EduTooltip>
                              <div className="text-xs font-data font-medium">
                                {u.money(result.totalTax as number, { accounting: true })}
                              </div>
                            </div>
                            <div>
                              <EduTooltip entryId="E-30">
                                <div className="text-[10px] text-text-muted cursor-help">Peak Funding</div>
                              </EduTooltip>
                              <div className="text-xs font-data font-medium text-danger">
                                {u.money(result.peakFunding as number, { accounting: true })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {activeProject && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="border border-border bg-white p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              Production Profile
                            </h4>
                            <SectionHelp entry={edu['E-31']!} />
                            <div className="min-h-[280px]">
                              <ProductionChart
                                production={activeProject.productionProfile}
                                startYear={activeProject.project.startYear}
                                endYear={activeProject.project.endYear}
                              />
                            </div>
                          </div>
                          <div className="border border-border bg-white p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              Annual Revenue, CAPEX & Cumulative NCF
                            </h4>
                            <SectionHelp entry={edu['E-32']!} />
                            <div className="min-h-[280px]">
                              <AnnualCashFlowChart
                                cashflows={result.yearlyCashflows}
                                costProfile={activeProject.costProfile}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border border-border bg-white p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                            Year-by-Year Economics
                          </h4>
                          <GranularityToggle
                            value={activeTimeGranularity}
                            onChange={setTimeGranularity}
                          />
                        </div>
                        {activeTimeGranularity !== 'yearly' && (
                          <p className="text-[10px] text-text-muted mb-3">
                            <strong>{activeTimeGranularity === 'monthly' ? 'Monthly' : 'Quarterly'} view:</strong>{' '}
                            production rates are inherited from the yearly profile (POC simplification);
                            revenue and costs are spread evenly across {activeTimeGranularity === 'monthly' ? '12 months' : '4 quarters'} per year.
                            KPIs (NPV, IRR) are always computed at yearly granularity per PSC convention.
                          </p>
                        )}
                        {activeTimeGranularity === 'yearly' ? (
                          <EconomicsTable
                            cashflows={result.yearlyCashflows}
                            fiscalRegimeType={activeProject?.fiscalRegimeConfig.type}
                          />
                        ) : (
                          <GranularEconomicsView
                            cashflows={result.yearlyCashflows}
                            granularity={activeTimeGranularity}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: 'versions',
              label: 'Budget & Forecast',
              icon: 'compare',
              content: <VersionComparisonView />,
            },
            {
              key: 'phases',
              label: 'Phases',
              icon: 'org-chart',
              content: <PhaseComparisonView />,
            },
          ]}
        />
      </div>
    </div>
  );
}

// ── Granular sub-views ─────────────────────────────────────────────────

interface GranularRow {
  label: string;
  revenue: number;
  costRecovery: number;
  profitSplit: number;
  tax: number;
  ncf: number;
}

function aggregateCashflowsToPeriods(
  cashflows: readonly YearlyCashflow[],
  granularity: TimeGranularity,
): GranularRow[] {
  const periodsPerYear = granularity === 'monthly' ? 12 : 4;
  const out: GranularRow[] = [];
  for (const cf of cashflows) {
    for (let i = 0; i < periodsPerYear; i++) {
      const label =
        granularity === 'monthly'
          ? `${cf.year}-${String(i + 1).padStart(2, '0')}`
          : `${cf.year} Q${i + 1}`;
      out.push({
        label,
        revenue: (cf.totalGrossRevenue as number) / periodsPerYear,
        costRecovery: (cf.costRecoveryAmount as number) / periodsPerYear,
        profitSplit: (cf.contractorProfitShare as number) / periodsPerYear,
        tax: (cf.pitaTax as number) / periodsPerYear,
        ncf: (cf.netCashFlow as number) / periodsPerYear,
      });
    }
  }
  return out;
}

function GranularEconomicsView({
  cashflows,
  granularity,
}: {
  cashflows: readonly YearlyCashflow[];
  granularity: TimeGranularity;
}) {
  const u = useDisplayUnits();
  const rows = useMemo(
    () => aggregateCashflowsToPeriods(cashflows, granularity),
    [cashflows, granularity],
  );

  return (
    <div className="overflow-x-auto -mx-4 px-4 max-h-[480px] overflow-y-auto">
      <table className="w-full border-collapse text-xs tabular-nums min-w-[640px]">
        <thead className="sticky top-0 bg-content-alt z-10">
          <tr className="border-b border-border text-text-secondary">
            <th className="text-left text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">Period</th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">Revenue ({u.currencySymbol}M)</th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">Cost Rec ({u.currencySymbol}M)</th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">Profit Split ({u.currencySymbol}M)</th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">Tax ({u.currencySymbol}M)</th>
            <th className="text-right text-[10px] font-semibold uppercase tracking-wider px-2 py-1.5">NCF ({u.currencySymbol}M)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/30 hover:bg-content-alt/50">
              <td className="px-2 py-1 font-data text-text-primary">{r.label}</td>
              <td className="text-right px-2 py-1 font-data">{u.money(r.revenue, { accounting: true })}</td>
              <td className="text-right px-2 py-1 font-data">{u.money(r.costRecovery, { accounting: true })}</td>
              <td className="text-right px-2 py-1 font-data">{u.money(r.profitSplit, { accounting: true })}</td>
              <td className="text-right px-2 py-1 font-data">{u.money(r.tax, { accounting: true })}</td>
              <td className={
                'text-right px-2 py-1 font-data font-medium ' +
                (r.ncf >= 0 ? 'text-success' : 'text-danger')
              }>
                {u.money(r.ncf, { accounting: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
