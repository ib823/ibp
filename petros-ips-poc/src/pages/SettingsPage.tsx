import { useProjectStore } from '@/store/project-store';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Badge } from '@/components/ui5/Ui5Badge';
import { FISCAL_REGIMES } from '@/data/fiscal-regimes';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { startTour, resetTourFlag } from '@/lib/tour-state';
import { UnitConversionSection } from '@/components/settings/UnitConversionSection';
import { Button } from '@/components/ui5/Ui5Button';
import { fmtPct } from '@/lib/format';
import { getPageEntries } from '@/lib/educational-content';

const edu = getPageEntries('settings');

export default function SettingsPage() {
  usePageTitle('Settings');
  const projects = useProjectStore((s) => s.projects);
  const activeScenario = useProjectStore((s) => s.activeScenario);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Settings & Reference</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Model configuration and fiscal regime reference data
        </p>
      </div>

      {/* Model Parameters */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
          Model Parameters
        </h4>
        <SectionHelp entry={edu['ST-02']!} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          <EduRow label="Discount Rate (NPV)" value="10.0%" tooltipId="ST-03" />
          <EduRow label="CAPEX Depreciation" value="5-year straight-line" tooltipId="ST-04" />
          <EduRow label="MIRR Finance Rate" value="8.0%" tooltipId="ST-05" />
          <EduRow label="MIRR Reinvest Rate" value="10.0%" tooltipId="ST-06" />
          <EduRow label="THV Oil Threshold" value="30 MMstb" tooltipId="ST-07" />
          <EduRow label="THV Gas Threshold" value="0.75 Tscf" tooltipId="ST-08" />
          <EduRow label="Supplementary Payment Rate" value="70%" tooltipId="ST-09" />
          <EduRow label="Decomm. Discount Rate" value="8.0%" tooltipId="ST-10" />
          <EduRow label="Gas Conversion" value="1 MMscf = 1,055 MMBtu" tooltipId="ST-11" />
          <EduRow label="BOE Conversion" value="6 Mscf = 1 BOE" tooltipId="ST-12" />
          <Row label="Active Scenario" value={activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)} />
          <Row label="Projects Loaded" value={`${projects.length}`} />
        </div>
      </div>

      <hr className="border-border my-2" />

      {/* Unit Conversion Factors (DF-01) */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Unit Conversion Factors</h3>
        <p className="text-xs text-text-secondary mb-3">
          Configure display unit preferences and customize conversion factors. Reference: SOW DF-01.
        </p>
        <UnitConversionSection />
      </div>

      <hr className="border-border my-2" />

      {/* Fiscal Regimes Reference */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
          Fiscal Regime Reference
        </h4>
        <SectionHelp entry={edu['ST-13']!} />
        <div className="space-y-4">
          {Object.entries(FISCAL_REGIMES).map(([key, regime]) => (
            <div key={key} className="border border-border/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-[10px] bg-petrol/10 text-petrol border-petrol/30">
                  {regime.type.replace('_', ' ')}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Row label="Royalty" value={fmtPct(regime.royaltyRate, 0)} />
                <Row label="PITA" value={fmtPct(regime.pitaRate, 0)} />
                <Row label="Export Duty" value={fmtPct(regime.exportDutyRate, 0)} />
                <Row label="Research Cess" value={fmtPct(regime.researchCessRate, 1)} />
              </div>
              {'tranches' in regime && (
                <div className="mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-text-secondary">R/C Tranches:</span>
                    <InfoIcon entry={edu['ST-14']!} />
                  </div>
                  <div className="grid grid-cols-5 gap-1 mt-1 text-[10px]">
                    <span className="font-medium text-text-secondary">R/C Range</span>
                    <span className="font-medium text-text-secondary text-right">Ceiling</span>
                    <span className="font-medium text-text-secondary text-right">Contractor</span>
                    <span className="font-medium text-text-secondary text-right">PETRONAS</span>
                    <span />
                    {regime.tranches.map((t, i) => (
                      <div key={i} className="contents">
                        <span className="font-data">{t.rcFloor.toFixed(1)} — {t.rcCeiling === Infinity ? '∞' : t.rcCeiling.toFixed(1)}</span>
                        <span className="font-data text-right">{fmtPct(t.costRecoveryCeilingPct, 0)}</span>
                        <span className="font-data text-right">{fmtPct(t.contractorProfitSharePct, 0)}</span>
                        <span className="font-data text-right">{fmtPct(t.petronasProfitSharePct, 0)}</span>
                        <span />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {'fixedCostRecoveryCeiling' in regime && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <Row label="Cost Recovery Ceiling" value={fmtPct(regime.fixedCostRecoveryCeiling, 0)} />
                  <Row label="PI Lower / Upper" value={`${regime.piLower} / ${regime.piUpper}`} />
                  <Row label="Contractor @ Lower/Upper" value={`${fmtPct(regime.contractorShareAtLower, 0)} / ${fmtPct(regime.contractorShareAtUpper, 0)}`} />
                </div>
              )}
              {'costRecoveryCeilingPct' in regime && !('tranches' in regime) && !('fixedCostRecoveryCeiling' in regime) && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <Row label="Cost Recovery" value={fmtPct(regime.costRecoveryCeilingPct, 0)} />
                  <Row label="Contractor Share" value={fmtPct(regime.contractorProfitSharePct, 0)} />
                  <Row label="PETRONAS Share" value={fmtPct(regime.petronasProfitSharePct, 0)} />
                </div>
              )}
              {'taxRate' in regime && (
                <div className="mt-2 text-xs">
                  <EduRow label="Corporate Tax Rate" value={fmtPct(regime.taxRate, 0)} tooltipId="ST-17" />
                </div>
              )}
            </div>
          ))}
          <div className="border border-border/50 p-3 bg-content-alt/30">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px]">RSC</Badge>
              <span className="text-[10px] text-text-muted">(Risk Service Contract)</span>
              <InfoIcon entry={edu['ST-18']!} />
            </div>
            <p className="text-[10px] text-text-secondary">
              Simplified approximation in POC using corporate-tax model.
              Full fee-based engine (fee-per-barrel, performance bonuses, cost reimbursement, reduced PITA 25%)
              to be implemented in SAC production system.
            </p>
          </div>
        </div>
      </div>

      {/* Guided Tour */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Guided Tour
        </h4>
        <p className="text-xs text-text-secondary mb-3">
          Walk through all features of the PETROS IPS with a 12-step interactive tour.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          icon="sys-help"
          onClick={() => { resetTourFlag(); startTour(); }}
        >
          Restart Guided Tour
        </Button>
      </div>

      <hr className="border-border my-2" />

      {/* About */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          About This POC
        </h4>
        <div className="text-xs text-text-secondary space-y-2">
          <p>
            PETROS Integrated Planning System (IPS) — Proof of Concept demonstrating domain logic
            for petroleum economics evaluation across multiple fiscal regimes.
          </p>
          <p>
            All fiscal parameters are illustrative, based on publicly available PETRONAS MPM descriptions.
            Sample data is derived from Sarawak offshore analogues.
          </p>
          <p className="text-text-muted italic">
            Production Integration: The SAC production system supports Microsoft Power BI connectivity
            via SAC's native live data connection, enabling interactive dashboards with drill-down,
            slicers, and cross-filters per SOW-07.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Disclaimer
        </h4>
        <p className="text-xs text-text-secondary">
          This POC uses illustrative data only. No actual PETROS project data, contract terms,
          or production profiles are used. Fiscal parameters are based on publicly available
          descriptions and may not reflect actual contractual obligations.
        </p>
      </div>

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-text-secondary">{label}</span>
      <span className="font-data font-medium text-text-primary text-right">{value}</span>
    </>
  );
}

function EduRow({ label, value, tooltipId }: { label: string; value: string; tooltipId: string }) {
  const entry = edu[tooltipId];
  return (
    <>
      <span className="text-text-secondary flex items-center gap-1">
        <EduTooltip entryId={tooltipId}><span className="cursor-help">{label}</span></EduTooltip>
        {entry?.infoPanel && <InfoIcon entry={entry} />}
      </span>
      <span className="font-data font-medium text-text-primary text-right">{value}</span>
    </>
  );
}

