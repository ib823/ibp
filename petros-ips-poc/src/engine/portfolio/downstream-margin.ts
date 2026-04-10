// ════════════════════════════════════════════════════════════════════════
// Downstream Margin Model
// ════════════════════════════════════════════════════════════════════════

import type {
  DownstreamInputs,
  DownstreamResult,
  USD,
} from '@/engine/types';
import { usd } from '@/engine/fiscal/shared';
import { calculateNPV } from '@/engine/economics/npv';
import { calculateIRR } from '@/engine/economics/irr';

const CORPORATE_TAX_RATE = 0.24;
const DISCOUNT_RATE = 0.10;
const FIELD_LIFE = 20; // years for downstream asset

/**
 * Calculate downstream margin economics.
 * Computes gross/net margins, NPV, IRR, and break-even prices.
 */
export function calculateDownstreamEconomics(
  inputs: DownstreamInputs,
): DownstreamResult {
  const throughput = inputs.plantCapacity * inputs.plantUtilization;

  // Revenue = sum of product volumes × prices
  let productRevenue = 0;
  for (const [product, volume] of inputs.productVolumes) {
    const price = inputs.productPrices.get(product) ?? (0 as USD);
    productRevenue += volume * (price as number);
  }

  // Feedstock cost
  const feedstockCost = inputs.feedstockVolume * (inputs.feedstockPrice as number);

  const grossMargin = productRevenue - feedstockCost;
  const netMargin = grossMargin - (inputs.fixedOpex as number) - (inputs.variableOpex as number) * throughput;

  // Build simple cashflow series (assume steady-state for FIELD_LIFE years)
  // Year 0: no CAPEX in this model (CAPEX handled by project-level model)
  const cashflows: number[] = [];
  for (let t = 0; t < FIELD_LIFE; t++) {
    const taxable = netMargin;
    const tax = Math.max(0, taxable * CORPORATE_TAX_RATE);
    cashflows.push(netMargin - tax);
  }

  const npv10 = calculateNPV(cashflows, DISCOUNT_RATE);
  const irr = calculateIRR(cashflows) ?? 0;

  // Break-even feedstock price: find price where NPV = 0
  const breakEvenFeedstockPrice = bisectBreakEven(
    (price) => {
      const gm = productRevenue - inputs.feedstockVolume * price;
      const nm = gm - (inputs.fixedOpex as number) - (inputs.variableOpex as number) * throughput;
      const cfs = Array.from({ length: FIELD_LIFE }, () => {
        const tax = Math.max(0, nm * CORPORATE_TAX_RATE);
        return nm - tax;
      });
      return calculateNPV(cfs, DISCOUNT_RATE);
    },
    0,
    (inputs.feedstockPrice as number) * 5,
  );

  // Break-even product price: find uniform product price multiplier where NPV = 0
  const breakEvenProductPrice = bisectBreakEven(
    (priceMult) => {
      let rev = 0;
      for (const [product, volume] of inputs.productVolumes) {
        const basePrice = inputs.productPrices.get(product) ?? (0 as USD);
        rev += volume * (basePrice as number) * priceMult;
      }
      const gm = rev - feedstockCost;
      const nm = gm - (inputs.fixedOpex as number) - (inputs.variableOpex as number) * throughput;
      const cfs = Array.from({ length: FIELD_LIFE }, () => {
        const tax = Math.max(0, nm * CORPORATE_TAX_RATE);
        return nm - tax;
      });
      return calculateNPV(cfs, DISCOUNT_RATE);
    },
    0,
    5,
  );

  // Convert multiplier back to an absolute price (use first product as reference)
  const firstProductEntry = inputs.productPrices.entries().next();
  const refPrice = firstProductEntry.done ? 0 : (firstProductEntry.value[1] as number);
  const breakEvenProductPriceAbsolute = breakEvenProductPrice * refPrice;

  return {
    grossMargin: usd(grossMargin),
    netMargin: usd(netMargin),
    npv10: usd(npv10),
    irr,
    breakEvenFeedstockPrice: usd(breakEvenFeedstockPrice),
    breakEvenProductPrice: usd(breakEvenProductPriceAbsolute),
  };
}

/**
 * Bisection search to find the input value where f(x) = 0.
 * Returns the break-even value.
 */
function bisectBreakEven(
  f: (x: number) => number,
  low: number,
  high: number,
  maxIter: number = 100,
  tol: number = 1e-6,
): number {
  let fLow = f(low);

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const fMid = f(mid);

    if (Math.abs(fMid) < tol || (high - low) / 2 < tol) {
      return mid;
    }

    if (fLow * fMid < 0) {
      high = mid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return (low + high) / 2;
}
