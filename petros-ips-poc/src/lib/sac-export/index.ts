// ════════════════════════════════════════════════════════════════════════
// SAC Bridge — POC → SAP Analytics Cloud export
//
// This module produces an Excel workbook that mirrors the shape of an SAC
// Planning model bootstrap. Evaluators can open the file in Excel to see
// exactly what would be imported into SAC during Phase 1a:
//
//   - Dimension master data (Project, Sector, Type, Account, Time,
//     Version, FiscalRegime) — rows align with SAC's /1B/ dimension
//     import format (ID, ParentID, Description, Hierarchy properties).
//   - Project master data with regime, status, equity share, lifecycle.
//   - Fact data (Project × Year × Account × Version × Scenario).
//   - Sample SAC Data Action scripts (Advanced Formula syntax) for the
//     calculations that would replace the POC's TS engines: cost
//     recovery, NPV, government take, audit emission.
//   - README sheet with version, generation timestamp, and the SAC
//     import sequence.
//
// The workbook is the proposal artifact that proves the POC's
// engine output is SAC-import-ready. Phase 1a delivery would ingest
// these CSVs into SAC's /1B/ master data + /CPMB/ fact-data import
// pipelines.
// ════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { ALL_PROJECTS } from '@/data/projects';
import { FISCAL_REGIMES } from '@/data/fiscal-regimes';
import type { EconomicsResult, ScenarioVersion } from '@/engine/types';

const VERSION = '1.0';
const SCENARIOS: readonly ScenarioVersion[] = ['base', 'high', 'low', 'stress'];

// ── Sheet generators ────────────────────────────────────────────────

function readmeSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['PETROS IPS — SAC Bridge Export'],
    [`Version: ${VERSION}`],
    [`Generated: ${new Date().toISOString()}`],
    [],
    ['Purpose'],
    ['  This workbook represents the POC data model in SAP Analytics Cloud (SAC)'],
    ['  Planning import-ready shape. Each "dim_*" sheet is a dimension master-data'],
    ['  CSV; "master_*" sheets are master data tables; "facts_*" sheets are fact'],
    ['  data; "action_*" sheets are sample SAC Data Action / Advanced Formula scripts.'],
    [],
    ['SAC Import Sequence (Phase 1a)'],
    ['  1. Create SAC Planning model with the dimensions listed below.'],
    ['  2. Import dimension members from each "dim_*" sheet via Data Integration'],
    ['     → Acquire Data → File Server (CSV).'],
    ['  3. Import master data via Master Data tile.'],
    ['  4. Import fact data via Data Action / Public Data Action import.'],
    ['  5. Configure Calculation Scope using the "action_*" scripts as the basis.'],
    ['  6. Build stories that map to the POC pages (Dashboard, Economics, Portfolio, etc.).'],
    [],
    ['Sheet Index'],
    ['  README                — this sheet'],
    ['  dim_Project           — Project hierarchy (4-level: Entity → Sector → Type → Project)'],
    ['  dim_Sector            — Business Sector dimension'],
    ['  dim_Type              — Business Type dimension'],
    ['  dim_Account           — Account dimension (NPV, IRR, CAPEX, Revenue, Tax, …)'],
    ['  dim_Time              — Time dimension (yearly grain, 2022–2050)'],
    ['  dim_Version           — Version dimension (Actuals, Budget, Forecast, Approved, Working)'],
    ['  dim_Scenario          — Scenario dimension (Base, High, Low, Stress)'],
    ['  dim_FiscalRegime      — Fiscal regime dimension (PSC RC/DW/EPT/SFA/LLA, RSC, Downstream)'],
    ['  master_Project        — Per-project master data (regime, status, lifecycle, equity)'],
    ['  facts_Economics       — Project × Year × Account × Version × Scenario facts'],
    ['  action_CostRecovery   — Sample SAC Data Action: PSC R/C cost recovery'],
    ['  action_NPV            — Sample SAC Data Action: NPV @ 10% discount'],
    ['  action_GovernmentTake — Sample SAC Data Action: government take pct'],
    ['  action_AuditTrail     — Sample SAC audit emission pattern'],
    [],
    ['Notes'],
    ['  • Currency values are USD (raw, not pre-divided). Apply SAC display unit logic in Story.'],
    ['  • Time grain is yearly. Quarterly/monthly will be derived in SAC via Account allocation rules.'],
    ['  • Fact rows are illustrative for the POC fixture (5 projects × 4 scenarios × 25 years).'],
    ['  • This workbook is generated client-side; no PETROS data leaves the demo browser.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 80 }];
  return ws;
}

