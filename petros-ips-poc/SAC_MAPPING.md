# POC ↔ SAP Analytics Cloud — Object Mapping

**Purpose**: this document is the bid-team's commitment ledger. For every concept demonstrated in the PETROS IPS POC, it names the **specific SAP Analytics Cloud object** that delivers it in Phase 1a/1b/2. The POC is the executable functional specification; this document is the contractual translation.

**Audience**: PETROS evaluators, ABeam delivery team, and the post-award SAC implementation team.

**How to read it**: each row maps a POC artifact to its SAC equivalent and the delivery phase. The fourth column is the verification path — the audit trail that proves the mapping works after Phase 1a UAT.

---

## 1. Architecture mapping

| POC layer | SAC equivalent | Phase | Notes |
|---|---|---|---|
| React/Vite SPA | SAC Story (canvas + tiles + filter prompts) | 1a | Each POC page maps to one SAC Story; story tabs match the sidebar entries. |
| Zustand stores | SAC Planning model + Public dimensions | 1a | Read/write state (project list, scenario, granularity) becomes Story input controls bound to the model. |
| TS engine modules (`src/engine/*`) | SAC Data Actions + Calculation Scope | 1a/1b | Pure-function calc layer maps to Advanced Formula DAS scripts; complex flows use Multi-Action sequences. |
| Vite bundle | SAC tenant on PETROS Entra | 1a | Hosted on existing PETROS Microsoft Entra ID; SSO/MFA federated. |
| Excel parity tests (`tests/lib/excel-export-parity.test.ts`) | SAC Calculation Scope formulas + sample workbook in repo | 1a | The POC's parity tests become the SAC UAT acceptance test set. |
| Playwright viewport walk (`scripts/viewport-walk.mjs`) | SAC Story Preview at multiple viewports | 1a | Manual / scripted walkthrough of stories at desktop / tablet / mobile breakpoints. |

---

## 2. Dimension mapping (Phase 1a)

The POC's data model corresponds 1:1 to a 7-dimension SAC Planning model:

| POC concept | SAC dimension | Type | Hierarchies | Source CSV |
|---|---|---|---|---|
| 4-level org hierarchy (Entity → Sector → Type → Project) | `dim_Project` | Public | 4-level parent-child | `dim_Project` sheet of `PETROS_IPS_SAC_Bridge.xlsx` |
| Business sector (Upstream / Downstream / CCS) | `dim_Sector` | Public | flat | `dim_Sector` |
| Operated / Non-Operated | `dim_Type` | Public | flat | `dim_Type` |
| All KPIs and line items (NPV, IRR, CAPEX, Revenue, …) | `dim_Account` | Account | by Category (KPI/INCOME/CAPEX/OPEX/CF/BS/IS/RESERVES/PRODUCTION/FISCAL) | `dim_Account` |
| Yearly granularity (2022–2050) | `dim_Time` | Time | CY / monthly / quarterly drill-down | `dim_Time` |
| Versions (Actuals/Budget/Forecast/Submitted/Approved/Working) | `dim_Version` | Version | public + private | `dim_Version` |
| Price scenarios (Base/High/Low/Stress) | `dim_Scenario` | Public | flat | `dim_Scenario` |
| Fiscal regimes (PSC RC/DW/EPT/SFA/LLA, RSC, Downstream) | `dim_FiscalRegime` | Public | by Class (production_sharing / service / corporate_tax) | `dim_FiscalRegime` |

**Phase 1a deliverable**: import the eight dimension CSVs into a new SAC Planning model named `PETROS_IPS_PLAN`, configure version logic, and seed master data from `master_Project` sheet.

---

## 3. Page → SAC Story mapping

