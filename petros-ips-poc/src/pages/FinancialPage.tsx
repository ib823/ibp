import { useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Tabs } from '@/components/ui5/Ui5Tabs';
import { Select } from '@/components/ui5/Ui5Select';
import { useProjectStore, getActiveResult, useEffectiveActiveProject } from '@/store/project-store';
import { FinancialTable } from '@/components/tables/FinancialTable';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { generateAccountMovements } from '@/engine/financial/account-movements';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { getPageEntries } from '@/lib/educational-content';

const edu = getPageEntries('financial');

export default function FinancialPage() {
  usePageTitle('Financial Statements');
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const result = useProjectStore((s) => getActiveResult(s));

  // Use the override-merged project so what-if edits propagate to IS/BS/CF.
  const activeProject = useEffectiveActiveProject() ?? projects.find((p) => p.project.id === activeProjectId);

  const statements = useMemo(() => {
    if (!result || !activeProject) return null;
    const cfs = result.yearlyCashflows;
    const is = generateIncomeStatement(cfs, activeProject);
    const bs = generateBalanceSheet(is, cfs, activeProject);
    const cfStmt = generateCashFlowStatement(is, cfs, activeProject);
    const am = generateAccountMovements(is, bs, cfs, activeProject);
    return { is, bs, cfStmt, am, cfs, years: cfs.map((c) => c.year) };
  }, [result, activeProject]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">Financial Statements</h2>
          <InfoIcon entry={edu['F-01']!} />
        </div>
        <Select
          value={activeProjectId ?? ''}
          onValueChange={(v) => setActiveProject(v)}
          options={projects.map((p) => ({ value: p.project.id, label: p.project.name }))}
          placeholder="Select project..."
          className="w-full sm:w-[220px]"
          aria-label="Select project"
        />
      </div>

      {!statements ? (
        <div className="flex items-center justify-center h-64 border border-border bg-white">
          <p className="text-sm text-text-muted">Select a project to view financial statements</p>
        </div>
      ) : (
        // Wrapper carries the data-tour attribute so the guided tour can
        // find it via querySelector — Ui5Tabs does not forward unknown
        // props to a host DOM node.
        <div data-tour="financial-tabs">
        <Tabs
          defaultTab="income"
          tabs={[
            {
              key: 'income',
              label: 'Income Statement',
              icon: 'business-card',
              content: (
                <div className="border border-border bg-white p-4">
                  <FinancialTable
                    years={statements.years}
                    rows={[
                      { label: 'Revenue', values: statements.is.yearly.map((l) => l.revenue as number), eduEntryId: 'F-07' },
                      { label: 'Royalty', values: statements.is.yearly.map((_, idx) => -(statements.cfs[idx]?.royalty as number ?? 0)), eduEntryId: 'F-08' },
                      { label: 'Cost of Sales', values: statements.is.yearly.map((l) => -(l.costOfSales as number)), eduEntryId: 'F-09' },
                      { label: 'Gross Profit', values: statements.is.yearly.map((l) => l.grossProfit as number), isSubtotal: true, eduEntryId: 'F-10' },
                      { label: 'DD&A', values: statements.is.yearly.map((l) => -(l.depreciationAmortisation as number)), eduEntryId: 'F-11' },
                      { label: 'Operating Profit', values: statements.is.yearly.map((l) => l.operatingProfit as number), isSubtotal: true, eduEntryId: 'F-12' },
                      { label: 'Profit Before Tax', values: statements.is.yearly.map((l) => l.profitBeforeTax as number), isSubtotal: true, eduEntryId: 'F-13' },
                      { label: 'Tax Expense', values: statements.is.yearly.map((l) => -(l.taxExpense as number)), eduEntryId: 'F-14' },
                      { label: 'Net Income', values: statements.is.yearly.map((l) => l.profitAfterTax as number), isTotal: true, eduEntryId: 'F-15' },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'balance',
              label: 'Balance Sheet',
              icon: 'table-view',
              content: (
                <div className="border border-border bg-white p-4">
                  <FinancialTable
                    years={statements.years}
                    rows={[
                      { label: 'PP&E (net)', values: statements.bs.yearly.map((l) => l.ppeNet as number), eduEntryId: 'F-16' },
                      { label: 'Cash', values: statements.bs.yearly.map((l) => l.cash as number), eduEntryId: 'F-17' },
                      { label: 'Total Assets', values: statements.bs.yearly.map((l) => l.totalAssets as number), isSubtotal: true, eduEntryId: 'F-18' },
                      { label: '', values: statements.years.map(() => 0) },
                      { label: 'Retained Earnings', values: statements.bs.yearly.map((l) => l.retainedEarnings as number), eduEntryId: 'F-19' },
                      { label: 'Reconciliation Adj. (POC)*', values: statements.bs.yearly.map((l) => l.otherReserves as number), eduEntryId: 'F-20' },
                      { label: 'Total Equity', values: statements.bs.yearly.map((l) => l.totalEquity as number), isSubtotal: true, eduEntryId: 'F-21' },
                      { label: 'Decomm. Provision', values: statements.bs.yearly.map((l) => l.decommissioningProvision as number), eduEntryId: 'F-22' },
                      { label: 'Total Liabilities', values: statements.bs.yearly.map((l) => l.totalLiabilities as number), isSubtotal: true, eduEntryId: 'F-23' },
                      { label: 'Equity + Liabilities', values: statements.bs.yearly.map((l) => l.totalEquityAndLiabilities as number), isTotal: true, eduEntryId: 'F-24' },
                    ]}
                  />
                  <EduTooltip entryId="F-36">
                    <p className="text-[9px] text-text-muted mt-3 cursor-help">
                      * Reconciliation Adjustment: This POC derives financial statements from a cash-based economic model.
                      In the production SAC implementation, financial statements will be generated from a proper accrual-based
                      accounting engine integrated with SAP S/4HANA, eliminating this adjustment.
                    </p>
                  </EduTooltip>
                </div>
              ),
            },
            {
              key: 'cashflow',
              label: 'Cash Flow',
              icon: 'money-bills',
              content: (
                <div className="border border-border bg-white p-4">
                  <FinancialTable
                    years={statements.years}
                    rows={[
                      { label: 'Profit Before Tax', values: statements.cfStmt.yearly.map((l) => l.profitBeforeTax as number), eduEntryId: 'F-25' },
                      { label: 'Add: Depreciation', values: statements.cfStmt.yearly.map((l) => l.depreciation as number), eduEntryId: 'F-26' },
                      { label: 'Tax Paid', values: statements.cfStmt.yearly.map((l) => -(l.taxPaid as number)), eduEntryId: 'F-27' },
                      { label: 'Operating Cash Flow', values: statements.cfStmt.yearly.map((l) => l.netOperatingCashFlow as number), isSubtotal: true, eduEntryId: 'F-28' },
                      { label: 'CAPEX', values: statements.cfStmt.yearly.map((l) => l.netInvestingCashFlow as number), eduEntryId: 'F-29' },
                      { label: 'Net Cash Change', values: statements.cfStmt.yearly.map((l) => l.netCashChange as number), isSubtotal: true, eduEntryId: 'F-30' },
                      { label: 'Opening Cash', values: statements.cfStmt.yearly.map((l) => l.openingCash as number), eduEntryId: 'F-31' },
                      { label: 'Closing Cash', values: statements.cfStmt.yearly.map((l) => l.closingCash as number), isTotal: true, eduEntryId: 'F-32' },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'movements',
              label: 'Account Movements',
              icon: 'history',
              content: (
                <div className="border border-border bg-white p-4 space-y-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        PP&E Roll-Forward
                      </h4>
                      <InfoIcon entry={edu['F-33']!} size={10} />
                    </div>
                    <SectionHelp entry={edu['F-33']!} />
                    <FinancialTable
                      years={statements.years}
                      rows={[
                        { label: 'Opening', values: statements.am.ppe.map((l) => l.opening as number) },
                        { label: 'Additions', values: statements.am.ppe.map((l) => l.additions as number) },
                        { label: 'Depreciation', values: statements.am.ppe.map((l) => -(l.depreciation as number)) },
                        { label: 'Closing', values: statements.am.ppe.map((l) => l.closing as number), isTotal: true },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        Decommissioning Provision
                      </h4>
                      <InfoIcon entry={edu['F-34']!} size={10} />
                    </div>
                    <SectionHelp entry={edu['F-34']!} />
                    <FinancialTable
                      years={statements.years}
                      rows={[
                        { label: 'Opening', values: statements.am.decommissioningProvision.map((l) => l.opening as number) },
                        { label: 'Additions', values: statements.am.decommissioningProvision.map((l) => l.additions as number) },
                        { label: 'Unwinding', values: statements.am.decommissioningProvision.map((l) => l.unwinding as number) },
                        { label: 'Utilisations', values: statements.am.decommissioningProvision.map((l) => -(l.utilisations as number)) },
                        { label: 'Closing', values: statements.am.decommissioningProvision.map((l) => l.closing as number), isTotal: true },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                        Retained Earnings
                      </h4>
                      <InfoIcon entry={edu['F-35']!} size={10} />
                    </div>
                    <SectionHelp entry={edu['F-35']!} />
                    <FinancialTable
                      years={statements.years}
                      rows={[
                        { label: 'Opening', values: statements.am.retainedEarnings.map((l) => l.opening as number) },
                        { label: 'Profit After Tax', values: statements.am.retainedEarnings.map((l) => l.profitAfterTax as number) },
                        { label: 'Closing', values: statements.am.retainedEarnings.map((l) => l.closing as number), isTotal: true },
                      ]}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
        </div>
      )}
    </div>
  );
}
