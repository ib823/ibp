import type { PriceDeck, USD, TimeSeriesData, ScenarioVersion } from '@/engine/types';

// ── Helpers ───────────────────────────────────────────────────────────

const START_YEAR = 2020;
const END_YEAR = 2055;

function usd(n: number): USD {
  return n as USD;
}

function buildSeries(
  startPrice: number,
  annualEscalation: number,
): TimeSeriesData<USD> {
  const series: Record<number, USD> = {};
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    series[y] = usd(
      Math.round(startPrice * Math.pow(1 + annualEscalation, y - START_YEAR) * 100) / 100,
    );
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
      series[y] = usd(Math.round(oilPrice * 0.85 * 100) / 100);
    }
  }
  return series;
}

// ── Price Decks ───────────────────────────────────────────────────────

const baseOil = buildSeries(65, 0.02);

export const BASE_PRICE_DECK: PriceDeck = {
  oil: baseOil,
  gas: buildSeries(8.50, 0.02),
  condensate: deriveCondensate(baseOil),
  exchangeRate: buildExchangeRateSeries(4.50),
  carbonCredit: buildSeries(25, 0.02),
};

const highOil = buildSeries(80, 0.025);

export const HIGH_PRICE_DECK: PriceDeck = {
  oil: highOil,
  gas: buildSeries(11, 0.025),
  condensate: deriveCondensate(highOil),
  exchangeRate: buildExchangeRateSeries(4.50),
  carbonCredit: buildSeries(50, 0.03), // Carbon markets rally scenario
};

const lowOil = buildSeries(45, 0.015);

export const LOW_PRICE_DECK: PriceDeck = {
  oil: lowOil,
  gas: buildSeries(6, 0.015),
  condensate: deriveCondensate(lowOil),
  exchangeRate: buildExchangeRateSeries(4.50),
  carbonCredit: buildSeries(15, 0.015),
};

const stressOil = buildFlatSeries(35);

export const STRESS_PRICE_DECK: PriceDeck = {
  oil: stressOil,
  gas: buildFlatSeries(4.50),
  condensate: deriveCondensate(stressOil),
  exchangeRate: buildExchangeRateSeries(4.50),
  carbonCredit: buildFlatSeries(5), // Carbon market collapse
};

// ── Lookup ────────────────────────────────────────────────────────────

export const PRICE_DECKS: Record<ScenarioVersion, PriceDeck> = {
  base: BASE_PRICE_DECK,
  high: HIGH_PRICE_DECK,
  low: LOW_PRICE_DECK,
  stress: STRESS_PRICE_DECK,
};
