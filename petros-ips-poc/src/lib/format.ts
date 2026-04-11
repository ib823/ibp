// ════════════════════════════════════════════════════════════════════════
// Number formatting utilities
// ════════════════════════════════════════════════════════════════════════
//
// All currency / unit display goes through `useDisplayUnits()` in
// `./useDisplayUnits.ts`, which binds the formatters below to the live
// Zustand state. Consumers should never call these directly for
// unit-bearing values — use the hook.
//
// Unitless helpers (`fmtPct`, `fmtNum`, `fmtYears`) are plain exports and
// can be imported anywhere.
// ════════════════════════════════════════════════════════════════════════

import type { UnitConversion } from '@/engine/types';
import { CURRENCY_SYMBOLS, convertSafe, normalizeZero } from '@/lib/display-units';

// ── Unitless helpers ───────────────────────────────────────────────────

/** Format percentage: 0.1524 → "15.2%" */
export function fmtPct(value: number, decimals: number = 1): string {
  return (value * 100).toFixed(decimals) + '%';
}

/** Format number with commas */
export function fmtNum(value: number, decimals: number = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format years: 5.4 → "5.4" */
export function fmtYears(value: number): string {
  return value.toFixed(1);
}

// ════════════════════════════════════════════════════════════════════════
// NEW FORMATTERS — currency/unit aware
// ════════════════════════════════════════════════════════════════════════

const DEFAULT_FALLBACK = '—';

function isRenderable(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

function formatWithDecimals(v: number, decimals: number): string {
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ── Currency ───────────────────────────────────────────────────────────

export interface MoneyOpts {
  currency: string;
  conversions: readonly UnitConversion[];
  /** Magnitude suffix. Default 'M'. Never auto-selected. */
  suffix?: 'M' | 'B' | '';
  /** Wrap negatives in parentheses instead of prefixing with '-'. */
  accounting?: boolean;
  /** Returned when value is null/undefined/NaN/±Infinity. Default '—'. */
  fallback?: string;
  /** Decimals shown. Default 1. */
  decimals?: number;
}

const SUFFIX_DIVISORS: Record<'M' | 'B' | '', number> = {
  M: 1_000_000,
  B: 1_000_000_000,
  '': 1,
};

/**
 * Format a raw base-currency (USD) amount as a display string honoring
 * the user's currency preference and the live conversion table.
 *
 * `value` is ALWAYS raw dollars. Callers that previously pre-divided by
 * 1e6 must stop — the suffix `'M'` handles that division here.
 */
export function formatMoney(value: number | null | undefined, opts: MoneyOpts): string {
  const fallback = opts.fallback ?? DEFAULT_FALLBACK;
  if (!isRenderable(value)) return fallback;

  const suffix = opts.suffix ?? 'M';
  const decimals = opts.decimals ?? 1;

  const converted = convertSafe(value, 'USD', opts.currency, opts.conversions);
  const scaled = normalizeZero(converted / SUFFIX_DIVISORS[suffix]);

  const symbol = CURRENCY_SYMBOLS[opts.currency] ?? opts.currency;
  // Multi-char codes (e.g. 'MYR' when no symbol configured) render with a
  // space between the code and the number so the result reads naturally.
  const prefix = symbol.length <= 1 ? symbol : `${symbol} `;

  if (scaled < 0) {
    const body = `${prefix}${formatWithDecimals(Math.abs(scaled), decimals)}${suffix}`;
    return opts.accounting ? `(${body})` : `-${body}`;
  }
  return `${prefix}${formatWithDecimals(scaled, decimals)}${suffix}`;
}

// ── Volume / rate / energy / mass ──────────────────────────────────────

export type UnitScale = '' | 'k' | 'M' | 'MM' | 'B';

const SCALE_DIVISORS: Record<UnitScale, number> = {
  '':  1,
  k:   1_000,
  M:   1_000_000,
  MM:  1_000_000,   // petroleum convention: MM = 10⁶
  B:   1_000_000_000,
};

const SCALE_PREFIX: Record<UnitScale, string> = {
  '':  '',
  k:   'k',
  M:   'M',
  MM:  'MM',
  B:   'B',
};

export interface UnitOpts {
  unit: string;
  conversions: readonly UnitConversion[];
  scale?: UnitScale;
  decimals?: number;
  fallback?: string;
}

function formatUnitValue(
  value: number | null | undefined,
  baseUnit: string,
  opts: UnitOpts,
): string {
  const fallback = opts.fallback ?? DEFAULT_FALLBACK;
  if (!isRenderable(value)) return fallback;

  const scale = opts.scale ?? '';
  const decimals = opts.decimals ?? 1;

  const converted = convertSafe(value, baseUnit, opts.unit, opts.conversions);
  const scaled = normalizeZero(converted / SCALE_DIVISORS[scale]);

  const prefix = SCALE_PREFIX[scale];
  const unitLabel = prefix ? `${prefix}${opts.unit}` : opts.unit;
  // Tiny gap so "180 MMbbl" reads cleanly; avoids "180MMbbl" crush.
  return `${formatWithDecimals(scaled, decimals)} ${unitLabel}`;
}

/** Base: bbl. */
export function formatOilVolume(value: number | null | undefined, opts: UnitOpts): string {
  return formatUnitValue(value, 'bbl', opts);
}

/** Base: bpd. Oil volume unit applies per-day (same factor table). */
export function formatOilRate(value: number | null | undefined, opts: UnitOpts): string {
  const fallback = opts.fallback ?? DEFAULT_FALLBACK;
  if (!isRenderable(value)) return fallback;
  const decimals = opts.decimals ?? 0;
  const converted = convertSafe(value, 'bbl', opts.unit, opts.conversions);
  const scaled = normalizeZero(converted / SCALE_DIVISORS[opts.scale ?? '']);
  const prefix = SCALE_PREFIX[opts.scale ?? ''];
  const unitLabel = prefix ? `${prefix}${opts.unit}/d` : `${opts.unit}/d`;
  return `${formatWithDecimals(scaled, decimals)} ${unitLabel}`;
}

/** Base: MMscf. */
export function formatGasVolume(value: number | null | undefined, opts: UnitOpts): string {
  return formatUnitValue(value, 'MMscf', opts);
}

/** Base: MMscfd. Gas volume unit applies per-day. */
export function formatGasRate(value: number | null | undefined, opts: UnitOpts): string {
  const fallback = opts.fallback ?? DEFAULT_FALLBACK;
  if (!isRenderable(value)) return fallback;
  const decimals = opts.decimals ?? 1;
  const converted = convertSafe(value, 'MMscf', opts.unit, opts.conversions);
  const scaled = normalizeZero(converted / SCALE_DIVISORS[opts.scale ?? '']);
  const prefix = SCALE_PREFIX[opts.scale ?? ''];
  const unitLabel = prefix ? `${prefix}${opts.unit}/d` : `${opts.unit}/d`;
  return `${formatWithDecimals(scaled, decimals)} ${unitLabel}`;
}

/** Base: MMBtu. */
export function formatEnergy(value: number | null | undefined, opts: UnitOpts): string {
  return formatUnitValue(value, 'MMBtu', opts);
}

/** Base: tonne. */
export function formatMass(value: number | null | undefined, opts: UnitOpts): string {
  return formatUnitValue(value, 'tonne', opts);
}

// ── Price labels ───────────────────────────────────────────────────────

export interface GasPriceOpts {
  energy: string;
  conversions: readonly UnitConversion[];
  currency?: string;
  decimals?: number;
}

/**
 * Convert a `$/MMBtu` price into the user's preferred energy unit.
 * Example: `formatPricePerUnit(8, { energy: 'GJ', conversions, currency: 'USD' })` → `$7.58/GJ`.
 *
 * The conversion is inverted: if 1 MMBtu = 1.05506 GJ, then
 * `$/GJ = ($/MMBtu) / (GJ per MMBtu) = ($/MMBtu) / 1.05506`.
 */
export function formatPricePerUnit(
  valuePerMMBtu: number | null | undefined,
  opts: GasPriceOpts,
): string {
  if (!isRenderable(valuePerMMBtu)) return '—';
  const decimals = opts.decimals ?? 2;
  const gjPerMMBtu = convertSafe(1, 'MMBtu', opts.energy, opts.conversions);
  const priceInDisplay = valuePerMMBtu / gjPerMMBtu;
  const currency = opts.currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const prefix = symbol.length <= 1 ? symbol : `${symbol} `;
  return `${prefix}${formatWithDecimals(priceInDisplay, decimals)}/${opts.energy}`;
}

export interface OilPriceOpts {
  oilVolume: string;
  conversions: readonly UnitConversion[];
  currency?: string;
  decimals?: number;
}

/**
 * Convert a `$/bbl` price into the user's preferred oil volume unit.
 * Example: `formatOilPricePerUnit(80, { oilVolume: 'm³', conversions, currency: 'USD' })`
 * → `$503.19/m³` (80 / 0.158987).
 */
export function formatOilPricePerUnit(
  valuePerBbl: number | null | undefined,
  opts: OilPriceOpts,
): string {
  if (!isRenderable(valuePerBbl)) return '—';
  const decimals = opts.decimals ?? 2;
  const unitPerBbl = convertSafe(1, 'bbl', opts.oilVolume, opts.conversions);
  const priceInDisplay = valuePerBbl / unitPerBbl;
  const currency = opts.currency ?? 'USD';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const prefix = symbol.length <= 1 ? symbol : `${symbol} `;
  return `${prefix}${formatWithDecimals(priceInDisplay, decimals)}/${opts.oilVolume}`;
}
