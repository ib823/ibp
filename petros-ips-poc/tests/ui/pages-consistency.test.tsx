import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DashboardPage from '@/pages/DashboardPage';
import EconomicsPage from '@/pages/EconomicsPage';
import FinancialPage from '@/pages/FinancialPage';
import PortfolioPage from '@/pages/PortfolioPage';
import ReservesPage from '@/pages/ReservesPage';
import { useProjectStore } from '@/store/project-store';
import { getActiveResult } from '@/store/project-store';
import { formatMoney, fmtPct } from '@/lib/format';
import { aggregatePortfolio } from '@/engine/portfolio/aggregation';
import { generateIncomeStatement } from '@/engine/financial/income-statement';
import { PROJECT_RESERVES, gasBcfToMmboe } from '@/engine/reserves/prms';
import { convertSafe } from '@/lib/display-units';
import { DEFAULT_CONVERSIONS } from '@/engine/utils/unit-conversion';
import { computeCosts } from '@/engine/fiscal/shared';
import { getActiveProject, renderWithRouter, resetStore } from './test-utils';

function fmtMoney(value: number, accounting = false) {
  return formatMoney(value, {
    currency: 'USD',
    conversions: DEFAULT_CONVERSIONS,
    accounting,
  });
}

function fmtCompactMoneyCell(value: number) {
  const scaled = value / 1_000_000;
  const magnitude = Math.abs(scaled).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return scaled < 0 ? `(${magnitude})` : magnitude;
}

function fmtFinancialCell(value: number) {
  const scaled = value / 1_000_000;
  const normalized = scaled === 0 ? 0 : scaled;
  if (Math.abs(normalized) < 0.05) return '-';
  const magnitude = Math.abs(normalized).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return normalized < 0 ? `(${magnitude})` : magnitude;
}

