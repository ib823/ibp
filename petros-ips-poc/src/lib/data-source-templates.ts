// ════════════════════════════════════════════════════════════════════════
// Blank Excel Template Generators — Data Sources Page
// ════════════════════════════════════════════════════════════════════════
//
// Each function builds a blank .xlsx template with column headers,
// data-type annotations, and 1 example row so planners know exactly
// what format to prepare for the SAC production upload endpoints.
// ════════════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function makeSheet(
  headers: string[],
  types: string[],
  notes: string[],
  exampleRow: (string | number)[],
): XLSX.WorkSheet {
  const data = [headers, types, notes, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  return ws;
}

// ── 1. Project Master ─────────────────────────────────────────────────

export function downloadProjectsTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = makeSheet(
    ['project_id', 'name', 'description', 'business_entity', 'business_sector', 'business_type', 'fiscal_regime', 'status', 'phase', 'start_year', 'end_year', 'equity_share'],
    ['string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'integer', 'integer', 'decimal 0-1'],
    ['Unique key', 'Display name', 'Free text', 'L1 hierarchy', 'L2: Upstream/CCS/etc', 'L3: Operated/Non-Op', 'PSC_RC/PSC_EPT/etc', 'active/pre-fid/producing/decom', 'exploration/development/production/abandonment', 'First project year', 'Last project year', 'Equity fraction'],
    ['sk-410', 'SK-410 Gas Development', 'Offshore Sarawak gas field', 'PETROS Group', 'Upstream', 'Operated', 'PSC_RC', 'active', 'development', 2026, 2048, 0.85],
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Projects');
  download(wb, 'Template_Project_Master.xlsx');
}

// ── 2. Production & Costs ─────────────────────────────────────────────

export function downloadProductionCostsTemplate() {
  const wb = XLSX.utils.book_new();

  const wsProd = makeSheet(
    ['project_id', 'year', 'oil_bpd', 'gas_mmscfd', 'condensate_bpd', 'water_bpd'],
    ['string', 'integer', 'number', 'number', 'number', 'number'],
    ['FK to Projects', '', 'Oil barrels/day', 'Gas MMscf/day', 'Condensate bbl/day', 'Water bbl/day *'],
    ['sk-410', 2028, 0, 120.00, 3800, 500],
  );
  XLSX.utils.book_append_sheet(wb, wsProd, 'Production');

  const wsCapex = makeSheet(
    ['project_id', 'year', 'capex_drilling_usd', 'capex_facilities_usd', 'capex_subsea_usd', 'capex_other_usd'],
    ['string', 'integer', 'number', 'number', 'number', 'number'],
    ['FK to Projects', '', 'USD', 'USD', 'USD', 'USD'],
    ['sk-410', 2026, 16000000, 60000000, 45000000, 6666667],
  );
  XLSX.utils.book_append_sheet(wb, wsCapex, 'CAPEX');

  const wsOpex = makeSheet(
    ['project_id', 'year', 'opex_fixed_usd', 'opex_variable_usd', 'abandonment_cost_usd'],
    ['string', 'integer', 'number', 'number', 'number'],
    ['FK to Projects', '', 'USD/year', 'USD/year', 'USD — final years only'],
    ['sk-410', 2028, 35000000, 10512000, 0],
  );
  XLSX.utils.book_append_sheet(wb, wsOpex, 'OPEX');

  download(wb, 'Template_Production_Costs.xlsx');
}

// ── 3. Price Decks ────────────────────────────────────────────────────

export function downloadPriceDecksTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = makeSheet(
    ['scenario', 'year', 'oil_usd_bbl', 'gas_usd_mmbtu', 'condensate_usd_bbl', 'exchange_rate_usd_myr', 'carbon_credit_usd_tonne'],
    ['string', 'integer', 'number', 'number', 'number', 'number', 'number'],
    ['base/high/low/stress', '', 'Brent equiv', 'Asian LNG marker', 'Typically ~85% of oil *', 'USD/MYR', 'Voluntary/compliance'],
    ['base', 2026, 73.19, 9.57, 62.21, 4.50, 28.15],
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Price_Deck');
  download(wb, 'Template_Price_Decks.xlsx');
}

// ── 4. Fiscal Regimes ─────────────────────────────────────────────────

export function downloadFiscalRegimesTemplate() {
  const wb = XLSX.utils.book_new();

  const wsBase = makeSheet(
    ['regime_type', 'royalty_rate', 'pita_rate', 'export_duty_rate', 'research_cess_rate', 'cost_recovery_ceiling_pct', 'contractor_profit_share_pct', 'petronas_profit_share_pct', 'pi_lower', 'pi_upper', 'deepwater_allowance', 'tax_rate'],
    ['string', 'decimal', 'decimal', 'decimal', 'decimal', 'decimal?', 'decimal?', 'decimal?', 'decimal?', 'decimal?', 'decimal?', 'decimal?'],
    ['PSC_RC/PSC_EPT/etc', '0-1', '0-1', '0-1', '0-1', 'SFA/LLA only', 'SFA/LLA only', 'SFA/LLA only', 'EPT only', 'EPT only', 'DW only', 'Downstream only'],
    ['PSC_RC', 0.10, 0.38, 0.10, 0.005, '', '', '', '', '', '', ''],
  );
  XLSX.utils.book_append_sheet(wb, wsBase, 'Regime_Base');

  const wsTranches = makeSheet(
    ['regime_type', 'tranche_order', 'rc_floor', 'rc_ceiling', 'cost_recovery_ceiling_pct', 'contractor_profit_share_pct', 'petronas_profit_share_pct'],
    ['string', 'integer', 'decimal', 'decimal', 'decimal', 'decimal', 'decimal'],
    ['FK to Regime_Base', '1-based', 'R/C ratio', 'R/C ratio (Inf for last)', '0-1', '0-1', '0-1'],
    ['PSC_RC', 1, 0.0, 1.0, 0.70, 0.70, 0.30],
  );
  XLSX.utils.book_append_sheet(wb, wsTranches, 'RC_Tranches');

  download(wb, 'Template_Fiscal_Regimes.xlsx');
}

// ── 5. Reserves & Storage ─────────────────────────────────────────────

export function downloadReservesTemplate() {
  const wb = XLSX.utils.book_new();

  const wsPrms = makeSheet(
    ['project_id', 'oil_1p_mmstb', 'oil_2p_mmstb', 'oil_3p_mmstb', 'gas_1p_bcf', 'gas_2p_bcf', 'gas_3p_bcf'],
    ['string', 'number', 'number', 'number', 'number', 'number', 'number'],
    ['FK to Projects', 'Proved', 'Proved+Probable', 'Proved+Probable+Possible', 'Proved', 'Proved+Probable', 'Proved+Probable+Possible'],
    ['sk-612', 75, 120, 165, 15, 25, 35],
  );
  XLSX.utils.book_append_sheet(wb, wsPrms, 'PRMS_Reserves');

  const wsSrms = makeSheet(
    ['project_id', 'site_name', 'low_estimate_mt', 'best_estimate_mt', 'high_estimate_mt', 'resource_class', 'maturity_subclass'],
    ['string', 'string', 'number', 'number', 'number', 'string', 'string'],
    ['FK to Projects', 'Display name', 'MT CO2', 'MT CO2', 'MT CO2', 'capacity/contingent/prospective', 'on-injection/approved/justified/pending'],
    ['m3-ccs', 'M3 Depleted Reservoir', 10, 15, 22, 'contingent', 'approved'],
  );
  XLSX.utils.book_append_sheet(wb, wsSrms, 'CO2_Storage');

  download(wb, 'Template_Reserves_Storage.xlsx');
}

// ── 6. Versioned Data (Budget & Forecast) ─────────────────────────────

export function downloadVersionedDataTemplate() {
  const wb = XLSX.utils.book_new();

  const wsHeader = makeSheet(
    ['project_id', 'data_version', 'scenario_version', 'status', 'last_modified', 'modified_by'],
    ['string', 'string', 'string', 'string', 'ISO date', 'string'],
    ['FK to Projects', 'budget/forecast/actuals/working', 'base/high/low/stress', 'open/submitted/to_change/approved', 'YYYY-MM-DD', 'Name (Role)'],
    ['sk-410', 'forecast', 'base', 'to_change', '2026-04-05', 'A. Hakim (FP&A)'],
  );
  XLSX.utils.book_append_sheet(wb, wsHeader, 'Version_Header');

  const wsProd = makeSheet(
    ['project_id', 'data_version', 'year', 'oil_bpd', 'gas_mmscfd', 'condensate_bpd', 'water_bpd'],
    ['string', 'string', 'integer', 'number', 'number', 'number', 'number'],
    ['FK to Projects', 'FK to Version_Header', '', 'bbl/day', 'MMscf/day', 'bbl/day', 'bbl/day'],
    ['sk-410', 'forecast', 2028, 0, 116.40, 3686, 485],
  );
  XLSX.utils.book_append_sheet(wb, wsProd, 'Version_Production');

  const wsCosts = makeSheet(
    ['project_id', 'data_version', 'year', 'capex_drilling_usd', 'capex_facilities_usd', 'capex_subsea_usd', 'capex_other_usd', 'opex_fixed_usd', 'opex_variable_usd', 'abandonment_cost_usd'],
    ['string', 'string', 'integer', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
    ['FK to Projects', 'FK to Version_Header', '', 'USD', 'USD', 'USD', 'USD', 'USD/year', 'USD/year', 'USD'],
    ['sk-410', 'forecast', 2026, 17280000, 64800000, 48600000, 7200000, 0, 0, 0],
  );
  XLSX.utils.book_append_sheet(wb, wsCosts, 'Version_Costs');

  download(wb, 'Template_Versioned_Data.xlsx');
}

// ── 7. Phase Snapshots ────────────────────────────────────────────────

export function downloadPhaseSnapshotsTemplate() {
  const wb = XLSX.utils.book_new();

  const wsHeader = makeSheet(
    ['project_id', 'phase', 'label', 'created_date', 'assumptions', 'reserves_mmboe'],
    ['string', 'string', 'string', 'ISO date', 'string', 'number?'],
    ['FK to Projects', 'pre_fid/post_fid/development/etc', 'Display label', 'YYYY-MM-DD', 'Key assumptions text', 'Optional reserves estimate'],
    ['sk-612', 'pre_fid', 'Concept Select (2025)', '2025-06-15', '2P reserves 120 MMbbl. Peak 25,000 bpd.', 120],
  );
  XLSX.utils.book_append_sheet(wb, wsHeader, 'Phase_Header');

  download(wb, 'Template_Phase_Snapshots.xlsx');
}

// ── 8. Unit Conversions & Model Parameters ────────────────────────────

export function downloadUnitConversionsTemplate() {
  const wb = XLSX.utils.book_new();

  const ws = makeSheet(
    ['from_unit', 'to_unit', 'factor', 'category', 'description'],
    ['string', 'string', 'positive number', 'string', 'string'],
    ['Source unit', 'Target unit', 'Multiply source by this', 'volume_oil/volume_gas/mass/energy/currency', 'Human-readable label'],
    ['bbl', 'm\u00B3', 0.158987, 'volume_oil', 'Barrels to Cubic Meters'],
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Conversions');

  download(wb, 'Template_Unit_Conversions.xlsx');
}
