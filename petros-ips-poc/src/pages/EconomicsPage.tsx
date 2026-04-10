import { useCallback } from 'react';
import { useProjectStore, getActiveResult } from '@/store/project-store';
import { ProjectInputForm } from '@/components/forms/ProjectInputForm';
import { KpiCard } from '@/components/shared/KpiCard';
import { WaterfallChart } from '@/components/charts/WaterfallChart';
import { ProductionChart } from '@/components/charts/ProductionChart';
import { AnnualCashFlowChart } from '@/components/charts/AnnualCashFlowChart';
import { GovernmentTakeChart } from '@/components/charts/GovernmentTakeChart';
import { EconomicsTable } from '@/components/tables/EconomicsTable';
import { fmtM, fmtPct, fmtYears } from '@/lib/format';
import { exportEconomicsToExcel } from '@/lib/excel-export';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EconomicsPage() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const projects = useProjectStore((s) => s.projects);
  const runProjectEconomics = useProjectStore((s) => s.runProjectEconomics);
  const result = useProjectStore((s) => getActiveResult(s));

  const activeProject = projects.find((p) => p.project.id === activeProjectId);

  const handleCalculate = useCallback(() => {
    if (activeProjectId) {
      runProjectEconomics(activeProjectId, activeScenario);
    }
  }, [activeProjectId, activeScenario, runProjectEconomics]);

  return (
    <div className="flex gap-6 h-full">
      {/* LEFT PANEL — Inputs */}
      <div className="w-[320px] shrink-0">
        <div className="border border-border bg-white p-4 sticky top-0">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Project Economics
          </h3>
          <ProjectInputForm onCalculate={handleCalculate} />
        </div>
      </div>

      {/* RIGHT PANEL — Results */}
      <div className="flex-1 min-w-0 space-y-4">
        {!result && (
          <div className="flex items-center justify-center h-64 border border-border bg-white">
            <p className="text-sm text-text-muted">
              Select a project and click Calculate to view results
            </p>
          </div>
        )}

        {result && (
          <>
            {/* Export + KPI Row */}
            <div className="flex justify-end mb-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => activeProject && exportEconomicsToExcel(
                  activeProject.project.name, activeScenario, result,
                )}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export to Excel
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <KpiCard
                label="NPV₁₀"
                value={fmtM(result.npv10 as number)}
                unit="$M"
                className={(result.npv10 as number) >= 0 ? 'border-l-2 border-l-success' : 'border-l-2 border-l-danger'}
              />
              <KpiCard
                label={result.isNonInvestmentPattern ? 'MIRR' : 'IRR'}
                value={result.isNonInvestmentPattern ? fmtPct(result.mirr) : fmtPct(result.irr ?? 0)}
                className={
                  (result.isNonInvestmentPattern ? result.mirr : (result.irr ?? 0)) >= 0.15
                    ? 'border-l-2 border-l-success'
                    : (result.isNonInvestmentPattern ? result.mirr : (result.irr ?? 0)) >= 0.10
                      ? 'border-l-2 border-l-amber'
                      : 'border-l-2 border-l-danger'
                }
              />
              <KpiCard
                label="Payback"
                value={fmtYears(result.paybackYears)}
                unit="years"
              />
              <KpiCard
                label="Profitability Index"
                value={result.profitabilityIndex.toFixed(2)}
              />
            </div>

            {/* Waterfall + Govt Take row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 border border-border bg-white p-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                  Fiscal Cashflow Waterfall (Lifecycle)
                </h4>
                <WaterfallChart cashflows={result.yearlyCashflows} />
              </div>
              <div className="border border-border bg-white p-4">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                  Government / Contractor Take
                </h4>
                <GovernmentTakeChart
                  governmentTakePct={result.governmentTakePct}
                  contractorTakePct={result.contractorTakePct}
                />
                <div className="grid grid-cols-2 gap-2 mt-2 text-center">
                  <div>
                    <div className="text-[10px] text-text-muted">Total Tax</div>
                    <div className="text-xs font-data font-medium">${fmtM(result.totalTax as number)}M</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted">Peak Funding</div>
                    <div className="text-xs font-data font-medium text-danger">
                      ${fmtM(result.peakFunding as number)}M
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Production + Cash Flow Charts */}
            {activeProject && (
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border bg-white p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    Production Profile
                  </h4>
                  <ProductionChart
                    production={activeProject.productionProfile}
                    startYear={activeProject.project.startYear}
                    endYear={activeProject.project.endYear}
                  />
                </div>
                <div className="border border-border bg-white p-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    Annual Revenue, CAPEX & Cumulative NCF
                  </h4>
                  <AnnualCashFlowChart
                    cashflows={result.yearlyCashflows}
                    costProfile={activeProject.costProfile}
                  />
                </div>
              </div>
            )}

            {/* Economics Table */}
            <div className="border border-border bg-white p-4">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                Year-by-Year Economics
              </h4>
              <EconomicsTable cashflows={result.yearlyCashflows} fiscalRegimeType={activeProject?.fiscalRegimeConfig.type} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