describe('page regressions against engine truth', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Economics page KPI cards and year-by-year table match the active economics result', () => {
    const state = useProjectStore.getState();
    const result = getActiveResult(state);
    expect(result).not.toBeNull();
    const firstRevenueCashflow = result!.yearlyCashflows.find(
      (cashflow) => (cashflow.totalGrossRevenue as number) > 0,
    )!;

    renderWithRouter(<EconomicsPage />);

    expect(screen.getByText('Project Economics')).toBeInTheDocument();
    expect(screen.getByText(fmtMoney(result!.npv10 as number, true))).toBeInTheDocument();
    expect(screen.getByText(fmtPct(result!.irr ?? 0))).toBeInTheDocument();
    expect(screen.getByText(result!.profitabilityIndex.toFixed(2))).toBeInTheDocument();

    const tables = screen.getAllByRole('table');
    const economicsTable = tables[tables.length - 1]!;
    const row = within(economicsTable).getByText(String(firstRevenueCashflow.year)).closest('tr');
    expect(row).not.toBeNull();
    const rowScope = within(row as HTMLTableRowElement);
    expect(rowScope.getAllByText(fmtCompactMoneyCell(firstRevenueCashflow.totalGrossRevenue as number)).length).toBeGreaterThan(0);
    expect(rowScope.getAllByText(fmtCompactMoneyCell(firstRevenueCashflow.netCashFlow as number)).length).toBeGreaterThan(0);
    expect(rowScope.getByText(firstRevenueCashflow.rcIndex.toFixed(2))).toBeInTheDocument();
  });

  it('Dashboard and Portfolio pages show the same aggregate portfolio numbers', () => {
    const state = useProjectStore.getState();
    const activeScenario = state.activeScenario;
    const resultsForScenario = new Map(
      [...state.economicsResults.entries()]
        .map(([id, scenarios]) => [id, scenarios.get(activeScenario)])
        .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] => Boolean(entry[1])),
    );
    const portfolio = aggregatePortfolio(
      state.projects,
      resultsForScenario,
      state.portfolioSelection,
      state.hierarchy,
    );

    // Match the shipping PortfolioPage formula exactly: receipts-over-
    // pretax-cashflow, not revenue-weighted governmentTakePct averaging.
    // Falls back to 0 when the denominator is non-positive (project is
    // unprofitable overall).
    let weightedIrr = 0;
    let totalCapexWeight = 0;
    let totalGovtReceipts = 0;
    let totalPreTaxCashFlow = 0;
    for (const id of state.portfolioSelection) {
      const result = resultsForScenario.get(id);
      if (!result) continue;
      const project = state.projects.find((p) => p.project.id === id);
      const capex = result.totalCapex as number;
      weightedIrr += (result.irr ?? result.mirr) * capex;
      totalCapexWeight += capex;

      totalGovtReceipts += result.yearlyCashflows.reduce(
        (sum, cf) =>
          sum +
          (cf.royalty as number) +
          (cf.exportDuty as number) +
          (cf.researchCess as number) +
          (cf.hostProfitShare as number) +
          (cf.supplementaryPayment as number) +
          (cf.pitaTax as number),
        0,
      );

      if (project) {
        const preTaxForProject =
          (result.totalRevenue as number) -
          result.yearlyCashflows.reduce((sum, cf) => {
            const cost = computeCosts(project.costProfile, cf.year);
            return sum + cost.totalCapex + cost.totalOpex + cost.abandonmentCost;
          }, 0);
        totalPreTaxCashFlow += preTaxForProject;
      }
    }
    const expectedWeightedIrr = totalCapexWeight > 0 ? weightedIrr / totalCapexWeight : 0;
    const expectedGovtTake =
      totalPreTaxCashFlow > 0
        ? (totalGovtReceipts / totalPreTaxCashFlow) * 100
        : 0;

    renderWithRouter(<DashboardPage />);
    expect(screen.getAllByText(fmtMoney(portfolio.totalNpv as number, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtMoney(portfolio.totalCapex as number, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtPct(expectedWeightedIrr)).length).toBeGreaterThan(0);

    renderWithRouter(<PortfolioPage />);
    expect(screen.getAllByText(fmtMoney(portfolio.totalNpv as number, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtMoney(portfolio.totalCapex as number, true)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(fmtPct(expectedWeightedIrr)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(expectedGovtTake.toFixed(1) + '%').length).toBeGreaterThan(0);
  });

  it('Financial page income statement values match the derived financial engine output', () => {
    const activeProject = getActiveProject();
    const result = getActiveResult(useProjectStore.getState());
    expect(result).not.toBeNull();

    const income = generateIncomeStatement(result!.yearlyCashflows, activeProject);
    const firstRevenueYear = income.yearly.find((line) => (line.revenue as number) > 0)!;
    const firstNetIncomeYear = income.yearly.find((line) => Math.abs(line.profitAfterTax as number) >= 50_000)!;

    renderWithRouter(<FinancialPage />);

    expect(screen.getByText('Financial Statements')).toBeInTheDocument();
    const table = screen.getByRole('table');

    const revenueRow = within(table).getByText('Revenue').closest('tr');
    expect(revenueRow).not.toBeNull();
    expect(within(revenueRow as HTMLTableRowElement).getByText(fmtFinancialCell(firstRevenueYear.revenue as number))).toBeInTheDocument();

    const netIncomeRow = within(table).getByText('Net Income').closest('tr');
    expect(netIncomeRow).not.toBeNull();
    expect(within(netIncomeRow as HTMLTableRowElement).getByText(fmtFinancialCell(firstNetIncomeYear.profitAfterTax as number))).toBeInTheDocument();
  });

  it('Reserves page summary totals match the reserves source data and unit conversions', () => {
    render(<ReservesPage />);

    const oil2PTotal = PROJECT_RESERVES.reduce((sum, project) => sum + project.oil['2P'], 0);
    const gas2PTotal = PROJECT_RESERVES.reduce((sum, project) => sum + project.gas['2P'], 0);
    const total2PBoe = PROJECT_RESERVES.reduce(
      (sum, project) => sum + project.oil['2P'] + gasBcfToMmboe(project.gas['2P']),
      0,
    );
    const gasFactor = convertSafe(1, 'Bcf', 'MMscf', DEFAULT_CONVERSIONS);

    // Matches `fmtReserveValue` in ReservesPage: one decimal under 10,
    // zero decimals at or above 10, with locale thousand separators.
    const fmtR = (v: number): string => {
      const digits = Math.abs(v) >= 10 ? 0 : 1;
      return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };
    expect(screen.getByText(fmtR(oil2PTotal))).toBeInTheDocument();
    expect(screen.getByText(fmtR(gas2PTotal * gasFactor))).toBeInTheDocument();
    expect(screen.getByText(fmtR(total2PBoe))).toBeInTheDocument();
  });
});
