import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Select } from '@/components/ui5/Ui5Select';
import { useProjectStore } from '@/store/project-store';
import { PROJECT_RESERVES, gasBcfToMmboe } from '@/engine/reserves/prms';
import { generateReservesReconciliation } from '@/engine/reserves/reconciliation';
import { CO2_STORAGE_RESOURCES, generateSrmsReconciliation } from '@/engine/reserves/srms';
import { ReservesWaterfall } from '@/components/charts/ReservesWaterfall';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { cn } from '@/lib/utils';
import { getPageEntries } from '@/lib/educational-content';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { convertSafe } from '@/lib/display-units';
import type { ReserveCategory } from '@/engine/types';

const edu = getPageEntries('reserves');
const YEARS = [2024, 2025, 2026];
const SRMS_YEARS = [2030, 2031, 2032, 2033, 2034, 2035];

export default function ReservesPage() {
  usePageTitle('Reserves');
  const projects = useProjectStore((s) => s.projects);
  const u = useDisplayUnits();
  const [selectedYear, setSelectedYear] = useState('2025');
  const [selectedCategory, setSelectedCategory] = useState<ReserveCategory>('2P');

  // Reserves are stored in MMstb (oil) and Bcf (gas). `u.oilFactor`
  // already converts bbl → user unit; since MMstb is dimensionally MM × bbl
  // it applies unchanged. For gas we need Bcf → user unit, which is a
  // different origin from u.gasFactor (which starts from MMscf).
  const bcfFactor = useMemo(
    () => convertSafe(1, 'Bcf', u.gasUnit, u.conversions),
    [u.gasUnit, u.conversions],
  );

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
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Reserves</h2>
        <InfoIcon entry={edu['R-01']!} />
      </div>

      {/* Summary Table */}
      <div className="border border-border bg-white p-4" data-tour="reserves-table">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
          Reserves by Project (SPE PRMS Classification)
        </h4>
        <SectionHelp entry={edu['R-02']!} />
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-xs min-w-[700px] tabular-nums">
            <thead>
              <tr className="border-b border-border bg-content-alt">
                <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5 w-[160px]">
                  Project
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  <EduTooltip entryId="R-06"><span className="cursor-help">Oil (MM{u.oilUnit})</span></EduTooltip>
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  <EduTooltip entryId="R-07"><span className="cursor-help">Gas ({u.gasUnit})</span></EduTooltip>
                </th>
                <th colSpan={3} className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5 border-l border-border">
                  <EduTooltip entryId="R-08"><span className="cursor-help">Total (MMboe)</span></EduTooltip>
                </th>
              </tr>
              <tr className="border-b border-border bg-content-alt">
                <th />
                {(['1P', '2P', '3P', '1P', '2P', '3P', '1P', '2P', '3P'] as const).map((c, i) => {
                  const tooltipId = c === '1P' ? 'R-03' : c === '2P' ? 'R-04' : 'R-05';
                  return (
                    <th key={i} className={cn(
                      'text-right text-[10px] font-medium text-text-secondary px-2 py-1',
                      i % 3 === 0 && 'border-l border-border',
                    )}>
                      <EduTooltip entryId={tooltipId}><span className="cursor-help">{c}</span></EduTooltip>
                    </th>
                  );
                })}
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
                    {(['1P', '2P', '3P'] as const).map((c) => {
                      const v = pr.oil[c] * u.oilFactor;
                      return (
                        <td key={`oil-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                          {v > 0 ? v.toFixed(v >= 10 ? 0 : 1) : '-'}
                        </td>
                      );
                    })}
                    {(['1P', '2P', '3P'] as const).map((c) => {
                      const v = pr.gas[c] * bcfFactor;
                      return (
                        <td key={`gas-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                          {v > 0 ? v.toFixed(v >= 10 ? 0 : 1) : '-'}
                        </td>
                      );
                    })}
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
                {(['1P', '2P', '3P'] as const).map((c) => {
                  const total = PROJECT_RESERVES.reduce((s, pr) => s + pr.oil[c], 0) * u.oilFactor;
                  return (
                    <td key={`tot-oil-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                      {total.toFixed(total >= 10 ? 0 : 1)}
                    </td>
                  );
                })}
                {(['1P', '2P', '3P'] as const).map((c) => {
                  const total = PROJECT_RESERVES.reduce((s, pr) => s + pr.gas[c], 0) * bcfFactor;
                  return (
                    <td key={`tot-gas-${c}`} className="text-right font-data px-2 py-1.5 border-l border-border/30">
                      {total.toFixed(total >= 10 ? 0 : 1)}
                    </td>
                  );
                })}
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
        </div>
      </div>

      {/* CO2 Storage Resources (SPE SRMS) */}
      <SrmsSection projects={projects} />

      {/* Reconciliation */}
      <div className="border border-border bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Reserves Reconciliation Waterfall
          </h4>
          <div className="flex items-center gap-2">
            <EduTooltip entryId="R-16">
              <Select
                value={selectedCategory}
                onValueChange={(v) => setSelectedCategory(v as ReserveCategory)}
                options={[
                  { value: '1P', label: '1P' },
                  { value: '2P', label: '2P' },
                  { value: '3P', label: '3P' },
                ]}
                className="w-[90px]"
                aria-label="Reserve category"
              />
            </EduTooltip>
            <EduTooltip entryId="R-17">
              <Select
                value={selectedYear}
                onValueChange={setSelectedYear}
                options={YEARS.map((y) => ({ value: y.toString(), label: y.toString() }))}
                className="w-[90px]"
                aria-label="Year"
              />
            </EduTooltip>
          </div>
        </div>
        <SectionHelp entry={edu['R-15']!} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="min-h-[260px]">
            <ReservesWaterfall
              movements={oilMovements}
              title={`Oil ${selectedCategory} — ${selectedYear}`}
              unit={`MM${u.oilUnit}`}
              valueFactor={u.oilFactor}
            />
          </div>
          <div className="min-h-[260px]">
            <ReservesWaterfall
              movements={gasMovements}
              title={`Gas ${selectedCategory} — ${selectedYear}`}
              unit={u.gasUnit}
              valueFactor={bcfFactor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CO2 Storage Resources Section ─────────────────────────────────────

function SrmsSection({ projects }: { projects: readonly import('@/engine/types').ProjectInputs[] }) {
  const srmsData = useMemo(() => {
    const results: Array<{ resource: (typeof CO2_STORAGE_RESOURCES)[number]; movements: import('@/engine/types').CO2StorageReconciliation[] }> = [];
    for (const resource of CO2_STORAGE_RESOURCES) {
      const project = projects.find((p) => p.project.id === resource.projectId);
      if (!project) continue;
      const movements = generateSrmsReconciliation({ resource, project, years: SRMS_YEARS });
      results.push({ resource, movements });
    }
    return results;
  }, [projects]);

  if (CO2_STORAGE_RESOURCES.length === 0) return null;

  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
        CO₂ Storage Resources (SPE SRMS 2025)
      </h4>
      <SectionHelp entry={edu['R-09']!} />

      {/* Summary Table */}
      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs mb-4 min-w-[600px] tabular-nums">
        <thead>
          <tr className="border-b border-border bg-content-alt">
            <th className="text-left text-[10px] font-semibold text-text-secondary uppercase px-3 py-1.5">Site</th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
              <EduTooltip entryId="R-10"><span className="cursor-help">Low (MT)</span></EduTooltip>
            </th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
              <EduTooltip entryId="R-11"><span className="cursor-help">Best (MT)</span></EduTooltip>
            </th>
            <th className="text-right text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
              <EduTooltip entryId="R-12"><span className="cursor-help">High (MT)</span></EduTooltip>
            </th>
            <th className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
              <EduTooltip entryId="R-13"><span className="cursor-help">Class</span></EduTooltip>
            </th>
            <th className="text-center text-[10px] font-semibold text-text-secondary uppercase px-2 py-1.5">
              <EduTooltip entryId="R-14"><span className="cursor-help">Maturity</span></EduTooltip>
            </th>
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
      </div>

      {/* Reconciliation Table */}
      {srmsData.map(({ resource, movements }) => (
        <div key={resource.projectId} className="overflow-x-auto">
          <h5 className="text-xs font-semibold text-text-secondary mb-2">
            {resource.siteName} — Capacity Reconciliation (Best Estimate)
          </h5>
          <table className="w-full border-collapse text-xs mb-3 min-w-[500px] tabular-nums">
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
