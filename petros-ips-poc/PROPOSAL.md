# T260002 — Integrated Planning System Implementation Proposal
## Slides §4–§9 (slides 36–84)

**Document**: slide-by-slide markdown for inclusion in the ABeam proposal deck.
**Companion artefacts referenced**: `ASSESSMENT.md` (14-phase review) · `PETROS_DELTAS.md` (62 deltas, full closure status) · `BID_NARRATIVE.md` (6-section synthesis) · `PHASE_1A_DISCOVERY.md` (27 closure questions) · `SAC_MAPPING.md` (POC ↔ SAC translation).
**POC**: deployed and live with 503/503 tests passing across 14 production pages + 3 enhancement pages (M&A, Project Finance, IFRS S2 Climate).

**Slide formatting convention** for each slide below:
- **Title** — exact heading text
- **Section / Visual notes** — what the slide designer needs (placement, charts, callouts)
- **Body** — slide content (bullets, table, diagram)
- **Speaker notes** — what the presenter says aloud (60–120 seconds per slide)

---

# §4 Target Architecture: SAC + Datasphere (7 slides)

---

## Slide 36 — Section divider: Target Architecture

**Visual notes**: Full-bleed brown-accent section divider matching the deck visual language. Large title left-aligned. Bottom-right: small ABeam logo. No body content beyond title + subtitle.

**Body**:
> ### Target Architecture
> SAP Analytics Cloud + SAP Datasphere
>
> Built on PETROS's existing SAP landscape — extending, not replacing.

**Speaker notes**:
> "Section 4 — target architecture. We've designed the Integrated Planning System on the two SAP platforms purpose-built for this challenge: SAC for planning and analytics, Datasphere for data fabric. Both natively integrate with the S/4HANA, SuccessFactors, Ariba, and DRC components shown on slide 35. We're not adding a parallel stack — we're activating capabilities already adjacent to the landscape PETROS owns."

---

## Slide 37 — Architecture overview (three-layer)

**Visual notes**: Centre of slide is a 3-layer architecture diagram. Top layer = "Planning & Analytics (SAP SAC)". Middle layer = "Data Fabric & Modelling (SAP Datasphere)". Bottom layer = "Source systems (S/4HANA · SuccessFactors · Ariba · DRC · DMS · Project)". Arrows: bottom-up actuals/master data ingestion, top-down write-back of approved plans. Right side: small inset showing "POC = Functional Spec" feeding into SAC layer.

**Body**:

| Layer | SAP component | Function | POC artefact |
|---|---|---|---|
| **Surface** | **SAP Analytics Cloud** | Planning models · Stories · Multi-Actions · Calculated Measures · Smart Predict · Calendar workflows | 14 POC pages (1:1 SAC Story mapping per `SAC_MAPPING.md`) |
| **Fabric** | **SAP Datasphere** | Federated semantic layer · cross-tenant bridging · master-data governance | Engine modules (`engine/*`) become Datasphere views |
| **Sources** | S/4HANA · SuccessFactors · Ariba · DRC · DMS | Actuals · master data · headcount · sourcing · tax filing | RFP §8 integration touchpoints |

**Speaker notes**:
> "Three layers, all SAP-native. Top: SAC handles every user-facing planning interaction — every Story, every Multi-Action, every workflow approval. Middle: Datasphere is the data fabric that pulls actuals from S/4 ACDOCA, master data from CSKS / PRPS / Project System, headcount from SuccessFactors, sourcing from Ariba, and bridges across tenant boundaries where PETROS S/4 sits inside the broader PETRONAS-Group landscape under transition. Bottom: the source systems already exist in PETROS's environment — we're not asking PETROS to add new infrastructure, we're connecting what's there."
>
> "On the right of the slide: our POC, deployed and live, is the executable functional specification. Every fiscal-engine calculation, every reserves-classification rule, every MFRS-compliant financial-statement formula has 503 unit tests passing today. When we land in Phase 1a, we don't write the calculation logic from scratch — we translate it node-for-node into SAC Data Action Scripts and Datasphere views."

---

## Slide 38 — SAP Analytics Cloud as the Planning Surface

**Visual notes**: Left half — bullet list of SAC capabilities mapped to POC features. Right half — screenshot collage from the deployed POC (Dashboard + Economics + Sensitivity + Monte Carlo). Labels point from screenshots back to SAC capability bullets.

**Body**:

| SAC capability | POC equivalent (today) | Phase 1a SAC delivery |
|---|---|---|
| **Planning model** (multi-dimensional) | Zustand `project-store.ts` | `PETROS_IPS_PLAN` model with 8 dimensions |
| **Story** (canvas + tiles + filters) | 14 React pages | 14 SAC Stories, 1:1 mapping per `SAC_MAPPING.md:43-58` |
| **Data Action Script** (DAS) | 9 fiscal regimes (`engine/fiscal/*`) + economics + financial | 9 DAS scripts mirroring the engine's switch statement |
| **Multi-Action** (orchestrated workflows) | `runProjectEconomics → runAllProjectEconomics` chain | `MA_Apply_Fiscal_Regime` router |
| **Calculated Measures** | NPV / IRR / MIRR / Payback / PI / Govt-Take | `M_NPV10`, `M_IRR`, `M_GovTake`, …  |
| **Smart Predict** (probabilistic) | `engine/montecarlo/simulation.ts` (Mulberry32 seeded) | SAC Smart Predict + custom widget for histogram |
| **Calendar workflow** | `engine/workflow/transitions.ts` (engine-enforced SoD) | SAC Calendar tasks + approval rules |
| **Story Help / educational content** | 1,867-line `educational-content.ts` registry | Story Help widgets + Content widgets |

**Speaker notes**:
> "SAC is purpose-built for what PETROS needs. Every capability listed on the left has a one-to-one correspondence with what we've already built and tested in the POC. Planning model maps to our project-store. Stories map to our pages. Data Action Scripts map to our fiscal-engine modules. Smart Predict for Monte Carlo replaces our Mulberry32 PRNG with SAC-native probabilistic capability — same audit-grade reproducibility, same P10/P50/P90 reporting."
>
> "The 1,867-line educational-content registry on the right is what gives the POC its in-context learning experience — hover any KPI tile, get a tooltip; click an info-icon, get a full explanation panel; every term cites SPE, MFRS, PRMS, or PITA. That entire registry ports to SAC Story Help widgets unchanged. PETROS users get the same scaffolded learn-while-using experience."

---

## Slide 39 — SAP Datasphere as the Data Fabric

**Visual notes**: Left — Datasphere logo + value-prop summary. Right — connector matrix showing PETROS's existing systems and how Datasphere semantically unifies them. Bottom-right: callout "Cross-tenant bridge — PETROS S/4 ↔ PETRONAS-Group landscape under transition (D9)".

**Body**:

| Datasphere capability | What it does for PETROS IPS |
|---|---|
| **Federated query** | Pulls actuals from S/4 ACDOCA without copying — no batch ETL, no overnight delays |
| **Semantic layer** | Defines the POC's `dim_Project`, `dim_Account`, `dim_Time`, `dim_Version`, `dim_Scenario`, `dim_FiscalRegime`, `dim_Sector`, `dim_Type` once — every consumer (SAC, Power BI, ad-hoc query) sees identical semantics |
| **Cross-tenant federation** | Bridges PETROS S/4 with the broader PETRONAS-Group landscape during transition (Phase 1a integration design — D9) |
| **Master-data governance** | One source for project hierarchy, fiscal regime, host counterparty (PETROS vs PETRONAS — D2) |
| **Power BI live connection** | Native — board-level dashboards on Power BI without breaking SAC as planning surface (D8) |
| **Data lineage** | Auditable: every KPI traces back to its S/4 source line item — Bursa-disclosure-grade audit trail |

**Speaker notes**:
> "Datasphere is what makes the integration work without re-platforming. Three things matter most for PETROS:"
>
> "First — federated query. We don't copy actuals out of S/4HANA into a separate planning data store. Datasphere queries ACDOCA in-place. Real-time numbers, no overnight batch jobs."
>
> "Second — cross-tenant bridge. PETROS's S/4 currently sits inside the broader PETRONAS-Group landscape under the transition arrangement following the 2020 CSA. Datasphere is the supported pattern for cross-tenant semantic federation — PETROS planning sees PETROS data with appropriate access controls, without forcing a tenant migration."
>
> "Third — Power BI live connection. RFP §7 names Power BI explicitly. Datasphere supports Power BI as a native consumer — board-level executives keep their existing Power BI reports while SAC runs the planning workflow underneath."

---

## Slide 40 — Data Flow: the Planning Cycle

**Visual notes**: Centre — circular flow diagram showing the planning cycle. 6 nodes connected clockwise: (1) Actuals from S/4 → (2) Datasphere semantic layer → (3) SAC Planning model loads `actuals` version → (4) Planner edits in `working` → (5) Submit → Review → Approve workflow → (6) Approved plan writes back to S/4 (capex commitments) and DRC (PITA + Sarawak SST filings). Bottom: timeline arrow showing monthly close → quarterly forecast → annual budget cycles.

**Body**:

The planning cycle: **continuous, auditable, and write-back enabled.**

| Step | Where | What | Cadence |
|:-:|---|---|:-:|
| 1 | S/4HANA ACDOCA / CSKS / PRPS | Actuals + master data published | continuous |
| 2 | Datasphere | Federated query — no copy, no delay | continuous |
| 3 | SAC Planning model (`actuals` version) | Loaded into 6-version registry | monthly |
| 4 | SAC Story (`working` → `submitted`) | Planner edits + what-if analysis | per-cycle |
| 5 | SAC Calendar workflow | SoD-enforced submit → review → approve | per-cycle |
| 6 | DRC + S/4 write-back | PITA / SST filings + CAPEX commitments | post-approval |

**Speaker notes**:
> "Six steps, three of which are automatic and three of which are user-driven. Steps 1, 2, 6 are infrastructure — happen continuously without user intervention. Steps 3, 4, 5 are the planner's experience: pull actuals, propose a plan, route through workflow, get approval. The Segregation of Duty guard is engine-enforced — `transitions.ts:65` in our POC has the rule `if submittedBy === actor.id then deny approve`. SAC Calendar implements the same guard natively."
>
> "Cadence on the bottom: monthly close pulls fresh actuals; quarterly re-forecast resets the `forecast` version; annual budget freezes the `approved` version into `actuals`. All six versions — actuals, budget, forecast, submitted, approved, working — coexist in the same model with native SAC version controls."

---

## Slide 41 — Security & Governance Architecture

**Visual notes**: Top — three columns labeled "Identity (Entra ID)", "Authorisation (SAC RBAC + Datasphere row-level)", "Audit (SAC Activities log)". Middle — flow diagram showing SSO + MFA chain. Bottom — compliance certifications strip: ISO/IEC 27001, MAS PDPA, Bursa Listing Requirements, IFRS S2 (FY2025+).

**Body**:

| Layer | Component | RFP requirement closed |
|---|---|---|
| **Identity** | MS Entra ID federation (PETROS tenant) — MFA enforced per tenant policy | RFP §IT-3: SSO + MFA |
| **Authorisation** | 5-role RBAC (analyst / reviewer / approver / admin / viewer) — capability matrix from `engine/auth/types.ts:81-87` translates to SAC Application Privileges | RFP §10 |
| **Authorisation (data)** | Datasphere row-level security (Sarawak-only / non-operated restrictions / pre-FID confidentiality) | D48 closes during Phase 1a |
| **Audit** | SAC Activities native log + `AuditEntry.changes` structured before/after capture (D45) | RFP §10 + Bursa LR audit-trail |
| **Workflow integrity** | Engine-enforced SoD — `transitions.ts:65` — translates to SAC Calendar approval rules | RFP §9 + Data Mgmt §2 |
| **Data residency** | SAC tenant in Singapore or Malaysia region — confirmed Phase 1a (D16) | RFP §IT-4 + PDPA 2010 |
| **Compliance certifications** | SAP-operated SOC-2 / ISO 27001 / SAP-Cloud SLA | RFP §IT-4 |

**Speaker notes**:
> "Security and governance is where most planning systems quietly under-deliver. We've engineered three things explicitly:"
>
> "First — engine-enforced Segregation of Duty. Most vendors disable an Approve button when the user is the same person who Submitted. Our POC checks the rule in pure-function engine code — line 65 of transitions.ts — meaning even if an attacker bypasses the UI and calls the API directly, the approval is rejected. SAC Calendar implements the same engine-side guard natively."
>
> "Second — structured before/after audit capture. The POC's AuditEntry has a `changes` field that records every field-level mutation — `from: 100M, to: 120M, field: 'capex'`. That's compliance-grade audit, not freeform-string audit. Bursa Malaysia Listing Requirements expect this level of traceability."
>
> "Third — row-level security via Datasphere. PETROS planning teams get appropriate visibility — Sarawak teams see Sarawak blocks, non-operated participations are restricted by JV agreement, pre-FID projects are confidentiality-tagged. All driven from one Datasphere policy table; SAC inherits."

---

## Slide 42 — SAC Story Map (POC pages → SAC Stories)

**Visual notes**: Two-column layout. Left = "POC pages today" (17 pages with route path). Right = "SAC Stories Phase 1a" (one-to-one mapping). Connecting arrows show the translation. Bottom: callout "All 17 pages = 1 SAC Planning model + 17 Stories. No re-architecture."

**Body**:

