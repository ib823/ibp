// ════════════════════════════════════════════════════════════════════════
// PETROS Integrated Planning System — Domain Type Definitions
// ════════════════════════════════════════════════════════════════════════

// ── Branded Types ─────────────────────────────────────────────────────

declare const __usdBrand: unique symbol;
declare const __myrBrand: unique symbol;

export type USD = number & { readonly [__usdBrand]: never };
export type MYR = number & { readonly [__myrBrand]: never };

// ── Common Utility Types ──────────────────────────────────────────────

/** Year → value mapping for time-series data */
export type TimeSeriesData<T> = Record<number, T>;

export type UnitType =
  | 'bbl'
  | 'MMscf'
  | 'MMBtu'
  | 'tonne'
  | 'USD'
  | 'MYR'
  | 'boe'
  | 'bcf'
  | 'mmbbl';

export type DataStatus = 'open' | 'submitted' | 'to_change' | 'approved';

// ── Fiscal Regime Types ───────────────────────────────────────────────

interface FiscalRegimeBase {
  readonly royaltyRate: number;
  readonly pitaRate: number;
  readonly exportDutyRate: number;
  readonly researchCessRate: number;
}

export interface RCTranche {
  readonly rcFloor: number;
  readonly rcCeiling: number;
  readonly costRecoveryCeilingPct: number;
  readonly contractorProfitSharePct: number;
  readonly petronasProfitSharePct: number;
}

export interface FiscalRegime_PSC_RC extends FiscalRegimeBase {
  readonly type: 'PSC_RC';
  readonly tranches: readonly RCTranche[];
}

export interface FiscalRegime_PSC_EPT extends FiscalRegimeBase {
  readonly type: 'PSC_EPT';
  readonly piLower: number;        // default 1.50
  readonly piUpper: number;        // default 2.50
  readonly contractorShareAtLower: number; // default 0.90
  readonly contractorShareAtUpper: number; // default 0.30
  readonly fixedCostRecoveryCeiling: number; // default 0.70
}

export interface FiscalRegime_PSC_SFA extends FiscalRegimeBase {
  readonly type: 'PSC_SFA';
  readonly costRecoveryCeilingPct: number;
  readonly contractorProfitSharePct: number;
  readonly petronasProfitSharePct: number;
}

export interface FiscalRegime_PSC_LLA extends FiscalRegimeBase {
  readonly type: 'PSC_LLA';
  readonly costRecoveryCeilingPct: number;
  readonly contractorProfitSharePct: number;
  readonly petronasProfitSharePct: number;
}

export interface ProductionTier {
  readonly volumeFloor: number; // bpd
  readonly volumeCeiling: number;
  readonly contractorSharePct: number;
  readonly petronaSharePct: number;
}

export interface FiscalRegime_PSC_1976 extends FiscalRegimeBase {
  readonly type: 'PSC_1976';
  readonly productionTiers: readonly ProductionTier[];
}

export interface FiscalRegime_PSC_1985 extends FiscalRegimeBase {
  readonly type: 'PSC_1985';
  readonly productionTiers: readonly ProductionTier[];
}

export interface FiscalRegime_PSC_DW extends FiscalRegimeBase {
  readonly type: 'PSC_DW';
  readonly tranches: readonly RCTranche[];
  readonly deepwaterAllowance: number;
}

export interface FiscalRegime_PSC_HPHT extends FiscalRegimeBase {
  readonly type: 'PSC_HPHT';
  readonly tranches: readonly RCTranche[];
  readonly hphtAllowance: number;
}

export interface FiscalRegime_RSC extends FiscalRegimeBase {
  readonly type: 'RSC';
  readonly feePerBarrel: number;
  readonly performanceBonus: number;
  readonly costReimbursementPct: number;
}

export interface FiscalRegime_DOWNSTREAM extends FiscalRegimeBase {
  readonly type: 'DOWNSTREAM';
  readonly taxRate: number; // default 0.24
}

