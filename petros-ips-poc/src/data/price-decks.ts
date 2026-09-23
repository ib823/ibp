// ════════════════════════════════════════════════════════════════════════
// Price decks — re-anchored September 2026 (D60)
// ════════════════════════════════════════════════════════════════════════
//
// Oil (Brent, USD/bbl)
//   2020–2025  EIA Europe Brent spot FOB annual averages (actuals, identical
//              in every scenario): 41.96, 70.86, 100.93, 82.49, 80.52, 69.14
//   2026       91 — EIA Short-Term Energy Outlook, September 2026 (the year
//              is largely realised, so every scenario uses it)
//   2027       base 74 (EIA STEO Sep 2026); high / low / stress bands
//   2028+      long-term planning assumption escalating from 2027 — base
//              USD 70/bbl in 2027 money at 2% p.a. Illustrative: PETROS to
//              confirm its corporate price deck in Phase 1a.
// Gas (USD/MMBtu) — illustrative contract gas, escalated from 2020; the
//   2026 base (~9.6) sits above the Peninsular regulated reference
//   (RM33–36/MMBtu ≈ USD 8.1–8.8 in 2026) and well below Asian LNG spot.
// Condensate — 85% of Brent.
// FX — USD/MYR REFERENCE_USD_MYR (~4.07, September 2026), flat.
// Carbon (USD/t CO₂) — internal carbon price / CCS storage-fee proxy.
//   Malaysia's carbon tax (announced for 2026) was postponed in April 2026
//   with no rate in law; treat as a scenario input.
// ════════════════════════════════════════════════════════════════════════

import type { PriceDeck, USD, TimeSeriesData, ScenarioVersion } from '@/engine/types';
import { REFERENCE_USD_MYR } from '@/engine/utils/unit-conversion';

// ── Helpers ───────────────────────────────────────────────────────────

const START_YEAR = 2020;
const END_YEAR = 2055;

/** EIA Brent spot annual averages (USD/bbl), actuals. */
const BRENT_ACTUALS: Readonly<Record<number, number>> = {
  2020: 41.96,
  2021: 70.86,
  2022: 100.93,
  2023: 82.49,
  2024: 80.52,
  2025: 69.14,
};

/** EIA STEO (September 2026) Brent forecast for the current year. */
const BRENT_2026 = 91;

function usd(n: number): USD {
  return n as USD;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSeries(
  startPrice: number,
  annualEscalation: number,
): TimeSeriesData<USD> {
  const series: Record<number, USD> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    series[y] = usd(round2(startPrice * Math.pow(1 + annualEscalation, y - START_YEAR)));
  }
  return series;
}

function buildFlatSeries(price: number): TimeSeriesData<USD> {
  const series: Record<number, USD> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    series[y] = usd(price);
  }
  return series;
}

/**
 * Brent series: actuals to 2025, EIA STEO for 2026, then the scenario's
 * 2027 price escalating at `escalation` from a `longTermBase` in 2027 money.
 */
function buildBrentSeries(
  price2027: number,
  longTermBase: number,
  escalation: number,
): TimeSeriesData<USD> {
  const series: Record<number, USD> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const price =
      BRENT_ACTUALS[y] ??
      (y === 2026 ? BRENT_2026
        : y === 2027 ? price2027
          : longTermBase * Math.pow(1 + escalation, y - 2027));
    series[y] = usd(round2(price));
  }
  return series;
}

function buildExchangeRateSeries(rate: number): TimeSeriesData<number> {
  const series: Record<number, number> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    series[y] = rate;
  }
  return series;
}

function deriveCondensate(oilSeries: TimeSeriesData<USD>): TimeSeriesData<USD> {
  const series: Record<number, USD> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    const oilPrice = oilSeries[y];
    if (oilPrice !== undefined) {
      series[y] = usd(round2(oilPrice * 0.85));
    }
  }
  return series;
}

// ── Price Decks ───────────────────────────────────────────────────────

const baseOil = buildBrentSeries(74, 70, 0.02);

export const BASE_PRICE_DECK: PriceDeck = {
  oil: baseOil,
  gas: buildSeries(8.50, 0.02),
  condensate: deriveCondensate(baseOil),
  exchangeRate: buildExchangeRateSeries(REFERENCE_USD_MYR),
  carbonCredit: buildSeries(25, 0.02),
};

const highOil = buildBrentSeries(85, 85, 0.025);

export const HIGH_PRICE_DECK: PriceDeck = {
  oil: highOil,
  gas: buildSeries(11, 0.025),
  condensate: deriveCondensate(highOil),
  exchangeRate: buildExchangeRateSeries(REFERENCE_USD_MYR),
  carbonCredit: buildSeries(50, 0.03), // Carbon markets rally scenario
};

const lowOil = buildBrentSeries(60, 55, 0.015);

export const LOW_PRICE_DECK: PriceDeck = {
  oil: lowOil,
  gas: buildSeries(6, 0.015),
  condensate: deriveCondensate(lowOil),
  exchangeRate: buildExchangeRateSeries(REFERENCE_USD_MYR),
  carbonCredit: buildSeries(15, 0.015),
};

const stressOil = buildBrentSeries(40, 40, 0);

export const STRESS_PRICE_DECK: PriceDeck = {
  oil: stressOil,
  gas: buildFlatSeries(4.50),
  condensate: deriveCondensate(stressOil),
  exchangeRate: buildExchangeRateSeries(REFERENCE_USD_MYR),
  carbonCredit: buildFlatSeries(5), // Carbon market collapse
};

// ── Lookup ────────────────────────────────────────────────────────────

export const PRICE_DECKS: Record<ScenarioVersion, PriceDeck> = {
  base: BASE_PRICE_DECK,
  high: HIGH_PRICE_DECK,
  low: LOW_PRICE_DECK,
  stress: STRESS_PRICE_DECK,
};
