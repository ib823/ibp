import type {
  Project,
  ProductionProfile,
  CostProfile,
  ProjectInputs,
  USD,
  TimeSeriesData,
} from '@/engine/types';
import { RC_PSC, DW_PSC, EPT_PSC, SFA_PSC, DOWNSTREAM_TAX } from './fiscal-regimes';
import { arpsDeclineCurve } from '@/engine/reserves/decline-curves';

// ── Helpers ───────────────────────────────────────────────────────────

function usd(n: number): USD {
  return Math.round(n * 100) / 100 as USD;
}

/** Build empty time-series filled with 0 for the given year range */
function zeros(start: number, end: number): TimeSeriesData<number> {
  const s: Record<number, number> = {};
  for (let y = start; y <= end; y++) s[y] = 0;
  return s;
}

function usdZeros(start: number, end: number): TimeSeriesData<USD> {
  const s: Record<number, USD> = {};
  for (let y = start; y <= end; y++) s[y] = usd(0);
  return s;
}

/**
 * Decline curve helper — delegates to the Arps family (D29).
 * Default b = 0 (exponential, backward-compatible). Caller supplies b for
 * hyperbolic (0 < b < 1) or harmonic (b = 1) reservoir behaviour.
 *
 * Reservoir-driver mapping (rule of thumb):
 *   b = 0     solution-gas drive   (exponential)
 *   b ≈ 0.5   gas reservoir / tight (hyperbolic)
 *   b ≈ 0.7   mature waterflood    (near-harmonic)
 *   b = 1     full harmonic
 */
function declineCurve(
  startYear: number,
  endYear: number,
  plateauStartYear: number,
  plateauEndYear: number,
  plateauRate: number,
  declineRate: number,
  arpsB: number = 0,
): TimeSeriesData<number> {
  return arpsDeclineCurve(
    startYear, endYear, plateauStartYear, plateauEndYear,
    plateauRate, declineRate, arpsB,
  );
}

/**
 * Build a CAPEX spread across development years with specified category totals.
 */
function spreadCapex(
  start: number,
  end: number,
  devYears: readonly number[],
  drilling: number,
  facilities: number,
  subsea: number,
  other: number,
): Pick<CostProfile, 'capexDrilling' | 'capexFacilities' | 'capexSubsea' | 'capexOther'> {
  const d = usdZeros(start, end);
  const f = usdZeros(start, end);
  const sub = usdZeros(start, end);
  const o = usdZeros(start, end);
  const n = devYears.length;

  // Spread drilling: 20% yr1, 40% yr2, 40% yr3 (or equal if different count)
  const drillWeights = n === 3 ? [0.20, 0.40, 0.40] : n === 4 ? [0.15, 0.30, 0.30, 0.25] : Array(n).fill(1 / n);
  const facWeights = n === 3 ? [0.30, 0.45, 0.25] : n === 4 ? [0.25, 0.35, 0.25, 0.15] : Array(n).fill(1 / n);
  const subWeights = n === 3 ? [0.25, 0.40, 0.35] : n === 4 ? [0.20, 0.35, 0.30, 0.15] : Array(n).fill(1 / n);
  const othWeights = Array(n).fill(1 / n) as number[];

  for (let i = 0; i < n; i++) {
    const y = devYears[i]!;
    d[y] = usd(drilling * drillWeights[i]!);
    f[y] = usd(facilities * facWeights[i]!);
    sub[y] = usd(subsea * subWeights[i]!);
    o[y] = usd(other * othWeights[i]!);
  }

  return {
    capexDrilling: d,
    capexFacilities: f,
    capexSubsea: sub,
    capexOther: o,
  };
}

// ════════════════════════════════════════════════════════════════════════
// PROJECT 1: SK-410 Gas Development
// ════════════════════════════════════════════════════════════════════════

const sk410Project: Project = {
  id: 'sk-410',
  name: 'SK-410 Gas Development',
  description: 'Offshore Sarawak gas field development with subsea tiebacks to existing hub',
  businessEntity: 'PETROS Group',
  businessSector: 'Upstream',
  businessType: 'Operated',
  fiscalRegime: 'PSC_RC',
  status: 'active',
  phase: 'development',
  startYear: 2026,
  endYear: 2048,
  equityShare: 0.85,
};