export type FiscalRegime =
  | FiscalRegime_PSC_RC
  | FiscalRegime_PSC_EPT
  | FiscalRegime_PSC_SFA
  | FiscalRegime_PSC_LLA
  | FiscalRegime_PSC_1976
  | FiscalRegime_PSC_1985
  | FiscalRegime_PSC_DW
  | FiscalRegime_PSC_HPHT
  | FiscalRegime_RSC
  | FiscalRegime_DOWNSTREAM;

export type FiscalRegimeType = FiscalRegime['type'];

// ── Project Types ─────────────────────────────────────────────────────

export type ProjectStatus =
  | 'active'
  | 'pre-fid'
  | 'producing'
  | 'decommissioning';

export type ProjectPhase =
  | 'exploration'
  | 'development'
  | 'production'
  | 'abandonment';

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly businessEntity: string;
  readonly businessSector: string;
  readonly businessType: string;
  readonly fiscalRegime: FiscalRegimeType;
  readonly status: ProjectStatus;
  readonly phase: ProjectPhase;
  readonly startYear: number;
  readonly endYear: number;
  readonly equityShare: number; // 0-1
}

export interface ProductionProfile {
  /** Oil production in bpd per year */
  readonly oil: TimeSeriesData<number>;
  /** Gas production in MMscfd per year */
  readonly gas: TimeSeriesData<number>;
  /** Condensate production in bpd per year */
  readonly condensate: TimeSeriesData<number>;
  /** Water production in bpd per year */
  readonly water: TimeSeriesData<number>;
}

export interface CostProfile {
  readonly capexDrilling: TimeSeriesData<USD>;
  readonly capexFacilities: TimeSeriesData<USD>;
  readonly capexSubsea: TimeSeriesData<USD>;
  readonly capexOther: TimeSeriesData<USD>;
  readonly opexFixed: TimeSeriesData<USD>;
  readonly opexVariable: TimeSeriesData<USD>;
  readonly abandonmentCost: TimeSeriesData<USD>;
}

export interface ProjectInputs {
  readonly project: Project;
  readonly productionProfile: ProductionProfile;
  readonly costProfile: CostProfile;
  readonly fiscalRegimeConfig: FiscalRegime;
}

// ── Price Types ───────────────────────────────────────────────────────

export type ScenarioVersion = 'base' | 'high' | 'low' | 'stress';

export interface PriceDeck {
  readonly oil: TimeSeriesData<USD>;        // USD/bbl
  readonly gas: TimeSeriesData<USD>;        // USD/MMBtu
  readonly condensate: TimeSeriesData<USD>; // USD/bbl
  readonly exchangeRate: TimeSeriesData<number>; // USD/MYR
  readonly carbonCredit: TimeSeriesData<USD>;    // USD/tonne
}

// ── Calculation Result Types ──────────────────────────────────────────

export interface YearlyCashflow {
  readonly year: number;

  // Revenue
  readonly grossRevenueOil: USD;
  readonly grossRevenueGas: USD;
  readonly grossRevenueCond: USD;
  readonly totalGrossRevenue: USD;

  // Government deductions from gross revenue
  readonly royalty: USD;
  readonly exportDuty: USD;
  readonly researchCess: USD;
  readonly revenueAfterRoyalty: USD; // net of royalty + export duty + research cess

  // Cost recovery
  readonly costRecoveryCeiling: USD;
  readonly costRecoveryAmount: USD;
  readonly unrecoveredCostCF: USD;

  // Profit split
  readonly profitOilGas: USD;
  readonly contractorProfitShare: USD;
  readonly petronasProfitShare: USD;
  readonly contractorEntitlement: USD;

  // Tax
  readonly supplementaryPayment: USD;
  readonly taxableIncome: USD;
  readonly capitalAllowance: USD;
  readonly pitaTax: USD;

  // Net cash flow
  readonly netCashFlow: USD;
  readonly cumulativeCashFlow: USD;
  readonly discountedCashFlow: USD;
  readonly cumulativeDiscountedCF: USD;

  // Indices
  readonly rcIndex: number;
  readonly profitabilityIndex: number;
  readonly cumulativeProduction: number; // boe
}

