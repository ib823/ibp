# PETROS IPS POC — UI/UX Audit Scorecard

**Audit date**: 2026-04-25
**Audit scope**: 11 pages, 14 chart components, 13 shared components, 6 UI5 shims, 4 deep components, layout shells, design-token CSS
**Methodology**: four parallel forensic Explore agents, each grading one slice against an explicit baseline (PETROS palette, SAP "72" type, semantic tokens) along eight dimensions per file: visual fidelity, component consistency, layout/responsive, information hierarchy, data formatting, interaction states, accessibility, demo robustness — plus four cross-cutting checks (pattern duplication, naming, demo-flow state, performance signals).

**Tracker convention**:
- `[ ]` open finding
- `[x]` fixed
- `[~]` partially addressed
- `[skip]` deferred with rationale

---

## Executive summary

| Severity | Count |
|---|---|
| **P0** — demo-breaker | 38 |
| **P1** — pattern violation | 110 |
| **P2** — polish | 70 |
| **Total** | 218 |

Top three problem surfaces: **DataSourcesPage** (largest file), **EconomicsPage** (most-watched page), **MonteCarloPage** (chart-heavy + percentile semantics). Most leverage is in the **shared component library** — fix once, ripple across 5–10 places.

---

## Systemic issues — fix here first

These eight issues account for ~60 individual findings combined. Each fix touches multiple files and is the highest leverage available.

### S1. Chart color hardcoding
- [x] `#E07060` and `#3B8DBD` in TornadoChart, SpiderDiagramChart → CHART_NEG / CHART_POS
- [x] `#3B8DBD`, `#E07060` in MonteCarloPage histogram bars → CHART_POS / CHART_NEG
- [~] `#2D8A4E`, `#C0392B` inline in ReservesWaterfall (matches palette but unbound) — deferred (in-palette, low risk)
- [x] `#1E3A5F`, `#3B8DBD` in PhaseComparisonView → PHASE_COLORS
- [~] `#2D8A4E`, `#C0392B`, `#1E3A5F` in VersionComparisonView waterfall — deferred (in-palette, low risk)
- [x] `#8B5CF6` (purple) for `admin` role in RoleBadge → tokenized as `--color-admin: #6B46C1`
- [~] NpvBubbleChart uses local color map — deferred (in-palette)
- **Fix shipped**: `src/lib/chart-colors.ts` exporting `COLORS`, `CHART_NEG`, `CHART_POS`, `CHART_CATEGORICAL`, `VARIABLE_COLORS`, `SECTOR_COLORS`, `SCENARIO_COLORS`, `PHASE_COLORS`, `PRODUCTION_COLORS`, `WATERFALL_NEG_SEQUENCE`. Off-palette colors fully eliminated; in-palette inline cleanups deferred.

### S2. Badge / tone class duplication
- [x] `RoleBadge` → migrated to Pill primitive
- [x] `StatusBadge` → migrated to Pill primitive (drops UI5 Tag dependency)
- [ ] `VersionedDataUpload` reinvents tone strings inline — deferred to next sweep
- [ ] `ConnectionCard` inline tone strings — deferred
- [ ] `DataSourcesPage` inline tone strings — deferred
- [ ] `SettingsPage` inline tone strings — deferred
- [ ] `AuditTrailPage` inline tone strings — deferred
- **Fix shipped**: `src/components/shared/Pill.tsx` with `PillTone` (petrol/amber/success/danger/admin/navy/neutral) and `PillSize` (xs/sm). RoleBadge and StatusBadge are now thin role-mappers on top. Remaining 5 inline-tone usages tracked above.

### S3. Spacing rhythm broken
- [ ] Inconsistent gap/space-y/py across pages: 3, 4, 5, 6, 1.5, 2 mixed without rhythm
- [ ] KpiCard padding ≠ table cell padding
- [ ] Sticky-header `py-1.5` vs body `py-2`
- **Fix**: codify {4, 8, 12, 16, 24} as the only legal spacings in CLAUDE.md design note; refactor egregious offenders.

### S4. Responsive breakpoints skip the middle band
- [ ] EconomicsPage KPI row: `grid-cols-2 lg:grid-cols-4` (no `sm:` / `md:`)
- [ ] PortfolioPage selection list missing `md:` variant
- [ ] FinancialPage controls don't `flex-wrap` cleanly at ~700px
- [ ] DashboardPage quick-link cards: 2 cols at 640–1024px (wasteful)
- **Fix**: add `sm:` and `md:` variants where missing.

### S5. Loading / empty / error states are inconsistent
- [x] EconomicsPage empty state — migrated to `<EmptyState />`
- [x] PortfolioPage "Calculating portfolio…" — migrated to `<LoadingState />` with spinner
- [x] MonteCarloPage — now shows `<LoadingState />` while running, `<EmptyState />` when idle
- [x] SensitivityPage three empty states (tornado/spider/scenario) — migrated to `<EmptyState />`
- [ ] ReservesPage Export button — deferred (not a state primitive issue, an interaction issue)
- [ ] EconomicsPage Export button — deferred (same)
- **Fix shipped**: `src/components/shared/States.tsx` exporting `<EmptyState />`, `<LoadingState />`, `<ErrorState />`. Each accepts `size` (sm/md/lg), proper ARIA roles (status / alert), and hint copy. LoadingState includes spinner via lucide `Loader2`.