// Gas plateau 120 MMscfd for 5 years (2028-2032), then 12% decline
// Condensate 3800 bpd plateau, same profile
const sk410Production: ProductionProfile = {
  oil: zeros(2026, 2048),
  gas: declineCurve(2026, 2048, 2028, 2032, 120, 0.12, 0.5) /* SK-410 gas: hyperbolic b=0.5 */,
  condensate: declineCurve(2026, 2048, 2028, 2032, 3800, 0.12, 0.5) /* SK-410 condensate */,
  water: (() => {
    // Water production ramps up as gas declines
    const s: Record<number, number> = {};
    for (let y = 2026; y <= 2048; y++) {
      if (y < 2028) s[y] = 0;
      else if (y <= 2032) s[y] = 500 + (y - 2028) * 200;
      else s[y] = Math.round(1500 + (y - 2032) * 400);
    }
    return s;
  })(),
};

const sk410Capex = spreadCapex(2026, 2048, [2026, 2027, 2028], 80e6, 200e6, 180e6, 20e6);

const sk410Costs: CostProfile = {
  ...sk410Capex,
  opexFixed: (() => {
    const s = usdZeros(2026, 2048);
    for (let y = 2028; y <= 2048; y++) s[y] = usd(35e6);
    return s;
  })(),
  opexVariable: (() => {
    // $1.20/boe — gas production in MMscfd to boe/d: ~120 MMscfd ≈ ~20,000 boe/d at plateau
    // Annual variable opex = rate * boe/d * 365
    const gasProfile = sk410Production.gas;
    const condProfile = sk410Production.condensate;
    const s = usdZeros(2026, 2048);
    for (let y = 2026; y <= 2048; y++) {
      const gasBoed = (gasProfile[y] ?? 0) * 1e6 / 6000; // MMscfd to boe/d (6 Mscf/boe)
      const condBoed = condProfile[y] ?? 0;
      s[y] = usd(1.20 * (gasBoed + condBoed) * 365);
    }
    return s;
  })(),
  abandonmentCost: (() => {
    const s = usdZeros(2026, 2048);
    s[2047] = usd(30e6);
    s[2048] = usd(35e6);
    return s;
  })(),
};

export const SK410_INPUTS: ProjectInputs = {
  project: sk410Project,
  productionProfile: sk410Production,
  costProfile: sk410Costs,
  fiscalRegimeConfig: RC_PSC,
};

// ════════════════════════════════════════════════════════════════════════
// PROJECT 2: SK-612 Deepwater Exploration
// ════════════════════════════════════════════════════════════════════════

const sk612Project: Project = {
  id: 'sk-612',
  name: 'SK-612 Deepwater Exploration',
  description: 'Deepwater oil prospect in SK-612 block, targeting turbidite sand reservoirs',
  businessEntity: 'PETROS Group',
  businessSector: 'Upstream',
  businessType: 'Operated',
  fiscalRegime: 'PSC_DW',
  status: 'pre-fid',
  phase: 'exploration',
  startYear: 2027,
  endYear: 2050,
  equityShare: 0.70,
};

// Oil plateau 25,000 bpd for 4 years (2031-2034), then 15% decline
const sk612Production: ProductionProfile = {
  oil: declineCurve(2027, 2050, 2031, 2034, 25000, 0.15, 0.4) /* SK-612 deepwater oil: hyperbolic b=0.4 */,
  gas: (() => {
    // Associated gas: GOR ~500 scf/bbl
    const oilProfile = declineCurve(2027, 2050, 2031, 2034, 25000, 0.15, 0.4) /* SK-612 deepwater oil: hyperbolic b=0.4 */;
    const s: Record<number, number> = {};
    for (let y = 2027; y <= 2050; y++) {
      s[y] = Math.round(((oilProfile[y] ?? 0) * 500 / 1e6) * 100) / 100; // MMscfd
    }
    return s;
  })(),
  condensate: zeros(2027, 2050),
  water: (() => {
    const s: Record<number, number> = {};
    for (let y = 2027; y <= 2050; y++) {
      if (y < 2031) s[y] = 0;
      else if (y <= 2034) s[y] = 2000 + (y - 2031) * 1500;
      else s[y] = Math.round(8000 + (y - 2034) * 2000);
    }
    return s;
  })(),
};

const sk612Capex = spreadCapex(2027, 2050, [2027, 2028, 2029, 2030], 200e6, 600e6, 350e6, 50e6);

const sk612Costs: CostProfile = {
  ...sk612Capex,
  opexFixed: (() => {
    const s = usdZeros(2027, 2050);
    for (let y = 2031; y <= 2050; y++) s[y] = usd(85e6);
    return s;
  })(),
  opexVariable: (() => {
    const oilProfile = sk612Production.oil;
    const s = usdZeros(2027, 2050);
    for (let y = 2027; y <= 2050; y++) {
      s[y] = usd(8.50 * (oilProfile[y] ?? 0) * 365);
    }
    return s;
  })(),
  abandonmentCost: (() => {
    const s = usdZeros(2027, 2050);
    s[2049] = usd(90e6);
    s[2050] = usd(90e6);
    return s;
  })(),
};