export interface EconomicsResult {
  readonly projectId: string;
  readonly scenario: ScenarioVersion;
  readonly yearlyCashflows: readonly YearlyCashflow[];

  // Key metrics
  readonly npv10: USD;
  readonly irr: number | null;
  readonly mirr: number;
  readonly paybackYears: number;
  readonly discountedPaybackYears: number;
  readonly profitabilityIndex: number;

  /** True when cash flow pattern is non-standard (no initial investment) and IRR is not meaningful */
  readonly isNonInvestmentPattern: boolean;

  // Government/contractor split
  readonly governmentTakePct: number;
  readonly contractorTakePct: number;

  // Totals
  readonly totalCapex: USD;
  readonly totalOpex: USD;
  readonly totalRevenue: USD;
  readonly peakFunding: USD;
  readonly totalTax: USD;
}

// ── Sensitivity Types ─────────────────────────────────────────────────

export type SensitivityVariable =
  | 'oilPrice'
  | 'gasPrice'
  | 'production'
  | 'capex'
  | 'opex';

export interface TornadoDataPoint {
  readonly variable: SensitivityVariable;
  readonly percentChange: number;
  readonly npvDelta: USD;
  readonly npvValue: USD;
}

export interface TornadoResult {
  readonly baseNpv: USD;
  readonly dataPoints: readonly TornadoDataPoint[];
}

// ── Monte Carlo Types ─────────────────────────────────────────────────

export type DistributionType = 'triangular' | 'normal' | 'lognormal';

export interface DistributionConfig {
  readonly type: DistributionType;
  readonly params: TriangularParams | NormalParams | LognormalParams;
}

export interface TriangularParams {
  readonly min: number;
  readonly mode: number;
  readonly max: number;
}

export interface NormalParams {
  readonly mean: number;
  readonly stdDev: number;
}

export interface LognormalParams {
  readonly mu: number;
  readonly sigma: number;
}

export interface MonteCarloConfig {
  readonly iterations: number;
  readonly seed: string;
  readonly distributions: Record<SensitivityVariable, DistributionConfig>;
}

export interface HistogramBin {
  readonly edgeLow: number;
  readonly edgeHigh: number;
  readonly count: number;
}

export interface MonteCarloResult {
  readonly npvValues: readonly USD[];
  readonly p10: USD;
  readonly p50: USD;
  readonly p90: USD;
  readonly mean: USD;
  readonly stdDev: number;
  readonly histogram: readonly HistogramBin[];
}

// ── Financial Statement Types ─────────────────────────────────────────

export interface IncomeStatementLine {
  readonly year: number;
  readonly revenue: USD;
  readonly costOfSales: USD;
  readonly grossProfit: USD;
  readonly explorationExpense: USD;
  readonly depreciationAmortisation: USD;
  readonly adminExpense: USD;
  readonly otherOperatingIncome: USD;
  readonly operatingProfit: USD;
  readonly financeIncome: USD;
  readonly financeCost: USD;
  readonly profitBeforeTax: USD;
  readonly taxExpense: USD;
  readonly profitAfterTax: USD;
}

export interface IncomeStatement {
  readonly yearly: readonly IncomeStatementLine[];
}

export interface BalanceSheetLine {
  readonly year: number;

  // Non-current assets
  readonly ppeNet: USD;
  readonly explorationAssets: USD;
  readonly rightOfUseAssets: USD;
  readonly otherNonCurrentAssets: USD;
  readonly totalNonCurrentAssets: USD;

  // Current assets
  readonly cash: USD;
  readonly tradeReceivables: USD;
  readonly inventories: USD;
  readonly otherCurrentAssets: USD;
  readonly totalCurrentAssets: USD;

  readonly totalAssets: USD;

  // Equity
  readonly shareCapital: USD;
  readonly retainedEarnings: USD;
  readonly otherReserves: USD;
  readonly totalEquity: USD;

  // Non-current liabilities
  readonly longTermDebt: USD;
  readonly decommissioningProvision: USD;
  readonly deferredTaxLiability: USD;
  readonly otherNonCurrentLiabilities: USD;
  readonly totalNonCurrentLiabilities: USD;

