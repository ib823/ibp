# PETROS IPS POC — Reassessment, September 2026

**Date**: 2026-09-23
**Scope**: the calculation engine (`src/engine/**`), the fiscal and market parameters (`src/data/**`), the pages that present them, the test suite, and the dependency stack.
**Baseline**: commit `34220ba`. Before this work, 503 of 503 tests passed and lint failed with 1 error.
**Outcome**: 538 of 538 tests pass (31 of them new, in `tests/engine/reassessment-2026.test.ts`). The type-check is clean.

This file records:
- what was re-verified against public sources,
- which formula errors were found and fixed,
- how the headline numbers moved as a result,
- what remains a PETROS Phase 1a confirmation item.

It complements `ASSESSMENT.md` and `PETROS_DELTAS.md`, which are dated April 2026.

---

## 1. Fiscal and market parameters re-verified (Sep 2026)

| Item | Before | Now | Source |
|---|---|---|---|
| Deepwater PSC terms | R/C table + 5% "uplift" per tranche, 30 MMstb THV with a 70% supplementary payment (SP), capex cut by 10% | MPM Deepwater R/C PSC term (for awards from June 2018): 6 R/C bands. Cost ceiling 80/80/70/70/60/60% of gross. Oil share 80/70/60/50/50/50 below THV and 60/50/40/40/40/40 above. Gas share 80/80/70/60/50/50 below and 60/60/50/40/40/40 above. THV 300 MMstb oil / 2 Tcf gas. SP claw-back applies only after R/C 1.2 (oil) / 1.4 (gas); its rate is not published, so none is modelled | petronas.com/mpm — `Deepwater-R_C-PSC-Terms.pdf` |
| Deepwater / HPHT incentive | Actual capex reduced by 10% | PITA investment allowance: 60% of qualifying capex, offset against up to 70% of statutory income, over 10 years | PwC Worldwide Tax Summaries, Malaysia (reviewed 16 Jun 2026) |
| EPT | Ceiling 70% of revenue *after* royalty | Ceiling "fixed at 70 per cent of the gross production". Profit share 1.8 − 0.6 × PI (unchanged) | MPM EPT page |
| SFA | Research cess 0.5% | Research cess, training/education and SP are not applicable. The 80% ceiling and 70:30 split are illustrative (not published) | MPM SFA page |
| LLA | Mapped to SFA (cost recovery + split) | Cash payment ≤10% plus an abandonment cess of Y% until the commitment is funded; the contractor keeps the rest. No cost recovery, research cess or SP. PITA 25%, capital allowances within 2 years, no export duty (PSCs signed 2020–2029) | MPM LLA page; PwC |
| Research cess base | 0.5% of gross revenue, deducted before the split | 0.5% of the contractor's cost oil + profit oil; deductible for PITA | MPM; industry sources |
| Sarawak SST | 5% (cited as "Act") | 5%, State Sales Tax Ordinance 1998 (Sarawak), in force 1 Jan 2019. Unchanged in 2026 | MPM "other governing laws"; state 2026 budget |
| Export duty | 10% on liquids | 10% on crude; instrument is now the Customs Duties Order 2025 (P.U.(A) 384/2025) | MPM; PDK 2025 |
| RSC tax | 25% "PITA" | Service fees taxed under ITA 1967 at the corporate rate, 24% | Industry legal commentary; PwC (24% for YA 2026) |
| CCS incentive | 60% ITA **and** 70% Pioneer exemption | **Either** 100% ITA (against up to 100% of statutory income, 10 years) **or** a 70% income exemption (10 years). Applications 2023–2027 | Budget 2023 (BDO); HKTDC |
| Corporate tax | 24% | 24% (YA 2026) | PwC |
| Carbon tax | n/a | Postponed 22 Apr 2026; no rate in law. The carbon price stays a scenario / internal price | The Star, 22 Apr 2026 |
| Brent deck | $65 in 2020, escalated 2%/yr (≈ $73 for 2026) | EIA actuals 2020–25 (2025: $69.14). EIA STEO Sep-2026: $91 (2026), $74 (2027). Then $70 in 2027 money escalated at 2% | EIA RBRTE; EIA STEO Sep 2026 |
| USD/MYR | 4.50 | 4.07 (mid-Sep 2026 market rate) | Market data |
| SRMS | Mixed "2017"/"2025" | SPE SRMS 2025 update, approved Jan 2025 | SPE / JPT |
| IFRS S2 / NSRF | "Bursa-listed from FY2025" | NSRF phasing: FY2025 large Main Market, FY2026 other Main Market, FY2027 ACE and large non-listed. S2 amendments effective 2027 | SC NSRF; IFRS Foundation |

## 2. Formula errors found and fixed

These are grouped by impact. Each fix has a test in `reassessment-2026.test.ts` or an updated one in `formula-audit.test.ts` / `consistency-audit.test.ts`.

**Headline economics**
1. **Equity basis.** Revenue was taken at the equity share but costs at 100%. This mixed bases in every NPV, IRR, profitability index (PI) and government-take figure. Costs are now at the working-interest share everywhere (`workingInterestCosts`). Consolidation no longer applies the equity share a second time.
2. **Tax losses were forfeited.** Losses from before production and at end of field life (including capital allowance in excess of income) now carry forward. PITA has no time limit (`TaxLossPool`).
3. **Sarawak SST.**
   - It was dropped for deepwater, HPHT and LLA regimes (SK-612 showed an SST of 0).
   - It was missing from government take, and the waterfall showed it inside "Net Costs".