| POC page | SAC Story | Story sections | Live data binding |
|---|---|---|---|
| Dashboard (`/`) | `Story_PETROS_IPS_Dashboard` | KPI tiles row, Project Summary table, Production + CAPEX charts | Bound to `PETROS_IPS_PLAN` model with project + scenario filter prompts |
| Economics (`/economics`) | `Story_Economics_Project` | Input form (left), KPI tiles, Waterfall, Government/Contractor donut, Production chart, Annual cashflow chart | Project prompt drives all tiles; data action `DA_Run_Economics` recalculates on submit |
| Sensitivity (`/sensitivity`) | `Story_Sensitivity` | Tornado, Spider, Scenario comparison tabs | Multi-action `MA_Run_Sensitivity` runs base + ±30% trials |
| Portfolio (`/portfolio`) | `Story_Portfolio` | KPI tiles, NPV bubble chart, hierarchy bar, project selection toggles, production + CAPEX charts | Aggregates by `dim_Project` hierarchy levels |
| Financial (`/financial`) | `Story_Financial_Statements` | Tab set: Income Statement / Balance Sheet / Cash Flow / Account Movements | Bound to financial sub-model with calc scope for DD&A, decom unwind, RE roll-forward |
| Reserves (`/reserves`) | `Story_Reserves` | PRMS classification table, YoY waterfall, SRMS section | `dim_Account` filters by category=RESERVES |
| Monte Carlo (`/monte-carlo`) | `Story_MonteCarlo` | Distribution config panel, NPV histogram, S-curve, P10/P50/P90 KPIs | SAC Smart Predict + custom Data Action `DA_RunMC_Trials(N)` |
| Settings (`/settings`) | `Story_Admin_Reference` | Reference card grid; not a planning input | n/a — admin metadata |
| Glossary (`/glossary`) | SAC Stories Help / `Story_Glossary` | Searchable accordion list of finance terms | static markdown content embedded as text widgets |
| Data Sources (`/data-sources`) | `Story_Data_Integration` | Connection cards (CSKS, PRPS, ACDOCA), template downloads, sync status | Bound to SAC Data Integration agent + S/4HANA CDS view registry |
| Audit Trail (`/audit`) | SAC Activities log | filtered to PETROS_IPS_PLAN events | Native SAC audit; capability-aware row-level visibility |

---

## 4. Engine module → SAC Data Action mapping

