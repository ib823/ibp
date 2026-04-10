import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectStore, getActiveResult } from '@/store/project-store';
import { FinancialTable } from '@/components/tables/FinancialTable';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { generateBalanceSheet } from '@/engine/financial/balance-sheet';
import { generateCashFlowStatement } from '@/engine/financial/cashflow-statement';
import { generateAccountMovements } from '@/engine/financial/account-movements';

export default function FinancialPage() {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const result = useProjectStore((s) => getActiveResult(s));

  const activeProject = projects.find((p) => p.project.id === activeProjectId);

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Financial Statements</h2>
        <Select value={activeProjectId ?? ''} onValueChange={(v) => setActiveProject(v)}>
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
      </div>

      {!statements ? (
        <div className="flex items-center justify-center h-64 border border-border bg-white">
          <p className="text-sm text-text-muted">Select a project to view financial statements</p>
        </div>
      ) : (
        <Tabs defaultValue="income" className="space-y-3">
          <TabsList>
            <TabsTrigger value="income" className="text-xs">Income Statement</TabsTrigger>
            <TabsTrigger value="balance" className="text-xs">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow" className="text-xs">Cash Flow</TabsTrigger>
            <TabsTrigger value="movements" className="text-xs">Account Movements</TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            <div className="border border-border bg-white p-4">
              <FinancialTable
                years={statements.years}
                rows={[
                  { label: 'Revenue', values: statements.is.yearly.map((l) => l.revenue as number) },
                  { label: 'Royalty', values: statements.is.yearly.map((_, idx) => -(statements.cfs[idx]?.royalty as number ?? 0)) },
                  { label: 'Cost of Sales', values: statements.is.yearly.map((l) => -(l.costOfSales as number)) },
                  { label: 'Gross Profit', values: statements.is.yearly.map((l) => l.grossProfit as number), isSubtotal: true },
                  { label: 'DD&A', values: statements.is.yearly.map((l) => -(l.depreciationAmortisation as number)) },
                  { label: 'Operating Profit', values: statements.is.yearly.map((l) => l.operatingProfit as number), isSubtotal: true },
                  { label: 'Profit Before Tax', values: statements.is.yearly.map((l) => l.profitBeforeTax as number), isSubtotal: true },
                  { label: 'Tax Expense', values: statements.is.yearly.map((l) => -(l.taxExpense as number)) },
                  { label: 'Net Income', values: statements.is.yearly.map((l) => l.profitAfterTax as number), isTotal: true },
                ]}
              />
            </div>
          </TabsContent>

          <TabsContent value="balance">
            <div className="border border-border bg-white p-4">
              <FinancialTable
                years={statements.years}
                rows={[
                  { label: 'PP&E (net)', values: statements.bs.yearly.map((l) => l.ppeNet as number) },
                  { label: 'Cash', values: statements.bs.yearly.map((l) => l.cash as number) },
                  { label: 'Total Assets', values: statements.bs.yearly.map((l) => l.totalAssets as number), isSubtotal: true },
                  { label: '', values: statements.years.map(() => 0) },
                  { label: 'Retained Earnings', values: statements.bs.yearly.map((l) => l.retainedEarnings as number) },
                  { label: 'Reconciliation Adj. (POC)*', values: statements.bs.yearly.map((l) => l.otherReserves as number) },
                  { label: 'Total Equity', values: statements.bs.yearly.map((l) => l.totalEquity as number), isSubtotal: true },
                  { label: 'Decomm. Provision', values: statements.bs.yearly.map((l) => l.decommissioningProvision as number) },
                  { label: 'Total Liabilities', values: statements.bs.yearly.map((l) => l.totalLiabilities as number), isSubtotal: true },
                  { label: 'Equity + Liabilities', values: statements.bs.yearly.map((l) => l.totalEquityAndLiabilities as number), isTotal: true },
                ]}
              />
              <p className="text-[9px] text-text-muted mt-3">
                * Reconciliation Adjustment: This POC derives financial statements from a cash-based economic model.
                In the production SAC implementation, financial statements will be generated from a proper accrual-based
                accounting engine integrated with SAP S/4HANA, eliminating this adjustment.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="cashflow">
            <div className="border border-border bg-white p-4">
              <FinancialTable
                years={statements.years}
                rows={[
                  { label: 'Profit Before Tax', values: statements.cfStmt.yearly.map((l) => l.profitBeforeTax as number) },
                  { label: 'Add: Depreciation', values: statements.cfStmt.yearly.map((l) => l.depreciation as number) },
                  { label: 'Tax Paid', values: statements.cfStmt.yearly.map((l) => -(l.taxPaid as number)) },
                  { label: 'Operating Cash Flow', values: statements.cfStmt.yearly.map((l) => l.netOperatingCashFlow as number), isSubtotal: true },
                  { label: 'CAPEX', values: statements.cfStmt.yearly.map((l) => l.netInvestingCashFlow as number) },
                  { label: 'Net Cash Change', values: statements.cfStmt.yearly.map((l) => l.netCashChange as number), isSubtotal: true },
                  { label: 'Opening Cash', values: statements.cfStmt.yearly.map((l) => l.openingCash as number) },
                  { label: 'Closing Cash', values: statements.cfStmt.yearly.map((l) => l.closingCash as number), isTotal: true },
                ]}
              />
            </div>
          </TabsContent>

          <TabsContent value="movements">
            <div className="border border-border bg-white p-4 space-y-6">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  PP&E Roll-Forward
                </h4>
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
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Decommissioning Provision
                </h4>
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
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
                  Retained Earnings
                </h4>
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
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