  // Current liabilities
  readonly shortTermDebt: USD;
  readonly tradePayables: USD;
  readonly currentTaxLiability: USD;
  readonly otherCurrentLiabilities: USD;
  readonly totalCurrentLiabilities: USD;

  readonly totalLiabilities: USD;
  readonly totalEquityAndLiabilities: USD;
}

export interface BalanceSheet {
  readonly yearly: readonly BalanceSheetLine[];
}

export interface CashFlowStatementLine {
  readonly year: number;

  // Operating activities
  readonly profitBeforeTax: USD;
  readonly depreciation: USD;
  readonly workingCapitalChanges: USD;
  readonly taxPaid: USD;
  readonly otherOperatingAdjustments: USD;
  readonly netOperatingCashFlow: USD;

  // Investing activities
  readonly capexPPE: USD;
  readonly capexExploration: USD;
  readonly disposalProceeds: USD;
  readonly otherInvesting: USD;
  readonly netInvestingCashFlow: USD;

  // Financing activities
  readonly debtDrawdown: USD;
  readonly debtRepayment: USD;
  readonly dividendsPaid: USD;
  readonly otherFinancing: USD;
  readonly netFinancingCashFlow: USD;

  readonly netCashChange: USD;
  readonly openingCash: USD;
  readonly closingCash: USD;
}

export interface CashFlowStatement {
  readonly yearly: readonly CashFlowStatementLine[];
}

// ── Account Movements / Roll-Forwards ─────────────────────────────────

export interface PPERollForward {
  readonly year: number;
  readonly opening: USD;
  readonly additions: USD;
  readonly depreciation: USD;
  readonly impairment: USD;
  readonly disposals: USD;
  readonly closing: USD;
}

export interface ExplorationAssetRollForward {
  readonly year: number;
  readonly opening: USD;
  readonly additions: USD;
  readonly writtenOff: USD;
  readonly reclassifiedToPPE: USD;
  readonly closing: USD;
}

export interface DebtRollForward {
  readonly year: number;
  readonly opening: USD;
  readonly drawdowns: USD;
  readonly repayments: USD;
  readonly closing: USD;
  readonly interestExpense: USD;
}

export interface DecommissioningProvisionRollForward {
  readonly year: number;
  readonly opening: USD;
  readonly additions: USD;
  readonly unwinding: USD;
  readonly utilisations: USD;
  readonly revisions: USD;
  readonly closing: USD;
}

export interface RetainedEarningsRollForward {
  readonly year: number;
  readonly opening: USD;
  readonly profitAfterTax: USD;
  readonly dividends: USD;
  readonly otherMovements: USD;
  readonly closing: USD;
}

export interface AccountMovements {
  readonly ppe: readonly PPERollForward[];
  readonly explorationAssets: readonly ExplorationAssetRollForward[];
  readonly debt: readonly DebtRollForward[];
  readonly decommissioningProvision: readonly DecommissioningProvisionRollForward[];
  readonly retainedEarnings: readonly RetainedEarningsRollForward[];
}

// ── Reserves Reconciliation ───────────────────────────────────────────

export type ReserveCategory = '1P' | '2P' | '3P';
export type HydrocarbonType = 'oil' | 'gas';

export interface ReservesMovement {
  readonly year: number;
  readonly category: ReserveCategory;
  readonly hydrocarbonType: HydrocarbonType;
  readonly opening: number;
  readonly extensions: number;
  readonly technicalRevisions: number;
  readonly economicRevisions: number;
  readonly acquisitions: number;
  readonly dispositions: number;
  readonly production: number;
  readonly closing: number;
}

export interface ReservesReconciliation {
  readonly movements: readonly ReservesMovement[];
}

// ── CO2 Storage Resource Types (SPE SRMS) ────────────────────────────

export type StorageResourceClass = 'capacity' | 'contingent' | 'prospective';
export type StorageMaturitySubclass = 'on-injection' | 'approved' | 'justified' | 'pending';