### S6. Focus-visible rings inconsistent
- [x] DashboardPage quick-link cards — `.focus-ring` applied
- [ ] Sidebar items — UI5 SideNavigation handles this (verified, deferred)
- [ ] EconomicsPage tab links — UI5 Tabs handles this (verified, deferred)
- [ ] Other ad-hoc usages — adopt `.focus-ring` as we encounter them
- **Fix shipped**: global `.focus-ring:focus-visible` utility in `src/index.css` — 2px petrol outline with 2px offset. Apply to any custom-styled interactive element lacking a focus indicator.

### S7. Naming clashes
- [ ] "Working Data" vs "Working Draft" vs "Working Version" vs "Draft" — same concept, four labels
- [ ] "P10 (Low Case)" vs "P10 (Pessimistic)" — toggle exists but KpiCard `border-l-danger` accent doesn't follow the SPE convention swap
- [ ] Distribution labels abbreviated `Tri / LN / Norm` — should be `Triangular / Lognormal / Normal` for evaluators
- [ ] `MIRR` label fallback when IRR is null but tooltip still says "IRR"
- **Fix**: `LABELS` constants module; spell out distributions; align card accent colors with semantic toggle state.

### S8. Hardcoded inline styles & magic numbers
- [ ] `shadow-[2px_0_0_0_rgb(226,229,234)]` (sticky shadow)
- [ ] `borderRadius: 4` inline in GuidedTour
- [ ] Reserves table `min-w-[700px]`
- [ ] Charts `min-h-[280px]`, no `max-h`
- [ ] Inputs `w-[110px]`, `w-[140px]`, `w-[176px]` scattered
- [ ] SVG paddings hardcoded in pixels (don't scale below 320px)
- **Fix**: tokens in CLAUDE.md; replace top-10 offenders.

---

## Demo-blocker shortlist (P0s ranked by likely demo visibility)

- [verified] **MC P10/P90 KpiCard border colors don't follow SPE convention toggle** — investigated and confirmed the implementation is **correct**. The engine emits ascending percentiles (`p10` = statistical 10th percentile = lowest NPV = always pessimistic). Border accents are positional (red→petrol→green) which maps semantically to pessimistic→median→optimistic in BOTH conventions. The toggle only relabels the percentile names. Audit was a misdiagnosis.
- [x] **HierarchyBar narrow projects show no label and have no aria-label** — added `role="img"` + `aria-label` + `title` to sector segments and project bars; truncated project names get `title={proj.key}` for hover-reveal.
- [x] **Tornado / Spider / Histogram off-palette colors** — replaced `#E07060` / `#3B8DBD` with `CHART_NEG` / `CHART_POS` (petrol/danger).
- [x] **GovernmentTakeChart cap mismatch** — center label and legend now show `*` suffix when `>100%`, linked to existing footnote. Imports central `COLORS` palette.
- [x] **FinancialPage amber-on-amber warning box fails contrast** — switched body to `text-text-primary` on `bg-amber/15` (with amber `<strong>` retained as the warning marker). Same fix applied to the Cash Flow note (`amber-50/200/800` → palette tokens).
- [x] **ScenarioKpiTable hardcoded scenario order crashes on missing key** — filter `ORDER` to keys actually present in `results`; render `null` if empty.
- [x] **EconomicsPage PI format inconsistency** — `.toFixed(2)` → `fmtNum(value, 2)`. Same fix applied in `ScenarioKpiTable`.
- [x] **PortfolioPage "Calculating portfolio…" with no spinner** — now uses `<LoadingState />` with spinner.
- [x] **MC distribution labels `Tri / LN / Norm`** — spelled out as Triangular / Lognormal / Normal; lognormal headers use `μ` / `σ` symbols.
- [x] **RoleBadge admin uses `#8B5CF6` purple — off-palette entirely** — tokenized as `--color-admin: #6B46C1`.
- [verified] **Ui5Input null-coercion** — already properly guarded (`value === undefined || value === null ? '' : String(value)`); no change needed. Audit pointed to old line.
- [x] **Reserves Export toasts "available in SAC"** — replaced toast onClick with proper `disabled` state + tooltip explaining the SAC roadmap. Same fix on `PortfolioPage`'s Export Portfolio.
- [ ] **Currency-symbol overflow** — table headers hardcode `({u.currencySymbol}M)`, assume 1-char symbol. Deferred (low risk while POC uses USD/MYR).
- [x] **GlossaryPage missing keys on `highlightMatch()` parts** — wrapped both text fragments and `<mark>` elements in `<span key>` with monotonic segment indices.

### Browser-session-only findings (added 2026-04-25)

- [x] **CSP blocks SAP "72" font** — `index.html` font-src didn't include `cdn.jsdelivr.net`; SAP fonts silently failed across all 11 pages × 3 viewports (36 console errors per page). Now allowed.
- [x] **GuidedTour auto-opens on every fresh page** — gated to dashboard route only (`location.pathname !== '/'` early return). Delay bumped 800 → 1500ms so users see content first. Direct deep-links to /economics or /portfolio no longer fire the welcome modal.
- [x] **Mobile (320px) hides the persona switcher** — toolbar overflow root cause: shrink-able children + flex-1 content > viewport. Fix: `shrink-0` on right-side items + responsive `ScenarioSelector` width (112px on mobile, 140px on sm+) + hide POC badge on `<sm` (footer disclaimer keeps the framing). AR avatar now renders cleanly at 320px.
- [x] **DashboardPage quick-link grid skips middle breakpoint** — added `sm:grid-cols-3`.
- **Verified clean across 33 viewport-page combinations**: zero nav failures, zero horizontal scroll, zero React runtime errors, zero non-CSP console errors. The layout is more robust than the static audit feared.

---

## Per-page findings

### DashboardPage (`src/pages/DashboardPage.tsx`)

- [ ] **P0** :194 — `yr` unit hardcoded; should use display units context
- [ ] **P0** :226-244 — Quick-link grid: `grid-cols-2 lg:grid-cols-4`, no `sm:grid-cols-3`; wasteful at 640–1024px
- [ ] **P1** :84 — KpiCard left-border accent inconsistent (positive NPV always petrol; negative IRR not styled)
- [ ] **P1** :106 — Project Summary `p-4` outer, header `py-1.5`, body `py-2` — broken rhythm
- [ ] **P1** :119 — Sticky shadow hardcoded inline RGB
- [ ] **P1** :122-135 — Header cell padding inconsistent (`px-3` sticky, `px-2` others)
- [ ] **P1** :159 — Row hover: no focus-visible state on Link; keyboard nav invisible
- [ ] **P1** :185 — Status badge no fallback for unknown status — silently unstyled
- [ ] **P1** :210-219 — Charts `min-h-[280px]` but no `max-h`; potential overflow
- [ ] **P2** :172 — Badge text `text-[10px]` vs KpiCard label `text-[11px]` — micro-typography drift

### EconomicsPage (`src/pages/EconomicsPage.tsx`)

- [ ] **P0** :76 — Empty state `h-64` fixed; cuts off on short viewports
- [ ] **P0** :149 — PI uses `.toFixed(2)`; all others use `u.money()` / `fmtPct()`
- [ ] **P0** :178-195 — Sub-grid `grid-cols-2`, no responsive variant; labels overflow narrow screens
- [ ] **P0** :241-244 — Monthly/Quarterly disclaimer never updates if user changes display units
- [ ] **P0** :333 — GranularEconomicsView table `max-h-[480px]` no min-height; can compress to 0
- [ ] **P1** :114 — KPI grid skips `sm:` / `md:` breakpoints
- [ ] **P1** :125 — `MIRR/IRR` label toggle but KpiCard truncates long labels
- [ ] **P1** :126-137 — IRR threshold colors hardcoded (0.15, 0.10) — no design token
- [ ] **P1** :154-197 — Waterfall + pie 3-col layout breaks 1024–1200px without `md:` step
- [ ] **P1** :169 — Govt/Contractor label `whitespace-nowrap` no max-width — future overflow risk
- [ ] **P1** :361-370 — Period table cell padding inconsistent header vs body
- [ ] **P1** :365-370 — NCF color via inline ternary — no semantic for color-blind users

### SensitivityPage (`src/pages/SensitivityPage.tsx`)

- [ ] **P0** :120, :125 — Tornado legend hardcoded `#E07060`, `#3B8DBD`
- [ ] **P0** :269 — ScenarioKpiTable `min-w-[500px]` overflow; hardcoded scenario order crashes on missing key
- [ ] **P1** :107, :137, :159 — Empty states identical to content cards — no visual hierarchy
- [ ] **P1** :110, :140, :165 — Section headings: `text-[11px]` mixed with chart titles inconsistently
- [ ] **P1** :247 — `isNonInvestmentPattern` falls back to MIRR but label still says "IRR"
- [ ] **P2** :254 — `fmtYears()` null/NaN renders bare "—" with no unit context

### PortfolioPage (`src/pages/PortfolioPage.tsx`)

- [ ] **P0** :129-133 — "Calculating portfolio…" plain text, no spinner
- [ ] **P0** :151 — KPI grid `grid-cols-2 sm:grid-cols-3 xl:cols-5` — abrupt resize between breakpoints
- [ ] **P0** :176 — `Portfolio Govt Take *` label width changes when overage detected — layout shift
- [ ] **P0** :240 — Long project names truncate with no aria-label — screen reader silent
- [ ] **P1** :209-262 — Toggle list uses `opacity-40` for inactive; no `aria-disabled`; tab still focuses
- [ ] **P1** :247 — Fiscal regime badge uses `.replace('_', ' ')` — renders "undefined" if missing

### FinancialPage (`src/pages/FinancialPage.tsx`)

- [ ] **P0** :169 — Warning box `bg-amber/5` + `text-amber`; contrast <3:1 fails WCAG AA
- [ ] **P0** :259 — Cash Flow note uses `amber-50/200/800` palette outside design system
- [ ] **P1** :130, :147-152 — Header controls don't `flex-wrap` cleanly; 380px+ unwrapped
- [ ] **P1** :182 — Title lacks scenario/project subtitle
- [ ] **P2** :168-171 — POC disclaimer only on non-year granularity; year view is also derived

### ReservesPage (`src/pages/ReservesPage.tsx`)

- [ ] **P0** :74 — Export toast says "available in SAC production system" — admits incompleteness
- [ ] **P0** :328-330 — SRMS reconciliation decimals inconsistent (`.toFixed(2)` vs `.toFixed(3)`)
- [ ] **P0** :86 — Table `min-w-[700px]` forces horizontal scroll at 768px portrait
- [ ] **P1** :82 — "SPE PRMS Classification" header lacks visual emphasis vs body
- [ ] **P1** :104 — 1P/2P/3P column headers iterate via `as const` — schema unclear
- [ ] **P2** :122-124 — Project name fallback shows raw UUID if project not found in store
- [ ] **P2** :36 — `selectedYear` typed as string then `Number()` cast — should be numeric

### MonteCarloPage (`src/pages/MonteCarloPage.tsx`)

- [ ] **P0** :355 — Histogram bars hardcoded `#3B8DBD` / `#E07060` — off-palette
- [ ] **P0** :318-334 — KpiCard borders fixed to position, not semantics — invert when SPE toggle on
- [ ] **P0** :349, :376 — Tooltip fontFamily hardcoded `IBM Plex Mono` — should use `.font-data`
- [ ] **P0** :189-193 — Distribution labels `Tri / LN / Norm` — abbreviations look unprofessional
- [ ] **P1** :318 — KpiCard label switches "P90 (Pessimistic)" but value still `result.p10` — ambiguity
- [ ] **P1** :340 — Iteration count format `fmtNum(result.npvValues.length)` differs from input field
- [ ] **P1** :59 — Default 1000 iterations; UI caps at 100k; navigation behavior under load untested
- [ ] **P2** :280-293 — `200` magic number for S-Curve sampling — extract const
- [ ] **P2** :211 — Empty state doesn't reflect `isCalculating` progress

### SettingsPage (`src/pages/SettingsPage.tsx`)

- [ ] **P1** :132 — `Badge variant="outline"` semantic clash with elsewhere
- [ ] **P2** :75 — Inline tone classes — should use shared Badge primitive
- [ ] **P2** :99 — `font-data` vs `tabular-nums` mixed
- [ ] **P2** :218-219 — `EduRow` duplicates grid pattern — could be reusable

### GlossaryPage (`src/pages/GlossaryPage.tsx`)

- [ ] **P0** :114-115 — `highlightMatch()` returns array without keys → React warning
- [ ] **P1** :101 — Open-state chevron `text-petrol` doesn't indicate interactivity clearly
- [ ] **P2** :169-175 — `mark` element `bg-amber/30` hardcoded

### DataSourcesPage (`src/pages/DataSourcesPage.tsx`)

- [ ] **P1** :535-539 — Input domain color legend inline instead of shared map
- [ ] **P1** :658 — Workbook badge padding inconsistent with StatusBadge
- [ ] **P1** :687 — `font-data` only on column name, not description
- [ ] **P2** :710 — Sample data table `whitespace-nowrap` truncates long text — no overflow handling

### AuditTrailPage (`src/pages/AuditTrailPage.tsx`)

- [ ] **P1** :177 — Body cells `tabular-nums` but headers don't — alignment drift
- [ ] **P1** :200 — Sticky column `bg-white` hardcoded — mismatches hover background
- [ ] **P1** :239 — Summary card font sizing breakpoint differs from KpiCard
- [ ] **P2** :205-207 — Icon badge inline styles duplicated from ConnectionCard

### Header / Sidebar / AppShell / Footer

- [ ] **P0** Header.tsx:45 — POC badge `text-amber bg-amber/10 border-amber/30` — borderline WCAG AA at 10px
- [ ] **P1** Header.tsx:39 — Mobile menu button no focus-visible ring
- [ ] **P1** Header.tsx:56 — "Recalculate All" icon-only on sm — no text label fallback for sighted users
- [ ] **P1** Sidebar.tsx:70 — Sidebar collapse may flicker / cause reflow on mobile open
- [ ] **P1** Sidebar.tsx:80-84 — Active route detection: `/` exact, others `.startsWith()` — inconsistent
- [ ] **P1** AppShell.tsx:22 — Auto-collapse at <1024px ignores user preference
- [ ] **P1** Footer.tsx:3 — `text-text-muted` on `bg-content-alt` — ~4.2:1 borderline
- [ ] **P2** AppShell.tsx:62 — `tabIndex={-1}` on main but no focus-on-route-change

---

## Shared library findings

### KpiCard
- [ ] **P0** :36-38 — Danger color via parens-string detection (fragile)
- [ ] **P1** :25 — Conditional EduTooltip wrap — prop API unclear
- [ ] **P2** :20 — Responsive font sizing via character count — should be prop-driven

### EduTooltip
- [ ] **P1** :33-37 — `cloneElement` assumes single child — fragments / arrays bypass silently
- [ ] **P2** :30 — Silent return on missing text — no dev feedback

### RoleBadge
- [ ] **P0** :9 — Admin role `#8B5CF6` purple — off-palette

### StatusBadge
- [ ] **P0** :13 — Tight coupling to UI5Badge complicates refactor
- [ ] **P1** :29-30 — Status labels hardcoded; should be imported from types

### ScenarioSelector
- [ ] **P2** :20 — `w-[140px]` hardcoded

### GranularityToggle
- [ ] **P1** :34 — Tooltip "Quarterly" doesn't match button text "Qtr"

### GuidedTour
- [ ] **P0** :173-177 — Box-shadow spotlight calc can underflow at <320px viewport
- [ ] **P1** :189 — `borderRadius: 4` inline — should use Tailwind class
- [ ] **P2** :252 — `bg-petrol-light` assumed available

### InfoIcon
- [ ] **P0** :33 — Invisible 44×44 touch target via `after:` — works but undocumented
- [ ] **P1** :52 — Dialog body `p-4` — magic number

### SectionHelp
- [ ] **P2** :18 — `min-h-[44px]` no desktop reduction — wastes space

### VersionedDataUpload
- [ ] **P0** :297 — Edit input `w-[110px]` hardcoded
- [ ] **P1** :304 — `step="0.000001"` — UI5 Input rejects this attribute (per Ui5Input.tsx comment)
- [ ] **P2** :203-207 — Tone class logic duplicated

### ConnectionCard
- [ ] **P1** :65 — `isEntra` flag disables connect; tooltip says "sign out" but no sign-out exists post-cleanup
- [ ] **P2** :234 — Status indicator inline-flex hardcoded gap

---

## UI5 shim findings

### Ui5Badge
- [ ] **P1** :34 — Color scheme map silent fallback to `'6'` on invalid variant
- [ ] **P2** :35 — Design hardcoded `"Set2"` — no constant

### Ui5Button
- [ ] **P1** :74 — `tooltip` prop maps to UI5 `tooltip` but interface doesn't document divergence from HTML `title`
- [ ] **P2** :71 — Class array `.filter(Boolean).join(' ')` not normalized

### Ui5Input
- [ ] **P0** :99 — `.value = String(value)` coerces `null/undefined` to literal "null"/"undefined"
- [ ] **P1** :76 — Step rounding: input shows unrounded, onChange fires rounded — UX gap

### Ui5Select
- [ ] **P1** :50 — `selectedOption` cast to HTMLElement without null guard — can throw
- [ ] **P2** :73 — Placeholder `value=""` — conflicts if user wants empty value

---

## Deep components

### UnitConversionSection
- [ ] **P0** :288-294 — Display-only-factor tooltip text long; not mobile-friendly
- [ ] **P1** :62 — `DISPLAY_ONLY_FACTOR_IDS` set hardcoded; engine sync risk
- [ ] **P2** :224 — Super-User warning uses `<a href="/audit">` — should use Router Link

### VersionComparisonView
- [ ] **P0** :527-528 — SVG text Y position fixed; doesn't scale with viewBox responsiveness
- [ ] **P1** :457 — Waterfall colors hardcoded
- [ ] **P1** :475 — `fontSize: 11` hardcoded — doesn't respect display unit scale
- [ ] **P2** :600+ — Long file (582 LOC) — extract sub-components

### PhaseComparisonView
- [ ] **P1** :400 — Stroke `#3B8DBD` hardcoded
- [ ] **P2** :196 — `Minus` icon imported but only used inline in `ChangeIndicator`
- [ ] **P2** :465 — Phase timeline scroll container doesn't handle mobile overflow

### WorkflowActionBar
- [ ] **P1** :133 — Textarea `rounded-none` explicit — should use form radius token
- [ ] **P2** :188 — Tone functions `toneBg/toneHover/toneBorder` — could be single map

### Tables (EconomicsTable, FinancialTable)
- [ ] **P2** EconomicsTable :65 — Body `font-data text-xs` but header doesn't — alignment

---

## Cross-cutting structural

- [ ] **P0** Pattern duplication: BadgeTone hardcoded in 5+ places → `BadgeTone` map
- [ ] **P0** Color hardcoding in viz: 7+ files → `chart-colors.ts`
- [ ] **P1** Responsive breakpoints inconsistent → breakpoint usage guide in CLAUDE.md
- [ ] **P1** "Working Data" naming inconsistency (Working Draft / Working Version / Draft) → standardize
- [ ] **P1** `ChartShell` import audit — verify all chart components use it for resize handling
- [ ] **P2** Aria gaps — `aria-expanded` on collapsibles, semantic `<dl>` on summary cards
- [ ] **P2** Icon size inconsistency (12 / 14 / 18 / 20) → token

---

## Browser session walk — what we did

A Playwright-based viewport walk (`scripts/viewport-walk.mjs`) visits all 11 pages at 320px / 768px / 1280px, captures full-page screenshots to `viewport-walk/*.png` (gitignored), and reports console errors, page errors, navigation failures, and horizontal-scroll overflow. Run with `node scripts/viewport-walk.mjs` while `npm run dev` is up.

**Verified clean** (33 page-viewport combinations):
- 0 navigation failures
- 0 horizontal-scroll overflows (even at 320px)
- 0 React runtime errors
- 0 non-CSP console errors
- 1 expected console message per page (Lit dev-mode warning — disappears in prod build)

**What the walk surfaced** that static analysis missed: the CSP / SAP font issue (S1 fixed) and the GuidedTour auto-open behaviour (task #14).

**What still needs human eyes**:
- Actual measured contrast at runtime (Lighthouse / axe DevTools)
- Perceived motion / transition smoothness
- Projector / large-screen legibility
- Mobile touch target ergonomics in practice
- Screen reader output
- Performance under throttled CPU
- Behaviour under persona switching mid-page

---

## How to use this scorecard

1. Before any new POC work, scan the **Demo-blocker shortlist** — those are the bid-critical items.
2. As findings are fixed, change `[ ]` → `[x]` in this file. PR or commit message should reference the audit IDs (e.g., "S1 chart-colors centralized").
3. Re-run the audit before bid submission. Spawn the same four Explore agents with the same prompts; diff the new findings against this file. Net new = regressions.
4. Treat **systemic issues (S1–S8)** as the unit of work, not individual findings — they ripple, the individual findings dedupe themselves.

**Owner**: bid team
**Last updated**: 2026-04-26 (typography section appended — see below)
**Vercel auto-deploy**: configured 2026-04-25 — `petros-ips-poc` project linked to `ib823/ibp` on `main` with root directory `petros-ips-poc/`. The duplicate `ibp` project's Git link removed (was producing broken 4-second deploys at `ibp-nine.vercel.app`).

---

## Typography audit (added 2026-04-26)

**Methodology**: a separate page-by-page typography review, captured externally (font-family × size × weight per rendered text node across all 14 routes plus modals, dropdowns, and pills). The review's structural recommendations were validated against the codebase before being entered here. **Three factual claims in the source review were rejected as not matching this codebase** — see "Source-review corrections" below — so this section reflects only verified findings.

### Source-review corrections (claims rejected)

These were stated by the source review but do not match the code as of 2026-04-26:

- **`/montecarlo` 404 routing bug** — does not exist. `src/components/layout/Sidebar.tsx:20` and `src/App.tsx:68` both use `/monte-carlo`. The string `/montecarlo` (no hyphen) appears nowhere in the codebase.
- **"Orphaned `@font-face` declarations to purge (Inter, Super Sans VF, IBM Plex Sans)"** — there are zero `@font-face` rules in `src/`. The "72" family is loaded by SAP UI5's bundled Assets (`@ui5/webcomponents-react/dist/Assets.js`, imported at `src/App.tsx:5`), not by us. IBM Plex Sans + Mono are loaded via Google Fonts in `index.html`. Inter / Super Sans VF, if observed at runtime in `document.fonts`, originate from the UI5 bundle and cannot be purged without modifying SAP UI5.
- **"Add tokens to `tailwind.config.ts`"** — file does not exist. The project uses **Tailwind v4** with the CSS-first `@theme {}` block in `src/index.css:5-39`. New design tokens go in CSS, not in a JS config.

### S9. Typography token system absent (new systemic issue)

The codebase has font-family tokens (`--font-sans`, `--font-mono`) and a `font-data` utility (`src/index.css:166-169`, with `tabular-nums`) but **no semantic size or weight tokens**. As a result:

- 232 occurrences of arbitrary `text-[Npx]` classes across `src/`, distributed across 3 distinct sizes: `text-[9px]`, `text-[10px]`, `text-[11px]` (verified by grep).
- `text-xs` (12px) appears in 37 files; `text-sm` (14px) in 15 files; sub-12px arbitrary classes in 20+ files. There is no semantic name attached to any of these — the same size is used for headers, captions, status pills, and table cells indiscriminately.
- KPI numeric sizing is **character-count-driven**, not role-driven (`KpiCard.tsx:39`: `len <= 9 ? 'text-xl sm:text-2xl' : len <= 12 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'`). Different KPI tiles on the same page render at different sizes depending on their formatted value length — this is the root cause of the "24px on Dashboard, 20px on Audit Trail" inconsistency surfaced by the source review.

**Fix direction**: extend the `@theme` block in `src/index.css` with a six-step semantic scale (caption / body / body-strong / subtitle / title / display) plus matching weight tokens. Migrate `text-[Npx]` and `text-xs|sm` call sites to the new tokens incrementally. KpiCard should switch from character-count branching to a single `display` token (with explicit `truncate` or `overflow-wrap` for long values).

**Why this is S9, not a per-page finding**: every page on the per-page list above is a downstream symptom. Tokenising once collapses dozens of P1/P2 entries.

### S10. Sub-12px text WCAG risk (new systemic issue)

Verified call sites for `text-[9px]` (sub-12px floor recommended by WCAG 2.1 1.4.4 / SAP Fiori):

- `src/components/shared/Pill.tsx:40` — `xs` size is 9px / 600 / uppercase. This is the canonical pill primitive; every consumer of `<Pill size="xs">` inherits the 9px floor.
- `src/components/shared/ConnectionCard.tsx:115,142,148,152` — Endpoint / Last sync / Data scope definition-list labels.
- `src/components/shared/S4HanaIntegrationPanel.tsx:150,156,160` — Sample columns / Volume estimate / Last sync labels.
- `src/pages/DataEntryPage.tsx:392,465` — step-counter avatar (5×5 px circle) and amber attention copy.

**Fix direction**: raise `Pill` `xs` size to 10px (or unify with `sm`) — every other 9px usage either uses Pill or is a definition-list `<dt>` that should adopt a shared `caption` token at ≥11px. The 5×5 step-counter avatar at `DataEntryPage.tsx:392` is a special case (numeric inside a small circular badge) and may need a dedicated rule rather than a token.

### S11. UI5 web-component typography unaligned with React/Tailwind side (new systemic issue)

The codebase has **no UI5 CSS-variable overrides** for typography (verified: `grep "sapFont"` in `src/` returns zero hits). UI5 web components (`ui5-button`, `ui5-tab`, `ui5-tag`, `ui5-select`, `ui5-side-navigation`, `ui5-dialog`) inherit the SAP Horizon defaults set by `setTheme('sap_horizon')` at `src/main.tsx:8`.

**Source-inspection finding (PR5, 2026-04-26)**: the SAP Horizon defaults are remarkably aligned with the new PETROS token system. Verified against `node_modules/@sap-theming/theming-base-content/.../sap_horizon/css_variables.css`:

| SAP Horizon variable | Default | PETROS token | Status |
|---|---|---|---|
| `--sapFontFamily` | `"72", "72full", Arial, ...` | `--font-sans` | match (post-PR1) |
| `--sapFontSize` | 14px | `--text-body` | match |
| `--sapFontSmallSize` | 12px | `--text-numeric` | match |
| `--sapFontLargeSize` | 16px | `--text-subtitle` | match |
| `--sapFontHeader6Size` | 14px | `--text-body` | match |
| `--sapFontHeader5Size` | 16px | `--text-subtitle` | match |
| `--sapFontHeader4Size` | 20px | `--text-title` | match |
| `--sapFontHeader3Size` | 24px | `--text-display` | match |
| `--sapFontHeader2Size` | 32px | (no token) | not used in this app |
| `--sapFontHeader1Size` | 48px | (no token) | not used in this app |

**Source-review claim rejected**: the audit asserted `ui5-popup-header-text` renders at 11px / 500 (modal-title-smaller-than-body inversion). This is contradicted by `node_modules/@ui5/webcomponents/dist/css/themes/PopupsCommon.css`:

```css
.ui5-popup-header-root .ui5-popup-header-text {
  font-size: var(--sapFontHeader5Size);  /* = 16px in sap_horizon */
}
```

Dialog headers render at 16px by default — already matching `--text-subtitle`. No override needed.

**Other source-review claims still NOT verified** by source inspection alone (require runtime measurement — see `scripts/typography-probe.mjs`):
- `ui5-button` "Recalculate All" rendering in `72-SemiboldDuplex` (a font family slip-through)
- `ui5-tag` chips rendering in `72-Bold`
- Per-page sub-11px text-node counts (144 on Settings, 156 on Data Sources, etc.) — many of these have already been resolved by PR4 since the offending sub-12px arbitrary classes are migrated.

**PR5 deliverables (shipped)**:
- Documentation block in `src/index.css` (preceding `ui5-input` selector) recording the SAP-default → PETROS-token alignment table.
- `scripts/typography-probe.mjs` — a Playwright probe that visits each page, walks every visible text node, flags any rendered text below 11px or off-token, and inspects computed `font-family/size/weight` on UI5 components plus the dialog header (in shadow DOM). Output: `typography-probe/report.json`. Run with `node scripts/typography-probe.mjs` while `npm run dev` is up.
- **No CSS overrides shipped** because source inspection shows none are needed. Targeted overrides should only be added if the probe reports a UI5 component rendering at an unexpected size — and only for that specific variable.

### S12. Font loading: IBM Plex Sans is shipped but never wins the cascade

- `index.html:11` loads `IBM Plex Sans:wght@400;500;600;700` via Google Fonts.
- `src/index.css:37,84` declares the cascade as `"72", "72full", "IBM Plex Sans", Arial, Helvetica, sans-serif !important`.
- `72` always resolves first (loaded by UI5 Assets bundle, served from `cdn.jsdelivr.net` per the CSP fix recorded in S1's browser-session findings), so `IBM Plex Sans` never renders.

**Fix direction**: drop `IBM Plex Sans` from both the Google Fonts URL and the `--font-sans` fallback chain. Keep `IBM Plex Mono` (it is genuinely used via `font-data`). Net effect: smaller font payload, no behavioural change.

### Demo-blocker shortlist additions

- [ ] **P0** — Pill `xs` size at 9px (S10). Used for persona/role tags (`ANALYST/REVIEWER/APPROVER`), regime tags, status chips. Sub-12px breaches Fiori legibility floor; raise to 10–11px in `Pill.tsx:40`.
- [ ] **P0** — KpiCard character-count-driven sizing (`KpiCard.tsx:39`). Replace with a single `display` size token; the audit's "20 vs 24 px across pages" inconsistency is a direct consequence of this branch.
- [ ] **P1** — UI5 dialog header size unverified but plausibly inverted vs body (S11). Run a 30-min Playwright session that calls `getComputedStyle()` on `ui5-dialog` header / body / footer to confirm before authoring overrides.

### Per-component typography findings (verified)

#### Pill (`src/components/shared/Pill.tsx`)
- [x] **P0** :40 — `xs` raised from `text-[9px]` to `text-caption` (11px). Affects RoleBadge across every page where personas appear, plus the "You" marker on DataEntryPage. xs retains uppercase + semibold + tracking-wider, so the role distinction from `sm` (mixed-case 500 chip) is preserved. (PR3)
- [x] **P1** :41 — `sm` raised from `text-[10px]` to `text-caption` (11px) by the PR4 codemod. Still mixed-case `font-medium` so the visual role differs from `xs` only by case + weight, not size. (PR4)

#### KpiCard (`src/components/shared/KpiCard.tsx`)
- [x] **P0** :39 — Character-count-driven size branch removed; replaced with single `text-display` (24px) token + `truncate` + `min-w-0` + `title={value}` for long-value hover discovery. KPI numerics now render at the same size on Dashboard/Economics/Portfolio/Audit Trail (resolves the cross-page 24/20px discrepancy). (PR2)

#### ConnectionCard (`src/components/shared/ConnectionCard.tsx`)
- [x] **P1** :115,142,148,152 — `text-[9px]` definition-list labels (Endpoint / Last sync / Data scope / status chip) migrated to `text-caption`. (PR4)

#### S4HanaIntegrationPanel (`src/components/shared/S4HanaIntegrationPanel.tsx`)
- [x] **P1** :150,156,160 — `text-[9px]` `<dt>` labels (Sample columns / Volume estimate / Last sync) migrated to `text-caption`. (PR4)

#### DataEntryPage (`src/pages/DataEntryPage.tsx`)
- [x] **P2** :392 — `text-[9px]` inside the step-counter avatar migrated to `text-caption`. The 20×20px circle now has slightly tighter content fit (~1px reduction in headroom); acceptable. (PR4)
- [x] **P1** :465 — `text-[9px]` amber attention copy migrated to `text-caption`. (PR4)

### Remediation roadmap

Sequenced so each PR is reviewable on its own and bisectable.

- **PR1** — token scaffold + font-stack purge.
  - Extend `@theme` block in `src/index.css` with semantic typography tokens (caption / body / body-strong / subtitle / title / display + numeric variants with `tnum`).
  - Drop `IBM Plex Sans` from `index.html` Google Fonts URL and from `--font-sans` fallback chain (S12).
  - **No call-site migration in PR1** — scaffold only. Existing `text-xs|sm|[Npx]` continues to render unchanged.
- **PR2** — KpiCard fix (S9 root cause). Replace character-count branch with single `display` token (24px — matches dominant `sm:text-2xl` rendering today; chosen over 28px to avoid regressing the 4-column dashboard grid at 1024–1280px). Audit Trail's 20px outlier unifies upward. Long values handled via `truncate` + `title={value}` for hover discovery.
- **PR3** — Pill `xs` floor raise (S10). Touches every persona/regime/status chip in one place.
- **PR4** — Migrate `text-[9|10|11]px` call sites in `ConnectionCard`, `S4HanaIntegrationPanel`, `DataEntryPage`, and the per-page `text-[Npx]` consumers to semantic tokens. **Shipped**: 231 occurrences across 38 files migrated to `text-caption` (11px). 9px and 10px sites raised; 11px sites unchanged in size, just renamed. Pill `sm` also bumped 10→11px in this pass. Lint + build + 497 tests green.
- **PR5** — UI5 typography overrides (S11). **Shipped**: source-inspection found that SAP Horizon defaults already match the new PETROS tokens at every level used by this app (body / numeric / subtitle / title / display all align). The audit's specific claim that dialog headers render at 11px was rejected by reading `node_modules/@ui5/webcomponents/dist/css/themes/PopupsCommon.css` (`--sapFontHeader5Size` = 16px). Deliverables: (a) alignment-table doc block in `src/index.css`, (b) `scripts/typography-probe.mjs` runtime probe for the remaining unverified claims. **No overrides shipped** — none are needed per source.
- **PR6** — Codemod `text-sm` to semantic tokens + ESLint rule banning `text-\[\d+px\]`. **Shipped**: 26 occurrences of `text-sm` migrated to `text-body` (zero visual change — both 14px). Added `no-restricted-syntax` rule with two selectors (Literal and TemplateElement) that catches both `className="text-[10px]"` and template-literal usage. Verified the rule fires on a synthetic violation with the expected error message. **Not in scope**: `text-xs` (169 occurrences) was left in place — it's context-dependent (some uses should become `text-numeric`, others `text-caption`), so a blind codemod would mis-tag intent. Migrate case-by-case in future work.
- **PR7** — Visual-regression scaffold (Playwright snapshots) per page × viewport. **Shipped** as scaffold (capture half only, no in-tree pixel diff): `scripts/typography-snapshots.mjs` + npm scripts `test:snapshots` (current capture) and `test:snapshots:baseline` (baseline capture). Workflow: capture baseline once after typography stabilises, commit `tests-e2e/snapshots/baseline/`, run `test:snapshots` in CI/locally, diff with ImageMagick `compare` or any image viewer. Owner work to curate. Rationale for not shipping in-tree pixel diff: PNG byte equality is too strict (anti-aliasing across machines triggers false positives), and a fuzzy diff would need a real lib like `pixelmatch`. Document the manual workflow instead.

PRs 1–4 are mechanical and low-risk. PR5 is the most visible and the most likely to surface unexpected UI5 cascade issues — schedule it after PR1 lands and is observed on Vercel.

### Tracking convention specific to this section

The Tailwind v4 detail matters for anyone fixing these: tokens go in `src/index.css` `@theme {}`, not a JS config. The repo has no `tailwind.config.ts` and the `@tailwindcss/vite` plugin reads tokens directly from the CSS theme block.