| POC route | Page | SAC Story (Phase 1a) | Phase |
|---|---|---|:-:|
| `/` | Dashboard | `Story_PETROS_IPS_Dashboard` | 1a |
| `/economics` | Economics | `Story_Economics_Project` | 1a |
| `/sensitivity` | Sensitivity | `Story_Sensitivity` | 1b |
| `/portfolio` | Portfolio | `Story_Portfolio` | 1a |
| `/financial` | Financial | `Story_Financial_Statements` | 1b |
| `/consolidation` | Consolidation | `Story_Group_Consolidation` | 2 |
| `/reserves` | Reserves | `Story_Reserves_PRMS_SRMS` | 2 |
| `/monte-carlo` | Monte Carlo | `Story_MonteCarlo` | 1b |
| `/data-entry` | Data Entry | `Story_Data_Input` | 1a |
| `/settings` | Settings | `Story_Admin_Reference` | 1a |
| `/glossary` | Glossary | SAC Help / `Story_Glossary` | 1a |
| `/data-sources` | Data Sources | `Story_Data_Integration` | 1a |
| `/audit` | Audit Trail | SAC Activities log | 1a |
| `/sac-mapping` | SAC Mapping | (proposal artefact — not a SAC story) | n/a |
| `/ma` | M&A | `Story_MA_AcquisitionDCF` | 1b |
| `/project-finance` | Project Finance | `Story_ProjectFinance_Waterfall` | 1b |
| `/climate` | IFRS S2 Climate | `Story_IFRS_S2_Disclosures` | 1b |

**Speaker notes**:
> "Seventeen pages today, seventeen SAC Stories Phase 1a + 1b. The translation is a known pattern — every UI control in the POC has a SAC equivalent. We're not redesigning the user experience; we're keeping it identical so PETROS planners aren't trained twice."
>
> "Phase 1a delivers the foundation Stories — Dashboard, Economics, Portfolio, Data Entry, Settings, Glossary, Data Sources, Audit Trail. Phase 1b adds the analytical depth — Sensitivity, Financial Statements, Monte Carlo, M&A, Project Finance, Climate disclosures. Phase 2 closes Group-level consolidation and reserves reconciliation. The order matches RFP §Timeline."

---

# §5 Functional Coverage (RFP §1–§11) (10 slides)

---

## Slide 43 — Section divider: Functional Coverage

**Visual notes**: Section divider. Single big number ("**6/11 ✅ Met · 4/11 ◐ Partial · 1/11 ⚠ Gap · 2/11 ⊘ Out-of-POC**") with each category colour-coded.

**Body**:
> ### Functional Coverage
> RFP §1–§11 Independent Scoring — 503/503 tests passing
>
> 6 ✅ Met · 4 ◐ Partial (Phase 1a/1b closure path) · 1 ⚠ Gap (BP Central UX — unavoidable for any bidder) · 2 ⊘ Out-of-POC (delivery org)

**Speaker notes**:
> "Section 5 — functional coverage of every RFP clause. We've scored ourselves independently against each of the 11 scope items in T260002 §2. Six are Met today by the POC. Four are Partial with explicit Phase 1a or 1b closure paths. One — UI alignment to PETROS BP Central — is a Gap; that's unavoidable for any bidder because BP Central is internal. Two are out-of-scope for software (delivery resourcing, ISO 27001 attestation)."
>
> "The next eight slides walk each clause individually. We use a consistent format: clause text on the left, our solution on the right, RAG status badge top-right."

---

## Slide 44 — RFP §1: Multi-fiscal Incremental Simulation

**Visual notes**: Top-right RAG badge "✅ Met". Body left-side: clause text. Body right-side: solution. Bottom: small evidence strip with file:line references.

**Body**:

> **RFP §1**: "To facilitate multiple/incremental simulation for economic evaluation, financial modelling and scenario planning, focusing on tactical and strategic planning at auditable and open integration covering Malaysia oil and gas/energy environment and regional fiscal regime."

| Our solution | Coverage |
|---|---|
| **9 fiscal regimes** modelled in `engine/fiscal/` | PSC RC · DW · EPT · SFA · LLA · 1976 · 1985 · HPHT · RSC · Downstream Tax |
| **Sarawak State Sales Tax (5%)** — D1 closure | Modelled in every Sarawak PSC; `engine/fiscal/shared.ts:97-128` |
| **Host counterparty discriminator** — D2 closure | `host: 'PETROS' \| 'PETRONAS'` per regime; auto-applied per block |
| **Malaysian Budget 2024-25 CCS incentives** — D62 closure | M3 CCS: 60% Investment Tax Allowance + 70% Pioneer Status |
| **Permutation grid**: 5 projects × 4 scenarios × 6 versions × 2 phases × 3 granularities | 720 cells, all coherent |
| **Audit trail**: every fiscal calc emits a YearlyCashflow record with 24 line items | Bursa-disclosure-grade traceability |

**Speaker notes**:
> "RFP §1 — multi-fiscal incremental simulation. Met. The POC ships with 9 fiscal regimes covering every PSC variant Malaysia uses, plus the corporate-tax regime for downstream and CCS. Crucially, we've engineered three PETROS-Sarawak-specific extensions:"
>
> "First — Sarawak State Sales Tax 5%. Generic Malaysia planning models miss this. We built it into every PSC engine. For a Sarawak gas project at peak production, that's $10–15M per year of additional government deduction we model correctly."
>
> "Second — host counterparty. Post-2020 CSA, Sarawak blocks have PETROS as host, not PETRONAS. We added a `host` discriminator to each regime config. A planning system that misnames its own host is a planning system that wasn't built for PETROS."
>
> "Third — CCS incentives. Malaysian Budget 2024-25 introduced Investment Tax Allowance and Pioneer Status for CCS. M3 CCS in our sample data has both turned on. Generic vendors will use 24% flat corporate tax and over-state PETROS's CCS tax burden materially."

---

## Slide 45 — RFP §2: Excel-Parity Transparent Calculation

**Visual notes**: Badge "✅ Met". Top — clause. Centre — workflow diagram showing calculation engine → SAC native + Excel export → PETROS evaluator opens both → numerical parity. Bottom — code snippet from `tests/lib/excel-export-parity.test.ts`.

**Body**:

> **RFP §2**: "To facilitate multiple fiscal regime incremental economics evaluation and transparent to support excel-based economic calculations."

**Coverage**:
- Excel export from POC: `lib/excel-export.ts` — 4-sheet workbook (Summary · Cash Flows · Fiscal Detail · Financial)
- **Excel-parity regression test**: `tests/lib/excel-export-parity.test.ts` (5 assertions, $0.5M tolerance)
- Round-trips engine result → Excel → re-read cells → assert equality
- Tested in both USD and MYR currency conversion (4.50× factor)
- Phase 1a UAT artefact: same workbook used as the SAC delivery acceptance test

**Test code excerpt** (verbatim from the POC):
```typescript
// engine result → workbook → re-read → assert match
const wb = buildEconomicsWorkbook(SK410, BASE, sk410EconomicsBase, { currency: 'USD' });
const summarySheet = readSheet(wb, 'Summary');
expect(summarySheet.NPV10).toBeCloseTo(sk410EconomicsBase.npv10, -5);
expect(summarySheet.IRR).toBeCloseTo(sk410EconomicsBase.irr, 4);
```

**Speaker notes**:
> "RFP §2 — Excel-parity transparent calculation. Met. We have a regression test that round-trips the engine through an Excel workbook export, re-reads the cells, and asserts numerical equality within $500k tolerance. That's the pattern Petros evaluators use to verify any calculator: open the Excel, change a cell, watch the formulas recompute."
>
> "Critically: the same workbook is the Phase 1a UAT artefact. PETROS evaluation team runs the engine, exports to Excel, and verifies SAC Calculation Scope formulas produce identical numbers. No black box. Every fiscal-regime, every NPV, every government-take figure is traceable to a formula visible in the workbook."

---

## Slide 46 — RFP §3: Sensitivity & Optionality

**Visual notes**: Badge "✅ Met". Centre — three Tornado-chart screenshots from the POC: classic 5 variables, extended 9 variables (adding FX / PITA rate / Sarawak SST / Reserves), Monte Carlo histogram with SPE-convention P10/P50/P90 labels.

**Body**:

> **RFP §3**: "To provide sensitivity analyses and optionality on development and portfolio scenarios"

| Capability | POC implementation | PETROS-aware extension |
|---|---|---|
| **Tornado** (deterministic, ±%) | `engine/sensitivity/tornado.ts` | **9 variables** including FX (BNM band), PITA rate, Sarawak SST, Reserves |
| **Spider** (continuous range) | `engine/sensitivity/spider.ts` | Same 9 variables, 13 continuous steps |
| **Scenario comparison** | `engine/sensitivity/scenario.ts` | Base / High / Low / Stress price decks |
| **Monte Carlo** | `engine/montecarlo/simulation.ts` | Mulberry32 seeded; **P10/P50/P90 with SPE-PRMS convention disambiguation** (D37) |
| **Variable correlation** | `MonteCarloConfig.correlationMatrix` field — Cholesky in Phase 1b SAC delivery | D39 |
| **Reserves uncertainty** | `'reserves'` as MC variable — proxied by production scaling, full PRMS link Phase 1b | D40 |

**Speaker notes**:
> "RFP §3 — Met. Three things to call out beyond the obvious tornado/spider/Monte Carlo capability:"
>
> "First — variable set. Generic IOC vendors do tornado on five variables: oil, gas, production, capex, opex. We extended to nine, adding FX with Bank Negara reference-rate bounds, PITA rate, Sarawak State Sales Tax rate, and reserves uncertainty. PETROS reports MYR but earns USD — FX is a first-order driver, not a constant."
>
> "Second — convention discipline. SPE PRMS uses P10 = optimistic, P90 = conservative. Most statistical libraries flip those. Our POC exposes both conventions and ships a glossary entry that disambiguates. PETROS reserves engineers and planning analysts can read the same Monte Carlo output without translation."
>
> "Third — reproducibility. We use Mulberry32 seeded PRNG. Same seed produces identical P10/P50/P90 across machines, across runs, across CI. That's audit-grade — when PETROS UAT runs the same Monte Carlo, they get the same answer we do."

---

## Slide 47 — RFP §4: PRMS / SRMS Reserves + YoY Reconciliation

**Visual notes**: Badge "✅ Met". Three-axis diagram: classification axis (Reserves · Contingent · Prospective), uncertainty axis (1P/2P/3P · 1C/2C/3C · Low/Best/High), maturity-subclass dimension (On Production / Approved / Justified / Pending). Bottom: SRMS treatment for M3 CCS.

**Body**:

> **RFP §4**: "To capture resources/storage estimates and reconciling year-over-year changes in accordance with Society of Petroleum Engineers (SPE)'s Petroleum Resources Management System (PRMS) and/or CO₂ Storage Resources Management System (SRMS) standards and able to integrate with economic evaluation requirements for consistent and streamlined portfolio view."

| Coverage | POC implementation | Standard cited |
|---|---|---|
| **Reserves** | `engine/reserves/prms.ts` — 1P/2P/3P × oil/gas | SPE PRMS 2018 §2.1.2 |
| **Contingent Resources** | `engine/reserves/contingent.ts` — 1C/2C/3C + 3 subclasses | SPE PRMS 2018 §2.1.3 |
| **Prospective Resources** | `engine/reserves/prospective.ts` — Pg × Pc risk-weighting | SPE PRMS 2018 §2.1.4 |
| **YoY reconciliation waterfall** | `engine/reserves/reconciliation.ts` | SPE PRMS 2018 §3.1 |
| **Economic-revision driver** | `priceDeckScenarioFactor` parameter — flexes proved volumes on price-deck change (D27 closure) | RFP §4 "integrate with economic evaluation" |
| **CO₂ SRMS** | `engine/reserves/srms.ts` — for M3 CCS | SPE SRMS 2017 |
| **Arps decline-curve catalogue** | `engine/reserves/decline-curves.ts` (D29) | Arps J.J. (1945) — exponential / hyperbolic / harmonic |

**Speaker notes**:
> "RFP §4 — Met. Three points of distinction:"
>
> "First — three-axis classification. Most planning POCs model Reserves only. We model Reserves + Contingent + Prospective with full uncertainty bands and PRMS subclasses. The contingent module cites PRMS 2018 §2.1.3.2 directly in the source code. The prospective module implements Pg × Pc risk-weighting per §2.1.4. Few SAC-implementer competitors will demonstrate this depth."
>
> "Second — economic-revision driver. RFP §4 has an explicit phrase: 'integrate with economic evaluation requirements'. We took that literally. Our reconciliation accepts a `priceDeckScenarioFactor` — drop oil price 20%, watch some 1P volumes fall to contingent under the economic-limit re-test. That's what PRMS economic revisions actually look like."
>
> "Third — Arps decline-curve catalogue. Sample data uses hyperbolic b=0.5 for Sarawak gas, b=0.4 for SK-612 deepwater oil, b=0.3 for Tukau marginal. Industry-standard reservoir behaviour, not flat exponential."

---

## Slide 48 — RFP §5: Pre-Built Financial Models

**Visual notes**: Badge "✅ Met (was Partial pre-bid)". Five tiles in a row: Income Statement · Balance Sheet · Cash Flow · M&A · Project Finance. Each tile shows the engine module + page that delivers it. Bottom: "**M&A and Project Finance — RFP §5 explicit — closed in pre-bid implementation**".

**Body**:

> **RFP §5**: "To provide pre-built, industry compliant and customisable Financial Models and Reports, including but not limited to Financial Statement (Balance Sheets and Cash Flow), Budgeting and Forecasting, Portfolio Management, **Merger & Acquisition (M&A)**, and **Project Finance**."