export const SK612_INPUTS: ProjectInputs = {
  project: sk612Project,
  productionProfile: sk612Production,
  costProfile: sk612Costs,
  fiscalRegimeConfig: DW_PSC,
};

// ════════════════════════════════════════════════════════════════════════
// PROJECT 3: Balingian Shallow Water (already producing)
// ════════════════════════════════════════════════════════════════════════

const balingianProject: Project = {
  id: 'balingian',
  name: 'Balingian Shallow Water',
  description: 'Producing shallow water oil field offshore Sarawak, EPT fiscal terms',
  businessEntity: 'PETROS Group',
  businessSector: 'Upstream',
  businessType: 'Operated',
  fiscalRegime: 'PSC_EPT',
  status: 'producing',
  phase: 'production',
  startYear: 2022,
  endYear: 2038,
  equityShare: 0.75,
};

// Currently 12,000 bpd, 10% decline from 2022 onwards
const balingianProduction: ProductionProfile = {
  oil: (() => {
    const s: Record<number, number> = {};
    for (let y = 2022; y <= 2038; y++) {
      const t = y - 2022;
      s[y] = Math.round(12000 * Math.exp(-0.10 * t) * 100) / 100;
    }
    return s;
  })(),
  gas: (() => {
    // Associated gas GOR ~300 scf/bbl
    const s: Record<number, number> = {};
    for (let y = 2022; y <= 2038; y++) {
      const t = y - 2022;
      const oilRate = 12000 * Math.exp(-0.10 * t);
      s[y] = Math.round((oilRate * 300 / 1e6) * 100) / 100;
    }
    return s;
  })(),
  condensate: zeros(2022, 2038),
  water: (() => {
    const s: Record<number, number> = {};
    for (let y = 2022; y <= 2038; y++) {
      // Water cut increases over time
      s[y] = Math.round(3000 + (y - 2022) * 800);
    }
    return s;
  })(),
};

const balingianCosts: CostProfile = {
  capexDrilling: usdZeros(2022, 2038),
  capexFacilities: usdZeros(2022, 2038),
  capexSubsea: (() => {
    // $15M/yr sustaining CAPEX as subsea maintenance
    const s = usdZeros(2022, 2038);
    for (let y = 2022; y <= 2038; y++) s[y] = usd(15e6);
    return s;
  })(),
  capexOther: usdZeros(2022, 2038),
  opexFixed: (() => {
    const s = usdZeros(2022, 2038);
    for (let y = 2022; y <= 2038; y++) s[y] = usd(22e6);
    return s;
  })(),
  opexVariable: (() => {
    const s = usdZeros(2022, 2038);
    for (let y = 2022; y <= 2038; y++) {
      const t = y - 2022;
      const oilRate = 12000 * Math.exp(-0.10 * t);
      s[y] = usd(12.50 * oilRate * 365);
    }
    return s;
  })(),
  abandonmentCost: (() => {
    const s = usdZeros(2022, 2038);
    s[2037] = usd(20e6);
    s[2038] = usd(25e6);
    return s;
  })(),
};

export const BALINGIAN_INPUTS: ProjectInputs = {
  project: balingianProject,
  productionProfile: balingianProduction,
  costProfile: balingianCosts,
  fiscalRegimeConfig: EPT_PSC,
};

// ════════════════════════════════════════════════════════════════════════
// PROJECT 4: Tukau Marginal (SFA)
// ════════════════════════════════════════════════════════════════════════

const tukauProject: Project = {
  id: 'tukau',
  name: 'Tukau Marginal',
  description: 'Marginal oil field development under Small Field Asset terms',
  businessEntity: 'PETROS Group',
  businessSector: 'Upstream',
  businessType: 'Operated',
  fiscalRegime: 'PSC_SFA',
  status: 'pre-fid',
  phase: 'development',
  startYear: 2027,
  endYear: 2040,
  equityShare: 1.0,
};

// Plateau 5,000 bpd for 3 years (2029-2031), 18% decline
const tukauProduction: ProductionProfile = {
  oil: declineCurve(2027, 2040, 2029, 2031, 5000, 0.18, 0.3) /* Tukau marginal: gentle hyperbolic b=0.3 */,
  gas: (() => {
    // Low GOR ~200 scf/bbl
    const oilProfile = declineCurve(2027, 2040, 2029, 2031, 5000, 0.18, 0.3) /* Tukau marginal: gentle hyperbolic b=0.3 */;
    const s: Record<number, number> = {};
    for (let y = 2027; y <= 2040; y++) {
      s[y] = Math.round(((oilProfile[y] ?? 0) * 200 / 1e6) * 100) / 100;
    }
    return s;
  })(),
  condensate: zeros(2027, 2040),
  water: (() => {
    const s: Record<number, number> = {};
    for (let y = 2027; y <= 2040; y++) {
      if (y < 2029) s[y] = 0;
      else s[y] = Math.round(800 + (y - 2029) * 500);
    }
    return s;
  })(),
};

