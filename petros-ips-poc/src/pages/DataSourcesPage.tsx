import { useState, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Badge } from '@/components/ui5/Ui5Badge';
import { Button } from '@/components/ui5/Ui5Button';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectionCard } from '@/components/shared/ConnectionCard';
import { S4HanaIntegrationPanel } from '@/components/shared/S4HanaIntegrationPanel';
import { VersionedDataUpload } from '@/components/shared/VersionedDataUpload';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { SectionHelp } from '@/components/shared/SectionHelp';
import { getEntry } from '@/lib/educational-content';

// ── Live data imports (sample rows pulled from actual POC data) ────────
import { ALL_PROJECTS } from '@/data/projects';
import { BASE_PRICE_DECK } from '@/data/price-decks';
import { FISCAL_REGIMES } from '@/data/fiscal-regimes';
import { buildVersionedDataRegistry } from '@/data/versioned-data';
import { buildPhaseDataRegistry } from '@/data/phase-data';
import { PROJECT_RESERVES } from '@/engine/reserves/prms';
// CO2_STORAGE_RESOURCES available if needed for SRMS sample rows
// import { CO2_STORAGE_RESOURCES } from '@/engine/reserves/srms';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';

// ── Template download functions ────────────────────────────────────────
import {
  downloadProjectsTemplate,
  downloadProductionCostsTemplate,
  downloadPriceDecksTemplate,
  downloadFiscalRegimesTemplate,
  downloadReservesTemplate,
  downloadVersionedDataTemplate,
  downloadPhaseSnapshotsTemplate,
  downloadUnitConversionsTemplate,
} from '@/lib/data-source-templates';

// ════════════════════════════════════════════════════════════════════════
// Data Definitions
// ════════════════════════════════════════════════════════════════════════

interface ColumnDef {
  name: string;
  type: string;
  description: string;
}

interface SheetDef {
  name: string;
  columns: ColumnDef[];
}

interface WorkbookDef {
  id: string;
  name: string;
  purpose: string;
  frequency: string;
  pages: string[];
  sheets: SheetDef[];
  footnotes?: string[];
  downloadFn: () => void;
  getSampleRows: () => (string | number)[][];
}

// ── Cross-reference matrix ────────────────────────────────────────────

const PAGES = ['Dashboard', 'Economics', 'Sensitivity', 'Portfolio', 'Financial', 'Reserves', 'Monte Carlo'] as const;

const DATA_SOURCES = [
  'Projects',
  'Production & Costs',
  'Price Decks',
  'Fiscal Regimes',
  'Reserves & Storage',
  'Versioned Data',
  'Phase Snapshots',
  'Unit Conversions',
] as const;

// Which data sources feed which pages (true = consumed)
const MATRIX: Record<string, Record<string, boolean>> = {
  'Projects':            { Dashboard: true,  Economics: true,  Sensitivity: true,  Portfolio: true,  Financial: true,  Reserves: true,  'Monte Carlo': true },
  'Production & Costs':  { Dashboard: true,  Economics: true,  Sensitivity: true,  Portfolio: true,  Financial: true,  Reserves: true,  'Monte Carlo': true },
  'Price Decks':         { Dashboard: true,  Economics: true,  Sensitivity: true,  Portfolio: true,  Financial: true,  Reserves: false, 'Monte Carlo': true },
  'Fiscal Regimes':      { Dashboard: true,  Economics: true,  Sensitivity: true,  Portfolio: true,  Financial: true,  Reserves: false, 'Monte Carlo': true },
  'Reserves & Storage':  { Dashboard: false, Economics: false, Sensitivity: false, Portfolio: false, Financial: false, Reserves: true,  'Monte Carlo': false },
  'Versioned Data':      { Dashboard: false, Economics: true,  Sensitivity: false, Portfolio: false, Financial: false, Reserves: false, 'Monte Carlo': false },
  'Phase Snapshots':     { Dashboard: false, Economics: true,  Sensitivity: false, Portfolio: false, Financial: false, Reserves: false, 'Monte Carlo': false },
  'Unit Conversions':    { Dashboard: true,  Economics: true,  Sensitivity: true,  Portfolio: true,  Financial: true,  Reserves: true,  'Monte Carlo': true },
};

// ════════════════════════════════════════════════════════════════════════
// Page Component
// ════════════════════════════════════════════════════════════════════════