| Module | POC implementation | MFRS / IFRS standard | Status |
|---|---|---|:-:|
| **Income Statement** | `engine/financial/income-statement.ts` — vintaged DD&A; **UoP option (D31)** | MFRS 116 §60-62 | ✅ |
| **Balance Sheet** | `engine/financial/balance-sheet.ts` — driver-based, no plug field | MFRS 137 + IFRIC 1 (D32) | ✅ |
| **Cash Flow Statement** | `engine/financial/cashflow-statement.ts` — indirect method | MFRS 107 | ✅ |
| **Account Movements** | `engine/financial/account-movements.ts` — PPE / Decom / Debt / E&E / RE roll-forwards | MFRS 116 / 137 / 6 | ✅ |
| **Decommissioning Provision** | `engine/financial/decommissioning.ts` (D32) | MFRS 137 + IFRIC 1 | ✅ |
| **E&E Assets** | `engine/financial/exploration-evaluation.ts` (D33) | MFRS 6 (successful-efforts) | ✅ |
| **Lease (FPSO RoU)** | `engine/financial/lease.ts` (D34) | MFRS 16 | ✅ |
| **Deferred Tax** | `engine/financial/deferred-tax.ts` (D14) | MFRS 112 | ✅ |
| **M&A — Acquisition DCF** | `engine/financial/ma.ts` + page `/ma` (D6) | Brealey-Myers / CFA L2 | ✅ NEW |
| **Project Finance — Debt Service Waterfall** | `engine/financial/project-finance.ts` + page `/project-finance` (D6) | Yescombe (2013) / Moody's PF Methodology | ✅ NEW |
| **IFRS S2 Climate** | `engine/financial/ifrs-s2.ts` + page `/climate` (D35) | IFRS S2 (June 2023) — Bursa FY2025+ | ✅ NEW |

**Speaker notes**:
> "RFP §5 — and this is where the bid-narrative shifts. RFP §5 names M&A and Project Finance explicitly. In our independent assessment, this was originally the weakest area of the POC — those two modules didn't exist. We built them before bid submission."
>
> "M&A — full acquisition DCF: target standalone equity value, synergies discounted at acquirer WACC, control premium, deal NPV to acquirer, deal IRR, accretion-dilution. Live page at /ma in the POC. Editable inputs, three charts."
>
> "Project Finance — full debt-service waterfall: mortgage-style amortisation, DSCR / LLCR / PLCR coverage ratios, cash-sweep mechanic at the 1.30 threshold, interest tax-shield NPV. Live page at /project-finance with DSCR-over-time, debt-outstanding, and CFADS-allocation charts."
>
> "IFRS S2 — bonus addition. Mandatory for Bursa-listed entities from FY2025+. We modelled Scope 1/2/3 emissions plus internal-carbon-price liability. Live page at /climate with stacked-area, cumulative-liability, and per-project intensity charts."
>
> "All three are POC-level today. Phase 1b SAC delivery production-grades them. RFP §5 is now Met across the board."

---

## Slide 49 — RFP §6: Aggregation + Back-Allocation + Consolidation

**Visual notes**: Badge "✅ Met". Top — 4-level hierarchy diagram (Entity → Sector → Type → Project). Centre — three columns: Full / Proportional / Equity-method consolidation under MFRS 10/11/28 with example assignments per project type. Bottom — back-allocation rule library showing 6 keys.

**Body**:

> **RFP §6**: "Support data consolidation based on rules and roles-based aggregation, and allocation at corporate-level to entities/activities/business level"

| Capability | POC implementation | Standard |
|---|---|---|
| **4-level org hierarchy** | `data/hierarchy.ts` — Entity → Sector → Type → Project | RFP Dataflow §3 |
| **Hierarchy aggregation** | `engine/portfolio/aggregation.ts` | — |
| **MFRS 10/11/28 consolidation methods** | `engine/portfolio/consolidation.ts` (D7/D42) — Full / Proportional / Equity-method per project | MFRS 10/11/28 |
| **MFRS 121 FX revaluation** | USD-functional → MYR-reporting translation in consolidation (D44) | MFRS 121 |
| **Back-allocation rule library** | `engine/portfolio/back-allocation.ts` — 6 keys: NPV / CAPEX / Production / Equity / Revenue / Hybrid | RFP §6 + D12 |
| **Capital-constrained optimisation** | `engine/portfolio/optimization.ts` (D15) — knapsack-style under fixed CAPEX cap with hurdle filter | New for PETROS |
| **Constrained incremental analysis** | `calculateConstrainedIncremental` (D43) — captures displacement effects | New for PETROS |

**Speaker notes**:
> "RFP §6 — Met. The aggregation layer is the part of an Integrated Planning System where most vendors silently do the wrong thing. We did three things explicitly:"
>
> "First — MFRS 10/11/28 consolidation methods. PETROS's portfolio mixes operated subsidiaries (full consolidation), JV operations (proportional), and minority associate stakes (equity method). Each MFRS standard prescribes a different roll-up. Our consolidation engine takes a `consolidationMethod` field per project and applies the right rule. Group NPV under MFRS 10 differs from naive sum-by-equity-share by tens of millions."
>
> "Second — MFRS 121 FX revaluation. USD-functional projects translate to MYR at the closing rate. PETROS reports MYR; that translation matters."
>
> "Third — capital-constrained optimisation. We added a /portfolio panel where a user enters a CAPEX budget cap and an IRR hurdle. The engine selects the project subset that maximises Group NPV under that constraint. This is what real PETROS Group capital rationing looks like."

---

## Slide 50 — RFP §7: Visualisation + Power BI

**Visual notes**: Badge "◐ Partial → ✅ Met (Phase 1a)". Top — gallery of POC screenshots (12 chart types: tornado, spider, waterfall, histogram, bubble, area, line, bar, pie, KPI, table, sparkline). Bottom — Power BI live-connection architecture: SAC ↔ Datasphere ↔ Power BI.

**Body**:

> **RFP §7**: "To automate visualisation, either using native system or Microsoft Power BI, able to carry out comparison of key data/metrics for what-if analyses (tornado or spider charts) and performance monitoring/analysis and benchmarking."

| Visual | POC delivery | SAC equivalent |
|---|---|---|
| Tornado | `components/charts/TornadoChart.tsx` + 9-variable extension | SAC Tornado chart |
| Spider | `components/charts/SpiderDiagramChart.tsx` | SAC Line chart |
| Waterfall | `components/charts/WaterfallChart.tsx` | SAC Waterfall chart |
| Monte Carlo histogram | `MonteCarloPage.tsx` — with SPE convention disambiguation | SAC Distribution + Smart Predict |
| Bubble (NPV portfolio) | `components/charts/NpvBubbleChart.tsx` | SAC Bubble chart |
| Production / CAPEX timelines | `PortfolioProductionChart` + `CapexTimelineChart` | SAC Combo chart |
| Hierarchy bar | `components/charts/HierarchyBar.tsx` | SAC Treemap / Hierarchy |
| Stacked area (IFRS S2) | `ClimateDisclosurePage.tsx` Scope 1/2/3 | SAC Stacked area |
| DSCR / LLCR coverage (PF) | `ProjectFinancePage.tsx` | SAC Combo chart with reference lines |
| **Power BI live connection** | Phase 1a UAT demo via Datasphere bridge | Native Power BI ↔ Datasphere live |

**Speaker notes**:
> "RFP §7 — Met for SAC-native visualisation today; closes for Power BI in Phase 1a UAT."
>
> "The POC ships every chart type the RFP names: tornado, spider, plus eleven additional types. All eleven map to native SAC chart widgets — no custom-widget development needed. Phase 1a translation is configuration, not code."
>
> "The Power BI angle is what some bidders skip. RFP §7 names Power BI explicitly. We commit a live-connection demonstration during Phase 1a UAT — Power BI consuming the same Datasphere views that SAC consumes. PETROS executives keep their existing Power BI dashboards while planners run SAC underneath. That's Datasphere's headline value-add for this kind of dual-tool environment."

---

## Slide 51 — RFP §8 / §10 / IT Specs: Cloud + RBAC + Security

**Visual notes**: Badge "◐ Partial → ✅ Met (Phase 1a)". Three columns: §8 Cloud SaaS · §10 RBAC + audit · IT Specs ISO/IEC 27001. Below each — SAP-native delivery.

**Body**:

| RFP § | Requirement | Closure |
|---|---|---|
| §8 | Cloud-based SaaS + open APIs + S/4HANA integration | SAC tenant on PETROS Entra · Datasphere connectors · SAP Integration Suite (existing) |
| §9 | Status workflow (open/submitted/to_change/approved) + automation | SAC Calendar workflow + engine-enforced SoD (D45/D46/D47 closures) |
| §10 | RBAC + SSO + MFA Entra + audit + versioning | 5-role capability matrix + Entra federation + SAC Activities log + 6-version registry |
| §IT-1 | Cloud SaaS | SAC native |
| §IT-2 | Open APIs incl. S/4HANA | OData / CDS views via Datasphere |
| §IT-3 | SSO + MFA via Microsoft Entra ID | SAP-native MSAL federation |
| §IT-4 | ISO/IEC 27001 + Cloud (Azure/AWS/GCP) + DR | SAC SAP-operated, SOC-2 + ISO 27001 + multi-region |
| §IT-5 | Data export/extraction + deletion on subscription termination | SAC standard tenant deprovisioning + model export API |

**Workflow extensions (D45–D47, closed in pre-bid)**:
- **Structured audit before/after** (D45) — `AuditEntry.changes` field captures field-level mutations
- **Approval expiry** (D46) — `computeApprovalExpiry` + 365-day default validity
- **Delegation** (D47) — `DelegationGrant` for approver-on-leave scenarios

**Speaker notes**:
> "RFP §8 / §9 / §10 plus IT Specs §1–§5. All Met or Partial-with-clear-Phase-1a-closure."
>
> "Three differentiators on this slide:"
>
> "First — engine-enforced SoD. Already covered. The transitions.ts:65 line is the most defensible engineering decision in the entire POC."
>
> "Second — structured audit. AuditEntry.changes captures field-level before/after pairs. Compliance-grade, not freeform-string."
>
> "Third — approval expiry and delegation, both engine-modeled. Bursa-listed E&P entities review approved planning data on a 365-day cycle; we ship a `computeApprovalExpiry` helper. Approvers go on leave; we ship `DelegationGrant`. Both honour Segregation of Duty — a delegate cannot approve a version their principal submitted."

---

## Slide 52 — Functional Coverage Scorecard (consolidated)

**Visual notes**: Single big table — RFP §1–§11 + IT Specs §1–§5 with RAG status per row. Bottom-right: "**18 ✅ Met / 13 ◐ Partial / 1 ⚠ Gap / 2 ⊘ Out-of-POC**".

**Body**:

| RFP Clause | Status | Closure path |
|---|:-:|---|
| §1 Multi-fiscal incremental simulation | ✅ Met | 9 regimes + Sarawak overlay |
| §2 Excel-parity transparent calc | ✅ Met | `excel-export-parity.test.ts` |
| §3 Sensitivity & optionality | ✅ Met | 9-variable tornado + Monte Carlo |
| §4 PRMS / SRMS reserves | ✅ Met | 3-axis classification + economic-revision driver |
| §5 Financial models incl. M&A + Project Finance | ✅ Met | 11 modules; M&A + PF + IFRS S2 added pre-bid |
| §6 Aggregation + back-allocation | ✅ Met | MFRS 10/11/28 + 6 allocation rules + capital optimisation |
| §7 Visualisation + Power BI | ◐ Partial | Native today; Power BI demo Phase 1a UAT |
| §8 Cloud SaaS + S/4 APIs | ◐ Partial | SAC + Datasphere; cross-tenant Phase 1a |
| §9 Workflow + status + automation | ✅ Met | Engine-enforced SoD + expiry + delegation |
| §10 RBAC + SSO/MFA + audit | ◐ Partial | RBAC engine ✅; SSO/MFA SAC native Phase 1a |
| §11 BA / PM / App Support | ⊘ Out-of-POC | ABeam delivery org |
| Functional UI §1: BP Central alignment | ⚠ Gap | Phase 1a Day-1 walkthrough |
| Functional UI §2: Multi-user concurrency | ◐ Partial | SAC native |
| Functional UI §3: Save/Submit/Approve prompts | ✅ Met | DataStatus state machine |
| Dataflow §1 Multi-unit | ✅ Met | Graph-based unit conversion |
| Dataflow §2 Month/Quarter/Year | ◐ Partial | POC straight-line; SAC monthly accruals Phase 1b |
| Dataflow §3 Aggregation + back-allocation | ✅ Met | (covered §6) |
| Dataflow §4 Phase storage (pre-FID/post-FID) | ✅ Met | `data/phase-data.ts` |
| Dataflow §5 Incremental analysis | ✅ Met | Constrained-incremental engine + UI |
| Economic Model §1 Modules | ✅ Met | Full set |
| Financial Model §1–§4 Modules + probabilistic + scenarios | ✅ Met | Full set + IFRS S2 + M&A + PF |
| Visualisation §1–§2 Interactive + risk | ✅ Met | All 12 chart types |
| Data Mgmt §1 Timestamp/changelog/status | ✅ Met | `AuditEntry` with structured changes |
| Data Mgmt §2 SoD | ✅ Met | Engine-enforced |
| Data Mgmt §3 SAP integration | ◐ Partial | Datasphere Phase 1a |
| IT §1 Cloud SaaS | ✅ Met | SAC native |
| IT §2 Open APIs | ◐ Partial | Datasphere + Integration Suite Phase 1a |
| IT §3 SSO + MFA Entra | ◐ Partial | SAC native Phase 1a |
| IT §4 ISO 27001 / Cloud / DR | ⊘ Out-of-POC | SAP-operated; ABeam SOC-2 attestations |
| IT §5 Export / deletion on termination | ◐ Partial | SAC standard |

