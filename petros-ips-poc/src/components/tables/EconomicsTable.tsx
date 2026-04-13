import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { YearlyCashflow, FiscalRegimeType } from '@/engine/types';
import { useDisplayUnits } from '@/lib/useDisplayUnits';
import { cn } from '@/lib/utils';
import { InfoIcon } from '@/components/shared/InfoIcon';
import { EduTooltip } from '@/components/shared/EduTooltip';
import { getEntry } from '@/lib/educational-content';

interface EconomicsTableProps {
  cashflows: readonly YearlyCashflow[];
  fiscalRegimeType?: FiscalRegimeType;
}

interface Row {
  year: number;
  oilProd: number;
  gasProd: number;
  revenue: number;
  royalty: number;
  costRecovery: number;
  profitSplit: number;
  tax: number;
  ncf: number;
  cumNcf: number;
  rcIndex: number;
}

const col = createColumnHelper<Row>();

/** Render a column header with optional tooltip and InfoIcon */
function ColHeader({ text, entryId }: { text: string; entryId: string }) {
  const entry = getEntry(entryId);
  if (!entry) return <>{text}</>;

  const hasInfo = entry.infoPanel != null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {entry.tooltip ? (
        <EduTooltip entry={entry}><span className="cursor-help">{text}</span></EduTooltip>
      ) : (
        text
      )}
      {hasInfo && <InfoIcon entry={entry} size={10} className="w-3.5 h-3.5" />}
    </span>
  );
}

type MoneyFormatter = (v: number) => string;

function buildColumns(
  fiscalRegimeType: FiscalRegimeType | undefined,
  currencyLabel: string,
  format: MoneyFormatter,
) {
  const base = [
    col.accessor('year', {
      header: () => <ColHeader text="Year" entryId="E-33" />,
      cell: (info) => <span className="font-data text-xs">{info.getValue()}</span>,
      size: 60,
    }),
    col.accessor('oilProd', {
      header: () => <ColHeader text={`Oil Rev (${currencyLabel})`} entryId="E-34" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 90,
    }),
    col.accessor('gasProd', {
      header: () => <ColHeader text={`Gas Rev (${currencyLabel})`} entryId="E-35" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 90,
    }),
    col.accessor('revenue', {
      header: () => <ColHeader text={`Revenue (${currencyLabel})`} entryId="E-36" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 100,
    }),
    col.accessor('royalty', {
      header: () => <ColHeader text={`Royalty (${currencyLabel})`} entryId="E-37" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 90,
    }),
    col.accessor('costRecovery', {
      header: () => <ColHeader text={`Cost Rec (${currencyLabel})`} entryId="E-38" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 110,
    }),
    col.accessor('profitSplit', {
      header: () => <ColHeader text={`Profit Split (${currencyLabel})`} entryId="E-39" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 120,
    }),
    col.accessor('tax', {
      header: () => <ColHeader text={`Tax (${currencyLabel})`} entryId="E-40" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} />,
      size: 80,
    }),
    col.accessor('ncf', {
      header: () => <ColHeader text={`NCF (${currencyLabel})`} entryId="E-41" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} highlight />,
      size: 100,
    }),
    col.accessor('cumNcf', {
      header: () => <ColHeader text={`Cum NCF (${currencyLabel})`} entryId="E-42" />,
      cell: (info) => <NumCell value={info.getValue()} format={format} highlight />,
      size: 110,
    }),
  ];

  // Show R/C or PI column based on fiscal regime
  const showRcPi = fiscalRegimeType !== 'DOWNSTREAM' && fiscalRegimeType !== 'RSC';
  if (showRcPi) {
    const isEpt = fiscalRegimeType === 'PSC_EPT';
    base.push(
      col.accessor('rcIndex', {
        header: () => <ColHeader text={isEpt ? 'Prof. Index' : 'R/C Index'} entryId="E-43" />,
        cell: (info) => (
          <span className="font-data text-xs text-right block">
            {info.getValue().toFixed(2)}
          </span>
        ),
        size: 90,
      }),
    );
  }

  return base;
}

function NumCell({
  value,
  highlight,
  raw,
  decimals,
  format,
}: {
  value: number;
  highlight?: boolean;
  raw?: boolean;
  decimals?: number;
  format?: MoneyFormatter;
}) {
  const formatted = raw
    ? (decimals !== undefined
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US'))
    : format
      ? format(value)
      : value.toString();
  const isNegative = value < 0;
  return (
    <span
      className={cn(
        'font-data text-xs text-right block',
        isNegative && 'text-danger',
        highlight && !isNegative && value > 0 && 'text-success font-medium',
      )}
    >
      {formatted}
    </span>
  );
}

export function EconomicsTable({ cashflows, fiscalRegimeType }: EconomicsTableProps) {
  const u = useDisplayUnits();

  const data = useMemo<Row[]>(
    () =>
      cashflows.map((cf) => ({
        year: cf.year,
        oilProd: (cf.grossRevenueOil as number) > 0 ? (cf.grossRevenueOil as number) : 0,
        gasProd: (cf.grossRevenueGas as number) > 0 ? (cf.grossRevenueGas as number) : 0,
        revenue: cf.totalGrossRevenue as number,
        royalty: cf.royalty as number,
        costRecovery: cf.costRecoveryAmount as number,
        profitSplit: cf.contractorProfitShare as number,
        tax: cf.pitaTax as number,
        ncf: cf.netCashFlow as number,
        cumNcf: cf.cumulativeCashFlow as number,
        rcIndex: cf.rcIndex,
      })),
    [cashflows],
  );

  // Compact, symbol-free numbers so dense cells stay readable; the column
  // header carries the currency+magnitude unit. Negatives use accounting
  // parens to match the table's existing visual language (KpiCard
  // convention is preserved elsewhere via u.money with accounting).
  const moneyFormat = useMemo<MoneyFormatter>(() => {
    return (v: number) => {
      const scaled = (v * u.currencyFactor) / 1_000_000;
      const normalized = scaled === 0 ? 0 : scaled;
      const magnitude = Math.abs(normalized).toLocaleString('en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return normalized < 0 ? `(${magnitude})` : magnitude;
    };
  }, [u.currencyFactor]);
  const currencyLabel = `${u.currencySymbol}M`;
  const columns = useMemo(
    () => buildColumns(fiscalRegimeType, currencyLabel, moneyFormat),
    [fiscalRegimeType, currencyLabel, moneyFormat],
  );

  // The React Compiler lint rule flags `useReactTable` as incompatible
  // because TanStack Table returns functions that it cannot memoize
  // safely. The warning is library-level and there is no alternative API
  // — this table is consumed locally in the render and its instance
  // does not leak to memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto w-full">
      <div className="min-w-[900px]">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-content-alt">
                {hg.headers.map((header, hi) => (
                  <th
                    key={header.id}
                    className={cn(
                      'text-[10px] font-semibold text-text-secondary uppercase tracking-wider text-right px-2 py-1.5',
                      hi === 0 && 'sticky left-0 z-10 bg-content-alt',
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-content-alt/50">
                {row.getVisibleCells().map((cell, ci) => (
                  <td
                    key={cell.id}
                    className={cn(
                      'px-2 py-1',
                      ci === 0 && 'sticky left-0 z-10 bg-white',
                    )}
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