const tukauCapex = spreadCapex(2027, 2040, [2027, 2028, 2029], 50e6, 65e6, 25e6, 10e6);

const tukauCosts: CostProfile = {
  ...tukauCapex,
  opexFixed: (() => {
    const s = usdZeros(2027, 2040);
    for (let y = 2029; y <= 2040; y++) s[y] = usd(12e6);
    return s;
  })(),
  opexVariable: (() => {
    const oilProfile = tukauProduction.oil;
    const s = usdZeros(2027, 2040);
    for (let y = 2027; y <= 2040; y++) {
      s[y] = usd(10 * (oilProfile[y] ?? 0) * 365);
    }
    return s;
  })(),
  abandonmentCost: (() => {
    const s = usdZeros(2027, 2040);
    s[2039] = usd(12e6);
    s[2040] = usd(13e6);
    return s;
  })(),
};

export const TUKAU_INPUTS: ProjectInputs = {
  project: tukauProject,
  productionProfile: tukauProduction,
  costProfile: tukauCosts,
  fiscalRegimeConfig: SFA_PSC,
};

// ════════════════════════════════════════════════════════════════════════
// PROJECT 5: M3 CCS Storage
// ════════════════════════════════════════════════════════════════════════

const m3CcsProject: Project = {
  id: 'm3-ccs',
  name: 'M3 CCS Storage',
  description: 'Carbon capture and storage project — depleted reservoir, 15 MT CO2 capacity',
  businessEntity: 'PETROS Group',
  businessSector: 'CCS',
  businessType: 'Operated',
  fiscalRegime: 'DOWNSTREAM',
  status: 'pre-fid',
  phase: 'development',
  startYear: 2027,
  endYear: 2050,
  equityShare: 1.0,
};

// No hydrocarbon production — revenue comes from carbon credits / storage fees
// CO2 injection ramps from 0.5 MT/yr to 1.2 MT/yr plateau
const m3CcsProduction: ProductionProfile = {
  oil: zeros(2027, 2050),
  gas: zeros(2027, 2050),
  condensate: zeros(2027, 2050),
  water: (() => {
    // Use water field as CO2 injection proxy (tonnes/day)
    // 0.5 MT/yr ≈ 1370 t/d, 1.2 MT/yr ≈ 3288 t/d
    const s: Record<number, number> = {};
    for (let y = 2027; y <= 2050; y++) {
      if (y < 2030) s[y] = 0;
      else if (y === 2030) s[y] = 1370;  // 0.5 MT/yr ramp
      else if (y === 2031) s[y] = 2055;  // 0.75 MT/yr
      else if (y === 2032) s[y] = 2740;  // 1.0 MT/yr
      else s[y] = 3288;                  // 1.2 MT/yr plateau
    }
    return s;
  })(),
};

const m3CcsCapex = spreadCapex(2027, 2050, [2027, 2028, 2029, 2030], 30e6, 170e6, 80e6, 40e6);

const m3CcsCosts: CostProfile = {
  ...m3CcsCapex,
  opexFixed: (() => {
    const s = usdZeros(2027, 2050);
    for (let y = 2030; y <= 2050; y++) s[y] = usd(18e6);
    return s;
  })(),
  opexVariable: (() => {
    // $8/tonne injected
    const injection = m3CcsProduction.water;
    const s = usdZeros(2027, 2050);
    for (let y = 2027; y <= 2050; y++) {
      const dailyTonnes = injection[y] ?? 0;
      s[y] = usd(8 * dailyTonnes * 365);
    }
    return s;
  })(),
  abandonmentCost: usdZeros(2027, 2050), // Not modeled yet
};

export const M3_CCS_INPUTS: ProjectInputs = {
  project: m3CcsProject,
  productionProfile: m3CcsProduction,
  costProfile: m3CcsCosts,
  fiscalRegimeConfig: DOWNSTREAM_TAX,
};

// ── All Projects ──────────────────────────────────────────────────────

export const ALL_PROJECTS: readonly ProjectInputs[] = [
  SK410_INPUTS,
  SK612_INPUTS,
  BALINGIAN_INPUTS,
  TUKAU_INPUTS,
  M3_CCS_INPUTS,
];

export const PROJECTS_BY_ID: Record<string, ProjectInputs> = Object.fromEntries(
  ALL_PROJECTS.map((p) => [p.project.id, p]),
);
