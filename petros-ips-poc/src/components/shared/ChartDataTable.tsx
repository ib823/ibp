// ════════════════════════════════════════════════════════════════════════
// ChartDataTable — screen-reader-only tabular fallback for chart data
//
// Charts are rendered as SVG which is opaque to assistive technology.
// WCAG 2.1 AA § 1.1.1 (Non-text Content) and § 1.3.1 (Info &
// Relationships) require a text alternative that conveys the same
// information. Including a <table> with row/column headers lets screen
// readers navigate the data naturally.
//
// Usage:
//   <div className="relative">
//     <MyChart data={...} />
//     <ChartDataTable caption="..." columns={[...]} rows={[...]} />
//   </div>
//
// The table is visually hidden via `sr-only` but exposed to AT. A
// `toggle` prop renders a small "View data table" button for sighted
// keyboard users who prefer tabular data.
// ════════════════════════════════════════════════════════════════════════

import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ChartDataColumn {
  /** Display name shown as column header */
  readonly label: string;
  /** Optional unit suffix rendered inline in the header (e.g. "USD M") */
  readonly unit?: string;
}

interface ChartDataTableProps {
  caption: string;
  columns: readonly ChartDataColumn[];
  /** Row data — each inner array must match columns in length and order */
  rows: readonly (string | number)[][];
  /** When true, renders a toggleable visible table for sighted users */
  toggle?: boolean;
  className?: string;
}

export function ChartDataTable({ caption, columns, rows, toggle = false, className }: ChartDataTableProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const visible = toggle && open;

  return (
    <>
      {toggle && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-table`}
          className="text-[10px] text-text-muted hover:text-petrol focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol underline decoration-dotted underline-offset-2"
        >
          {open ? 'Hide data table' : 'View data table'}
        </button>
      )}
      <div id={`${id}-table`} className={cn(visible ? 'mt-2' : 'sr-only', className)}>
        <table className="w-full text-xs border-collapse tabular-nums">
          <caption className={cn(visible ? 'text-left text-[10px] text-text-muted mb-1' : 'sr-only')}>
            {caption}
          </caption>
          <thead>
            <tr className="border-b border-border bg-content-alt text-text-secondary">
              {columns.map((c, i) => (
                <th key={i} scope="col" className="text-left px-2 py-1 font-semibold">
                  {c.label}{c.unit ? ` (${c.unit})` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-border/30">
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn('px-2 py-1', ci === 0 ? 'text-text-primary font-medium' : 'text-right font-data')}
                    scope={ci === 0 ? 'row' : undefined}
                  >
                    {typeof cell === 'number' ? cell.toLocaleString('en-US', { maximumFractionDigits: 2 }) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