function dimProjectSheet(): XLSX.WorkSheet {
  const header = ['ID', 'Description', 'ParentID', 'HierarchyLevel', 'Sector', 'Type', 'FiscalRegime'];
  const rows: (string | number)[][] = [header];
  rows.push(['PETROS_GROUP', 'PETROS Group', '', 1, '', '', '']);
  // Sectors as L2 nodes
  rows.push(['UPSTREAM',           'Upstream',                     'PETROS_GROUP', 2, '', '', '']);
  rows.push(['DOWNSTREAM_INFRA',   'Downstream & Infrastructure',  'PETROS_GROUP', 2, '', '', '']);
  rows.push(['CCS',                'Carbon Capture & Storage',     'PETROS_GROUP', 2, '', '', '']);
  // Types as L3 nodes
  rows.push(['UPSTREAM_OPERATED',  'Upstream — Operated',          'UPSTREAM', 3, 'Upstream', 'Operated', '']);
  rows.push(['UPSTREAM_NONOP',     'Upstream — Non-Operated',      'UPSTREAM', 3, 'Upstream', 'Non-Operated', '']);
  rows.push(['CCS_OPERATED',       'CCS — Operated',               'CCS',      3, 'CCS',      'Operated', '']);
  // Projects as L4 leaves
  for (const p of ALL_PROJECTS) {
    const parent = p.project.businessSector === 'Upstream'
      ? (p.project.businessType === 'Non-Operated' ? 'UPSTREAM_NONOP' : 'UPSTREAM_OPERATED')
      : p.project.businessSector === 'CCS' ? 'CCS_OPERATED' : 'DOWNSTREAM_INFRA';
    rows.push([
      p.project.id,
      p.project.name,
      parent,
      4,
      p.project.businessSector,
      p.project.businessType,
      p.fiscalRegimeConfig.type,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 22 }, { wch: 36 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

function dimSectorSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description', 'ParentID'],
    ['Upstream',                    'Upstream',                    'PETROS_GROUP'],
    ['Downstream & Infrastructure', 'Downstream & Infrastructure', 'PETROS_GROUP'],
    ['CCS',                         'Carbon Capture & Storage',    'PETROS_GROUP'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 36 }, { wch: 16 }];
  return ws;
}

function dimTypeSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description'],
    ['Operated',     'Operated by PETROS'],
    ['Non-Operated', 'Non-operated (PETROS holds equity but partner operates)'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 50 }];
  return ws;
}

function dimAccountSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description', 'Unit', 'AggregationType', 'Category'],
    ['NPV10',                'Net Present Value @ 10%',    'USD', 'NONE',  'KPI'],
    ['IRR',                  'Internal Rate of Return',    'PCT', 'NONE',  'KPI'],
    ['MIRR',                 'Modified IRR',               'PCT', 'NONE',  'KPI'],
    ['PAYBACK',              'Payback Period (yrs)',       'YEAR','NONE',  'KPI'],
    ['DISCOUNTED_PAYBACK',   'Discounted Payback (yrs)',   'YEAR','NONE',  'KPI'],
    ['PI',                   'Profitability Index',        'NUM', 'NONE',  'KPI'],
    ['REVENUE_GROSS',        'Gross Revenue',              'USD', 'SUM',   'INCOME'],
    ['ROYALTY',              'Royalty',                    'USD', 'SUM',   'GOVT_DEDUCTION'],
    ['EXPORT_DUTY',          'Export Duty',                'USD', 'SUM',   'GOVT_DEDUCTION'],
    ['RESEARCH_CESS',        'Research Cess',              'USD', 'SUM',   'GOVT_DEDUCTION'],
    ['REVENUE_AFTER_ROYALTY','Revenue after Royalty',      'USD', 'SUM',   'INCOME'],
    ['COSTREC_CEILING',      'Cost Recovery Ceiling',      'USD', 'NONE',  'FISCAL'],
    ['COSTREC_AMOUNT',       'Cost Recovery Amount',       'USD', 'SUM',   'FISCAL'],
    ['UNRECOVERED_COST',     'Unrecovered Cost (carry)',   'USD', 'NONE',  'FISCAL'],
    ['PROFIT_OIL_GAS',       'Profit Oil/Gas',             'USD', 'SUM',   'FISCAL'],
    ['CONTRACTOR_SHARE',     'Contractor Profit Share',    'USD', 'SUM',   'FISCAL'],
    ['PETRONAS_SHARE',       'PETRONAS Profit Share',      'USD', 'SUM',   'FISCAL'],
    ['SUPP_PAYMENT',         'Supplementary Payment',      'USD', 'SUM',   'FISCAL'],
    ['PITA',                 'Petroleum Income Tax',       'USD', 'SUM',   'TAX'],
    ['CONTRACTOR_ENTITLEMENT','Contractor Entitlement',    'USD', 'SUM',   'FISCAL'],
    ['CAPEX_DRILLING',       'CAPEX Drilling',             'USD', 'SUM',   'CAPEX'],
    ['CAPEX_FACILITIES',     'CAPEX Facilities',           'USD', 'SUM',   'CAPEX'],
    ['CAPEX_SUBSEA',         'CAPEX Subsea',               'USD', 'SUM',   'CAPEX'],
    ['CAPEX_OTHER',          'CAPEX Other',                'USD', 'SUM',   'CAPEX'],
    ['OPEX_FIXED',           'OPEX Fixed',                 'USD', 'SUM',   'OPEX'],
    ['OPEX_VARIABLE',        'OPEX Variable',              'USD', 'SUM',   'OPEX'],
    ['ABANDONMENT',          'Abandonment Cost',           'USD', 'SUM',   'OPEX'],
    ['NCF',                  'Net Cash Flow',              'USD', 'SUM',   'CASHFLOW'],
    ['CUM_NCF',              'Cumulative NCF',             'USD', 'NONE',  'CASHFLOW'],
    ['DCF',                  'Discounted Cash Flow',       'USD', 'SUM',   'CASHFLOW'],
    ['CUM_DCF',              'Cumulative DCF',             'USD', 'NONE',  'CASHFLOW'],
    ['GOVT_TAKE_PCT',        'Government Take %',          'PCT', 'NONE',  'KPI'],
    ['CONTRACTOR_TAKE_PCT',  'Contractor Take %',          'PCT', 'NONE',  'KPI'],
    ['PEAK_FUNDING',         'Peak Funding Requirement',   'USD', 'NONE',  'KPI'],
    ['OIL_PRODUCTION',       'Oil Production (bpd avg)',   'BPD', 'AVG',   'PRODUCTION'],
    ['GAS_PRODUCTION',       'Gas Production (MMscfd avg)','MMSCFD','AVG', 'PRODUCTION'],
    ['CONDENSATE_PRODUCTION','Condensate Prod (bpd avg)',  'BPD', 'AVG',   'PRODUCTION'],
    ['RESERVES_1P',          'Reserves 1P (Proved)',       'MMBOE','NONE', 'RESERVES'],
    ['RESERVES_2P',          'Reserves 2P (Proved+Prob)',  'MMBOE','NONE', 'RESERVES'],
    ['RESERVES_3P',          'Reserves 3P (P+P+Possible)', 'MMBOE','NONE', 'RESERVES'],
    ['INCOME_PBT',           'Profit Before Tax',          'USD', 'SUM',   'IS'],
    ['INCOME_PAT',           'Profit After Tax',           'USD', 'SUM',   'IS'],
    ['BS_PPE_NET',           'PPE Net',                    'USD', 'NONE',  'BS'],
    ['BS_CASH',              'Cash & Equivalents',         'USD', 'NONE',  'BS'],
    ['BS_DECOM_PROVISION',   'Decommissioning Provision',  'USD', 'NONE',  'BS'],
    ['BS_RETAINED_EARNINGS', 'Retained Earnings',          'USD', 'NONE',  'BS'],
    ['CF_OPERATING',         'Operating Cash Flow',        'USD', 'SUM',   'CF'],
    ['CF_INVESTING',         'Investing Cash Flow',        'USD', 'SUM',   'CF'],
    ['CF_FINANCING',         'Financing Cash Flow',        'USD', 'SUM',   'CF'],
    ['CF_NET',               'Net Cash Movement',          'USD', 'SUM',   'CF'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 36 }, { wch: 8 }, { wch: 16 }, { wch: 16 }];
  return ws;
}

function dimTimeSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [['ID', 'Description', 'Year', 'CalendarType']];
  for (let y = 2022; y <= 2050; y++) {
    rows.push([`Y${y}`, String(y), y, 'CY']);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 14 }];
  return ws;
}

function dimVersionSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description', 'Category', 'IsLocked'],
    ['actuals',   'Actuals',          'public',  'TRUE'],
    ['budget',    'Annual Budget',    'public',  'TRUE'],
    ['forecast',  'Rolling Forecast', 'public',  'FALSE'],
    ['submitted', 'Submitted',        'public',  'FALSE'],
    ['approved',  'Approved',         'public',  'TRUE'],
    ['working',   'Working / Draft',  'private', 'FALSE'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 12 }];
  return ws;
}

function dimScenarioSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description', 'Type'],
    ['base',   'Base Case',           'central'],
    ['high',   'High Price Scenario', 'upside'],
    ['low',    'Low Price Scenario',  'downside'],
    ['stress', 'Stress Test',         'stress'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }];
  return ws;
}

function dimFiscalRegimeSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['ID', 'Description', 'Class'],
  ];
  // The five regimes presently exported in FISCAL_REGIMES map. Other regime
  // types declared in engine/types.ts (RSC, PSC_LLA, PSC_HPHT, PSC_1976/85)
  // are reserved for Phase 1b/2 expansion.
  const description: Record<string, string> = {
    PSC_RC:     'PSC — Revenue/Cost (R/C tranches)',
    PSC_DW:     'PSC — Deepwater',
    PSC_EPT:    'PSC — Enhanced Profitability Terms',
    PSC_SFA:    'PSC — Shallow Field Agreement',
    DOWNSTREAM: 'Downstream Corporate Tax',
  };
  for (const [, regime] of Object.entries(FISCAL_REGIMES)) {
    const id = regime.type;
    const cls = id.startsWith('PSC') ? 'production_sharing' : 'corporate_tax';
    rows.push([id, description[id] ?? id, cls]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 22 }];
  return ws;
}

