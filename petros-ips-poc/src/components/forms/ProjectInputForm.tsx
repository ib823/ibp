import { useState, useCallback } from 'react';
import { Select } from '@/components/ui5/Ui5Select';
import { Input } from '@/components/ui5/Ui5Input';
import { Label } from '@ui5/webcomponents-react';
import { Button } from '@/components/ui5/Ui5Button';
import { Badge } from '@/components/ui5/Ui5Badge';
import { RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { getPageEntries } from '@/lib/educational-content';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import type { ProjectInputs, CostProfile, ProductionProfile, TimeSeriesData } from '@/engine/types';

const edu = getPageEntries('economics');

interface ProjectInputFormProps {
  onCalculate: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

function deriveParams(project: ProjectInputs) {
  const { productionProfile: pp, costProfile: cp, project: proj } = project;

  const peakGas = Math.max(0, ...Object.values(pp.gas));
  const peakOil = Math.max(0, ...Object.values(pp.oil));
  const peakCond = Math.max(0, ...Object.values(pp.condensate));

  // Derive decline rate from production profile (find first decline year)
  let declineRate = 0.12; // default
  const primaryProfile = peakGas > 0 ? pp.gas : pp.oil;
  const vals = Object.entries(primaryProfile).map(([y, v]) => [Number(y), v] as [number, number]).sort((a, b) => a[0] - b[0]);
  const peakVal = Math.max(0, ...vals.map((v) => v[1]));
  for (let i = 1; i < vals.length; i++) {
    if (vals[i - 1]![1] === peakVal && vals[i]![1] < peakVal && vals[i]![1] > 0) {
      declineRate = Math.round(-Math.log(vals[i]![1] / peakVal) * 100) / 100;
      break;
    }
  }

  const totalCapex =
    Object.values(cp.capexDrilling).reduce((s, v) => s + (v as number), 0) +
    Object.values(cp.capexFacilities).reduce((s, v) => s + (v as number), 0) +
    Object.values(cp.capexSubsea).reduce((s, v) => s + (v as number), 0) +
    Object.values(cp.capexOther).reduce((s, v) => s + (v as number), 0);

  const opexYears = Object.values(cp.opexFixed).filter((v) => (v as number) > 0);
  const avgOpexFixed = opexYears.length > 0
    ? opexYears.reduce((s, v) => s + (v as number), 0) / opexYears.length
    : 0;

  const totalAbex =
    Object.values(cp.abandonmentCost).reduce((s, v) => s + (v as number), 0);
  const abexYears = Object.entries(cp.abandonmentCost)
    .filter(([, v]) => (v as number) > 0)
    .map(([y]) => Number(y));

  return {
    peakGas, peakOil, peakCond, declineRate,
    totalCapex, avgOpexFixed, totalAbex,
    abexStart: abexYears.length > 0 ? Math.min(...abexYears) : proj.endYear,
    abexEnd: abexYears.length > 0 ? Math.max(...abexYears) : proj.endYear,
  };
}

/** Round to 1 decimal place to avoid floating-point display artifacts */
function r1(n: number): number { return Math.round(n * 10) / 10; }

function scaleTimeSeries<T extends number>(series: TimeSeriesData<T>, factor: number): TimeSeriesData<T> {
  const result: Record<number, T> = {};
  for (const [year, value] of Object.entries(series)) {
    result[Number(year)] = (value * factor) as T;
  }
  return result;
}

/**
 * Rebuild a production series using a NEW decline rate while preserving
 * the original ramp-up, plateau rate, plateau duration, and total year
 * range. Uses exponential decline q(t) = q_plateau × e^(-D × (t − tEnd)).
 *
 * If the series is empty or has no plateau, returns it unchanged.
 */
function rebuildWithDecline<T extends number>(
  series: TimeSeriesData<T>,
  newDeclineRate: number,
): TimeSeriesData<T> {
  const entries = Object.entries(series)
    .map(([y, v]) => [Number(y), v as number] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return series;

  const peakVal = Math.max(0, ...entries.map(([, v]) => v));
  if (peakVal === 0) return series;

  // Find the LAST year that still sits at plateau (peak) — that's the
  // last year before decline begins.
  let plateauEndYear: number | null = null;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]![1] >= peakVal - 1e-9) {
      plateauEndYear = entries[i]![0];
    } else if (plateauEndYear !== null) {
      break;
    }
  }
  if (plateauEndYear === null) return series;

  const out: Record<number, T> = {};
  for (const [year, original] of entries) {
    if (year <= plateauEndYear) {
      // Ramp-up and plateau years keep their original values
      out[year] = original as T;
    } else {
      const t = year - plateauEndYear;
      out[year] = (Math.round(peakVal * Math.exp(-newDeclineRate * t) * 100) / 100) as T;
    }
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────

export function ProjectInputForm({ onCalculate }: ProjectInputFormProps) {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const activeProject = projects.find((p) => p.project.id === activeProjectId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-text-muted mb-1.5 block">
          Select Project
        </Label>
        <Select
          value={activeProjectId ?? ''}
          onValueChange={(v) => setActiveProject(v)}
          options={projects.map((p) => ({ value: p.project.id, label: p.project.name }))}
          placeholder="Select project..."
          aria-label="Select project"
        />
      </div>

      {/* key forces remount on project switch — useState initializers
          re-read the new project's defaults, avoiding a reset effect. */}
      {activeProject && (
        <EditableProjectFields
          key={activeProject.project.id}
          project={activeProject}
          onCalculate={onCalculate}
        />
      )}

      {!activeProject && (
        <Button disabled className="w-full" icon="simulate">
          Calculate
        </Button>
      )}
    </div>
  );
}

function EditableProjectFields({ project, onCalculate }: { project: ProjectInputs; onCalculate: () => void }) {
  const { project: proj, fiscalRegimeConfig } = project;
  const isCalculating = useProjectStore((s) => s.isCalculating);
  const updateProjectOverrides = useProjectStore((s) => s.updateProjectOverrides);
  const u = useDisplayUnits();

  const defaults = deriveParams(project);

  const [peakRate, setPeakRate] = useState(r1(defaults.peakGas > 0 ? defaults.peakGas : defaults.peakOil));
  const [declineRate, setDeclineRate] = useState(r1(defaults.declineRate * 100));
  const [totalCapex, setTotalCapex] = useState(r1(defaults.totalCapex / 1e6));
  const [annualOpex, setAnnualOpex] = useState(r1(defaults.avgOpexFixed / 1e6));
  const [totalAbex, setTotalAbex] = useState(r1(defaults.totalAbex / 1e6));
  const [modified, setModified] = useState(false);

  // Note: no reset effect. The parent passes key={project.id} so this
  // component remounts when the project changes, and the useState
  // initializers above re-derive defaults from the new project.

  const handleChange = useCallback((setter: (v: number) => void, min = 0, max = 1_000_000) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow empty string temporarily (user clearing input); treat as 0
    if (raw === '' || raw === '-') {
      setter(0);
      setModified(true);
      return;
    }
    const parsed = Number(raw);
    // Reject NaN, Infinity, and out-of-range
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(Math.max(parsed, min), max);
    setter(clamped);
    setModified(true);
  }, []);

  const handleReset = useCallback(() => {
    const d = deriveParams(project);
    setPeakRate(r1(d.peakGas > 0 ? d.peakGas : d.peakOil));
    setDeclineRate(r1(d.declineRate * 100));
    setTotalCapex(r1(d.totalCapex / 1e6));
    setAnnualOpex(r1(d.avgOpexFixed / 1e6));
    setTotalAbex(r1(d.totalAbex / 1e6));
    setModified(false);
    // Reset overrides in store
    updateProjectOverrides(proj.id, null);
  }, [project, proj.id, updateProjectOverrides]);

  const handleCalculate = useCallback(() => {
    if (modified) {
      const d = deriveParams(project);
      const origPeakRate = d.peakGas > 0 ? d.peakGas : d.peakOil;
      const prodFactor = origPeakRate > 0 ? peakRate / origPeakRate : 1;
      const capexFactor = d.totalCapex > 0 ? (totalCapex * 1e6) / d.totalCapex : 1;
      const opexFactor = d.avgOpexFixed > 0 ? (annualOpex * 1e6) / d.avgOpexFixed : 1;
      const abexFactor = d.totalAbex > 0 ? (totalAbex * 1e6) / d.totalAbex : 1;

      // Decline rate is entered as %/yr in the form; engine uses a fraction.
      const newDecline = declineRate / 100;
      // Only rebuild curves if the user changed the decline rate materially
      // (floating-point-safe threshold).
      const declineChanged = Math.abs(newDecline - d.declineRate) > 1e-6;

      const newCosts: CostProfile = {
        capexDrilling: scaleTimeSeries(project.costProfile.capexDrilling, capexFactor),
        capexFacilities: scaleTimeSeries(project.costProfile.capexFacilities, capexFactor),
        capexSubsea: scaleTimeSeries(project.costProfile.capexSubsea, capexFactor),
        capexOther: scaleTimeSeries(project.costProfile.capexOther, capexFactor),
        opexFixed: scaleTimeSeries(project.costProfile.opexFixed, opexFactor),
        opexVariable: project.costProfile.opexVariable,
        abandonmentCost: scaleTimeSeries(project.costProfile.abandonmentCost, abexFactor),
      };

      // Rebuild production curves with the new decline rate (if changed),
      // then apply the peak-rate scaling factor.
      const rebuildAndScale = <T extends number>(
        original: TimeSeriesData<T>,
      ): TimeSeriesData<T> => {
        const withDecline = declineChanged
          ? rebuildWithDecline(original, newDecline)
          : original;
        return scaleTimeSeries(withDecline, prodFactor);
      };

      const newProd: ProductionProfile = {
        oil: rebuildAndScale(project.productionProfile.oil),
        gas: rebuildAndScale(project.productionProfile.gas),
        condensate: rebuildAndScale(project.productionProfile.condensate),
        water: project.productionProfile.water,
      };

      updateProjectOverrides(proj.id, { productionProfile: newProd, costProfile: newCosts });
    }
    onCalculate();
  }, [modified, project, proj.id, peakRate, declineRate, totalCapex, annualOpex, totalAbex, updateProjectOverrides, onCalculate]);

  const isGasProject = defaults.peakGas > 0;

  // The form keeps state in internal base units (bpd / MMscfd / USD millions)
  // so handleCalculate's scaling math stays unchanged. We only convert at
  // the display boundary: input.value multiplies by the display factor,
  // and the onChange handler reverse-divides before clamping and storing.
  const rateFactor = isGasProject ? u.gasFactor : u.oilFactor;
  const peakRateUnitLabel = isGasProject ? `${u.gasUnit}/d` : `${u.oilUnit}/d`;
  const currencyLabel = `${u.currencySymbol}M`;

  const handleChangeConverted = useCallback(
    (setter: (v: number) => void, factor: number, min = 0, max = 1_000_000) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '' || raw === '-') {
          setter(0);
          setModified(true);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return;
        // User types in display units; convert back to base before clamping.
        const base = factor !== 0 ? parsed / factor : parsed;
        const clamped = Math.min(Math.max(base, min), max);
        setter(clamped);
        setModified(true);
      },
    [],
  );

  return (
    <div className="space-y-4">
      {/* Modified badge */}
      {modified && (
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-[9px] bg-amber/10 text-amber border-amber/30">Modified</Badge>
          <button onClick={handleReset} className="text-[10px] text-petrol hover:underline flex items-center gap-1">
            <RotateCcw size={10} /> Reset
          </button>
        </div>
      )}

      {/* Production */}
      <Section title="Production Assumptions">
        <EditField
          label={isGasProject ? `Peak Gas (${peakRateUnitLabel})` : `Peak Oil (${peakRateUnitLabel})`}
          value={Number((peakRate * rateFactor).toFixed(rateFactor === 1 ? 0 : 2))}
          onChange={handleChangeConverted(setPeakRate, rateFactor, 0, isGasProject ? 10_000 : 1_000_000)}
          step={isGasProject ? 1 : 100}
          eduEntryId="E-02"
        />
        <EditField label="Decline Rate (%/yr)" value={declineRate} onChange={handleChange(setDeclineRate, 0, 50)} step={0.5} min={0} max={50} eduEntryId="E-03" />
        {defaults.peakCond > 0 && (
          <ReadOnlyField
            label="Peak Condensate"
            value={`${(defaults.peakCond * u.oilFactor).toLocaleString('en-US', { maximumFractionDigits: u.oilFactor === 1 ? 0 : 1 })} ${u.oilUnit}/d`}
            eduEntryId="E-04"
          />
        )}
        <ReadOnlyField label="Field Life" value={`${proj.startYear} — ${proj.endYear}`} eduEntryId="E-05" />
      </Section>

      <hr className="border-border my-4" />

      {/* Costs */}
      <Section title="Cost Assumptions">
        <EditField
          label={`Total CAPEX (${currencyLabel})`}
          value={Number((totalCapex * u.currencyFactor).toFixed(1))}
          onChange={handleChangeConverted(setTotalCapex, u.currencyFactor, 0, 50_000)}
          step={10}
          min={0}
          max={50_000}
          eduEntryId="E-06"
        />
        <EditField
          label={`Annual OPEX Fixed (${currencyLabel}/yr)`}
          value={Number((annualOpex * u.currencyFactor).toFixed(1))}
          onChange={handleChangeConverted(setAnnualOpex, u.currencyFactor, 0, 5_000)}
          step={1}
          min={0}
          max={5_000}
          eduEntryId="E-07"
        />
        <EditField
          label={`Abandonment Cost (${currencyLabel})`}
          value={Number((totalAbex * u.currencyFactor).toFixed(1))}
          onChange={handleChangeConverted(setTotalAbex, u.currencyFactor, 0, 10_000)}
          step={1}
          min={0}
          max={10_000}
          eduEntryId="E-08"
        />
        {defaults.abexStart < proj.endYear && (
          <ReadOnlyField label="Decomm. Period" value={`${defaults.abexStart}–${defaults.abexEnd}`} eduEntryId="E-09" />
        )}
        <ReadOnlyField label="Equity Share" value={`${(proj.equityShare * 100).toFixed(0)}%`} eduEntryId="E-10" />
      </Section>

      <hr className="border-border my-4" />

      {/* Fiscal */}
      <Section title="Fiscal Regime">
        <div className="flex items-center gap-2 mb-2">
          <EduTooltip entryId="E-11">
            <Badge variant="outline" className="text-[10px] bg-petrol/10 text-petrol border-petrol/30 cursor-help">
              {fiscalRegimeConfig.type.replace('_', ' ')}
            </Badge>
          </EduTooltip>
          <EduTooltip entryId="E-12">
            <Badge variant="outline" className="text-[10px] cursor-help">{proj.status}</Badge>
          </EduTooltip>
          <InfoIcon entry={edu['E-11']!} />
        </div>
        <ReadOnlyField label="Royalty Rate" value={`${(fiscalRegimeConfig.royaltyRate * 100).toFixed(0)}%`} eduEntryId="E-13" />
        <ReadOnlyField label="PITA Rate" value={`${(fiscalRegimeConfig.pitaRate * 100).toFixed(0)}%`} eduEntryId="E-14" />
      </Section>

      <Button
        onClick={handleCalculate}
        disabled={isCalculating}
        className="w-full"
        icon="simulate"
        title="Runs the full fiscal model for the selected project"
      >
        {isCalculating ? 'Calculating...' : 'Calculate'}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function EditField({ label, value, onChange, step, min, max, eduEntryId }: {
  label: string; value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number; min?: number; max?: number;
  eduEntryId?: string;
}) {
  const entry = eduEntryId ? edu[eduEntryId] : undefined;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {entry?.tooltip ? (
          <EduTooltip entry={entry}><Label className="text-xs text-text-secondary whitespace-nowrap cursor-help">{label}</Label></EduTooltip>
        ) : (
          <Label className="text-xs text-text-secondary whitespace-nowrap">{label}</Label>
        )}
        {entry?.infoPanel && <InfoIcon entry={entry} />}
      </div>
      <Input
        type="number"
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        max={max}
        className="h-7 w-[100px] text-xs font-data text-right"
      />
    </div>
  );
}

function ReadOnlyField({ label, value, eduEntryId }: { label: string; value: string; eduEntryId?: string }) {
  const entry = eduEntryId ? edu[eduEntryId] : undefined;
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary flex items-center gap-1">
        {entry?.tooltip ? (
          <EduTooltip entry={entry}><span className="cursor-help">{label}</span></EduTooltip>
        ) : (
          label
        )}
        {entry?.infoPanel && <InfoIcon entry={entry} />}
      </span>
      <span className="text-xs font-data font-medium text-text-primary">{value}</span>
    </div>
  );
}
