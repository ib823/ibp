import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, RotateCcw } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import type { ProjectInputs, CostProfile, ProductionProfile, TimeSeriesData } from '@/engine/types';

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
    .filter(([_, v]) => (v as number) > 0)
    .map(([y]) => Number(y));

  return {
    peakGas, peakOil, peakCond, declineRate,
    totalCapex, avgOpexFixed, totalAbex,
    abexStart: abexYears.length > 0 ? Math.min(...abexYears) : proj.endYear,
    abexEnd: abexYears.length > 0 ? Math.max(...abexYears) : proj.endYear,
  };
}

function scaleTimeSeries<T extends number>(series: TimeSeriesData<T>, factor: number): TimeSeriesData<T> {
  const result: Record<number, T> = {};
  for (const [year, value] of Object.entries(series)) {
    result[Number(year)] = (value * factor) as T;
  }
  return result;
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
        <Select value={activeProjectId ?? ''} onValueChange={(v) => setActiveProject(v)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select project..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.project.id} value={p.project.id} className="text-sm">
                {p.project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeProject && <EditableProjectFields project={activeProject} onCalculate={onCalculate} />}

      {!activeProject && (
        <Button disabled className="w-full bg-petrol text-white">
          <Calculator size={16} className="mr-2" /> Calculate
        </Button>
      )}
    </div>
  );
}

function EditableProjectFields({ project, onCalculate }: { project: ProjectInputs; onCalculate: () => void }) {
  const { project: proj, fiscalRegimeConfig } = project;
  const isCalculating = useProjectStore((s) => s.isCalculating);
  const updateProjectOverrides = useProjectStore((s) => s.updateProjectOverrides);

  const defaults = deriveParams(project);

  const [peakRate, setPeakRate] = useState(defaults.peakGas > 0 ? defaults.peakGas : defaults.peakOil);
  const [declineRate, setDeclineRate] = useState(defaults.declineRate * 100);
  const [totalCapex, setTotalCapex] = useState(defaults.totalCapex / 1e6);
  const [annualOpex, setAnnualOpex] = useState(defaults.avgOpexFixed / 1e6);
  const [totalAbex, setTotalAbex] = useState(defaults.totalAbex / 1e6);
  const [modified, setModified] = useState(false);

  // Reset when project changes
  useEffect(() => {
    const d = deriveParams(project);
    setPeakRate(d.peakGas > 0 ? d.peakGas : d.peakOil);
    setDeclineRate(d.declineRate * 100);
    setTotalCapex(d.totalCapex / 1e6);
    setAnnualOpex(d.avgOpexFixed / 1e6);
    setTotalAbex(d.totalAbex / 1e6);
    setModified(false);
  }, [project]);

  const handleChange = useCallback((setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(Number(e.target.value));
    setModified(true);
  }, []);

  const handleReset = useCallback(() => {
    const d = deriveParams(project);
    setPeakRate(d.peakGas > 0 ? d.peakGas : d.peakOil);
    setDeclineRate(d.declineRate * 100);
    setTotalCapex(d.totalCapex / 1e6);
    setAnnualOpex(d.avgOpexFixed / 1e6);
    setTotalAbex(d.totalAbex / 1e6);
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

      const newCosts: CostProfile = {
        capexDrilling: scaleTimeSeries(project.costProfile.capexDrilling, capexFactor),
        capexFacilities: scaleTimeSeries(project.costProfile.capexFacilities, capexFactor),
        capexSubsea: scaleTimeSeries(project.costProfile.capexSubsea, capexFactor),
        capexOther: scaleTimeSeries(project.costProfile.capexOther, capexFactor),
        opexFixed: scaleTimeSeries(project.costProfile.opexFixed, opexFactor),
        opexVariable: project.costProfile.opexVariable,
        abandonmentCost: scaleTimeSeries(project.costProfile.abandonmentCost, abexFactor),
      };

      const newProd: ProductionProfile = {
        oil: scaleTimeSeries(project.productionProfile.oil, prodFactor),
        gas: scaleTimeSeries(project.productionProfile.gas, prodFactor),
        condensate: scaleTimeSeries(project.productionProfile.condensate, prodFactor),
        water: project.productionProfile.water,
      };

      updateProjectOverrides(proj.id, { productionProfile: newProd, costProfile: newCosts });
    }
    onCalculate();
  }, [modified, project, proj.id, peakRate, totalCapex, annualOpex, totalAbex, updateProjectOverrides, onCalculate]);

  const isGasProject = defaults.peakGas > 0;

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
          label={isGasProject ? 'Peak Gas (MMscfd)' : 'Peak Oil (bpd)'}
          value={peakRate}
          onChange={handleChange(setPeakRate)}
          step={isGasProject ? 1 : 100}
        />
        <EditField label="Decline Rate (%/yr)" value={declineRate} onChange={handleChange(setDeclineRate)} step={0.5} min={0} max={30} />
        {defaults.peakCond > 0 && (
          <ReadOnlyField label="Peak Condensate" value={`${defaults.peakCond.toLocaleString()} bpd`} />
        )}
        <ReadOnlyField label="Field Life" value={`${proj.startYear} — ${proj.endYear}`} />
      </Section>

      <Separator />

      {/* Costs */}
      <Section title="Cost Assumptions">
        <EditField label="Total CAPEX ($M)" value={totalCapex} onChange={handleChange(setTotalCapex)} step={10} min={0} />
        <EditField label="Annual OPEX Fixed ($M/yr)" value={annualOpex} onChange={handleChange(setAnnualOpex)} step={1} min={0} />
        <EditField label="Abandonment Cost ($M)" value={totalAbex} onChange={handleChange(setTotalAbex)} step={1} min={0} />
        {defaults.abexStart < proj.endYear && (
          <ReadOnlyField label="Decomm. Period" value={`${defaults.abexStart}–${defaults.abexEnd}`} />
        )}
        <ReadOnlyField label="Equity Share" value={`${(proj.equityShare * 100).toFixed(0)}%`} />
      </Section>

      <Separator />

      {/* Fiscal */}
      <Section title="Fiscal Regime">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] bg-petrol/10 text-petrol border-petrol/30">
            {fiscalRegimeConfig.type.replace('_', ' ')}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{proj.status}</Badge>
        </div>
        <ReadOnlyField label="Royalty Rate" value={`${(fiscalRegimeConfig.royaltyRate * 100).toFixed(0)}%`} />
        <ReadOnlyField label="PITA Rate" value={`${(fiscalRegimeConfig.pitaRate * 100).toFixed(0)}%`} />
      </Section>

      <Button
        onClick={handleCalculate}
        disabled={isCalculating}
        className="w-full bg-petrol hover:bg-petrol-light text-white"
      >
        <Calculator size={16} className="mr-2" />
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

function EditField({ label, value, onChange, step, min, max }: {
  label: string; value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-text-secondary whitespace-nowrap">{label}</Label>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs font-data font-medium text-text-primary">{value}</span>
    </div>
  );
}
