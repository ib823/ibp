// ════════════════════════════════════════════════════════════════════════
// Chart Colors — single source of truth for SVG / Recharts fills & strokes
//
// Why: prior to centralization, charts used inline hex literals (#3B8DBD,
// #E07060, #8B5CF6, etc.) some of which were off-palette. Tokenizing
// here makes palette changes ripple correctly and lets the audit
// scorecard track palette adherence.
//
// Note: hex literals (not CSS variables). SVG fill/stroke attributes
// accept var() in modern browsers but the support matrix is uneven and
// jsdom-based tests break. Tailwind classes (bg-petrol, text-success)
// still pick up the SAP Horizon theme bridge in index.css.
// ════════════════════════════════════════════════════════════════════════

import type { SensitivityVariable } from '@/engine/types';

/** PETROS design palette — semantic colors. */
export const COLORS = {
  // Brand
  petrol: '#1E3A5F',
  petrolLight: '#254A78',
  navy: '#0A1628',

  // Accent
  amber: '#D4A843',
  amberLight: '#E8C668',

  // Semantic
  success: '#2D8A4E',
  danger: '#C0392B',
  admin: '#6B46C1', // role-distinct purple, tokenized as --color-admin

  // Text & surfaces
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E2E5EA',
  contentAlt: '#F0F2F5',

  // Chart-specific semantic uses
  chartGrid: '#E2E5EA',           // = border
  chartAxis: '#6B7280',            // = textSecondary
  chartAxisLabel: '#9CA3AF',       // = textMuted
  chartReference: '#9CA3AF',       // dashed reference lines
  chartZero: '#9CA3AF',            // y=0 / x=0 lines
  chartBaseLine: '#1A1A2E',        // emphasized base lines
} as const;

/** Tornado / sensitivity directional colors. */
export const CHART_NEG = COLORS.danger;
export const CHART_POS = COLORS.petrol;

/**
 * Categorical 5-color series — for portfolio production overlays,
 * multi-line variable comparisons, and any chart where you need
 * up to 5 visually distinct ordered colors.
 */
export const CHART_CATEGORICAL: readonly string[] = [
  COLORS.petrol,
  COLORS.success,
  COLORS.amber,
  COLORS.danger,
  COLORS.admin,
];

/** Sensitivity variable → consistent color across all charts.
 *  Phase 1+ classic IOC variables; later additions reuse the palette. */
export const VARIABLE_COLORS: Record<SensitivityVariable, string> = {
  oilPrice: COLORS.success,
  gasPrice: COLORS.petrol,
  production: COLORS.amber,
  capex: COLORS.danger,
  opex: COLORS.admin,
  fx: '#0EA5E9',          // sky — Bank Negara reference rate (D4/D36)
  discountRate: '#8B5CF6', // violet — WACC-style (D38)
  pitaRate: '#EF4444',     // red — fiscal pressure (D38)
  royaltyRate: '#F59E0B',  // amber-strong — fiscal floor
  sarawakSstRate: '#84CC16', // lime — Sarawak-specific (D1)
  reserves: '#06B6D4',     // teal — PRMS uncertainty (D40)
};

/** Business sector → color (used in HierarchyBar). */
export const SECTOR_COLORS: Record<string, string> = {
  Upstream: COLORS.petrol,
  'Downstream & Infrastructure': COLORS.amber,
  CCS: COLORS.success,
};

/** Scenario → color (high/base/low/stress). */
export const SCENARIO_COLORS = {
  high: COLORS.success,
  base: COLORS.petrol,
  low: COLORS.amber,
  stress: COLORS.danger,
} as const;

/**
 * Phase-comparison fixed pair (phase 1 = before, phase 2 = after).
 * Consistent with version comparison so visual reads the same.
 */
export const PHASE_COLORS = {
  before: COLORS.petrolLight, // dashed area: phase 1
  after: COLORS.petrol,       // solid area: phase 2
} as const;

/**
 * Production-area chart fills + strokes.
 * Replaces inline #1B5E20 / #1565C0 (off-palette deep tones) used
 * previously for production area chart "stroke darker than fill" effect.
 */
export const PRODUCTION_COLORS = {
  oilStroke: COLORS.success,
  oilFill: COLORS.success,
  gasStroke: COLORS.petrol,
  gasFill: COLORS.petrol,
  condensateStroke: COLORS.amber,
  condensateFill: COLORS.amber,
} as const;

/**
 * Waterfall multi-cut sequence — for financial waterfalls with multiple
 * cost categories. Uses semantic palette where possible; the warm
 * gradient (orange→amber→red) for cumulative cuts mirrors PETROS reports.
 */
export const WATERFALL_NEG_SEQUENCE: readonly string[] = [
  COLORS.danger,
  '#D35400', // burnt orange — used only for sequential additional cuts
  '#E67E22', // amber-orange
  '#E74C3C', // red-orange
  '#8B4513', // saddle brown — last-resort 5th tier
];