export interface CO2StorageResource {
  readonly projectId: string;
  readonly siteName: string;
  readonly lowEstimate: number;     // MT CO2 (equivalent to 1C/1P)
  readonly bestEstimate: number;    // MT CO2 (equivalent to 2C/2P)
  readonly highEstimate: number;    // MT CO2 (equivalent to 3C/3P)
  readonly resourceClass: StorageResourceClass;
  readonly maturitySubclass: StorageMaturitySubclass;
}

export interface CO2StorageReconciliation {
  readonly year: number;
  readonly projectId: string;
  readonly opening: number;           // MT remaining capacity
  readonly newAssessments: number;
  readonly technicalRevisions: number;
  readonly injected: number;          // MT injected this year
  readonly closing: number;
}

// ── Portfolio Types ───────────────────────────────────────────────────

export interface OrgHierarchy {
  readonly businessEntity: string;
  readonly businessSector: string;
  readonly businessType: string;
  readonly projectName: string;
}

export interface HierarchyAggregation {
  readonly level: 'businessEntity' | 'businessSector' | 'businessType' | 'projectName';
  readonly key: string;
  readonly npv: USD;
  readonly totalCapex: USD;
  readonly totalProduction: number;
  readonly children: readonly HierarchyAggregation[];
}

export interface PortfolioResult {
  readonly totalNpv: USD;
  readonly totalCapex: USD;
  readonly totalProduction: number;
  readonly projectResults: ReadonlyMap<string, EconomicsResult>;
  readonly hierarchyAggregation: HierarchyAggregation;
}

export interface IncrementalAnalysis {
  readonly basePortfolioNpv: USD;
  readonly withProjectNpv: USD;
  readonly incrementalNpv: USD;
  readonly projectId: string;
}

// ── Downstream Types ──────────────────────────────────────────────────

export interface DownstreamInputs {
  readonly feedstockVolume: number;
  readonly feedstockPrice: USD;
  readonly productVolumes: ReadonlyMap<string, number>;
  readonly productPrices: ReadonlyMap<string, USD>;
  readonly fixedOpex: USD;
  readonly variableOpex: USD;
  readonly plantUtilization: number; // 0-1
  readonly plantCapacity: number;
}

