# PETROS IPS — Proof of Concept

Integrated Planning System proof of concept for PETROS (Tender T260002): petroleum economics under Malaysian fiscal regimes, financial statements, sensitivity / Monte Carlo, reserves (SPE PRMS / SRMS) and portfolio views. React 19 + TypeScript + Vite; the production system is planned on SAP Analytics Cloud (see `SAC_MAPPING.md`).

All fiscal parameters, production profiles and project data are illustrative (see `NOTICE`).

## Run

```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # vitest — engine, lib, store and UI tests
npm run build      # type-check + production build
npm run lint
```

## Where the logic lives

| Area | Path |
|---|---|
| Fiscal engines (R/C, Deepwater R/C, HPHT, EPT, SFA, LLA, 1976/1985, RSC, downstream/CCS) | `src/engine/fiscal/` |
| Fiscal regime parameters and sources | `src/data/fiscal-regimes.ts` |
| Price decks (EIA actuals + STEO) and FX | `src/data/price-decks.ts`, `src/engine/utils/unit-conversion.ts` |
| NPV / IRR / MIRR / indicators / portfolio valuation year | `src/engine/economics/` |
| Financial statements (MFRS 6/15/16/107/112/116/137) | `src/engine/financial/` (`accounting-drivers.ts` is the shared source) |
| Sensitivity, Monte Carlo | `src/engine/sensitivity/`, `src/engine/montecarlo/` |
| Reserves, portfolio | `src/engine/reserves/`, `src/engine/portfolio/` |

## Conventions

- Money is USD; project economics are on PETROS's working-interest (equity) basis for both revenue and costs. Volumes are 100% field basis.
- NPV discounts to the first project year (end-of-year convention). Portfolio totals re-value every project at the 2026 valuation year on forward cash flows.
- Tax losses and unabsorbed capital allowances are carried forward.

## Reviews and records

- `REASSESSMENT_2026-09.md` — September 2026 formula and parameter reassessment (latest)
- `ASSESSMENT.md`, `PETROS_DELTAS.md` — April 2026 RFP assessment and PETROS-specific deltas
- `AUDIT.md` — UI/UX audit; `SAC_MAPPING.md` — SAC translation
