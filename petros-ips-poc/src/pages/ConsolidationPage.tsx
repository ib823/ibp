// ════════════════════════════════════════════════════════════════════════
// ConsolidationPage — RFP Phase 2 deliverable nod:
//   "Group Finance calculation and consolidate for scenario planning
//    and investment decision."
//
// Aggregates project-level Income Statements by business sector, mocks
// intercompany eliminations (illustrative), and shows the Group total.
// Demonstrates the pattern Phase 2 will deliver in SAC via consolidation
// sub-models, intercompany trading partner dimensions, and elimination
// data actions.
// ════════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useProjectStore } from '@/store/project-store';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import type { IncomeStatement, IncomeStatementLine, ProjectInputs, EconomicsResult } from '@/engine/types';

// ── Sector aggregation key — maps project businessSector to a column ──

type ConsolColumn = 'upstream' | 'ccs';
const COLUMN_LABEL: Record<ConsolColumn, string> = {
  upstream: 'PETROS E&P',
  ccs:      'PETROS CCS',
};
const COLUMN_LEGAL: Record<ConsolColumn, string> = {
  upstream: 'PETROS Exploration & Production Sdn Bhd',
  ccs:      'PETROS Carbon Storage Sdn Bhd',
};

function projectColumn(project: ProjectInputs): ConsolColumn {
  if (project.project.businessSector === 'CCS') return 'ccs';
  return 'upstream';
}

// ── Illustrative intercompany eliminations ──────────────────────────
//
// Real PETROS group structure would have shared-services charges,
// internal gas-supply transfers, treasury allocations, etc. The POC
// uses a small per-line eliminate-on-aggregation pattern to show the
// mechanism.
const ELIMINATION_RULES: Array<{
  line: keyof IncomeStatementLine;
  pct: number;
  description: string;
}> = [
  { line: 'revenue',     pct: 0.015, description: 'Internal service revenue (E&P → CCS injection support)' },
  { line: 'costOfSales', pct: 0.015, description: 'Matching cost-of-sales offset (CCS recharge)' },
  { line: 'adminExpense', pct: 0.030, description: 'Group HQ shared-services allocation already in entity P&Ls' },
];

// ── Page ────────────────────────────────────────────────────────────