| POC engine | SAC delivery | DAS file | Phase |
|---|---|---|---|
| `engine/fiscal/psc-rc.ts` | DAS `DA_PSC_RC_CostRecovery` (multi-step) | `action_CostRecovery` sheet (sample stub) | 1b |
| `engine/fiscal/psc-dw.ts` | DAS `DA_PSC_DW_Allowance` | extends RC pattern | 1b |
| `engine/fiscal/psc-ept.ts` | DAS `DA_PSC_EPT_PIInterp` | linear PI interpolation | 1b |
| `engine/fiscal/psc-sfa.ts` | DAS `DA_PSC_SFA_Fixed` | fixed-pct profit split | 1b |
| `engine/fiscal/psc-legacy.ts` | DAS `DA_PSC_Vintage_VolTier` | 1976/1985 volume-tier splits | 1b (priority low) |
| `engine/fiscal/index.ts` | SAC Multi-Action `MA_Apply_Fiscal_Regime` (router) | n/a | 1b |
| `engine/economics/cashflow.ts` | DAS `DA_Build_YearlyCashflow` | per-project, per-scenario | 1b |
| `engine/economics/npv.ts` | Story Calculated Measure `M_NPV10` | discount @ 10% | 1b |
| `engine/economics/irr.ts` | Story Calculated Measure `M_IRR` | Brent's method via custom widget | 1b |
| `engine/economics/mirr.ts` | Story Calculated Measure `M_MIRR` | dual-rate IRR | 1b |
| `engine/economics/indicators.ts` | Story Calculated Measures (PI, Payback, GovtTake, …) | several | 1b |
| `engine/financial/income-statement.ts` | SAC sub-model `IS_PETROS_IPS` + DAS `DA_Build_IS` | Phase 1b | 1b |
| `engine/financial/balance-sheet.ts` | SAC sub-model `BS_PETROS_IPS` + DAS `DA_Build_BS` | 1b | |
| `engine/financial/cashflow-statement.ts` | SAC sub-model `CFS_PETROS_IPS` + DAS `DA_Build_CFS` | 1b | |
| `engine/financial/account-movements.ts` | DAS `DA_Roll_Forward_Accounts` | 1b | |
| `engine/reserves/prms.ts` | `dim_ReservesCategory` + DAS `DA_Build_PRMS_Snapshot` | 2 | |
| `engine/reserves/reconciliation.ts` | DAS `DA_PRMS_YoY_Reconciliation` | 2 (full reconciliation) | |
| `engine/reserves/srms.ts` | `dim_ReservesClass=SRMS` + DAS `DA_SRMS_Capacity` | 2 | |
| `engine/sensitivity/tornado.ts` | SAC Story chart bound to `MA_Run_Sensitivity` | 1b | |
| `engine/sensitivity/spider.ts` | SAC Story Line chart | 1b | |
| `engine/sensitivity/scenario.ts` | DAS `DA_Compare_Scenarios` | 1b | |
| `engine/montecarlo/simulation.ts` | SAC Smart Predict (Monte Carlo) + custom widget | 1b | |
| `engine/montecarlo/distributions.ts` | SAC Calculation Scope user functions | 1b | |
| `engine/portfolio/aggregation.ts` | Native SAC aggregation via `dim_Project` hierarchy | 1a | |
| `engine/portfolio/incremental.ts` | DAS `DA_Incremental_Analysis` | 1b | |
| `engine/portfolio/back-allocation.ts` | DAS `DA_Allocate_Corporate_to_Project` | 1b | |
| `engine/portfolio/downstream-margin.ts` | Sub-model `DSTREAM_MARGIN` | 2 | |
| `engine/workflow/transitions.ts` | SAC Calendar workflow + DAS `DA_Submit/Approve/Request_Changes` | 1a | |
| `engine/auth/types.ts` (capability matrix) | SAC Roles + Teams + dimension-level access | 1a | |

---

## 5. Workflow & SoD mapping

| POC mechanism | SAC delivery | Configuration |
|---|---|---|
| 5-role model (analyst/reviewer/approver/admin/viewer) | SAC Roles + Teams | One Role per role; Teams scope by Sector/Project |
| Capability matrix (`can(role, capability)`) | SAC Application Privileges + dimension-level access | Per-role privilege grid |
| State machine (open → submitted → to_change / approved) | SAC Calendar tasks | One Calendar template per workflow type |
| SoD: approver ≠ submitter | SAC Calendar approval rules + DAS guard | Native + Multi-Action precondition |
| Audit log (AuditEntry → AuditTrailPage) | SAC Activities log | Native; surfaced in Story_Admin |

---

## 6. Integration mapping

| POC mock | SAC delivery | Source system | Phase |
|---|---|---|---|
| `pages/DataSourcesPage.tsx` connection cards | SAC Data Integration agent + Datasphere | SAP S/4HANA | 1a |
| Cost Center master (illustrative) | SAC dimension import from S/4HANA | CDS view `I_CostCenter` (CSKS) | 1a |
| WBS / Project structure | SAC dimension import from S/4HANA | CDS view `I_WBSElement` (PRPS) | 1a |
| Actuals (general ledger) | SAC fact import from S/4HANA | CDS view `I_GLAccountLineItemRawData` (ACDOCA) | 1a |
| Excel template upload | SAC File Server import | n/a | 1a |
| Manual entry grid | SAC Story input controls | n/a | 1a |

---

## 7. RFP requirement coverage

Mapping back to RFP T260002 Section 2 requirements (the bid-grading criteria):

