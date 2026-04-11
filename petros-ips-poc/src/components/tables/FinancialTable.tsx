import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { getEntry } from '@/lib/educational-content';
import { useDisplayUnits } from '@/lib/useDisplayUnits';

export interface FinancialRow {
  label: string;
  values: number[];
  isSubtotal?: boolean;
  isTotal?: boolean;
  eduEntryId?: string;
}

interface FinancialTableProps {
  years: number[];
  rows: FinancialRow[];
}

function makeCellFormatter(currencyFactor: number): (value: number) => string {
  return (value: number) => {
    const m = (value * currencyFactor) / 1e6;
    const normalized = m === 0 ? 0 : m;
    if (Math.abs(normalized) < 0.05) return '-';
    if (normalized < 0) {
      return '(' + Math.abs(normalized).toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + ')';
    }
    return normalized.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };
}

function RowLabel({ label, eduEntryId }: { label: string; eduEntryId?: string }) {
  if (!eduEntryId) return <>{label}</>;

  const entry = getEntry(eduEntryId);
  if (!entry) return <>{label}</>;

  const hasInfo = entry.infoPanel != null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {entry.tooltip ? (
        <EduTooltip entry={entry}><span className="cursor-help">{label}</span></EduTooltip>
      ) : (
        label
      )}
      {hasInfo && <InfoIcon entry={entry} size={10} className="w-3.5 h-3.5" />}
    </span>
  );
}

export function FinancialTable({ years, rows }: FinancialTableProps) {
  const u = useDisplayUnits();
  const fmtCell = useMemo(() => makeCellFormatter(u.currencyFactor), [u.currencyFactor]);

  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-max">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 py-1.5 sticky left-0 bg-content-alt w-[180px] min-w-[180px]">
                {u.currencySymbol}M
              </th>
              {years.map((y) => (
                <th
                  key={y}
                  className="text-right text-[10px] font-semibold text-text-secondary px-2 py-1.5 min-w-[72px]"
                >
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={cn(
                  'border-b border-border/30',
                  row.isSubtotal && 'border-t border-border bg-content-alt/50',
                  row.isTotal && 'border-t-2 border-t-border bg-content-alt font-semibold',
                )}
              >
                <td
                  className={cn(
                    'px-3 py-1 text-text-secondary sticky left-0 bg-white',
                    (row.isSubtotal || row.isTotal) && 'font-semibold text-text-primary bg-content-alt/50',
                    row.isTotal && 'bg-content-alt',
                  )}
                >
                  <RowLabel label={row.label} eduEntryId={row.eduEntryId} />
                </td>
                {row.values.map((v, vi) => (
                  <td
                    key={vi}
                    className={cn(
                      'text-right font-data px-2 py-1',
                      v < 0 && 'text-danger',
                      (row.isSubtotal || row.isTotal) && 'font-medium',
                    )}
                  >
                    {fmtCell(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