4. **Supplementary payment.** It applied to 100% of profit share once *any* stream crossed the THV. It now applies per stream to the above-THV fraction, pro-rated in the year of crossing, as the in-app documentation already described.
5. **RSC.**
   - The 25% tax rate was hard-coded.
   - The performance bonus was reported as a supplementary payment, so it was counted as government take.
6. **CCS.** The ITA and the Pioneer exemption were both applied; they are alternatives.

**Indicators and portfolio**
7. A missing IRR displayed as **0%**. It now shows "n/a", and the search range is extended to 1,000%.
8. **Portfolio NPV added NPVs dated to different years.** Balingian was valued at 2022 including sunk flows. Projects are now re-valued at the 2026 valuation year on forward flows. "Weighted IRR" is replaced by the IRR of the combined portfolio cash flow.
9. **The optimiser** was greedy but claimed to be a knapsack. It is now an exact subset search for up to 20 projects.
10. **Smaller indicator fixes:**
    - Payback returned the field life when the cash position was never negative; it now returns 0.
    - Discounted payback ignored the discount rate that was actually selected.
    - The mid-year convention discounted by an extra half year.
11. **Sensitivity.**
    - The FX tornado bar was always zero, because the economics are in USD.
    - The discount-rate sensitivity was never applied.
    - The spider and scenario charts ignored what-if overrides.
    - Monte Carlo ignored configured fiscal, discount and reserves distributions, and could draw negative multipliers.
12. **The MMscf → MMBtu display factor** was 1.055; it is 1,055.

**Financial statements (MFRS)**
13. **Income statement.**
    - Revenue was gross revenue less royalty only.
    - It is now contractor entitlement (MFRS 15), with the research cess in cost of sales.
14. **Balance sheet.**
    - It balanced only through a "reconciliation" plug, as large as −$3.2bn.
    - It now balances by construction from shared drivers (`accounting-drivers.ts`):
      - DD&A starts at first production and excludes E&E;
      - the decommissioning asset is depreciated and its unwinding goes to finance cost;
      - deferred tax is recognised on assets, the provision and unused losses.
15. **Cash flow statement.** Abandonment was counted twice and closing cash did not match the balance sheet. The net change now equals net cash flow.
16. **Project finance.**
    - The average DSCR included a 99.99 placeholder.
    - Negative DSCRs were hidden.
    - LLCR was overstated by (1+r).
    - Construction years were fixed at 1.
17. **M&A.** The deal IRR left out the target's cash flows; at a fair price it now returns the WACC.
18. **Reserves.** The reconciliation no longer breaks its own identity when production exceeds booked reserves.

## 3. Headline impact (base case)

| Project | Regime | NPV10 before ($M) | NPV10 after ($M) | IRR before | IRR after | Govt take before | Govt take after |
|---|---|---:|---:|---:|---:|---:|---:|
| SK-410 Gas | R/C | 383.9 | 415.6 | 33.3% | 40.8% | 76.3% | 82.5% |
| SK-612 Deepwater | DW | −338.7 | 172.9 | "0%" | 14.4% | 107.9% | 72.7% |
| Balingian | EPT | 179.1 | 232.2 | n/a (MIRR) | 41.5% MIRR | 68.6% | 79.2% |
| Tukau | SFA | 93.2 | 85.4 | 29.7% | 29.2% | 62.0% | 69.6% |
| M3 CCS | CCS | −205.6 | −200.5 | −0.2% | 0.3% | 179.4% | 0.0% |

The portfolio NPV was previously summed across mixed valuation dates. Valued at 2026 it is $589.4M, with a portfolio IRR of 20.0%.

What drives SK-612 is the published deepwater terms: a 300 MMstb THV, no 70% SP cliff, 80% ceilings and the 60% investment allowance. The March–April 2026 price spike (EIA Q2-26 average $103) is reflected only through the 2026 annual figure.

## 4. Behaviour worth knowing

- **R/C "gold-plating" incentive.** Under the illustrative 1997-style R/C table (70/60/50/30/20), a +10% CAPEX case *raises* SK-410 NPV by about $22M. The extra cost keeps the lagged R/C index below the 2.0 boundary for another year, and at that boundary the contractor share drops from 50% to 30%. This is a property of step R/C tables, not a code error. Capex-monotonicity tests therefore use a fixed-split regime. The Deepwater R/C and EPT terms were designed partly to soften this effect.
- The deepwater term keeps separate oil and gas cost banks; the engine uses a single cost pool.
- UoP DD&A uses the larger of booked 2P and the plan's production. The sample PRMS 2P (for example SK-410 at 250 Bcf) is below the modelled production profile.

## 5. Still for PETROS to confirm (Phase 1a)

- **Deal terms:**
  - The supplementary payment rate and trigger in each signed R/C and deepwater PSC (D18).
  - The SFA split and ceiling.
  - The LLA Y% and abandonment cost commitment.
  - Which CCS incentive M3 elects.
- **Tax base questions:**
  - Whether condensate and LNG are subject to export duty under the Customs Duties Order 2025.
  - Whether Sarawak SST applies to pipeline gas sold within Sarawak.
  - Whether Pillar Two domestic top-up tax applies to PETROS (groups ≥ €750M).
- **Planning inputs:** the corporate price deck (D60), the Bank Negara FX reference window (D4), and the booked-reserves basis for UoP.

## 6. Dependencies

See the dependency-upgrade commit on this branch for the before and after version table and the `npm audit` result.
