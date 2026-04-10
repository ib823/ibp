import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FinancialRow {
  label: string;
  values: number[];
  isSubtotal?: boolean;
  isTotal?: boolean;
}

interface FinancialTableProps {
  years: number[];
  rows: FinancialRow[];
}

function fmtCell(value: number): string {
  const m = value / 1e6;
  if (Math.abs(m) < 0.05) return '-';
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

export function FinancialTable({ years, rows }: FinancialTableProps) {
  return (
    <ScrollArea className="w-full">
      <div className="min-w-max">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-content-alt">
              <th className="text-left text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-3 py-1.5 sticky left-0 bg-content-alt w-[180px] min-w-[180px]">
                $M
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
                  {row.label}
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
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
