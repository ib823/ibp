# Phase 1a — Business Requirements Framing — Discovery Items

**Audience**: PETROS Functional Design lead + ABeam Phase 1a delivery team.
**Purpose**: enumerate every PETROS-input-required item from the assessment so they can be batched into the Day-1 / Day-7 / Day-14 BRF cadence. Each item is engineered to be a **closure question** (yes/no or a short value), not an open-ended discussion.

---

## Day-1 walkthroughs (block-and-tackle inputs)

| # | Topic | Question | Delta closed |
|:-:|---|---|---|
| 1 | **BP Central UX walkthrough** | Provide screen-capture set or live-walkthrough access to PETROS Business Planning Central; identify accepted Excel templates. | D3, D10 |
| 2 | **Cross-tenant S/4HANA arrangement** | Confirm whether PETROS S/4HANA is a separate tenant from PETRONAS Group; if separate, confirm Datasphere as bridge. | D9 |
| 3 | **Data residency** | Confirm SAC tenant region (Singapore / Malaysia hosting). PDPA / Sarawak data residency. | D16 |
| 4 | **Real project magnitudes** | Provide actual reserves / production / CAPEX per active and pre-FID block to replace POC illustrative numbers. | D61 |

## Day-7 fiscal-regime confirmation

| # | Topic | Question | Delta closed |
|:-:|---|---|---|
| 5 | **Sarawak State Sales Tax 5%** | Confirm current SST rate and any block-specific exemptions (e.g., CCS, hydrogen). | D1 |
| 6 | **Host counterparty per block** | Per-block list confirming PETROS host vs. PETRONAS host (post-CSA 2020 transition). | D2 |
| 7 | **Supplementary Payment rate** | Confirm SP rate per signed PSC contract — POC uses 70% as illustrative; real contracts may differ. | D18 |
| 8 | **Sarawak deepwater post-2020 incentives** | Confirm whether Sarawak DW PSC includes any state-level incentives beyond the 10% deepwater allowance. | D19 |
| 9 | **Cluster development PSCs** | Confirm whether any Sarawak development uses cluster-PSC structure (multi-field hub-spoke); if so, share representative terms. | D20 |
| 10 | **Marginal Field LFA regime** | Confirm whether mature-field LFA terms differ from generic SFA (POC uses SFA for Tukau marginal). | D21 |
| 11 | **HPHT / LLA enablement** | Confirm whether PETROS uses HPHT or LLA regimes; if so, populate regime data, otherwise remove dead code paths. | D22 |
| 12 | **Carbon credit policy + Budget 2024-25 CCS incentives** | Confirm M3 CCS eligibility for Investment Tax Allowance + Pioneer Status; confirm carbon-credit revenue recognition policy. | D62 |

## Day-14 sensitivity / treasury / governance policy

| # | Topic | Question | Delta closed |
|:-:|---|---|---|
| 13 | **Discounting convention** | Confirm preferred default: end-of-year (POC current) or mid-year (SPE upstream norm). | D23 |
| 14 | **PI definition convention** | Confirm preferred definition: NPV/PV(CAPEX) accept ≥ 0, or (NPV+PV(CAPEX))/PV(CAPEX) accept ≥ 1. | D24 |
| 15 | **Sensitivity bounds per variable** | Variable-specific bounds: oil ±USD/bbl band; gas ±%; CAPEX from QRA P10/P90; OPEX ±%; FX from BNM range. | D4, D41 |
| 16 | **Monte Carlo distributions** | Confirm asset-class-specific distribution params (deepwater vs shallow vs CCS). | D13, D40 |
| 17 | **Variable correlation matrix** | Confirm Pearson correlations between (oil, gas), (capex, opex), (production, capex). Phase 1b SAC delivery. | D39 |
| 18 | **DD&A method** | Confirm preferred default: vintaged SL (POC current) or unit-of-production (industry standard). | D31 |
| 19 | **Decommissioning discount rate** | Confirm credit-adjusted risk-free rate per MFRS 137 (POC default 8%). | D32 |
| 20 | **Internal carbon price** | Confirm internal carbon price (USD/tonne CO₂e) for IFRS S2 Pillar 4 schedules. POC default $25. | D35 |
| 21 | **Consolidation methods per project** | Per-project: Full / Proportional / Equity-method assignment. Functional currency per project. | D7, D42, D44 |
| 22 | **Back-allocation rule** | Choose preset (NPV / CAPEX / Production / Equity / Revenue / Hybrid 60/40) or custom. | D12 |
| 23 | **Capital budget cap** | Group-level annual CAPEX cap for capital-constrained portfolio optimisation. | D15, D43 |
| 24 | **Approval validity period** | Confirm re-approval cycle (POC default: 365 days). | D46 |
| 25 | **Delegation policy** | Confirm whether delegation-grant mechanism is required; if so, default validity. | D47 |
| 26 | **Row-level security policy** | Per-role visibility scope: Sarawak-only / non-operated restrictions / pre-FID confidentiality. | D48 |
| 27 | **Audit before/after capture** | Confirm fields requiring structured before/after audit (compliance scope). | D45 |

## Phase 1a deliverable — discovery output

Each item has a one-line answer that lands in `data/petros-config.ts` (production) or remains as a configuration-time toggle in SAC.

## Phase 1b SAC commitments tied to closures

| SAC delivery | POC modules ready | Phase | Deltas closed at SAC delivery |
|---|---|:-:|---|
| `DA_Build_DecommProvision` | `engine/financial/decommissioning.ts` | 1b | D32 |
| `DA_Build_DTL` | `engine/financial/deferred-tax.ts` | 1b | D14 |
| `DA_Build_EE_Asset` | `engine/financial/exploration-evaluation.ts` | 1b | D33 |
| `DA_Build_Lease_RoU` | `engine/financial/lease.ts` | 1b | D34 |
| `DA_Build_IFRS_S2` | `engine/financial/ifrs-s2.ts` | 1b | D35 |
| `DA_MA_AcquisitionDCF` | `engine/financial/ma.ts` | 1b | D6 (M&A half) |
| `DA_ProjectFinance_Waterfall` | `engine/financial/project-finance.ts` | 1b | D6 (PF half) |
| `DA_Consolidate_MFRS10_11_28` | `engine/portfolio/consolidation.ts` | 1b | D7, D42, D44 |
| `DA_Optimise_CapitalConstrained` | `engine/portfolio/optimization.ts` | 1b | D15 |
| `DA_Reserves_Reconciliation` | `engine/reserves/reconciliation.ts` (D27 hook) | 1b | D27 |
| `DA_Arps_DeclineCurves` | `engine/reserves/decline-curves.ts` | 1b | D29 |
| `DA_Workflow_ApprovalExpiry` | `engine/workflow/transitions.ts` (D46 helpers) | 1b | D46 |
| `DA_Workflow_Delegation` | `engine/workflow/transitions.ts` (D47 helpers) | 1b | D47 |
| `DA_PowerBI_LiveConnection` | n/a (SAC tenant + Datasphere config) | 1a UAT | D8 |
| `DA_S4_MonthlyAccrual` | n/a (SAC Data Integration + S/4 CDS) | 1b | D50 |
| `DA_Reserves_Committee_Workflow` | extends `engine/workflow/transitions.ts` | 2 | D28 |
| `DA_Cluster_PSC` | extends `engine/fiscal/index.ts` | 2 | D20 |

## Phase 2 deliverables (Jan 2027)

- Cluster-PSC fiscal aggregation (D20)
- Reserves Committee workflow with qualified-person signoff (D28)
- Real PETROS project magnitudes integrated via Phase 1a discovery (D61)