function masterProjectSheet(): XLSX.WorkSheet {
  const header = [
    'ProjectID', 'Name', 'Sector', 'Type', 'FiscalRegime', 'Status',
    'Phase', 'StartYear', 'EndYear', 'EquityShare', 'Description',
  ];
  const rows: (string | number)[][] = [header];
  for (const p of ALL_PROJECTS) {
    rows.push([
      p.project.id,
      p.project.name,
      p.project.businessSector,
      p.project.businessType,
      p.fiscalRegimeConfig.type,
      p.project.status,
      p.project.phase,
      p.project.startYear,
      p.project.endYear,
      p.project.equityShare,
      p.project.description ?? '',
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 60 },
  ];
  return ws;
}

function factsEconomicsSheet(
  resultsByProject: Record<string, Record<ScenarioVersion, EconomicsResult | null>>,
): XLSX.WorkSheet {
  // Long-format fact table: one row per (Project, Scenario, Account)
  // Engineered for SAC's import format which expects long-format facts.
  const header = ['ProjectID', 'Scenario', 'Account', 'Version', 'Time', 'Value'];
  const rows: (string | number)[][] = [header];
  for (const p of ALL_PROJECTS) {
    const byScenario = resultsByProject[p.project.id];
    if (!byScenario) continue;
    for (const sc of SCENARIOS) {
      const r = byScenario[sc];
      if (!r) continue;
      // Headline KPIs (no Time member needed → use #ALL)
      rows.push([p.project.id, sc, 'NPV10',               'working', '#ALL', round(r.npv10 as number)]);
      rows.push([p.project.id, sc, 'IRR',                 'working', '#ALL', round(r.irr ?? 0, 4)]);
      rows.push([p.project.id, sc, 'MIRR',                'working', '#ALL', round(r.mirr, 4)]);
      rows.push([p.project.id, sc, 'PAYBACK',             'working', '#ALL', round(r.paybackYears, 1)]);
      rows.push([p.project.id, sc, 'DISCOUNTED_PAYBACK',  'working', '#ALL', round(r.discountedPaybackYears, 1)]);
      rows.push([p.project.id, sc, 'PI',                  'working', '#ALL', round(r.profitabilityIndex, 2)]);
      rows.push([p.project.id, sc, 'GOVT_TAKE_PCT',       'working', '#ALL', round(r.governmentTakePct / 100, 4)]);
      rows.push([p.project.id, sc, 'CONTRACTOR_TAKE_PCT', 'working', '#ALL', round(r.contractorTakePct / 100, 4)]);
      rows.push([p.project.id, sc, 'PEAK_FUNDING',        'working', '#ALL', round(r.peakFunding as number)]);
      rows.push([p.project.id, sc, 'CAPEX_OTHER',         'working', '#ALL', round(r.totalCapex as number)]);
      rows.push([p.project.id, sc, 'OPEX_FIXED',          'working', '#ALL', round(r.totalOpex as number)]);
      rows.push([p.project.id, sc, 'REVENUE_GROSS',       'working', '#ALL', round(r.totalRevenue as number)]);
      // Yearly time series — net cash flow as the most-asked
      for (const cf of r.yearlyCashflows) {
        rows.push([p.project.id, sc, 'NCF',     'working', `Y${cf.year}`, round(cf.netCashFlow as number)]);
        rows.push([p.project.id, sc, 'DCF',     'working', `Y${cf.year}`, round(cf.discountedCashFlow as number)]);
        rows.push([p.project.id, sc, 'CUM_NCF', 'working', `Y${cf.year}`, round(cf.cumulativeCashFlow as number)]);
      }
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 12 }, { wch: 8 }, { wch: 18 }];
  return ws;
}

function actionCostRecoverySheet(): XLSX.WorkSheet {
  const lines = [
    '// SAC Data Action — PSC R/C Cost Recovery (illustrative)',
    '// Target dimensions: [d/Project], [d/Time], [d/Account], [d/Scenario], [d/Version]',
    '// Maps to POC engine: src/engine/fiscal/psc-rc.ts',
    '',
    '// Step 1 — Cost recovery ceiling = Revenue after royalty × tranche ceiling pct',
    '//   (For R/C PSC the ceiling pct steps with the cumulative R/C index. See',
    '//    dim_FiscalRegime master data for tranche thresholds.)',
    'MEMBERSET [d/Account] = "COSTREC_CEILING"',
    'DATA() = RESULTLOOKUP([d/Account]="REVENUE_AFTER_ROYALTY") * 0.70',
    '',
    '// Step 2 — Cost recovery amount = MIN(ceiling, unrecovered cost pool)',
    'MEMBERSET [d/Account] = "COSTREC_AMOUNT"',
    'DATA() = IF (',
    '  RESULTLOOKUP([d/Account]="UNRECOVERED_COST") < RESULTLOOKUP([d/Account]="COSTREC_CEILING"),',
    '  RESULTLOOKUP([d/Account]="UNRECOVERED_COST"),',
    '  RESULTLOOKUP([d/Account]="COSTREC_CEILING")',
    ')',
    '',
    '// Step 3 — Profit oil/gas = Revenue after royalty − Cost recovery',
    'MEMBERSET [d/Account] = "PROFIT_OIL_GAS"',
    'DATA() = RESULTLOOKUP([d/Account]="REVENUE_AFTER_ROYALTY")',
    '       - RESULTLOOKUP([d/Account]="COSTREC_AMOUNT")',
    '',
    '// Step 4 — Contractor/PETRONAS profit split (depends on R/C tranche)',
    '//   In practice this is a tranche lookup against the running R/C index.',
    '//   The example below uses a constant 70/30 for tranche 0; replace with',
    '//   a lookup against [d/Account]="RC_INDEX" → tranche → split.',
    'MEMBERSET [d/Account] = "CONTRACTOR_SHARE"',
    'DATA() = RESULTLOOKUP([d/Account]="PROFIT_OIL_GAS") * 0.70',
    'MEMBERSET [d/Account] = "PETRONAS_SHARE"',
    'DATA() = RESULTLOOKUP([d/Account]="PROFIT_OIL_GAS") * 0.30',
    '',
    '// Step 5 — Update unrecovered cost pool for next period',
    '//   (carries unrecovered CAPEX into the next year)',
    'MEMBERSET [d/Account] = "UNRECOVERED_COST"',
    'DATA() = PREVIOUS(RESULTLOOKUP([d/Account]="UNRECOVERED_COST"))',
    '       + RESULTLOOKUP([d/Account]="CAPEX_TOTAL")',
    '       - RESULTLOOKUP([d/Account]="COSTREC_AMOUNT")',
  ];
  const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

function actionNpvSheet(): XLSX.WorkSheet {
  const lines = [
    '// SAC Data Action — NPV @ 10% discount rate',
    '// Maps to POC engine: src/engine/economics/npv.ts',
    '',
    '// Convention: Year 0 cash flows undiscounted (industry standard for upstream).',
    '// Discount factor for year t (t≥1): 1 / (1+r)^t with r = 0.10',
    '',
    '// Step 1 — Discounted cash flow per year',
    'MEMBERSET [d/Account] = "DCF"',
    'DATA() = IF (',
    '  [d/Time] = "Y2022",  // assume Y2022 is t=0 for illustration',
    '  RESULTLOOKUP([d/Account]="NCF"),',
    '  RESULTLOOKUP([d/Account]="NCF") / POWER(1.10, [d/Time].YearOffset)',
    ')',
    '',
    '// Step 2 — Cumulative DCF (running sum)',
    'MEMBERSET [d/Account] = "CUM_DCF"',
    'DATA() = PREVIOUS(RESULTLOOKUP([d/Account]="CUM_DCF")) + RESULTLOOKUP([d/Account]="DCF")',
    '',
    '// Step 3 — NPV10 = total cumulative DCF at end of project life',
    '//   In SAC this is typically a Calculated Measure on the Story rather',
    '//   than a Data Action: SUM([d/Time], [d/Account]="DCF").',
  ];
  const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

function actionGovernmentTakeSheet(): XLSX.WorkSheet {
  const lines = [
    '// SAC Story Calculated Measure — Government Take %',
    '// Maps to POC engine: src/engine/economics/indicators.ts',
    '',
    '// Government revenue = Royalty + Export Duty + Research Cess',
    '//                    + PETRONAS Share of profit oil/gas',
    '//                    + Petroleum Income Tax (PITA)',
    '//                    + Supplementary Payment',
    '',
    'GOVT_REVENUE = (',
    '    [d/Account].ROYALTY',
    '  + [d/Account].EXPORT_DUTY',
    '  + [d/Account].RESEARCH_CESS',
    '  + [d/Account].PETRONAS_SHARE',
    '  + [d/Account].PITA',
    '  + [d/Account].SUPP_PAYMENT',
    ')',
    '',
    'GOVT_TAKE_PCT = GOVT_REVENUE / [d/Account].REVENUE_GROSS',
    '',
    '// Contractor take is the residual — guarded against >100% govt take',
    '// (which can occur in cost-recovery-bound years).',
    'CONTRACTOR_TAKE_PCT = MAX(0, 1 - GOVT_TAKE_PCT)',
  ];
  const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

function actionAuditTrailSheet(): XLSX.WorkSheet {
  const lines = [
    '// SAC Audit Trail — pattern',
    '// Maps to POC: src/store/auth-store.ts (recordAudit) + AuditTrailPage',
    '',
    '// SAC Planning has built-in audit logging; the configuration below mirrors',
    '// the POC\'s AuditEventKind union.',
    '',
    '// 1) Enable Auditing on the model: Modeler → Audit → Activate',
    '//',
    '// 2) Audit-relevant event kinds (mapped to POC):',
    '//      auth.signed_in              → SAC built-in (login)',
    '//      workflow.submitted          → Calendar event: data action "submit"',
    '//      workflow.changes_requested  → Calendar event: data action "request_changes"',
    '//      workflow.approved           → Calendar event: data action "approve"',
    '//      connection.synced           → Data Integration sync event',
    '//      data.template_uploaded      → Master Data import event',
    '//',
    '// 3) Custom audit lines (Data Action snippet):',
    'MEMBERSET [d/Account] = "AUDIT_FLAG"',
    'DATA() = NOW()  // timestamp the change',
    '',
    '// 4) Segregation of Duty enforcement: SAC roles + Calendar workflow',
    '//    Approver role cannot run "approve" data action on records where',
    '//    [submittedBy] = currentUser. This mirrors POC\'s canTransition guard.',
  ];
  const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l]));
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

// ── Helpers ─────────────────────────────────────────────────────────

function round(v: number, decimals = 0): number {
  if (!Number.isFinite(v)) return 0;
  const m = Math.pow(10, decimals);
  return Math.round(v * m) / m;
}

// ── Public API ──────────────────────────────────────────────────────

export interface SacExportInput {
  /** Map: projectId → scenario → economics result. Pass current store state. */
  resultsByProject: Record<string, Record<ScenarioVersion, EconomicsResult | null>>;
}

/** Build the SAC bridge workbook — testable, no DOM side-effects. */
export function buildSacExportWorkbook(input: SacExportInput): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, readmeSheet(),                      'README');
  XLSX.utils.book_append_sheet(wb, dimProjectSheet(),                  'dim_Project');
  XLSX.utils.book_append_sheet(wb, dimSectorSheet(),                   'dim_Sector');
  XLSX.utils.book_append_sheet(wb, dimTypeSheet(),                     'dim_Type');
  XLSX.utils.book_append_sheet(wb, dimAccountSheet(),                  'dim_Account');
  XLSX.utils.book_append_sheet(wb, dimTimeSheet(),                     'dim_Time');
  XLSX.utils.book_append_sheet(wb, dimVersionSheet(),                  'dim_Version');
  XLSX.utils.book_append_sheet(wb, dimScenarioSheet(),                 'dim_Scenario');
  XLSX.utils.book_append_sheet(wb, dimFiscalRegimeSheet(),             'dim_FiscalRegime');
  XLSX.utils.book_append_sheet(wb, masterProjectSheet(),               'master_Project');
  XLSX.utils.book_append_sheet(wb, factsEconomicsSheet(input.resultsByProject), 'facts_Economics');
  XLSX.utils.book_append_sheet(wb, actionCostRecoverySheet(),          'action_CostRecovery');
  XLSX.utils.book_append_sheet(wb, actionNpvSheet(),                   'action_NPV');
  XLSX.utils.book_append_sheet(wb, actionGovernmentTakeSheet(),        'action_GovernmentTake');
  XLSX.utils.book_append_sheet(wb, actionAuditTrailSheet(),            'action_AuditTrail');
  return wb;
}

/** Build + trigger a browser download. */
export function exportSacBridge(input: SacExportInput): { filename: string; sheetCount: number } {
  const wb = buildSacExportWorkbook(input);
  const date = new Date().toISOString().split('T')[0];
  const filename = `PETROS_IPS_SAC_Bridge_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { filename, sheetCount: wb.SheetNames.length };
}