export interface DownstreamResult {
  readonly grossMargin: USD;
  readonly netMargin: USD;
  readonly npv10: USD;
  readonly irr: number;
  readonly breakEvenFeedstockPrice: USD;
  readonly breakEvenProductPrice: USD;
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE 1: Multi-Version Data Management (FM-04)
// ════════════════════════════════════════════════════════════════════════

/**
 * Lifecycle state of a planning data submission.
 * Distinct from `ScenarioVersion` which represents price scenarios.
 */
export type DataVersion =
  | 'actuals'    // Historical actuals (would come from SAP S/4HANA)
  | 'budget'     // Approved annual budget
  | 'forecast'   // Mid-year re-forecast
  | 'submitted'  // Submitted for review (not yet approved)
  | 'approved'   // Approved plan
  | 'working';   // Scratch space for planners

export interface VersionedProjectData {
  readonly projectId: string;
  readonly dataVersion: DataVersion;
  readonly scenarioVersion: ScenarioVersion;
  readonly status: DataStatus;
  readonly lastModified: string; // ISO date
  readonly modifiedBy: string;
  readonly productionProfile: ProductionProfile;
  readonly costProfile: CostProfile;
  /** Identity of the user who made the most recent "submitted" transition.
   *  Used by the SoD guard to prevent same-user approval. Absent until first submission. */
  readonly submittedBy?: string;
  /** Free-form comment attached to the most recent transition (e.g. reviewer feedback). */
  readonly reviewComment?: string;
}

export interface YearlyVariance {
  readonly year: number;
  readonly revenueBudget: number;
  readonly revenueActual: number;
  readonly revenueVariance: number;
  readonly revenueVariancePct: number;
  readonly capexBudget: number;
  readonly capexActual: number;
  readonly capexVariance: number;
  readonly opexBudget: number;
  readonly opexActual: number;
  readonly opexVariance: number;
  readonly ncfBudget: number;
  readonly ncfActual: number;
  readonly ncfVariance: number;
  readonly productionBudget: number; // boe/d
  readonly productionActual: number;
  readonly productionVariance: number;
}

export interface VersionComparisonResult {
  readonly projectId: string;
  readonly version1: DataVersion;
  readonly version2: DataVersion;
  readonly yearlyVariances: readonly YearlyVariance[];
  readonly npvVariance: number;
  readonly irrVariance: number | null;
  readonly capexVariance: number;
  readonly productionVariance: number;
  readonly revenueVariance: number;
  /** Decomposition of NCF variance into price/volume/cost components */
  readonly priceVariance: number;
  readonly volumeVariance: number;
  readonly costVariance: number;
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE 2: Configurable Unit Conversion (DF-01)
// ════════════════════════════════════════════════════════════════════════

export type UnitConversionCategory =
  | 'volume_oil'
  | 'volume_gas'
  | 'mass'
  | 'energy'
  | 'currency'
  | 'pressure'
  | 'length';

export interface UnitConversion {
  readonly id: string;
  readonly fromUnit: string;
  readonly toUnit: string;
  readonly factor: number;
  readonly category: UnitConversionCategory;
  readonly isDefault: boolean;
  readonly description: string;
  /** Seeded (unmodified) factor for System Default rows.
   *  When `factor !== defaultFactor`, the row is marked "Modified" and
   *  can be reverted via the Reset action. Absent for user-defined rows. */
  readonly defaultFactor?: number;
}

export interface UnitPreferences {
  readonly oilVolume: string; // 'bbl' | 'm³' | 'litres'
  readonly gasVolume: string; // 'MMscf' | 'Bcf' | 'Nm³' | 'PJ'
  readonly mass: string;      // 'tonnes' | 'kg' | 'lb'
  readonly currency: string;  // 'USD' | 'MYR'
  readonly energy: string;    // 'MMBtu' | 'GJ' | 'MWh'
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE 3: Time Granularity (DF-02)
// ════════════════════════════════════════════════════════════════════════

export type TimeGranularity = 'monthly' | 'quarterly' | 'yearly';

export interface MonthlyProductionEntry {
  readonly year: number;
  readonly month: number; // 1-12
  readonly oilBpd: number;
  readonly gasMmscfd: number;
  readonly condensateBpd: number;
}

export interface MonthlyProductionProfile {
  readonly monthly: readonly MonthlyProductionEntry[];
}

export interface MonthlyCostEntry {
  readonly year: number;
  readonly month: number;
  readonly capex: USD;
  readonly opexFixed: USD;
  readonly opexVariable: USD;
  readonly abandonmentCost: USD;
}

export interface MonthlyCostProfile {
  readonly monthly: readonly MonthlyCostEntry[];
}

// ════════════════════════════════════════════════════════════════════════
// FEATURE 4: Pre-FID vs Post-FID Phase Comparison (DF-04)
// ════════════════════════════════════════════════════════════════════════

export type ProjectPhaseVersion =
  | 'pre_fid'
  | 'post_fid'
  | 'development'
  | 'production'
  | 'late_life'
  | 'decommissioning';

export interface PhaseVersionData {
  readonly projectId: string;
  readonly phase: ProjectPhaseVersion;
  readonly label: string;
  readonly createdDate: string;
  readonly assumptions: string;
  readonly productionProfile: ProductionProfile;
  readonly costProfile: CostProfile;
  /** Optional reserves estimate associated with this phase, in MMboe */
  readonly reservesMmboe?: number;
}

export interface PhaseComparisonResult {
  readonly projectId: string;
  readonly phase1: ProjectPhaseVersion;
  readonly phase1Label: string;
  readonly phase2: ProjectPhaseVersion;
  readonly phase2Label: string;
  readonly economics1: EconomicsResult;
  readonly economics2: EconomicsResult;
  readonly npvDelta: number;
  readonly irrDelta: number | null;
  readonly capexDelta: number;
  readonly reservesDelta: number;
  readonly peakProductionDelta: number;
}