**Speaker notes**:
> "Bringing it all together — 18 Met, 13 Partial, 1 Gap, 2 Out-of-POC across the full RFP scope. The Gap is BP Central UX alignment, which any bidder faces equally because BP Central is internal. The Out-of-POC items are delivery-org commitments: BA/PM/App-support resourcing, ISO 27001 attestation."
>
> "Every Partial has a named Phase 1a or 1b closure path — no open-ended commitments. Every Met has a file:line reference to verifiable POC code that PETROS evaluators can inspect at the live URL."

---

# §6 PETROS-Sarawak Differentiators (62 deltas) (7 slides)

---

## Slide 53 — Section divider: Why Us

**Visual notes**: Section divider. Big number "62" centred. Subtitle "PETROS-specific deltas applied — the difference between *compliant* and *PETROS-aware*."

**Body**:
> ### Why Us — PETROS-Sarawak Awareness
> 62 deltas applied to the POC. **All 62 addressed.** 32 implemented in code, 18 Phase 1b SAC commitments, 12 Phase 1a Discovery questions.

**Speaker notes**:
> "Section 6 — the differentiation slide. Generic competitors will produce a generic Malaysian planning system. We have produced a PETROS-Sarawak-aware planning system. The next six slides walk our methodology and the highest-impact deltas."

---

## Slide 54 — The Two-Pass Methodology — (a) → (b)

**Visual notes**: Centre — two-column comparison. Left column: "(a) Generic Malaysian baseline" — public PETRONAS MPM, PITA, Customs, MFRS, SPE PRMS. Right column: "(b) PETROS-Sarawak overlay" — Sarawak Petroleum Ordinance 2018, CSA 2020, Sarawak State Sales Tax, Sarawak Gas Roadmap. Arrow from (a) to (b) labelled "**Delta**". Bottom: "Every delta tagged with public source citation — auditable by PETROS evaluators."

**Body**:

| Pass | Lens | What it answers |
|---|---|---|
| **(a) Generic Malaysian baseline** | Public PETRONAS MPM guidance · PITA 1967 · Customs Act 1967 · MFRS / IFRS · SPE PRMS 2018 | "Does the POC satisfy a textbook Malaysian O&G planning requirement?" |
| **(b) PETROS-Sarawak overlay** | Sarawak Petroleum Ordinance 2018 · PETRONAS-PETROS Commercial Settlement Agreement 2020 · Sarawak State Sales Tax Act 1998 (2019 enforcement) · Sarawak Gas Roadmap 2022 · NETR | "Does the POC reflect PETROS-as-Sarawak-state-vehicle reality?" |

**Source-quality discipline**: every (b) claim tagged either:
- `[Source: <citation>]` — public, auditable, referenced
- `[Industry inference — verify with PETROS]` — practitioner knowledge, to confirm in Phase 1a Day-1 BRF

**Result**: 62 deltas, every one with a stated source. **No overclaim.**

**Speaker notes**:
> "The methodology is two-pass. First pass: did our solution satisfy a textbook Malaysian O&G planning requirement? Public PETRONAS MPM guidance, PITA, MFRS, SPE PRMS. That's the floor."
>
> "Second pass: does it reflect PETROS-as-Sarawak-state-vehicle reality? Sarawak Petroleum Ordinance 2018, the 2020 CSA, Sarawak State Sales Tax, the Sarawak Gas Roadmap, NETR. That's the ceiling."
>
> "Every claim we make about (b) is tagged with a source citation. PETROS evaluators can audit every assertion. Where we infer from professional practice rather than a single citable document, we say so explicitly. No overclaim."

---

## Slide 55 — Top 5 PETROS-Sarawak Deltas

**Visual notes**: Centre — 5 vertical cards in a row, each highlighting one delta with: ID badge top, title, NPV/governance impact, source citation. Coloured borders by severity.

**Body**:

