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

- [ ] **MC P10/P90 KpiCard border colors don't follow SPE convention toggle** — when toggle is on, red-bordered card means "optimistic". Petrotech evaluator will pause. (`MonteCarloPage.tsx:318-334`)
- [ ] **HierarchyBar narrow projects show no label and have no aria-label** — projects <15% portfolio share are nameless. (`HierarchyBar.tsx:43,91`)
- [x] **Tornado / Spider / Histogram off-palette colors** — replaced `#E07060` / `#3B8DBD` with `CHART_NEG` / `CHART_POS` (petrol/danger).
- [ ] **GovernmentTakeChart cap mismatch** — donut caps at 100%, center label still shows raw 115%. (`GovernmentTakeChart.tsx:20-30`)
- [ ] **FinancialPage amber-on-amber warning box fails contrast** — text-amber on bg-amber/5, ~3:1 on display. (`FinancialPage.tsx:169`)
- [ ] **ScenarioKpiTable hardcoded scenario order crashes on missing key** — `.map()` on undefined if backend ever omits one. (`SensitivityPage.tsx:269`)
- [ ] **EconomicsPage PI format inconsistency** — `.toFixed(2)` while every other metric uses `u.money()`. (`EconomicsPage.tsx:149`)
- [x] **PortfolioPage "Calculating portfolio…" with no spinner** — now uses `<LoadingState />` with spinner.
- [ ] **MC distribution labels `Tri / LN / Norm`** — evaluator-unfriendly abbreviations. (`MonteCarloPage.tsx:189-193`)
- [x] **RoleBadge admin uses `#8B5CF6` purple — off-palette entirely** — tokenized as `--color-admin: #6B46C1`.
- [ ] **Ui5Input null-coercion** — `value=""` becomes literal "null" / "undefined" if guard fails. (`Ui5Input.tsx:99`)
- [ ] **Reserves Export toasts "available in SAC"** — admits POC is incomplete on a routine action. (`ReservesPage.tsx:74`)
- [ ] **Currency-symbol overflow** — table headers hardcode `({u.currencySymbol}M)`, assume 1-char symbol.
- [ ] **GlossaryPage missing keys on `highlightMatch()` parts** — React warning visible in console. (`GlossaryPage.tsx:114-115`)

### Browser-session-only findings (added 2026-04-25)

- [x] **CSP blocks SAP "72" font** — `index.html` font-src didn't include `cdn.jsdelivr.net`; SAP fonts silently failed across all 11 pages × 3 viewports (36 console errors per page). Now allowed.
- [ ] **GuidedTour auto-opens on first visit and obscures content** — design intent (good for unfamiliar evaluators) but a fresh viewer's first impression is a 12-step modal blocking the dashboard. Consider 2-3s delay or "Take the tour" CTA. (See task #14.)
- [ ] **Mobile (320px) hides the persona switcher** — header user menu disappears; persona switcher inaccessible. Switcher is now a first-class feature, must work on mobile. (See task #15.)
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
**Last updated**: 2026-04-25
