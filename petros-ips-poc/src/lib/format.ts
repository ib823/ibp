// ════════════════════════════════════════════════════════════════════════
// Number formatting utilities
// ════════════════════════════════════════════════════════════════════════

/** Format USD millions: 1234567890 → "1,234.6" */
export function fmtM(value: number): string {
  const millions = value / 1_000_000;
  if (Math.abs(millions) >= 1000) {
    return (millions / 1000).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + 'B';
  }
  return millions.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Format as $M with sign */
export function fmtDollarM(value: number): string {
  const m = value / 1_000_000;
  const prefix = m < 0 ? '-$' : '$';
  return prefix + Math.abs(m).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + 'M';
}

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

/** Format accounting style: negative in parentheses */
export function fmtAccounting(value: number): string {
  const m = value / 1_000_000;
  if (m < 0) {
    return '(' + Math.abs(m).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + ')';
  }
  return m.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
