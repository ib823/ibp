import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/store/project-store';
import { PROJECT_RESERVES, gasBcfToMmboe } from '@/engine/reserves/prms';
import { generateReservesReconciliation } from '@/engine/reserves/reconciliation';
import { CO2_STORAGE_RESOURCES, generateSrmsReconciliation } from '@/engine/reserves/srms';
import { ReservesWaterfall } from '@/components/charts/ReservesWaterfall';
import { cn } from '@/lib/utils';
import type { ReserveCategory } from '@/engine/types';

const YEARS = [2024, 2025, 2026];

export default function ReservesPage() {
  const projects = useProjectStore((s) => s.projects);
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedCategory, setSelectedCategory] = useState<ReserveCategory>('2P');

  const reconciliation = useMemo(
    () => generateReservesReconciliation({ projects, years: YEARS }),
    [projects],
  );

  const yearMovements = useMemo(
    () => reconciliation.movements.filter((m) => m.year === Number(selectedYear) && m.category === selectedCategory),
    [reconciliation, selectedYear, selectedCategory],
  );

  const oilMovements = yearMovements.filter((m) => m.hydrocarbonType === 'oil');
  const gasMovements = yearMovements.filter((m) => m.hydrocarbonType === 'gas');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Reserves</h2>

      {/* Summary Table */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Reserves by Project (SPE PRMS Classification)
        </h4>
        <ScrollArea className="w-full">
          <table className="w-full border-collapse text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-content-alt">
                <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5 w-[160px]">
                  Project
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  Oil (MMstb)
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  Gas (Bcf)
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  Total (MMboe)
                </th>
              </tr>
              <tr className="border-b border-border bg-content-alt">
                <th />
                {['1P', '2P', '3P', '1P', '2P', '3P', '1P', '2P', '3P'].map((c, i) => (
                  <th key={i} className={cn(
                    'text-right text-[10px] font-medium text-text-secondary px-2 py-1',
                    i % 3 === 0 && 'border-l border-border',
                  )}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROJECT_RESERVES.map((pr) => {
                const proj = projects.find((p) => p.project.id === pr.projectId);
                return (
                  <tr key={pr.projectId} className="border-b border-border/30 hover:bg-content-alt/50">
                    <td className="px-3 py-1.5 text-text-primary font-medium">
                      {proj?.project.name ?? pr.projectId}
                    </td>
                    {(['1P', '2P', '3P'] as const).map((c) => (
                      <td key={`oil-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                        {pr.oil[c] > 0 ? pr.oil[c].toFixed(0) : '-'}
                      </td>
                    ))}
                    {(['1P', '2P', '3P'] as const).map((c) => (
                      <td key={`gas-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                        {pr.gas[c] > 0 ? pr.gas[c].toFixed(0) : '-'}
                      </td>
                    ))}
                    {(['1P', '2P', '3P'] as const).map((c) => (
                      <td key={`boe-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                        {(pr.oil[c] + gasBcfToMmboe(pr.gas[c])) > 0
                          ? (pr.oil[c] + gasBcfToMmboe(pr.gas[c])).toFixed(1)
                          : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* Totals */}
              <tr className="border-t-2 border-border bg-content-alt font-semibold">
                <td className="px-3 py-1.5 text-text-primary">Total</td>
                {(['1P', '2P', '3P'] as const).map((c) => (
                  <td key={`tot-oil-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                    {PROJECT_RESERVES.reduce((s, pr) => s + pr.oil[c], 0).toFixed(0)}
                  </td>
                ))}
                {(['1P', '2P', '3P'] as const).map((c) => (
                  <td key={`tot-gas-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                    {PROJECT_RESERVES.reduce((s, pr) => s + pr.gas[c], 0).toFixed(0)}
                  </td>
                ))}
                {(['1P', '2P', '3P'] as const).map((c) => {
                  const total = PROJECT_RESERVES.reduce(
                    (s, pr) => s + pr.oil[c] + gasBcfToMmboe(pr.gas[c]),
                    0,
                  );
                  return (
                    <td key={`tot-boe-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                      {total.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* CO2 Storage Resources (SPE SRMS) */}
      <SrmsSection projects={projects} />

      {/* Reconciliation */}
      <div className="border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Reserves Reconciliation Waterfall
          </h4>
          <div className="flex items-center gap-2">
            <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ReserveCategory)}>
              <SelectTrigger className="w-[80px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1P" className="text-xs">1P</SelectItem>
                <SelectItem value="2P" className="text-xs">2P</SelectItem>
                <SelectItem value="3P" className="text-xs">3P</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[80px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReservesWaterfall
            movements={oilMovements}
            title={`Oil ${selectedCategory} — ${selectedYear}`}
            unit="MMstb"
          />
          <ReservesWaterfall
            movements={gasMovements}
            title={`Gas ${selectedCategory} — ${selectedYear}`}
            unit="Bcf"
          />
        </div>
      </div>
    </div>
  );
}

// ── CO2 Storage Resources Section ─────────────────────────────────────

function SrmsSection({ projects }: { projects: readonly import('@/engine/types').ProjectInputs[] }) {
  const srmsYears = [2030, 2031, 2032, 2033, 2034, 2035];

  const srmsData = useMemo(() => {
    const results: Array<{ resource: (typeof CO2_STORAGE_RESOURCES)[number]; movements: import('@/engine/types').CO2StorageReconciliation[] }> = [];
    for (const resource of CO2_STORAGE_RESOURCES) {
      const project = projects.find((p) => p.project.id === resource.projectId);
      if (!project) continue;
      const movements = generateSrmsReconciliation({ resource, project, years: srmsYears });
      results.push({ resource, movements });
    }
    return results;
  }, [projects]);

  if (CO2_STORAGE_RESOURCES.length === 0) return null;

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
        CO₂ Storage Resources (SPE SRMS 2025)
      </h4>

      {/* Summary Table */}
      <table className="w-full border-collapse text-xs mb-4">
        <thead>
          <tr className="border-b border-border bg-content-alt">
            <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5">Site</th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Low (MT)</th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Best (MT)</th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">High (MT)</th>
            <th className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Class</th>
            <th className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">Maturity</th>
          </tr>
        </thead>
        <tbody>
          {CO2_STORAGE_RESOURCES.map((r) => (
            <tr key={r.projectId} className="border-b border-border/30">
              <td className="px-3 py-1.5 text-text-primary font-medium">{r.siteName}</td>
              <td className="text-right font-data px-2 py-1.5">{r.lowEstimate}</td>
              <td className="text-right font-data px-2 py-1.5">{r.bestEstimate}</td>
              <td className="text-right font-data px-2 py-1.5">{r.highEstimate}</td>
              <td className="text-center px-2 py-1.5 capitalize">{r.resourceClass}</td>
              <td className="text-center px-2 py-1.5 capitalize">{r.maturitySubclass}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Reconciliation Table */}
      {srmsData.map(({ resource, movements }) => (
        <div key={resource.projectId}>
          <h5 className="text-[10px] font-semibold text-text-secondary mb-2">
            {resource.siteName} — Capacity Reconciliation (Best Estimate)
          </h5>
          <table className="w-full border-collapse text-xs mb-3">
            <thead>
              <tr className="border-b border-border bg-content-alt">
                <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-2 py-1">Year</th>
                <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1">Opening (MT)</th>
                <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1">Revisions</th>
                <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1">Injected (MT)</th>
                <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1">Closing (MT)</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.year} className="border-b border-border/30">
                  <td className="px-2 py-1 font-data">{m.year}</td>
                  <td className="text-right font-data px-2 py-1">{m.opening.toFixed(2)}</td>
                  <td className="text-right font-data px-2 py-1">{m.technicalRevisions.toFixed(3)}</td>
                  <td className="text-right font-data px-2 py-1 text-danger">{m.injected.toFixed(3)}</td>
                  <td className="text-right font-data px-2 py-1 font-medium">{m.closing.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="text-[9px] text-text-muted mt-2">
        Classified per SPE CO₂ Storage Resources Management System (SRMS) 2025.
        Estimates are illustrative — not actual assessed storage capacity.
      </p>
    </div>
  );
}