export default function DataSourcesPage() {
  usePageTitle('Data Sources');
  const [openId, setOpenId] = useState<string | null>(null);

  const versionedRegistry = useMemo(() => buildVersionedDataRegistry(), []);
  const phaseRegistry = useMemo(() => buildPhaseDataRegistry(), []);

  const workbooks: WorkbookDef[] = useMemo(() => [
    // ── 1. Projects ───────────────────────────────────────────────────
    {
      id: 'projects',
      name: 'Project Master',
      purpose: 'Project registry, hierarchy assignment, and lifecycle metadata for all assets in the portfolio.',
      frequency: 'Rarely — new project onboarding or status changes',
      pages: ['All pages'],
      sheets: [{
        name: 'Projects',
        columns: [
          { name: 'project_id', type: 'string', description: 'Unique key used across all workbooks' },
          { name: 'name', type: 'string', description: 'Display name' },
          { name: 'description', type: 'string', description: 'Project description (free text)' },
          { name: 'business_entity', type: 'string', description: 'L1 hierarchy (e.g. PETROS Group)' },
          { name: 'business_sector', type: 'string', description: 'L2: Upstream / Downstream / CCS' },
          { name: 'business_type', type: 'string', description: 'L3: Operated / Non-Operated' },
          { name: 'fiscal_regime', type: 'string', description: 'PSC_RC, PSC_EPT, PSC_SFA, PSC_DW, DOWNSTREAM' },
          { name: 'status', type: 'string', description: 'active / pre-fid / producing / decommissioning' },
          { name: 'phase', type: 'string', description: 'exploration / development / production / abandonment' },
          { name: 'start_year', type: 'integer', description: 'First year of project timeline' },
          { name: 'end_year', type: 'integer', description: 'Last year (including abandonment)' },
          { name: 'equity_share', type: 'decimal', description: 'Participating interest 0–1' },
        ],
      }],
      downloadFn: downloadProjectsTemplate,
      getSampleRows: () =>
        ALL_PROJECTS.slice(0, 3).map((p) => [
          p.project.id, p.project.name, p.project.businessSector,
          p.project.fiscalRegime, p.project.status, p.project.startYear,
          p.project.endYear, p.project.equityShare,
        ]),
    },

    // ── 2. Production & Costs ─────────────────────────────────────────
    {
      id: 'production-costs',
      name: 'Production & Costs',
      purpose: 'Year-by-year production profiles (oil, gas, condensate, water) and cost breakdown (CAPEX drilling/facilities/subsea, OPEX fixed/variable, abandonment).',
      frequency: 'Annually — during re-forecast cycle',
      pages: ['Economics', 'Sensitivity', 'Portfolio', 'Financial', 'Monte Carlo'],
      sheets: [
        {
          name: 'Production',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'year', type: 'integer', description: 'Calendar year' },
            { name: 'oil_bpd', type: 'number', description: 'Oil production, barrels per day' },
            { name: 'gas_mmscfd', type: 'number', description: 'Gas production, MMscf per day' },
            { name: 'condensate_bpd', type: 'number', description: 'Condensate, barrels per day' },
            { name: 'water_bpd', type: 'number', description: 'Water production, barrels per day' },
          ],
        },
        {
          name: 'CAPEX',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'year', type: 'integer', description: 'Calendar year' },
            { name: 'capex_drilling', type: 'USD', description: 'Drilling CAPEX' },
            { name: 'capex_facilities', type: 'USD', description: 'Facilities CAPEX' },
            { name: 'capex_subsea', type: 'USD', description: 'Subsea CAPEX' },
            { name: 'capex_other', type: 'USD', description: 'Other CAPEX' },
          ],
        },
        {
          name: 'OPEX',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'year', type: 'integer', description: 'Calendar year' },
            { name: 'opex_fixed', type: 'USD', description: 'Fixed operating expenditure per year' },
            { name: 'opex_variable', type: 'USD', description: 'Variable OPEX (volume-linked)' },
            { name: 'abandonment_cost', type: 'USD', description: 'Decommissioning cost (final years)' },
          ],
        },
      ],
      footnotes: [
        '* For CCS projects (M3 CCS), the water_bpd field is repurposed as CO2 injection rate in tonnes/day. Production system: separate co2_injection_tpd column.',
      ],
      downloadFn: downloadProductionCostsTemplate,
      getSampleRows: () => {
        const p = ALL_PROJECTS[0]!;
        const years = [p.project.startYear, p.project.startYear + 2, p.project.startYear + 4];
        return years.map((y) => [
          p.project.id, y,
          (p.productionProfile.oil[y] ?? 0).toFixed(0),
          (p.productionProfile.gas[y] ?? 0).toFixed(2),
          (p.productionProfile.condensate[y] ?? 0).toFixed(0),
          (p.productionProfile.water[y] ?? 0).toFixed(0),
        ]);
      },
    },

    // ── 3. Price Decks ────────────────────────────────────────────────
    {
      id: 'price-decks',
      name: 'Price Decks',
      purpose: 'Commodity price assumptions across 4 scenarios (Base, High, Low, Stress) for oil, gas, condensate, FX rate, and carbon credits.',
      frequency: 'Quarterly — price review committee',
      pages: ['Economics', 'Sensitivity', 'Portfolio', 'Financial', 'Monte Carlo'],
      sheets: [{
        name: 'Price_Deck',
        columns: [
          { name: 'scenario', type: 'string', description: 'base / high / low / stress' },
          { name: 'year', type: 'integer', description: 'Calendar year' },
          { name: 'oil_usd_bbl', type: 'number', description: 'Oil price USD/bbl (Brent equivalent)' },
          { name: 'gas_usd_mmbtu', type: 'number', description: 'Gas price USD/MMBtu' },
          { name: 'condensate_usd_bbl', type: 'number', description: 'Condensate price USD/bbl' },
          { name: 'exchange_rate', type: 'number', description: 'USD/MYR exchange rate' },
          { name: 'carbon_credit_usd_tonne', type: 'number', description: 'Carbon credit price USD/tonne' },
        ],
      }],
      footnotes: [
        '* POC simplification: Condensate price is derived as oil price x 0.85. Production system: independent condensate price deck from market data.',
      ],
      downloadFn: downloadPriceDecksTemplate,
      getSampleRows: () => {
        const years = [2026, 2030, 2040];
        return years.map((y) => [
          'base', y,
          ((BASE_PRICE_DECK.oil[y] ?? 0) as number).toFixed(2),
          ((BASE_PRICE_DECK.gas[y] ?? 0) as number).toFixed(2),
          ((BASE_PRICE_DECK.condensate[y] ?? 0) as number).toFixed(2),
          ((BASE_PRICE_DECK.exchangeRate[y] ?? 0) as number).toFixed(2),
          ((BASE_PRICE_DECK.carbonCredit[y] ?? 0) as number).toFixed(2),
        ]);
      },
    },

    // ── 4. Fiscal Regimes ─────────────────────────────────────────────
    {
      id: 'fiscal-regimes',
      name: 'Fiscal Regimes',
      purpose: 'PSC contract terms — royalty, PITA, export duty, cost recovery ceilings, profit-sharing tranches. Drives all fiscal calculations.',
      frequency: 'Rarely — new PSC terms or contract amendments',
      pages: ['Economics', 'Sensitivity', 'Portfolio', 'Financial'],
      sheets: [
        {
          name: 'Regime_Base',
          columns: [
            { name: 'regime_type', type: 'string', description: 'PSC_RC / PSC_EPT / PSC_SFA / PSC_DW / DOWNSTREAM' },
            { name: 'royalty_rate', type: 'decimal', description: 'Royalty rate 0–1' },
            { name: 'pita_rate', type: 'decimal', description: 'Petroleum income tax rate' },
            { name: 'export_duty_rate', type: 'decimal', description: 'Export duty rate' },
            { name: 'research_cess_rate', type: 'decimal', description: 'Research cess rate' },
          ],
        },
        {
          name: 'RC_Tranches',
          columns: [
            { name: 'regime_type', type: 'string', description: 'FK to Regime_Base' },
            { name: 'tranche_order', type: 'integer', description: '1-based sequence' },
            { name: 'rc_floor', type: 'decimal', description: 'R/C ratio lower bound' },
            { name: 'rc_ceiling', type: 'decimal', description: 'R/C ratio upper bound' },
            { name: 'cost_recovery_ceiling_pct', type: 'decimal', description: 'Max cost recovery %' },
            { name: 'contractor_profit_share_pct', type: 'decimal', description: 'Contractor share %' },
            { name: 'petronas_profit_share_pct', type: 'decimal', description: 'PETRONAS share %' },
          ],
        },
      ],
      downloadFn: downloadFiscalRegimesTemplate,
      getSampleRows: () => {
        const entries = Object.entries(FISCAL_REGIMES).slice(0, 3);
        return entries.map(([key, r]) => [
          key, r.royaltyRate, r.pitaRate, r.exportDutyRate, r.researchCessRate,
        ]);
      },
    },

    // ── 5. Reserves & Storage ─────────────────────────────────────────
    {
      id: 'reserves',
      name: 'Reserves & Storage',
      purpose: 'SPE PRMS reserves classification (1P/2P/3P for oil and gas) and SPE SRMS CO2 storage resource estimates.',
      frequency: 'Annually — reserves booking / audit',
      pages: ['Reserves'],
      sheets: [
        {
          name: 'PRMS_Reserves',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'oil_1p_mmstb', type: 'number', description: 'Proved oil reserves MMstb' },
            { name: 'oil_2p_mmstb', type: 'number', description: 'Proved + Probable' },
            { name: 'oil_3p_mmstb', type: 'number', description: 'Proved + Probable + Possible' },
            { name: 'gas_1p_bcf', type: 'number', description: 'Proved gas reserves Bcf' },
            { name: 'gas_2p_bcf', type: 'number', description: 'Proved + Probable' },
            { name: 'gas_3p_bcf', type: 'number', description: 'Proved + Probable + Possible' },
          ],
        },
        {
          name: 'CO2_Storage',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'site_name', type: 'string', description: 'Storage site display name' },
            { name: 'low_estimate_mt', type: 'number', description: 'Low estimate MT CO2' },
            { name: 'best_estimate_mt', type: 'number', description: 'Best estimate MT CO2' },
            { name: 'high_estimate_mt', type: 'number', description: 'High estimate MT CO2' },
            { name: 'resource_class', type: 'string', description: 'capacity / contingent / prospective' },
            { name: 'maturity_subclass', type: 'string', description: 'on-injection / approved / justified / pending' },
          ],
        },
      ],
      footnotes: [
        '* POC simplification: Reserves reconciliation movements (extensions, revisions, acquisitions, dispositions) are computed with illustrative formulas. Production system: actual movement data from reserves auditor.',
        '* SRMS technical revisions are derived as opening x 0.5%. Production system: actual assessed revisions.',
      ],
      downloadFn: downloadReservesTemplate,
      getSampleRows: () =>
        PROJECT_RESERVES.filter((r) => r.oil['2P'] > 0 || r.gas['2P'] > 0).slice(0, 3).map((r) => [
          r.projectId, r.oil['1P'], r.oil['2P'], r.oil['3P'], r.gas['1P'], r.gas['2P'], r.gas['3P'],
        ]),
    },

    // ── 6. Versioned Data ─────────────────────────────────────────────
    {
      id: 'versioned-data',
      name: 'Versioned Data (Budget & Forecast)',
      purpose: 'Multiple planning submissions per project — Budget, Forecast, Actuals, Working drafts — with approval status tracking. Enables variance analysis.',
      frequency: 'Each planning cycle (mid-year re-forecast, annual budget)',
      pages: ['Economics (Budget & Forecast tab)'],
      sheets: [
        {
          name: 'Version_Header',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'data_version', type: 'string', description: 'budget / forecast / actuals / working' },
            { name: 'scenario_version', type: 'string', description: 'base / high / low / stress' },
            { name: 'status', type: 'string', description: 'open / submitted / to_change / approved' },
            { name: 'last_modified', type: 'ISO date', description: 'YYYY-MM-DD last update' },
            { name: 'modified_by', type: 'string', description: 'Name and role of submitter' },
          ],
        },
        {
          name: 'Version_Production',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'data_version', type: 'string', description: 'FK to Version_Header' },
            { name: 'year', type: 'integer', description: 'Calendar year' },
            { name: 'oil_bpd', type: 'number', description: 'Oil bbl/day' },
            { name: 'gas_mmscfd', type: 'number', description: 'Gas MMscf/day' },
            { name: 'condensate_bpd', type: 'number', description: 'Condensate bbl/day' },
            { name: 'water_bpd', type: 'number', description: 'Water bbl/day' },
          ],
        },
        {
          name: 'Version_Costs',
          columns: [
            { name: 'project_id', type: 'string', description: 'FK to Projects' },
            { name: 'data_version', type: 'string', description: 'FK to Version_Header' },
            { name: 'year', type: 'integer', description: 'Calendar year' },
            { name: 'capex_drilling / facilities / subsea / other', type: 'USD', description: '4 CAPEX category columns' },
            { name: 'opex_fixed / opex_variable / abandonment_cost', type: 'USD', description: '3 OPEX columns' },
          ],
        },
      ],
      downloadFn: downloadVersionedDataTemplate,
      getSampleRows: () => {
        const rows: (string | number)[][] = [];
        for (const [projId, versions] of versionedRegistry) {
          for (const [ver, data] of versions) {
            rows.push([projId, ver, data.scenarioVersion, data.status, data.lastModified, data.modifiedBy]);
          }
          if (rows.length >= 4) break;
        }
        return rows.slice(0, 4);
      },
    },

    // ── 7. Phase Snapshots ────────────────────────────────────────────
    {
      id: 'phase-snapshots',
      name: 'Phase Snapshots',
      purpose: 'Pre-FID vs Post-FID planning snapshots — captures how production, cost, and reserve estimates evolved across decision gates.',
      frequency: 'At gate milestones (Concept Select, FID, etc.)',
      pages: ['Economics (Phases tab)'],
      sheets: [{
        name: 'Phase_Header',
        columns: [
          { name: 'project_id', type: 'string', description: 'FK to Projects' },
          { name: 'phase', type: 'string', description: 'pre_fid / post_fid / development / production / etc.' },
          { name: 'label', type: 'string', description: 'Display label (e.g. Concept Select 2025)' },
          { name: 'created_date', type: 'ISO date', description: 'When this snapshot was taken' },
          { name: 'assumptions', type: 'string', description: 'Key assumptions text' },
          { name: 'reserves_mmboe', type: 'number?', description: 'Optional reserves estimate (MMboe)' },
        ],
      }],
      downloadFn: downloadPhaseSnapshotsTemplate,
      getSampleRows: () => {
        const rows: (string | number)[][] = [];
        for (const [, phases] of phaseRegistry) {
          for (const p of phases) {
            rows.push([p.projectId, p.phase, p.label, p.createdDate, p.reservesMmboe ?? '']);
          }
        }
        return rows.slice(0, 4);
      },
    },

    // ── 8. Unit Conversions ───────────────────────────────────────────
    {
      id: 'unit-conversions',
      name: 'Unit Conversions & Model Parameters',
      purpose: 'Configurable conversion factors (bbl→m3, USD→MYR, Mscf→boe) and model parameters (discount rate 10%, depreciation 5yr SL). Super-users can add custom factors.',
      frequency: 'Rarely — configuration changes',
      pages: ['All pages (display unit rendering)', 'Settings'],
      sheets: [{
        name: 'Conversions',
        columns: [
          { name: 'from_unit', type: 'string', description: 'Source unit (e.g. bbl)' },
          { name: 'to_unit', type: 'string', description: 'Target unit (e.g. m3)' },
          { name: 'factor', type: 'number', description: 'Multiply source value by this factor' },
          { name: 'category', type: 'string', description: 'volume_oil / volume_gas / mass / energy / currency' },
          { name: 'description', type: 'string', description: 'Human-readable label' },
        ],
      }],
      downloadFn: downloadUnitConversionsTemplate,
      getSampleRows: () =>
        DEFAULT_CONVERSIONS.slice(0, 4).map((c) => [
          c.fromUnit, c.toUnit, c.factor, c.category, c.description,
        ]),
    },
  ], [versionedRegistry, phaseRegistry]);

  const connEntry = getEntry('CONN-01');
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Data Sources</h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Input data that feeds the PETROS IPS calculation engine. Each workbook below describes
          the structure, sample data, and downloadable blank template for production upload.
        </p>
      </div>

      {/* SAP S/4HANA integration — Phase 1a feeds */}
      <S4HanaIntegrationPanel />

      {/* Zone 0 — Live connections (POC simulation) */}
      <section className="border border-border bg-white p-4 sm:p-5 space-y-3" aria-labelledby="ds-connections-title">
        <header className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h2 id="ds-connections-title" className="text-body font-semibold text-text-primary flex items-center gap-1.5">
              Live connections
              {connEntry && <InfoIcon entry={connEntry} />}
            </h2>
            <p className="text-caption text-text-secondary mt-0.5">
              Production integration lifecycle — connect / sync / disconnect SAP S/4HANA and SAP Analytics Cloud.
              Microsoft Entra ID shows the current authenticated tenant for reference.
            </p>
          </div>
        </header>
        {connEntry?.sectionHelp && <SectionHelp entry={connEntry} />}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ConnectionCard kind="s4hana" eduId="CONN-01" />
          <ConnectionCard kind="sac" />
          <ConnectionCard kind="entra" />
        </div>
      </section>

      {/* Round-trip upload */}
      <VersionedDataUpload />

      {/* Zone 1 — Input → Output Flow Map */}
      <FlowMap />

      {/* Zone 2 — Cross-Reference Matrix */}
      <CrossReferenceMatrix />

      {/* Zone 3 — Expandable Workbook Cards */}
      <div className="space-y-1">
        {workbooks.map((wb) => (
          <WorkbookCard
            key={wb.id}
            workbook={wb}
            isOpen={openId === wb.id}
            onToggle={() => setOpenId((prev) => (prev === wb.id ? null : wb.id))}
          />
        ))}
      </div>

      {/* Zone 4 — Disclaimer */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-2">
          Production Integration Note
        </h4>
        <div className="text-caption text-text-muted space-y-1.5">
          <p>
            This POC uses hardcoded sample data derived from Sarawak offshore analogues. In the SAC production system,
            these data sources are ingested via <strong>SAP Analytics Cloud Import Data Management</strong> with automated
            validation, or through direct integration with <strong>SAP S/4HANA</strong> (for Actuals) and upstream
            planning models.
          </p>
          <p>
            The downloadable templates above provide the exact column structure expected by the production upload
            endpoints. Per SOW-08, the production system supports uploads from files and spreadsheets with format
            validation and error reporting.
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Zone 1 — Input → Output Flow Map
// ════════════════════════════════════════════════════════════════════════

const INPUT_DOMAINS = [
  { label: 'Projects', color: 'bg-petrol' },
  { label: 'Production & Costs', color: 'bg-petrol' },
  { label: 'Price Decks', color: 'bg-petrol' },
  { label: 'Fiscal Regimes', color: 'bg-petrol' },
  { label: 'Reserves', color: 'bg-petrol' },
  { label: 'Versioned Data', color: 'bg-amber' },
  { label: 'Phase Snapshots', color: 'bg-amber' },
  { label: 'Unit Config', color: 'bg-success' },
];

const OUTPUT_PAGES_FLOW = [
  'Dashboard', 'Economics', 'Sensitivity', 'Portfolio',
  'Financial', 'Reserves', 'Monte Carlo',
];

function FlowMap() {
  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Data Flow: Input Workbooks → Calculation Engine → Output Pages
      </h4>
      <div className="flex items-center gap-3">
        {/* Inputs */}
        <div className="flex-1 space-y-1">
          <div className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-1">Input Workbooks</div>
          <div className="flex flex-wrap gap-1">
            {INPUT_DOMAINS.map((d) => (
              <span
                key={d.label}
                className={cn('text-caption text-white px-2 py-0.5 font-medium', d.color)}
              >
                {d.label}
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-caption text-text-muted">
              <span className="w-2 h-2 bg-petrol inline-block" /> Core
            </span>
            <span className="flex items-center gap-1 text-caption text-text-muted">
              <span className="w-2 h-2 bg-amber inline-block" /> Planning Cycles
            </span>
            <span className="flex items-center gap-1 text-caption text-text-muted">
              <span className="w-2 h-2 bg-success inline-block" /> Configuration
            </span>
          </div>
        </div>

        {/* Arrow */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <ArrowRight size={20} className="text-petrol" />
          <span className="text-caption text-text-muted font-medium">Engine</span>
        </div>

        {/* Outputs */}
        <div className="flex-1">
          <div className="text-caption font-semibold uppercase tracking-wider text-text-muted mb-1">Output Pages</div>
          <div className="flex flex-wrap gap-1">
            {OUTPUT_PAGES_FLOW.map((p) => (
              <span
                key={p}
                className="text-caption bg-content-alt text-text-secondary px-2 py-0.5 border border-border font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Zone 2 — Cross-Reference Matrix
// ════════════════════════════════════════════════════════════════════════

function CrossReferenceMatrix() {
  return (
    <div className="border border-border bg-white p-4">
      <h4 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-3">
        Data Source → Page Cross-Reference
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-caption min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left px-2 py-1.5 font-semibold text-text-secondary w-[180px]">Data Source</th>
              {PAGES.map((p) => (
                <th key={p} className="text-center px-1.5 py-1.5 font-semibold text-text-secondary">{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map((ds) => (
              <tr key={ds} className="border-b border-border/30 hover:bg-content-alt/50">
                <td className="px-2 py-1.5 font-medium text-text-primary">{ds}</td>
                {PAGES.map((p) => (
                  <td key={p} className="text-center px-1.5 py-1.5">
                    {MATRIX[ds]?.[p] ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-petrol" title={`${ds} feeds ${p}`} />
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-border/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption text-text-muted mt-2">
        Filled dot = this data source is consumed by the page. Settings page (unit preferences, fiscal reference) is excluded from the matrix as it is configuration-only.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Zone 3 — Expandable Workbook Card
// ════════════════════════════════════════════════════════════════════════

function WorkbookCard({
  workbook,
  isOpen,
  onToggle,
}: {
  workbook: WorkbookDef;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const sampleRows = useMemo(() => (isOpen ? workbook.getSampleRows() : []), [isOpen, workbook]);

  return (
    <div className={cn('border border-border bg-white transition-colors', isOpen && 'border-petrol/30')}>
      {/* Header — always visible */}
      <button onClick={onToggle} className="w-full flex items-start gap-2 px-4 py-3 text-left min-h-[44px]">
        {isOpen ? (
          <ChevronDown size={14} className="text-petrol mt-0.5 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-text-muted mt-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-semibold text-text-primary">{workbook.name}</span>
            <Badge variant="outline" className="text-caption py-0 px-1.5">
              {workbook.frequency}
            </Badge>
          </div>
          <div className="text-xs text-text-muted mt-0.5">{workbook.purpose}</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {workbook.pages.map((p) => (
              <span key={p} className="text-caption bg-petrol/10 text-petrol px-1.5 py-0 border border-petrol/20 font-medium">
                {p}
              </span>
            ))}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {isOpen && (
        <div className="px-4 pb-4 pl-10 space-y-4">
          {/* Sheets */}
          {workbook.sheets.map((sheet) => (
            <div key={sheet.name}>
              <h5 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Sheet: {sheet.name}
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-caption min-w-[480px]">
                  <thead>
                    <tr className="border-b border-border bg-content-alt">
                      <th className="text-left px-2 py-1 font-semibold text-text-secondary">Column</th>
                      <th className="text-left px-2 py-1 font-semibold text-text-secondary w-[80px]">Type</th>
                      <th className="text-left px-2 py-1 font-semibold text-text-secondary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.columns.map((col) => (
                      <tr key={col.name} className="border-b border-border/30">
                        <td className="px-2 py-1 font-data font-medium text-text-primary">{col.name}</td>
                        <td className="px-2 py-1 font-data text-text-muted">{col.type}</td>
                        <td className="px-2 py-1 text-text-secondary">{col.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Sample data */}
          {sampleRows.length > 0 && (
            <div>
              <h5 className="text-caption font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                Sample Data (from POC)
              </h5>
              <div className="overflow-x-auto bg-content-alt p-2">
                <table className="w-full border-collapse text-caption font-data">
                  <tbody>
                    {sampleRows.map((row, i) => (
                      <tr key={i} className={i < sampleRows.length - 1 ? 'border-b border-border/20' : ''}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-0.5 text-text-primary whitespace-nowrap">
                            {typeof cell === 'number' ? cell.toLocaleString() : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footnotes */}
          {workbook.footnotes && workbook.footnotes.length > 0 && (
            <div className="space-y-1">
              {workbook.footnotes.map((fn, i) => (
                <p key={i} className="text-caption text-text-muted italic">{fn}</p>
              ))}
            </div>
          )}

          {/* Download template */}
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            icon="download"
            onClick={() => workbook.downloadFn()}
          >
            Download Blank Template
          </Button>
        </div>
      )}
    </div>
  );
}