export default function ConsolidationPage() {
  usePageTitle('Group Consolidation');
  const projects = useProjectStore((s) => s.projects);
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const allResults = useProjectStore((s) => s.economicsResults);
  const u = useDisplayUnits();

  // Pull each project's result for the active scenario into a flat map.
  const resultsByProject = useMemo(() => {
    const m = new Map<string, EconomicsResult>();
    for (const [projectId, byScenario] of allResults) {
      const r = byScenario.get(activeScenario);
      if (r) m.set(projectId, r);
    }
    return m;
  }, [allResults, activeScenario]);

  const consol = useMemo(
    () => buildConsolidation(projects, resultsByProject),
    [projects, resultsByProject],
  );

  if (!consol) {
    return (
      <div className="border border-border bg-white p-6 text-center text-sm text-text-muted">
        Run economics calculations to populate the consolidation. Click "Recalculate All"
        in the header.
      </div>
    );
  }

  const lines: Array<{ key: keyof IncomeStatementLine; label: string; isSubtotal?: boolean; isTotal?: boolean }> = [
    { key: 'revenue',                 label: 'Revenue' },
    { key: 'costOfSales',             label: 'Cost of Sales' },
    { key: 'grossProfit',             label: 'Gross Profit', isSubtotal: true },
    { key: 'depreciationAmortisation',label: 'Depreciation & Amortisation' },
    { key: 'explorationExpense',      label: 'Exploration Expense' },
    { key: 'adminExpense',            label: 'Administrative Expense' },
    { key: 'operatingProfit',         label: 'Operating Profit', isSubtotal: true },
    { key: 'financeCost',             label: 'Finance Cost' },
    { key: 'profitBeforeTax',         label: 'Profit Before Tax', isSubtotal: true },
    { key: 'taxExpense',              label: 'Tax Expense' },
    { key: 'profitAfterTax',          label: 'Profit After Tax', isTotal: true },
  ];

  return (
    <div className="space-y-4 max-w-[1400px]">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Group Consolidation</h1>
        <p className="text-xs text-text-secondary mt-0.5 max-w-3xl">
          Project-level Income Statements aggregated by sector, with illustrative
          intercompany eliminations, rolled up to the PETROS Group total. Phase 2
          delivers this via SAC consolidation sub-models with trading-partner
          dimensions and elimination data actions. Showing scenario:{' '}
          <span className="font-data text-text-primary">{activeScenario}</span>.
        </p>
      </div>

      {/* Entity legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['upstream', 'ccs'] as const).map((col) => (
          <article key={col} className="border border-border bg-white p-3 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-petrol mb-1">
              {COLUMN_LABEL[col]}
            </div>
            <div className="text-xs text-text-primary truncate">{COLUMN_LEGAL[col]}</div>
            <div className="text-[10px] text-text-muted mt-1">
              {consol.projectsByColumn[col].length} project
              {consol.projectsByColumn[col].length === 1 ? '' : 's'} ·{' '}
              {consol.projectsByColumn[col].map((p) => p.project.name).join(', ') || '—'}
            </div>
          </article>
        ))}
        <article className="border border-petrol/40 bg-petrol/5 p-3 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-petrol mb-1">
            PETROS Group
          </div>
          <div className="text-xs text-text-primary truncate">Petroleum Sarawak Berhad</div>
          <div className="text-[10px] text-text-muted mt-1">
            Consolidated entity · {projects.length} projects
          </div>
        </article>
      </div>

      {/* Consolidation table */}
      <div className="border border-border bg-white">
        <div className="px-4 pt-3 pb-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Consolidated Income Statement (sum across project life)
          </h4>
          <p className="text-[11px] text-text-muted">
            Values aggregate every year of every project's life-cycle P&L.
            Eliminations column is illustrative; production system applies
            per-period intercompany rules.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[760px] tabular-nums">
            <thead>
              <tr className="border-y border-border bg-content-alt/50">
                <th className="text-left px-3 py-2 sticky left-0 bg-content-alt/50 z-10 w-[260px]">
                  Line item
                </th>
                <th className="text-right px-2 py-2 w-[120px]">{COLUMN_LABEL.upstream}</th>
                <th className="text-right px-2 py-2 w-[120px]">{COLUMN_LABEL.ccs}</th>
                <th className="text-right px-2 py-2 w-[120px] border-l border-border">
                  Eliminations
                </th>
                <th className="text-right px-2 py-2 w-[120px] border-l border-petrol/30 bg-petrol/5">
                  PETROS Group
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const upstream = consol.byColumn.upstream[line.key];
                const ccs = consol.byColumn.ccs[line.key];
                const eliminate = consol.eliminations[line.key];
                const group = upstream + ccs - eliminate;
                return (
                  <tr
                    key={line.key}
                    className={cn(
                      'border-b border-border/50',
                      line.isSubtotal && 'bg-content-alt/30 font-semibold',
                      line.isTotal && 'bg-petrol/5 font-semibold border-t border-petrol/30',
                    )}
                  >
                    <td className="px-3 py-1.5 sticky left-0 z-10 bg-inherit">
                      {line.label}
                    </td>
                    <td className="px-2 py-1.5 text-right font-data">
                      {u.money(upstream, { accounting: true })}
                    </td>
                    <td className="px-2 py-1.5 text-right font-data">
                      {u.money(ccs, { accounting: true })}
                    </td>
                    <td className="px-2 py-1.5 text-right font-data text-text-secondary border-l border-border">
                      {eliminate === 0 ? '—' : `(${u.money(eliminate)})`}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1.5 text-right font-data border-l border-petrol/30 bg-petrol/5',
                        group < 0 && 'text-danger',
                      )}
                    >
                      {u.money(group, { accounting: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eliminations rules */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">
          Intercompany Elimination Rules (illustrative)
        </h4>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-content-alt/50">
              <th className="text-left px-3 py-2 w-[180px]">P&L line</th>
              <th className="text-right px-2 py-2 w-[80px]">Rate</th>
              <th className="text-left px-2 py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {ELIMINATION_RULES.map((r) => (
              <tr key={r.line} className="border-b border-border/50">
                <td className="px-3 py-1.5 text-text-primary">{r.line}</td>
                <td className="px-2 py-1.5 text-right font-data">{(r.pct * 100).toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-text-secondary">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-text-muted mt-2">
          Phase 2 implementation: SAC consolidation sub-model with a Trading Partner
          dimension on each entity's transactions, plus per-period elimination data
          actions on intercompany pairs.
        </p>
      </div>
    </div>
  );
}

// ── Aggregation ────────────────────────────────────────────────────

interface ConsolidationData {
  projectsByColumn: Record<ConsolColumn, ProjectInputs[]>;
  byColumn: Record<ConsolColumn, Record<keyof IncomeStatementLine, number>>;
  eliminations: Record<keyof IncomeStatementLine, number>;
}

function buildConsolidation(
  projects: readonly ProjectInputs[],
  resultsByProject: Map<string, EconomicsResult> | undefined,
): ConsolidationData | null {
  if (!resultsByProject || resultsByProject.size === 0) return null;

  const empty = (): Record<keyof IncomeStatementLine, number> => ({
    year: 0,
    revenue: 0,
    costOfSales: 0,
    grossProfit: 0,
    explorationExpense: 0,
    depreciationAmortisation: 0,
    adminExpense: 0,
    otherOperatingIncome: 0,
    operatingProfit: 0,
    financeIncome: 0,
    financeCost: 0,
    profitBeforeTax: 0,
    taxExpense: 0,
    profitAfterTax: 0,
  });

  const byColumn: Record<ConsolColumn, Record<keyof IncomeStatementLine, number>> = {
    upstream: empty(),
    ccs: empty(),
  };
  const projectsByColumn: Record<ConsolColumn, ProjectInputs[]> = {
    upstream: [],
    ccs: [],
  };

  for (const project of projects) {
    const result = resultsByProject.get(project.project.id);
    if (!result) continue;
    const col = projectColumn(project);
    projectsByColumn[col].push(project);
    const is = generateIncomeStatement(result.yearlyCashflows, project);
    accumulate(byColumn[col], is);
  }

  // Compute eliminations off the aggregate revenue / costs / admin
  // (illustrative: a small percentage of upstream revenue is treated as
  // intercompany so it doesn't double-count when added to CCS revenue)
  const eliminations: Record<keyof IncomeStatementLine, number> = empty();
  for (const rule of ELIMINATION_RULES) {
    const base = byColumn.upstream[rule.line] + byColumn.ccs[rule.line];
    eliminations[rule.line] = Math.abs(base) * rule.pct;
  }

  return { projectsByColumn, byColumn, eliminations };
}

function accumulate(
  acc: Record<keyof IncomeStatementLine, number>,
  is: IncomeStatement,
): void {
  for (const line of is.yearly) {
    for (const k of Object.keys(line) as (keyof IncomeStatementLine)[]) {
      if (k === 'year') continue;
      acc[k] = (acc[k] ?? 0) + (line[k] as number);
    }
  }
}