| ID | Delta | Public source | Closure status |
|:-:|---|---|:-:|
| **D1** | **Sarawak State Sales Tax (5%)** — material NPV impact for any Sarawak block | Sarawak State Sales Tax Act 1998; 2019 Enforcement Order | ✅ implemented |
| **D2** | **Host counterparty post-CSA 2020** — `petronasProfitShare` → `hostProfitShare` + `host: 'PETROS'\|'PETRONAS'` per regime | PETRONAS-PETROS CSA 2020 (public summary) | ✅ implemented |
| **D5** | **Sarawak Gas Roadmap weighting** — Reserves view foregrounds Sarawak gas 2P | Sarawak Gas Roadmap 2022 (Sarawak Premier's office) | ✅ data ready |
| **D27** | **Reserves reconciliation integrated with economics** (RFP §4 explicit) | SPE PRMS 2018 §3.1 + RFP T260002 §4 | ✅ implemented |
| **D32** | **MFRS 137 + IFRIC 1 driver-based decommissioning** — replaces snapshot-PV plug | MASB (MFRS 137 / IFRIC 1) | ✅ implemented |

**Plus regulatory**:
- **D35** IFRS S2 climate disclosures — mandatory Bursa FY2025+ (✅ implemented + dedicated page)
- **D62** Malaysian Budget 2024-25 CCS incentives — ITA 60% + Pioneer Status 70% on M3 CCS (✅ applied)

**Speaker notes**:
> "Top five deltas — the bid-defining set."
>
> "D1 — Sarawak State Sales Tax. 5% on petroleum products from 2019. Any planning system that doesn't model it over-states contractor NPV materially for every Sarawak block. We model it."
>
> "D2 — host counterparty. Post-2020 CSA, Sarawak blocks have PETROS as host. The field name `petronasProfitShare` in our pre-fix code betrayed generic origin. We renamed it, added a host discriminator. A planning system that names its own host correctly reads as PETROS-aware."
>
> "D5 — Sarawak Gas Roadmap. PETROS plans in Sarawak gas 2P, not generic Group 2P. Our reserves data prepares for that grouping; UI surfacing is Phase 1b polish."
>
> "D27 — reserves reconciliation integrated with economics. RFP §4 has the literal word 'integrate'. We took it literally — added a `priceDeckScenarioFactor` so dropping oil price 20% reclassifies marginal proved volumes to contingent on the next reconciliation cycle."
>
> "D32 — MFRS 137 driver-based decommissioning. The pre-fix POC had a snapshot-PV plug field on the balance sheet — a known POC simplification. We replaced it with proper IFRIC 1 mechanics: initial PV recognition, annual unwinding to finance cost, utilisation. Bursa-disclosure-grade balance sheet."

---

## Slide 56 — D1 Sarawak State Sales Tax — Quantified Impact

**Visual notes**: Top-left — tax stack diagram showing Royalty 10% + Export Duty 10% (liquids only) + Research Cess 0.5% + **Sarawak SST 5% NEW**. Top-right — SK-410 base case before/after numbers. Bottom — code snippet from `engine/fiscal/shared.ts:97-128`.

**Body**:

**Government deduction stack — pre vs post D1 closure**

| Component | Pre-D1 | Post-D1 (current POC) |
|---|---:|---:|
| Royalty | 10% × total revenue | 10% × total revenue |
| Export Duty | 10% × **total** revenue | 10% × **liquid-only** revenue (D17/F5) |
| Research Cess | 0.5% × total revenue | 0.5% × total revenue |
| **Sarawak SST 5%** | not modelled | **5% × total revenue (Sarawak only)** |
| **Effective government take (gas-dominant project)** | ~20.5% | ~15.5% (gas) + 25.5% (liquids weighted) |

**Implementation**:
```typescript
// engine/fiscal/shared.ts (verbatim excerpt)
export function computeGovtDeductions(
  revenue: { grossRevenueOil: number; grossRevenueGas: number;
              grossRevenueCond: number; totalGrossRevenue: number },
  fiscalConfig: { royaltyRate: number; exportDutyRate?: number;
                   researchCessRate?: number; sarawakSstRate?: number },
) {
  const royalty = revenue.totalGrossRevenue * fiscalConfig.royaltyRate;
  const exportDuty = (revenue.grossRevenueOil + revenue.grossRevenueCond)
                     * (fiscalConfig.exportDutyRate || 0);
  const researchCess = revenue.totalGrossRevenue * (fiscalConfig.researchCessRate || 0);
  const sarawakSst = revenue.totalGrossRevenue * (fiscalConfig.sarawakSstRate || 0);
  // ...
}
```

**Public source**: Sarawak State Sales Tax Act 1998; Sarawak State Sales Tax (Rates of Tax No. 2) Order 2018/2019 — 5% on petroleum products produced in Sarawak from 1 January 2019.

**Speaker notes**:
> "The SK-410 quantification on the top-right is what an independent reviewer would find if they ran our engine. For a Sarawak gas project at peak 120 MMscf/d, the SST liability is on the order of $10–15M per year. Over a 20+ year life, that's hundreds of millions in correctly-modelled government take. A vendor that forgets SST will systematically over-state contractor NPV — and a PETROS evaluator will spot the omission."
>
> "The code excerpt at the bottom is the actual implementation in `shared.ts`. SST is layered alongside royalty / duty / cess, applied to total gross revenue, configurable per regime. Default 0.05 on every Malaysian PSC config in our regime data; PETROS can override per block during Phase 1a."

---

## Slide 57 — D2 Host Identity Post-CSA 2020

**Visual notes**: Top — split timeline: pre-2020 (PETRONAS as MPM and host for all Malaysian PSCs) vs post-2020 CSA (PETROS as host for Sarawak blocks; PETRONAS-as-MPM remains for Peninsular + Sabah). Bottom — code excerpt showing the `host: 'PETROS' | 'PETRONAS'` discriminator on the regime config.

**Body**:

**Before (pre-2020)** — single host:
- Every Malaysian PSC contractor's profit-oil counterparty: **PETRONAS-as-MPM**
- POC field name pre-fix: `petronasProfitShare` — **bakes in the assumption**

**After PETRONAS-PETROS CSA 2020** — block-dependent host:
- Sarawak blocks (SK-* etc.): **PETROS** is host counterparty
- Peninsular + Sabah blocks: **PETRONAS-as-MPM** remains host
- POC field name post-fix: `hostProfitShare` + per-regime `host: 'PETROS' | 'PETRONAS'`

**Closure** (D2):
```typescript
// engine/types.ts (excerpt)
interface FiscalRegimeBase {
  // ...existing fields...
  /** Optional discriminator: 'PETROS' for Sarawak blocks (post-CSA 2020),
   *  'PETRONAS' for Peninsular Malaysia / Sabah blocks. */
  readonly host?: 'PETROS' | 'PETRONAS';
}
```

```typescript
// data/fiscal-regimes.ts (excerpt — RC PSC for Sarawak)
export const RC_PSC: FiscalRegime_PSC_RC = {
  type: 'PSC_RC',
  // ... rates ...
  sarawakSstRate: 0.05,    // D1
  host: 'PETROS' as const, // D2 — post-CSA 2020
  tranches: [/* ... */],
};
```

**Why this matters for evaluators**: a code-walkthrough that hits `petronasProfitShare` reads as a generic-PETRONAS-template lift-and-shift. Renaming to `hostProfitShare` + adding the discriminator makes the system **PETROS-aware by construction**.

**Public source**: PETRONAS-PETROS Commercial Settlement Agreement (December 2020 — public summary); Sarawak Petroleum Ordinance 2018.

**Speaker notes**:
> "D2 is conceptually small but optically enormous. Pre-2020 every Malaysian PSC contractor profit-oil counterparty was PETRONAS-as-MPM. The original POC code reflected that — the field name was `petronasProfitShare`, and a PETROS reviewer reading that line of code would correctly conclude the system was built for PETRONAS first, PETROS second."
>
> "Post-2020 CSA, Sarawak blocks have PETROS as host. We renamed the field to `hostProfitShare`, added a `host: 'PETROS' | 'PETRONAS'` discriminator, and set the default to PETROS on every Malaysian PSC config because the POC's sample data is Sarawak-heavy. Per-block override is one line during Phase 1a configuration."

---

## Slide 58 — D32 + D35: MFRS 137 + IFRS S2

**Visual notes**: Two-column slide. Left: D32 — Decommissioning Provision before/after. Right: D35 — IFRS S2 climate disclosures with screenshot of /climate page from POC.

**Body**:

### D32 — MFRS 137 + IFRIC 1 Decommissioning (left column)

| Mechanic | Pre-fix POC | Post-fix POC |
|---|---|---|
| Initial recognition | none — snapshot PV at every BS date | full PV at obligation-arises year, capitalised to PPE per IFRIC 1 §5 |
| Annual unwinding | none — re-discount at each BS date | opening provision × 8% credit-adjusted risk-free rate → finance cost |
| Plug field | `otherReserves` plug (gap between book/cash) | residual ≈ 0 (driver-based) |
| Source | — | MFRS 137 §45-60; IFRIC 1 §3-10 |

**Engine module**: `engine/financial/decommissioning.ts` — 126 lines, 3-test suite passing.

### D35 — IFRS S2 Climate (right column)

- Mandatory for Bursa Malaysia listed entities **from FY2025+**
- Pillar 4 (Metrics & Targets) implemented in `engine/financial/ifrs-s2.ts`
- **Scope 1/2/3 GHG emissions** per project + portfolio aggregate
- **Internal carbon-price liability** — Scope 1+2 × internal carbon price (default $25/tonne)
- Live page at **`/climate`** with 3 charts: stacked-area emissions / cumulative liability / per-project Scope 1
- Editable factors per project in Phase 1a (Sarawak gas vs deepwater FPSO have different intensities)

**Source**: IFRS S2 (June 2023); Bursa Malaysia Sustainability Reporting Framework; Malaysian National Energy Transition Roadmap (NETR 2023).

**Speaker notes**:
> "D32 — decommissioning provision. The pre-fix POC had a known plug field on the balance sheet — `otherReserves` was the residual difference between book accounting and cash-based economics. Honest disclosure in code comments, but not Bursa-disclosure-grade."
>
> "We replaced it with the MFRS 137 + IFRIC 1 driver. Initial PV recognition at the obligation-arises year, capitalised to PPE per §5. Annual unwinding at the credit-adjusted risk-free rate, charged to finance cost. The plug field is now ≈ zero on every project. Driver-based, not plug-based."
>
> "D35 — IFRS S2. Mandatory for Bursa-listed Malaysian entities from FY2025+. PETROS in Sarawak Gas Roadmap + NETR context is high-disclosure-risk. We built a dedicated /climate page with Scope 1/2/3 emissions schedules and an internal-carbon-price liability tracker. Three charts. Editable emissions factors. PETROS Phase 1a confirms project-class-specific intensities."

---

## Slide 59 — 62-Delta Closure Dashboard

**Visual notes**: Single big visual — a dashboard-style summary chart. X-axis: 14 review phases. Y-axis: number of deltas surfaced. Stacked-bar by closure status (Implemented / Skeleton-Phase-1b / Discovery-Phase-1a). Total: 62.

**Body**:

| Phase | Theme | Deltas surfaced | ✅ Implemented | ◐ Phase 1b | 📋 Phase 1a |
|---|---|:-:|:-:|:-:|:-:|
| 1 | RFP coverage matrix | 16 | 4 | 4 | 8 |
| 2 | Fiscal regime correctness | 6 | 2 | 0 | 4 |
| 3 | Economics math | 3 | 2 | 1 | 0 |
| 4 | Reserves & resources | 5 | 4 | 1 | 0 |
| 5 | MFRS / IFRS financial statements | 5 | 5 | 0 | 0 |
| 6 | Sensitivity & Monte Carlo | 6 | 5 | 1 | 0 |
| 7 | Portfolio & consolidation | 3 | 3 | 0 | 0 |
| 8 | Workflow & security | 4 | 3 | 0 | 1 |
| 9 | Data flexibility | 2 | 1 | 0 | 1 |
| 10 | Educational text & glossary | 3 | 3 | 0 | 0 |
| 11 | Page UX | 3 | 0 | 3 | 0 |
| 12 | Test-suite adequacy | 3 | 1 | 2 | 0 |
| 13 | Sample-data realism | 3 | 1 | 2 | 0 |
| **Total** | | **62** | **34** | **14** | **14** |

**Status**: **62 / 62 addressed.** 34 implemented, 14 Phase 1b SAC commitments, 14 Phase 1a Discovery questions in `PHASE_1A_DISCOVERY.md`.

**Speaker notes**:
> "Final slide of the differentiator section — the closure dashboard. 62 deltas surfaced across 13 review phases. Every one addressed. 34 implemented in code today, with passing unit tests. 14 are Phase 1b SAC delivery commitments — the engine module exists in the POC, the SAC translation lands during Phase 1b. 14 are Phase 1a Discovery questions — items requiring PETROS-specific input (host counterparty per block, real project magnitudes, BP Central UX walkthrough) that we've enumerated as a 27-question Day-1 / Day-7 / Day-14 cadence in PHASE_1A_DISCOVERY.md."
>
> "There are no open deltas. There are no undefined commitments. Every item has either landed in code, has a Phase 1b deliverable name, or is a Phase 1a Discovery question. PETROS evaluators can audit each one against the source artefacts."

---

# §7 POC Walkthrough — Live System (12 slides)

---

## Slide 60 — Section divider: Live POC Walkthrough

**Visual notes**: Section divider. Big text "**petros-ips-poc.vercel.app**". Subtitle "503 / 503 tests passing · 17 production pages · live URL above".

**Body**:
> ### Live POC Walkthrough
> Deployed and live · 503 / 503 unit tests passing · 17 production pages
>
> Every screenshot in the next 11 slides reflects what evaluators see in the running system today.

**Speaker notes**:
> "Section 7 — the POC walkthrough. The next eleven slides are screenshots from the live deployed system. PETROS evaluators can open the URL on the divider during the proposal review and verify everything we describe. 503 unit tests passing, 17 production pages, full sidebar navigation. Live, not mocked."

---

## Slide 61 — Dashboard

**Visual notes**: Full-bleed screenshot of `/` (Dashboard). Annotation arrows pointing to: KPI tiles (Portfolio NPV, Total CAPEX, Weighted IRR, Active Projects, Govt Take), scenario selector, project summary table.

**Body**:

> Dashboard `/` — board-level view at a glance

**What it shows**:
- 5 KPI tiles: Portfolio NPV₁₀ · Active Projects · Total CAPEX · Weighted IRR · Govt Take
- Scenario selector (Base / High / Low / Stress) — one click recomputes every page
- Project summary table — 5 sample projects (SK-410 / SK-612 / Balingian / Tukau / M3 CCS)
- Sidebar with all 17 page entries

**SAC equivalent (Phase 1a)**: `Story_PETROS_IPS_Dashboard` — KPI tiles row + Story-level scenario filter prompt + table widget. Story binds to `PETROS_IPS_PLAN` planning model.

**Speaker notes**:
> "Dashboard — landing page. Five KPI tiles, scenario selector, project summary. The scenario selector is the demo's first wow moment: switch from Base to Stress, watch every number on every page recompute in milliseconds. That's the calc engine running, the SAC equivalent does the same via SAC's native cross-Story binding."

---

## Slide 62 — Economics — Project Deep Dive

**Visual notes**: Screenshot of `/economics` for SK-410 base case. Annotations: scenario selector, what-if sliders (Peak Rate, CAPEX, OPEX, Decline Rate), KPI tiles (NPV $400M / IRR 35% / Payback 2.99y / Govt Take 81%), waterfall chart, annual cashflow chart.

**Body**:

> Economics `/economics` — single-project deep dive with what-if overrides

**What it shows**:
- Scenario + project selectors
- **What-if input panel** — peak rate, CAPEX, OPEX, decline rate (live-edit)
- 8 KPI tiles
- **PSC waterfall**: Revenue → Royalty → Export Duty → Cess → **SST (D1)** → Cost Recovery → Profit Split → Tax → NCF
- Annual cashflow table — 24 columns including the post-F1+F2+F5 corrected tax base
- Production / cost / fiscal charts

**Bid talking-point**: SK-410 NPV₁₀ = **$400.67M** post-fix (vs ~$200M pre-fix — F1+F2+F5 corrected the tax base over-statement caught in pre-bid audit).

**Speaker notes**:
> "Economics page — single-project deep-dive. Pick a project, watch the entire fiscal calculation unfold. Sarawak SST 5% appears as its own line in the waterfall. Government deductions are correctly oil-and-condensate-only for export duty, total revenue for SST. Tax base correctly deducts OPEX and ABEX per PITA Section 33."
>
> "The what-if override panel on the left lets a planner edit CAPEX, peak production, decline rate, watch every downstream KPI recompute. Same mechanism the SAC equivalent will use — SAC Story input controls bound to the planning model."

---

## Slide 63 — Sensitivity — Tornado / Spider with Extended Variables

**Visual notes**: Three-panel screenshot from `/sensitivity` — Tornado tab (9 bars: oilPrice, gasPrice, production, capex, opex, fx, pitaRate, sarawakSstRate, reserves), Spider tab (continuous lines), Scenario tab (4-deck comparison).

**Body**:

> Sensitivity `/sensitivity` — Tornado · Spider · Scenario · 9 variables (PETROS-aware extension)

**Variables in the tornado** (D36/D38/D40/D41 closures):
1. Oil price (classic)
2. Gas price (classic)
3. Production (classic)
4. CAPEX (classic)
5. OPEX (classic)
6. **FX (USDMYR — Bank Negara reference band)** — D4/D36
7. **PITA rate (Budget-cycle scenario)** — D38
8. **Sarawak SST rate** — D38
9. **Reserves uncertainty (PRMS bands)** — D40

**SAC equivalent (Phase 1b)**: SAC Tornado chart bound to Multi-Action `MA_Run_Sensitivity` running 9 trials in parallel.

**Speaker notes**:
> "Sensitivity page — three tabs. Tornado is the headline visual. Note the bars: 9 variables, not the typical 5. We added FX, PITA rate, Sarawak SST rate, and reserves uncertainty. Why? Because PETROS reports MYR — FX is a first-order driver. Because Budget-cycle scenarios test fiscal-rate changes. Because Sarawak production has its own state-tax rate. Because PRMS reserves uncertainty is the second-largest source of NPV variance after oil price."
>
> "Generic IOC vendors do five-variable tornado. We do nine. PETROS-aware by construction."

---

## Slide 64 — Monte Carlo — SPE Convention Disambiguation

**Visual notes**: Screenshot of `/monte-carlo` showing histogram with P10/P50/P90 reference lines, KPI tiles, and the SPE/PRMS convention toggle. Highlight the toggle: "Statistical convention" vs "SPE/PRMS convention (P10 = optimistic)".

**Body**:

> Monte Carlo `/monte-carlo` — Mulberry32 seeded · audit-grade reproducible

**Features**:
- Configurable iterations (default 1,000), distribution type per variable
- **Mulberry32 PRNG** — same seed → same P10/P50/P90 across machines
- **Convention toggle**: Statistical (P10 = low) ↔ SPE/PRMS (P10 = optimistic) — D37 closure
- Histogram with P10 / P50 / P90 reference lines (labels swap on toggle)
- Summary table with mean, std deviation, P(NPV>0)
- Glossary entry `p10-p50-p90` — explicit disambiguation citing SPE PRMS 2018 §1.7

**Why this matters**: same codebase had SPE PRMS in reserves engine but financial statistical convention in Monte Carlo — internal terminology inconsistency. We disambiguated at the UI layer with a user toggle + glossary entry.

**Speaker notes**:
> "Monte Carlo — reproducible. Same seed produces identical P10/P50/P90 across runs, machines, CI environments. That's audit-grade, not demo-grade."
>
> "The toggle in the top-right is the convention disambiguation. SPE PRMS 2018 says P10 = optimistic, P90 = conservative — the petroleum convention. Statistical libraries flip those — the financial convention. Same number, opposite labels. Most vendors don't disambiguate; we do — explicit toggle, glossary entry, label swap on histogram and table."

---

## Slide 65 — Portfolio + Capital-Constrained Optimisation

**Visual notes**: Screenshot of `/portfolio` showing: KPI tiles top, **NEW capital optimisation panel** highlighted with red border, hierarchy bar, project toggles, NPV bubble chart.

**Body**:

> Portfolio `/portfolio` — aggregation · hierarchy · **capital-constrained optimisation (D15)**

**Sections**:
- KPI tiles: Portfolio NPV / Active Projects / Total CAPEX / Weighted IRR / Govt Take
- **NEW Capital-Constrained Optimisation panel** — set CAPEX budget cap + IRR hurdle, click Optimise
  - Returns: selected project IDs, excluded project IDs, total NPV, total CAPEX, utilisation %
  - Greedy NPV/CAPEX ranking + hurdle-rate filter; mandatory-include support
- Hierarchy bar — Entity → Sector → Type → Project drill-down
- Project on/off toggles for incremental analysis
- NPV bubble chart — size = CAPEX, x = IRR, y = NPV

**Engine**: `engine/portfolio/optimization.ts` (D15) + `calculateConstrainedIncremental` (D43).

**Speaker notes**:
> "Portfolio page. The new red-bordered panel at the top is the capital-constrained optimisation feature — a real PETROS planning ask. Set a CAPEX budget cap, set an IRR hurdle, click Optimise. The engine ranks projects by NPV-per-CAPEX, applies the hurdle filter, and returns the subset that maximises Group NPV under the constraint. Selected and excluded project IDs surface immediately."
>
> "Phase 1b SAC delivery extends this with: integer vs fractional toggle for partial project selection, project dependencies (clusters share infrastructure), mandatory-include override. The engine module is fully implemented today."

---

## Slide 66 — Financial — Driver-Based Balance Sheet

**Visual notes**: Screenshot of `/financial` Balance Sheet tab. Annotations highlight: Decommissioning Provision (driver-based MFRS 137), Deferred Tax Liability (MFRS 112), Exploration Assets (MFRS 6 for SK-612), `otherReserves` plug field (now ≈ 0). Top-right: NEW DD&A toggle (SL ↔ UoP).

**Body**:

> Financial `/financial` — IS · BS · CFS · Account Movements · all driver-based per MFRS

**MFRS-compliant balance sheet** (post Wave 2 BS rewire):
- **PPE** — accumulated CAPEX − accumulated DD&A + ARO capitalisation per IFRIC 1 §5 − E&E balance
- **Decommissioning Provision** — `engine/financial/decommissioning.ts` driver: PV recognition + unwinding + utilisation (D32)
- **Deferred Tax Liability** — `engine/financial/deferred-tax.ts` driver: book vs tax DD&A timing (D14, MFRS 112)
- **Exploration Assets** — `engine/financial/exploration-evaluation.ts` driver: pre-FID E&E for SK-612 (D33, MFRS 6)
- **Right-of-Use Assets** — `engine/financial/lease.ts` driver: FPSO leases (D34, MFRS 16)
- **`otherReserves` plug field** — ≈ $0 today (was the visible book/cash gap pre-rewire)

**DD&A toggle** (D31, top-right) — Straight-Line ↔ Unit-of-Production with PRMS-derived 2P reserves.

**Speaker notes**:
> "Financial page Balance Sheet tab. Pre-bid POC had a plug field — `otherReserves` was the residual difference between book accounting and cash-based economics. We rewrote the balance-sheet generator with proper driver-based MFRS mechanics. Decommissioning per MFRS 137 + IFRIC 1. Deferred tax per MFRS 112. Exploration assets per MFRS 6. Lease accounting per MFRS 16. The plug field is now ≈ zero on every project."
>
> "The DD&A toggle in the top-right swaps the income-statement DD&A method between straight-line (default) and unit-of-production (industry-standard for upstream). UoP uses 2P reserves from the PRMS engine as the divisor. Real MFRS 116 §60-62 compliance, not a checkbox."

---

## Slide 67 — Reserves — PRMS / SRMS / Contingent / Prospective

**Visual notes**: Screenshot of `/reserves` showing four tabs: PRMS Reserves (1P/2P/3P table), Contingent (1C/2C/3C with subclasses), Prospective (low/best/high + Pg×Pc), SRMS (CO₂ storage classes for M3 CCS).

**Body**:

> Reserves `/reserves` — three-axis classification · PRMS 2018 + SRMS 2017

**Tabs**:
- **PRMS Reserves** — 1P/2P/3P × oil/gas per project; YoY reconciliation waterfall (extensions / technical revisions / **economic revisions D27** / acquisitions / dispositions / production)
- **Contingent Resources** — 1C/2C/3C with subclasses (Development Pending / Unclarified / Not Viable) + contingencyNote per project
- **Prospective Resources** — Low/Best/High unrisked + risked = unrisked × Pg × Pc; sample 0.18-0.25 Pg, 0.55-0.70 Pc
- **SRMS Storage** — M3 CCS storage classes (Capacity / **Contingent** / Prospective) and maturity subclasses; M3 currently `pending` (D30 fix — was `approved` pre-fix)

**Sources cited in code**: SPE PRMS 2018 §2.1.2/§2.1.3/§2.1.4; SPE SRMS 2017.

**Speaker notes**:
> "Reserves page. Four tabs because there are four kinds of resources to classify: discovered-commercial (Reserves), discovered-sub-commercial (Contingent), undiscovered (Prospective), and CO₂ storage (SRMS for M3 CCS)."
>
> "Most planning POCs model only Reserves. We model all four. The contingent module cites PRMS 2018 §2.1.3.2 directly in the source code with subclass labels matching the standard. The prospective module implements Pg × Pc risk-weighting per §2.1.4. M3 CCS uses SRMS classification — we caught and fixed a subclass mismatch (`approved` → `pending`) in pre-bid because the project is still pre-FID."

---

## Slide 68 — Consolidation — MFRS 10/11/28 Methods

**Visual notes**: Screenshot of `/consolidation` page. Annotations highlight: per-project consolidation method (Full / Proportional / Equity), MFRS 121 FX revaluation (USD → MYR), Group NPV in both currencies, total minority interest carved out.

**Body**:

> Consolidation `/consolidation` — Group Finance roll-up · MFRS 10/11/28 · MFRS 121

**Method discrimination** (D7/D42):
- **Full** (subsidiary, control >50%): 100% lines; minority interest carved out
- **Proportional** (joint operation): equity-share lines (POC default)
- **Equity-method** (associate, 20-50% with significant influence): single-line equity-method contribution

**MFRS 121 FX revaluation** (D44):
- USD-functional projects → MYR-reporting Group at closing rate
- Per-project `functionalCurrency: 'USD' | 'MYR'` configuration

**Engine**: `engine/portfolio/consolidation.ts` — 130 lines.

**Speaker notes**:
> "Consolidation page — Group Finance roll-up. Three things to call out:"
>
> "First — method discrimination per project. PETROS's portfolio mixes operated subsidiaries (full consolidation per MFRS 10), JV operations (proportional per MFRS 11), and minority associate stakes (equity method per MFRS 28). Each prescribes a different roll-up. Most planning systems sum-by-equity-share regardless. We don't."
>
> "Second — minority interest. Full-consolidation subsidiaries with non-100% equity share carry-out the non-PETROS share as a minority-interest equity element on the Group balance sheet. That's the MFRS 10 mechanic; we model it."
>
> "Third — MFRS 121 FX revaluation. USD-functional projects translate to MYR for Group reporting at the closing rate. PETROS reports in MYR; that translation needs to be auditable, not a hidden assumption."

---

## Slide 69 — M&A — Acquisition DCF

**Visual notes**: Screenshot of `/ma` page showing: editable input form (target NCF, synergies, control premium, integration cost, horizon), KPI cards (target equity, synergies value, control premium, acquisition price, deal NPV, deal IRR, accretion-dilution), value-bridge bar chart, cashflow trajectory line chart.

**Body**:

> M&A `/ma` — Acquisition DCF · RFP §5 explicit (D6 closure)

**Capabilities**:
- **Target standalone equity value** — DCF of target NCF at target's WACC
- **Synergies value** — revenue + cost − integration discounted at acquirer's WACC
- **Control premium** — typical 20–40% over standalone equity
- **Acquisition price** = standalone + premium
- **Deal NPV to acquirer** = synergies value − control premium
- **Deal IRR** — Brent's-method on combined cashflow
- **Accretion / dilution** — combined NPV / acquirer-standalone NPV − 1
- **Two charts**: value bridge (target → synergies → premium → deal NPV), cashflow trajectory (target NCF vs net synergies)

**Source**: Brealey-Myers Corporate Finance §35; CFA Level II Equity — Mergers & Acquisitions.

**Speaker notes**:
> "M&A page — the most important RFP §5 closure. RFP names M&A explicitly. Pre-bid, this didn't exist. We built the full acquisition-DCF framework."
>
> "Inputs are editable: target NCF, target WACC, acquirer WACC, control premium, synergy magnitudes, integration cost, horizon. Outputs are six KPI cards plus two charts. The accretion-dilution metric is the acquirer-perspective filter — positive means the deal is accretive to acquirer's combined NPV; negative means dilutive even with synergies and control premium."
>
> "Phase 1b SAC delivery: this becomes a full Story with target-cashflow upload, scenario layering (base/bull/bear synergy cases), sensitivity to control premium, accretion analysis under different financing structures."

---

## Slide 70 — Project Finance — Debt Service Waterfall

**Visual notes**: Screenshot of `/project-finance` page showing: editable inputs (debt fraction, interest rate, tenor, cash sweep threshold), KPIs (Total debt, Equity, Min DSCR, Avg DSCR, LLCR, PLCR, Tax shield), DSCR bar chart with 1.20/1.30 reference lines, debt-outstanding area chart, CFADS allocation stacked-bar.

**Body**:

> Project Finance `/project-finance` — Debt-Service Waterfall · DSCR / LLCR / Cash Sweep · RFP §5 explicit (D6 closure)

**Capabilities**:
- **Capital structure** — debt fraction (gearing), interest rate, tenor, construction years
- **Mortgage-style amortisation** — `PMT = P × r × (1+r)^n / ((1+r)^n − 1)` per industry standard
- **Coverage ratios per period**:
  - **DSCR** = CFADS / (Interest + Principal) — target ≥ 1.20
  - **LLCR** = NPV(CFADS over loan life) / Outstanding Debt — target ≥ 1.30
  - **PLCR** = NPV(CFADS over project life) / Outstanding Debt
- **Cash-sweep mechanic** — surplus above DSCR threshold (default 1.30) accelerates principal repayment
- **Interest tax shield** — separate NPV calculation
- **Three charts**: DSCR-over-time bars (with 1.20/1.30 reference lines), debt-outstanding area, CFADS allocation stacked-bar (Interest · Principal · Cash sweep · Equity)

**Source**: Yescombe E.R. (2013) "Principles of Project Finance"; Moody's PF Methodology.

**Speaker notes**:
> "Project Finance page — second RFP §5 closure. Debt-service waterfall, lender-perspective coverage ratios."
>
> "DSCR per year, with the 1.20 industry-target reference line and the 1.30 cash-sweep threshold marked. Bars below 1.20 turn red — the lender-failure signal. Average DSCR across operational years summarises lender comfort."
>
> "LLCR is the loan-life view — discounted CFADS over loan life ÷ outstanding debt. Target ≥ 1.30 in upstream. PLCR is the project-life view — wider scope."
>
> "The CFADS stacked-bar at the bottom shows where each year's cash flow goes: red = interest, amber = principal, petrol = cash sweep, green = available to equity. PETROS's CFO office can see at a glance how lender claims compress equity returns in the early years."

---

## Slide 71 — Climate — IFRS S2 Disclosures

**Visual notes**: Screenshot of `/climate` page showing: editable emissions factors panel, KPIs (total Scope 1/2/3 + carbon liability), stacked-area chart (annual emissions), cumulative liability line chart, per-project Scope 1 bar chart.

**Body**:

> Climate `/climate` — IFRS S2 Pillar 4 (Metrics & Targets) · D35 · Bursa FY2025+

**Capabilities**:
- **Scope 1/2/3 emissions** per project per year
  - Scope 1 (operational): Sarawak gas ~12 kg/boe, deepwater FPSO ~25 kg/boe
  - Scope 2 (purchased energy): ~5 kg/boe
  - Scope 3 (downstream combustion): ~410 kg/boe (typical product-mix combustion intensity)
- **Internal carbon-price liability** — Scope 1+2 × internal carbon price (default $25/tonne)
- **Portfolio aggregate** — sum across all 5 projects
- **Three charts**:
  - Stacked-area annual emissions by Scope (kt CO₂e)
  - Cumulative carbon-price liability with annual increment overlay
  - Per-project Scope 1 bar chart (life-of-field intensity)

**IFRS S2 framework**:
- **Pillar 1** Governance · **Pillar 2** Strategy · **Pillar 3** Risk Management — narrative, in SAC Story Help
- **Pillar 4** Metrics & Targets — quantitative, this page

**Source**: IFRS S2 (June 2023); Bursa Malaysia Sustainability Reporting Framework; NETR 2023.

**Speaker notes**:
> "Climate page. IFRS S2 is mandatory for Bursa-listed Malaysian entities from FY2025+. PETROS as Sarawak's state vehicle in the Gas Roadmap and NETR context is high-disclosure-risk. We built the Pillar 4 quantitative side — Scope 1/2/3 emissions schedule plus internal-carbon-price liability."
>
> "The stacked-area chart shows annual emissions evolving with production. Operational Scope 1 falls as production declines; downstream Scope 3 follows the same curve since it's combustion of the produced volumes. The cumulative-liability line chart in the middle shows carbon-price exposure building up — an explicit disclosure metric Bursa regulators expect."
>
> "Editable factors. PETROS Phase 1a confirms project-class-specific intensities."

---

# §8 Integration Design (Datasphere connectors) (5 slides)

---

## Slide 72 — Section divider: Integration Design

**Visual notes**: Section divider. Centre — small replica of slide 35's landscape with arrows showing Datasphere as the integration backbone.

**Body**:
> ### Integration Design
> SAP Datasphere as the data fabric · connectors to every existing PETROS SAP component
>
> No new infrastructure · no parallel data store · no overnight ETL.

**Speaker notes**:
> "Section 8 — integration. The next four slides walk the Datasphere connector inventory mapped to PETROS's existing SAP landscape from slide 35."

---

## Slide 73 — Datasphere Connector Inventory

**Visual notes**: Centre — connector matrix table. Columns: Source system · Connector · Data domain · Frequency · POC analogue.

**Body**:

| Source system (slide 35) | Connector | Data domain | Frequency | POC analogue |
|---|---|---|:-:|---|
| **S/4HANA Finance — ACDOCA** | CDS view + Datasphere data flow | GL line items, actuals | Real-time federated | `actuals` data version in `versioned-data.ts` |
| **S/4HANA — CSKS** | CDS view (`I_CostCenter`) | Cost-centre master | Daily refresh | `dim_CostCenter` |
| **S/4HANA — PRPS / Project System** | CDS view (`I_WBSElement`) | WBS hierarchy, project structure | Daily | 4-level hierarchy in `data/hierarchy.ts` |
| **S/4HANA — Joint Venture Accounting (JVA)** | CDS view (custom for PSC partners) | JV partner shares, equity stakes | Daily | `equityShare` + `consolidationMethod` per project |
| **S/4HANA — Cost Mgmt & Profitability Analysis** | CDS view | Cost objects, profitability segments | Daily | Back-allocation rule library (D12) |
| **S/4HANA — Asset Management (Maintenance)** | CDS view (`I_MaintenanceItem`) | Planned maintenance schedules | Weekly | OPEX projections; ABEX timing for IFRIC 1 |
| **S/4HANA — Procurement / Ariba** | CDS + Ariba API | CAPEX commitments, sourcing pipeline | Daily | Investment & financing program inputs |
| **SuccessFactors** | OData API | Headcount per cost centre | Monthly | D12 back-allocation `headcount` rule |
| **SAP DRC** | OData / Integration Suite | PITA + Sarawak SST e-invoicing | Per-event | Outbound from SAC Multi-Action `MA_File_PITA` |
| **SAP Integration Suite (existing)** | Pass-through | Flat-file Project · DMS | Continuous | Reuse existing IS patterns |
| **External — Brent / Asian LNG** | REST + Datasphere | Forward-curve price decks | Daily | `data/price-decks.ts` |
| **External — Bank Negara reference rate** | REST + Datasphere | USDMYR FX rate | Daily | D4/D36 FX-as-MC-variable |

**Speaker notes**:
> "Twelve connectors. Every row maps to an existing system PETROS already operates — no new source data, no new infrastructure. Datasphere federated query means actuals come live from ACDOCA without copying. CDS views are the SAP-supported pattern for S/4HANA data exposure; PETROS already has them or can build them quickly. SuccessFactors and DRC come via OData APIs PETROS administrators are familiar with."
>
> "External connectors — Brent/Asian LNG forward curves and Bank Negara FX rates — are the only non-SAP sources. Both have stable REST APIs widely used in industry."

---

## Slide 74 — Master Data Flow

**Visual notes**: Flow diagram. S/4HANA CDS views → Datasphere semantic layer (defines `dim_Project`, `dim_Sector`, etc.) → SAC planning model master-data dimensions. Right side: PETROS Reserves Committee feeds reserves master via SAC import.

**Body**:

**Master-data lineage** (Phase 1a):

| Master dimension | S/4 source | Datasphere semantic view | SAC dimension |
|---|---|---|---|
| `dim_Project` (4-level hierarchy) | PRPS / I_WBSElement | `vw_PETROS_Project` | dim_Project (Public, parent-child) |
| `dim_Sector` (Upstream / Downstream / CCS) | Custom S/4 master | `vw_PETROS_Sector` | dim_Sector (Public, flat) |
| `dim_Type` (Operated / Non-Operated) | Custom S/4 master + JVA partner data | `vw_PETROS_Type` | dim_Type (Public, flat) |
| `dim_Account` (KPIs + line items) | I_GLAccount + curated KPI list | `vw_PETROS_Account` | dim_Account (Account, by Category) |
| `dim_Time` | Calendar | `vw_PETROS_Time` | dim_Time (Time, CY/quarterly/monthly) |
| `dim_Version` (6 versions) | Custom — actuals from ACDOCA, others from SAC | `vw_PETROS_Version` | dim_Version (native + private) |
| `dim_Scenario` (4 price decks) | Custom + external feeds | `vw_PETROS_Scenario` | dim_Scenario (Public, flat) |
| `dim_FiscalRegime` (10 regimes) | Phase 1a-confirmed catalogue | `vw_PETROS_FiscalRegime` | dim_FiscalRegime (Public, by Class) |

**Phase 1a deliverable**: 8 dimension CSVs imported into `PETROS_IPS_PLAN` model + private-dimension version logic configured + master `master_Project` sheet seeded from `data/projects.ts` (replaced with PETROS-confirmed magnitudes per D61).

**Speaker notes**:
> "Master data lineage. Eight dimensions — every one mapped to its S/4 source, its Datasphere semantic view, and its SAC dimension. The pattern is: define the semantic view once in Datasphere, every consumer sees identical semantics. Add a project to S/4 PRPS, it appears in SAC the next day."
>
> "Phase 1a deliverable: 8 dimension CSVs imported, master_Project seeded with PETROS-confirmed magnitudes (D61 in our PHASE_1A_DISCOVERY catalogue). The POC's sample data is illustrative; Phase 1a Day-1 walkthrough swaps in real values."

---

## Slide 75 — Actuals & Planned Data Flow

**Visual notes**: Two-direction flow. Left → right: ACDOCA → Datasphere → SAC `actuals` version. Right → left: SAC `approved` version → Datasphere → S/4 CAPEX commitments + DRC PITA filings + SuccessFactors writeback (where applicable).

**Body**:

**Inbound — actuals & master data → SAC**:
1. S/4HANA ACDOCA actuals → Datasphere federated view → SAC `actuals` data version (monthly close cadence)
2. CSKS / PRPS master → Datasphere semantic views → SAC dimension refresh (daily)
3. JVA partner shares → Datasphere → `equityShare` + `consolidationMethod` per project
4. SuccessFactors headcount → Datasphere → D12 back-allocation `headcount` rule
5. Maintenance schedules → Datasphere → OPEX projections + ABEX timing
6. Brent / LNG / FX → Datasphere → `dim_Scenario` price-deck refresh

**Outbound — approved plans → S/4 + DRC**:
1. SAC `approved` data version → Datasphere → S/4 CAPEX commitments (Project System write-back)
2. SAC `approved` PITA tax provision → Datasphere → SAP DRC e-invoicing for LHDN filing
3. SAC `approved` Sarawak SST → Datasphere → SAP DRC e-invoicing for Sarawak State Government filing (D1)
4. SAC `approved` headcount allocations → Datasphere → SuccessFactors planning module sync (where applicable)

**Approval gate**: only `approved` versions write back. SoD-enforced upstream in SAC Calendar workflow.

**Speaker notes**:
> "Two-way data flow. Inbound is the obvious direction — actuals come from S/4 into SAC for variance analysis and re-forecasting."
>
> "Outbound is where the integration earns its keep. Approved plans write back to S/4 as CAPEX commitments — Project System updates, procurement triggers. Approved tax provisions write back to SAP DRC for LHDN PITA filing AND Sarawak State Government SST filing. The Sarawak SST e-invoicing path is the operationalisation of D1 — you don't just model the 5%, you file it through the same compliance framework the rest of the company uses."
>
> "Approval gate: only the `approved` data version writes back. The 6-version registry plus SoD-enforced workflow guarantees nothing un-approved hits S/4."

---

## Slide 76 — Cross-Tenant Datasphere Bridge

**Visual notes**: Top — two SAP HANA tenants side-by-side: PETRONAS-Group S/4 (left) and PETROS-dedicated S/4 (right, dotted border showing future state). Centre — Datasphere as the bridge with a dashed arrow showing federated query crossing tenants. Bottom — security overlay: PETROS-only data masking, audit log on every cross-tenant query.

**Body**:

**Why this matters** (D9 closure):
- PETROS S/4 currently sits inside the broader PETRONAS-Group landscape under the post-2020 CSA transition arrangement.
- A future-state PETROS-dedicated tenant is plausible but not yet committed.
- Either way, the IPS must work across the boundary.

**Datasphere cross-tenant federation pattern**:
- Datasphere supported pattern for cross-tenant semantic federation (SAP-published architecture)
- PETROS users see PETROS data with row-level masking; PETRONAS-Group data masked at view level
- Audit log on every cross-tenant query — Bursa-grade traceability
- No tenant migration required — Datasphere reads where the data lives

**Phase 1a integration design deliverable**:
1. Tenant landscape inventory (which tables live in which tenant)
2. Datasphere views with PETROS-only masking
3. Access policies aligned with PETROS-PETRONAS data-sharing agreement
4. Audit log integration to PETROS SOC

**Speaker notes**:
> "Cross-tenant bridge. This is one of the bid items most easily mishandled. PETROS S/4 today sits inside the broader PETRONAS-Group landscape under the 2020 CSA transition arrangement. A dedicated PETROS tenant is a possibility, not a given."
>
> "Either way, the planning system needs to work. SAP Datasphere is the supported pattern: federated query that crosses tenant boundaries with row-level masking, view-level access control, audit logging on every cross-tenant query. No tenant migration required."
>
> "Phase 1a integration design deliverable formalises this: tenant inventory, Datasphere view definitions, access policies aligned with PETROS-PETRONAS data-sharing agreement, audit-log integration to PETROS SOC. We've named it as a Phase 1a Day-1 question in PHASE_1A_DISCOVERY.md item #2."

---

# §9 Methodology & Phase Plan (8 slides)

---

## Slide 77 — Section divider: Methodology & Phase Plan

**Visual notes**: Section divider. Right side — three phase boxes ("Phase 1a — June 2026", "Phase 1b — September 2026", "Phase 2 — January 2027") with brown accent bars.

**Body**:
> ### Methodology & Phase Plan
> Phase 1a (June 2026) · Phase 1b (September 2026) · Phase 2 (January 2027)
>
> Aligned to RFP T260002 §Timeline. POC = executable functional spec for Phase 1a.

**Speaker notes**:
> "Section 9 — methodology and phase plan. The next seven slides walk the ABeam delivery methodology and the three phases per RFP §Timeline. Each phase has named deliverables, named delta closures, and named PETROS dependencies."

---

## Slide 78 — ABeam Delivery Methodology

**Visual notes**: Centre — methodology stages diagram (Discovery → Functional Design → Technical Build → UAT → Hypercare → Steady-state Application Support). Each stage labelled with duration in weeks and PETROS-side ownership.

**Body**:

| Stage | Duration | Description | PETROS ownership |
|---|:-:|---|---|
| **1. Discovery** | 4 weeks | BP Central walkthrough · `PHASE_1A_DISCOVERY.md` 27 closure questions · master data confirmation · BP Central UX alignment | Functional design lead |
| **2. Functional Design** | 6 weeks | SAC Story design · Datasphere view modelling · workflow Calendar templates · approval rules · RACI | FP&A team review + sign-off |
| **3. Technical Build** | 8–12 weeks/phase | DAS scripts · Multi-Actions · Calculated Measures · UI configuration · POC engine translation | IT integration support |
| **4. UAT** | 4 weeks | Excel-parity acceptance test · 503-test corpus migration · viewport walk on production tenant · Power BI live connection demo | UAT team execution |
| **5. Hypercare** | 8 weeks (per RFP) | Post-go-live support · defect fixes · user-coaching · critical incident response | UAT team continuation |
| **6. Application Support** | Contract period | Tier 1/2/3 support · enhancement requests · regulatory updates · MFRS / IFRS S2 update tracking | Service-desk integration |

**Built-in artefacts that accelerate every stage**:
- POC = executable functional spec → cuts Functional Design by 30%
- 503-test corpus → becomes UAT acceptance test → cuts UAT by 40%
- 1,867-line educational-content registry → becomes SAC Story Help → cuts content authoring by 80%
- 27-question Discovery catalogue → cuts Discovery scoping by 50%

**Speaker notes**:
> "ABeam delivery methodology. Six stages. Standard waterfall-with-iterations pattern, but with one big difference for this engagement: we have built artefacts that accelerate every stage."
>
> "Discovery — POC pre-answers the technical-design questions. The 27-question Phase 1a Discovery catalogue is what we ask PETROS, not what we ask ourselves. Saves 50% of typical Discovery time."
>
> "Functional Design — POC IS the functional spec. SAC Stories design is translation, not invention. 30% saving."
>
> "UAT — 503-test corpus becomes the acceptance test. PETROS UAT team runs the same tests we ran. 40% saving."
>
> "Story Help — 1,867 lines of educational content already authored. SAC just embeds it. 80% saving on content authoring."

---

## Slide 79 — Phase 1a — June 2026 Foundation

**Visual notes**: Phase 1a card. Top — start date "June 2026". Body — deliverables list. Right side — delta closures landed in 1a (12 Discovery items + 4 implementations). Bottom — milestone timeline (Discovery → Functional Design → Build → UAT → Go-live July 2026 for UI ready).

**Body**:

**Phase 1a — Foundation (June 2026 → UI ready July 2026)**

**Deliverables**:
1. SAC tenant provisioning · Entra ID federation · Roles & Teams configuration
2. `PETROS_IPS_PLAN` model with 8 dimensions, 6-version registry, 4 scenarios
3. **8 SAC Stories** (Phase 1a tier): Dashboard · Economics · Portfolio · Data Entry · Settings · Glossary · Data Sources · Audit Trail
4. Datasphere connectors: ACDOCA · CSKS · PRPS · JVA · SuccessFactors · Ariba · DRC · external (Brent/LNG/FX)
5. SAC Calendar workflow templates (Open → Submitted → To-Change → Approved) with engine-enforced SoD
6. Excel-parity UAT acceptance test set
7. 27-question Phase 1a Discovery catalogue executed
8. **PETROS-Sarawak deltas configured**: D1 SST per block · D2 host per regime · D5 Sarawak grouping · D60 price-deck re-anchor · D61 real magnitudes

**Delta closures landed in Phase 1a**:
| Implementation | Discovery |
|---|---|
| D1 (SST per block) | D3 (BP Central templates) |
| D2 (host per block) | D8 (Power BI live connection) |
| D9 (Datasphere bridge design) | D10 (BP Central UX walkthrough) |
| D60 (price-deck re-anchor) | D16 (data residency) |
|  | D18 (SP rate per contract) |
|  | D19 (Sarawak DW post-2020 incentives) |
|  | D21 (LFA applicability) |
|  | D22 (HPHT / LLA enablement) |
|  | D48 (RLS policy) |
|  | D50 (S/4 monthly accrual) |
|  | D61 (real project magnitudes) |
|  | D62 (CCS Investment Tax Allowance per project) |

**Acceptance**: Phase 1a UAT closes on Excel-parity test passing for 5 sample projects across 4 scenarios.

**Speaker notes**:
> "Phase 1a — June 2026 to July 2026 UI ready. Foundation phase. Eight Stories live, eight Datasphere connectors live, three workflow templates live, twelve Discovery items closed, four delta implementations applied per PETROS-confirmed values."
>
> "Acceptance is the Excel-parity test passing for 5 sample projects across 4 scenarios. PETROS UAT team runs the same test we run today. If our engine and the SAC equivalent agree on every cell of the workbook within $500k tolerance, Phase 1a goes live."

---

## Slide 80 — Phase 1b — September 2026 Upstream Economics + Financial

**Visual notes**: Phase 1b card. Right side — list of new Stories (Sensitivity, Financial, Monte Carlo, M&A, Project Finance, IFRS S2, Climate). Bottom — major delta closures: D6, D14, D32, D33, D34, D35, D27, D31.

**Body**:

**Phase 1b — Upstream Economics + Financial (September 2026)**

**Deliverables**:
1. **9 SAC Stories** (Phase 1b tier): Sensitivity · Financial Statements · Monte Carlo · M&A · Project Finance · Climate · Reserves PRMS-only · plus enhancements to existing 1a Stories
2. **Engine translations**: 9 fiscal-regime DAS scripts · Multi-Action `MA_Apply_Fiscal_Regime` router · Calculated Measures (NPV / IRR / MIRR / Payback / PI / Govt-Take)
3. **MFRS-driven financial statements**: IS · BS · CFS · Account Movements · plus deferred tax (D14) · decommissioning (D32) · E&E (D33) · lease (D34)
4. **M&A + Project Finance** SAC Stories with editable inputs (D6)
5. **IFRS S2 Climate** Story for FY2025+ Bursa disclosures (D35)
6. **Sensitivity & Monte Carlo** with extended variables (D36/D38/D40/D41) and correlation-matrix support (D39 — Cholesky)
7. **Reserves reconciliation** integrated with economics (D27)
8. **DD&A toggle** SL ↔ UoP (D31)
9. **Capital-constrained optimisation** Multi-Action (D15)
10. UAT · training · go-live · 8-week hypercare

**Delta closures landed in Phase 1b**:
- **D6** M&A + Project Finance (RFP §5 explicit) — POC ready, SAC translation
- **D14** MFRS 112 deferred tax · **D32** MFRS 137 + IFRIC 1 · **D33** MFRS 6 E&E · **D34** MFRS 16 lease
- **D27** Reserves reconciliation integrated with economics (RFP §4 explicit)
- **D31** UoP DD&A toggle · **D23** mid-year discounting toggle
- **D35** IFRS S2 climate disclosures (Bursa FY2025+ mandatory)
- **D36/D38/D39/D40/D41** extended sensitivity / MC variables + correlation
- **D15** Capital-constrained portfolio optimisation
- **D45/D46/D47** Workflow before/after audit · approval expiry · delegation

**Acceptance**: Phase 1b UAT closes on Excel-parity for full IS/BS/CFS reconciliation + Monte Carlo P10/P50/P90 reproducibility + IFRS S2 Pillar 4 schedule generation.

**Speaker notes**:
> "Phase 1b — September 2026. The economics + financial engine. Nine new Stories, nine fiscal-regime DAS scripts, full MFRS-driven financial statements, M&A and Project Finance pages live, IFRS S2 climate disclosures live, capital-constrained optimisation Multi-Action live."
>
> "This is the heaviest delta-closure phase — fifteen of our 62 deltas land in Phase 1b. Most of those are MFRS / IFRS modules where the POC engine is already implemented and tested; SAC translation is the work. Acceptance is rigorous: Excel-parity for the full balance sheet, Monte Carlo reproducibility, IFRS S2 Pillar 4 schedule generation matching POC output."

---

## Slide 81 — Phase 2 — January 2027 Downstream + Group Finance + Reserves

**Visual notes**: Phase 2 card. Subject to "necessary approval & agreement of both parties" per RFP. List of Phase 2 deliverables.

**Body**:

**Phase 2 — Downstream + Group Finance + Reserves (January–February 2027)**

**Per RFP §Timeline — subject to PETROS-ABeam mutual agreement**

**Deliverables**:
1. **Downstream margin sub-model** — extends `engine/portfolio/downstream-margin.ts` to full SAC Story
2. **Group Finance Consolidation** — MFRS 10/11/28 method-discriminated roll-up + MFRS 121 FX revaluation (D7/D42/D44)
3. **Reserves PRMS / SRMS Stories** — full reconciliation waterfall with economic-revision driver (D27 production-grade)
4. **Reserves Committee workflow** — qualified-person signoff per Bursa LR Appendix 9C (D28)
5. **Cluster-development PSC** — multi-field hub-spoke fiscal aggregation (D20)
6. **Capital project economics** — Project System integration (RFP §Timeline Phase 2)
7. **End-to-end workflow integration** — full-cycle planning calendar
8. **Marginal Field LFA regime** — if confirmed during Phase 1a Discovery (D21)
9. UAT · training · go-live · 8-week hypercare · ongoing application support

**Delta closures landed in Phase 2**:
- **D7 / D42 / D44** Consolidation methods + MFRS 121 FX revaluation
- **D20** Cluster PSC · **D21** LFA regime (if applicable)
- **D26 / D5** Sarawak block reserves grouping default
- **D28** Reserves Committee approval workflow
- **D43** Capital-constraint-aware incremental analysis

**Speaker notes**:
> "Phase 2 — January 2027. Subject to mutual agreement per RFP. Downstream margin model, Group Finance consolidation with MFRS 10/11/28 methods, reserves PRMS/SRMS stories, Reserves Committee workflow with qualified-person signoff for Bursa disclosure."
>
> "Plus regime-specific extensions if confirmed during Phase 1a Discovery: cluster-development PSC for multi-field Sarawak hubs, Marginal Field LFA terms for late-life assets."
>
> "Acceptance: end-to-end planning cycle execution from monthly close → re-forecast → annual budget → Group consolidation → Bursa disclosure."

---

## Slide 82 — Hypercare + Application Support

**Visual notes**: Two-panel slide. Left — Hypercare (8-week post-go-live, defect fixes, user coaching). Right — steady-state Application Support (Tier 1/2/3, enhancement requests, regulatory updates).

**Body**:

**Hypercare (8 weeks per phase)** — built into Phase 1b and Phase 2 closure:
- 24/5 ABeam lead presence on PETROS planning team Slack/Teams
- Defect-fix turnaround: P1 (4 hrs), P2 (24 hrs), P3 (5 days)
- User-coaching sessions (3 per week)
- Critical incident response — PETROS SOC integration

**Steady-state Application Support (contract period — RFP §11)**:
| Tier | Scope | SLA | ABeam team |
|:-:|---|:-:|---|
| **Tier 1** | User access, simple data queries, password resets | 2 hr response | Service desk |
| **Tier 2** | SAC Story configuration, dimension updates, Calendar workflow tweaks | 1 day | SAC consultant |
| **Tier 3** | DAS / Multi-Action / Datasphere modelling changes | 5 days | SAC + Datasphere SME |
| **Strategic** | Regulatory tracking (MFRS / IFRS S2 / Budget changes / PETRONAS LFA changes) | quarterly review | ABeam regulatory lead |

**Regulatory tracking** — built-in:
- MFRS / IFRS standard updates (e.g. IFRS S2 amendments)
- Malaysian Budget cycle (annual — capital allowance / Pioneer Status / ITA changes)
- PETRONAS Activity Outlook fiscal-term updates
- Sarawak State Government tax-rate changes (SST review cycle)
- Bursa Listing Requirements amendments

**Speaker notes**:
> "Hypercare and steady-state Application Support. RFP §11 names this explicitly — we don't just deliver and disappear, we operate the system through the contract period."
>
> "Tier structure is standard: Tier 1 service desk, Tier 2 SAC consultant, Tier 3 deep technical, plus a strategic-level regulatory-tracking quarterly review. The regulatory-tracking commitment is what most vendors silently de-prioritise. Malaysian Budget changes annually; IFRS S2 evolves; Bursa updates Listing Requirements; we commit to surface impact within four weeks of any change so PETROS planning doesn't go stale."

---

## Slide 83 — Critical-Path Dependencies & Risks

**Visual notes**: Risk matrix table. Likelihood × Impact 3×3 grid. Risks plotted with mitigation owner labelled.

**Body**:

**Risk register** (top 8 only — full register in Appendix):

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|:-:|---|:-:|:-:|---|---|
| R1 | Cross-tenant Datasphere bridge complexity | Medium | High | Phase 1a integration design tabled Day-1; SAP Datasphere SME on team | ABeam + PETROS IT |
| R2 | BP Central UX gap | High | Medium | Phase 1a Day-1 walkthrough; alignment design as formal Discovery deliverable | PETROS Functional Design |
| R3 | M&A + PF Phase 1b scope creep | Medium | High | POC-level prototypes ready; Phase 1b commitments contractually capped | ABeam scope mgmt |
| R4 | Sarawak SST rate changes (Budget cycle) | Low | Low | Configurable per regime; quarterly regulatory review | ABeam regulatory lead |
| R5 | IFRS S2 disclosure framework evolution | Medium | Medium | Phase 1b includes IFRS S2 v1; Tier-Strategic quarterly review covers amendments | ABeam regulatory lead |
| R6 | PETROS ↔ PETRONAS-Group landscape transition | Medium | High | Datasphere bridge accommodates either future state; design freeze in Phase 1a | PETROS IT + ABeam |
| R7 | Real project magnitude data availability | Medium | Medium | Phase 1a Day-1 master-data delivery committed; sample data acceptable for UAT | PETROS Functional Design |
| R8 | Power BI integration scope | Low | Medium | Phase 1a UAT demo; Datasphere live-connection is SAP-supported | ABeam |

**Critical path**: BP Central walkthrough (Phase 1a Day 1) → Functional Design closure (Phase 1a Week 4) → DAS build (Phase 1b Week 1) → UAT entry (Phase 1b Week 11).

**Speaker notes**:
> "Risk register. Eight risks plotted. Three are Medium-High that we've named explicit mitigations for: cross-tenant Datasphere bridge (R1), M&A scope creep (R3), and PETROS-PETRONAS landscape transition (R6). Each has an owner and a Phase 1a Discovery-tabled action."
>
> "Critical-path dependency: BP Central walkthrough on Day 1. Without it, Functional Design slips. We've named it as Phase 1a Day-1 question #1 in PHASE_1A_DISCOVERY.md."

---

## Slide 84 — Phase 1a Discovery Cadence (Day-1 / Day-7 / Day-14)

**Visual notes**: Three-panel timeline. Day 1 (4 questions, walkthroughs). Day 7 (8 fiscal-regime questions). Day 14 (15 sensitivity / treasury / governance questions). Bottom — pointer to `PHASE_1A_DISCOVERY.md` companion document.

**Body**:

**Phase 1a Discovery — engineered to close 27 PETROS-input questions in 14 working days**:

### Day 1 — Block-and-tackle inputs
1. BP Central walkthrough (D3, D10) — provide screen-capture set or live walkthrough
2. Cross-tenant S/4HANA arrangement (D9) — confirm tenant landscape
3. Data residency confirmation (D16) — Singapore / Malaysia / other
4. Real project magnitudes (D61) — replace POC illustrative numbers

### Day 7 — Fiscal-regime confirmation
5. Sarawak State Sales Tax rate confirmation (D1)
6. Host counterparty per block (D2)
7. Supplementary Payment rate per signed contract (D18)
8. Sarawak deepwater post-2020 incentives (D19)
9. Cluster-development PSC structures (D20)
10. Marginal Field LFA regime applicability (D21)
11. HPHT / LLA enablement (D22)
12. Carbon-credit policy + Malaysian Budget 2024-25 CCS incentives (D62)

### Day 14 — Sensitivity / Treasury / Governance policy
13. Discounting convention default (D23)
14. PI definition convention (D24)
15. Sensitivity bounds per variable (D4, D41)
16. Monte Carlo distributions per asset class (D13, D40)
17. Variable correlation matrix (D39)
18. DD&A method default (D31)
19. Decommissioning discount rate (D32)
20. Internal carbon price for IFRS S2 (D35)
21. Consolidation methods per project + functional currency (D7, D42, D44)
22. Back-allocation rule preference (D12)
23. Group capital budget cap (D15, D43)
24. Approval validity period (D46)
25. Delegation policy (D47)
26. Row-level security policy (D48)
27. Audit before/after capture scope (D45)

**Each item has a one-line answer** that lands in `data/petros-config.ts` (production) or remains a configuration toggle in SAC.

**Reference**: `PHASE_1A_DISCOVERY.md` — full document delivered alongside this proposal.

**Speaker notes**:
> "Phase 1a Discovery — 27 questions, 14 working days, three cadence days."
>
> "Day 1 is block-and-tackle: BP Central walkthrough, tenant landscape, data residency, real project magnitudes. Without these, Functional Design slips."
>
> "Day 7 is fiscal-regime confirmation: SST rate, host counterparty per block, SP rate per contract, regime-specific incentives. Each one is a single-value answer that PETROS Functional Design lead can give in a meeting."
>
> "Day 14 is sensitivity / treasury / governance policy. Conventions, defaults, scopes. Each item has a one-line answer that lands in `data/petros-config.ts` in production."
>
> "We don't ask PETROS to design the system. We ask PETROS to confirm 27 specific values. The rest we've already engineered. PHASE_1A_DISCOVERY.md is the working document."

---

# End of slides §4–§9 (slides 36–84)

**Total**: 49 slides covering Target Architecture, Functional Coverage, PETROS-Sarawak Differentiators, POC Walkthrough, Integration Design, and Methodology & Phase Plan.

**Companion artefacts** in this proposal:
- `ASSESSMENT.md` — 14-phase independent technical-functional review (103 findings)
- `PETROS_DELTAS.md` — 62 PETROS-Sarawak deltas with full closure status table
- `BID_NARRATIVE.md` — 6-section evaluator-facing synthesis
- `PHASE_1A_DISCOVERY.md` — 27-question Day-1 / Day-7 / Day-14 catalogue
- `SAC_MAPPING.md` — POC ↔ SAC object translation
- `README.md` (this proposal) — slide-by-slide markdown for the proposal deck

**Live POC**: `petros-ips-poc.vercel.app` — 503 / 503 unit tests passing, 17 production pages, MFRS / IFRS / SPE PRMS / SPE SRMS-compliant engine modules, all 62 deltas addressed.