| RFP § | Requirement | POC evidence | SAC delivery |
|---|---|---|---|
| §1 | Multi-fiscal incremental simulation | 8 PSC regimes + downstream tax in `engine/fiscal/` | DAS per regime + Multi-Action router |
| §2 | Excel-parity transparent calc | `tests/lib/excel-export-parity.test.ts`, `lib/excel-export.ts` | SAC Calculation Scope formulas + sample workbook acceptance test |
| §3 | Sensitivity & optionality | Tornado / Spider / Monte Carlo / Scenario comparison | Native SAC sensitivity + Smart Predict |
| §4 | SPE PRMS / SRMS reserves YoY | `engine/reserves/prms.ts` + `reconciliation.ts` | `dim_ReservesCategory` + DAS reconciliation |
| §5 | Pre-built Financial Models (P&L/BS/CF) | `engine/financial/*` | Sub-models per statement |
| §6 | Roles-based aggregation + corp→entity allocation | 4-level hierarchy + `engine/portfolio/*` | Native aggregation + DAS allocation |
| §7 | Visualisation (tornado/spider, Power BI) | All charts + chart-data tables for accessibility | Native SAC + optional Power BI via Datasphere live connection |
| §8 | Cloud SaaS, S/4HANA APIs | SaaS hosted; DataSourcesPage mock | SAC tenant + Data Integration agent |
| §9 | Status workflow (open/submitted/to_change/approved) | `engine/workflow/transitions.ts` + WorkflowActionBar | SAC Calendar |
| §10 | RBAC, SSO+MFA Entra, audit, versioning | Capability matrix + AuditTrailPage + version mgmt | Native SAC |
| §11 | BA / PM / App support services | n/a (delivery org) | ABeam Delivery org structure |

**Coverage**: every RFP §1–§11 requirement has a POC evidence + SAC delivery mapping. The POC evidence is what's running today at `https://petros-ips-poc.vercel.app/`.

---

## 8. Phase plan tied to RFP timeline

Per RFP §"Timeline":

| RFP phase | Start | Mapping doc deliverables |
|---|---|---|
| **Phase 1a** | June 2026 | Story_PETROS_IPS_Dashboard, Story_Admin_Reference, Story_Audit, all 8 dimensions, master_Project, S/4HANA Data Integration agent, Roles+Teams config, Workflow Calendar templates, basic UAT |
| **Phase 1b** | September 2026 | All upstream economics DASes (PSC RC/DW/EPT/SFA, NPV, IRR, indicators), all financial sub-models (IS/BS/CFS), Sensitivity stories, Monte Carlo widget, Portfolio aggregation+incremental DASes |
| **Phase 2** | January 2027 | Downstream margin sub-model, Group Finance consolidation, Reserves stories (PRMS reconciliation + SRMS), end-to-end workflow, Capital Project economics |

---

## 9. Risk & mitigation

| Risk | Likelihood | Mitigation in POC |
|---|---|---|
| SAC Multi-Action complexity for fiscal regime router | medium | The TS engine encapsulates the router pattern in `engine/fiscal/index.ts:51-153`; the SAC Multi-Action mirrors that flow node-for-node |
| SAC monthly/quarterly close from yearly facts | medium | POC's `lib/period-granularity.ts` documents the spread/aggregate logic; SAC Calculation Scope replicates as Account dimension allocation rules |
| SoD enforcement edge cases | low | POC's `engine/workflow/transitions.ts` test suite (`tests/engine/workflow/transitions.test.ts`) is the SAC acceptance test set |
| Excel parity drift | low | POC's `excel-export-parity.test.ts` is the regression baseline; SAC delivery includes the same workbook as a UAT artifact |
| Power BI integration scope | low | SAC supports native live data connection from Power BI; Datasphere bridge if needed; not on critical path |

---

## 10. Versioning

This document is generated from the POC's data model and engine layout. Re-generate when:
- A new fiscal regime is added (`src/data/fiscal-regimes.ts`)
- A new page is added (`src/pages/`)
- A new engine module is added (`src/engine/`)
- A new RFP requirement is identified

**Last regenerated**: 2026-04-25 — version 1.0 (Phase 1a kickoff baseline)
**Source of truth**: this repo at `petros-ips-poc/SAC_MAPPING.md` + the live POC URL.
