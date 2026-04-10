import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import type { YearlyCashflow, FiscalRegimeType } from '@/engine/types';
import { fmtAccounting } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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

function buildColumns(fiscalRegimeType?: FiscalRegimeType) {
  const base = [
    col.accessor('year', {
      header: 'Year',
      cell: (info) => <span className="font-data text-xs">{info.getValue()}</span>,
      size: 60,
    }),
    col.accessor('oilProd', {
      header: 'Oil Rev ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 90,
    }),
    col.accessor('gasProd', {
      header: 'Gas Rev ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 90,
    }),
    col.accessor('revenue', {
      header: 'Revenue ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 100,
    }),
    col.accessor('royalty', {
      header: 'Royalty ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 90,
    }),
    col.accessor('costRecovery', {
      header: 'Cost Rec ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 100,
    }),
    col.accessor('profitSplit', {
      header: 'Profit Split ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 110,
    }),
    col.accessor('tax', {
      header: 'Tax ($M)',
      cell: (info) => <NumCell value={info.getValue()} />,
      size: 80,
    }),
    col.accessor('ncf', {
      header: 'NCF ($M)',
      cell: (info) => <NumCell value={info.getValue()} highlight />,
      size: 90,
    }),
    col.accessor('cumNcf', {
      header: 'Cum NCF ($M)',
      cell: (info) => <NumCell value={info.getValue()} highlight />,
      size: 100,
    }),
  ];

  // Show R/C or PI column based on fiscal regime
  const showRcPi = fiscalRegimeType !== 'DOWNSTREAM' && fiscalRegimeType !== 'RSC';
  if (showRcPi) {
    const isEpt = fiscalRegimeType === 'PSC_EPT';
    base.push(
      col.accessor('rcIndex', {
        header: isEpt ? 'Prof. Index' : 'R/C Index',
        cell: (info) => (
          <span className="font-data text-xs text-right block">
            {info.getValue().toFixed(2)}
          </span>
        ),
        size: 80,
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
}: {
  value: number;
  highlight?: boolean;
  raw?: boolean;
  decimals?: number;
}) {
  const formatted = raw
    ? (decimals !== undefined
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US'))
    : fmtAccounting(value);
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

  const columns = useMemo(() => buildColumns(fiscalRegimeType), [fiscalRegimeType]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ScrollArea className="w-full">
      <div className="min-w-[900px]">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-content-alt">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider text-right px-2 py-1.5"
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
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-2 py-1" style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
