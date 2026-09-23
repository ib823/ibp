// Recharts 3 sorts Legend items alphabetically (`itemSorter: 'value'`) and
// Tooltip rows by series name (`itemSorter: 'name'`) by default. Recharts 2
// kept both in series (JSX) order, which is what every multi-series chart in
// the app was designed around (e.g. stacked areas listed bottom-to-top, the
// "Cumulative" line last). These drop-in wrappers restore that order; import
// Legend / Tooltip from here instead of 'recharts' in multi-series charts.
import { Legend as RechartsLegend, Tooltip as RechartsTooltip } from 'recharts';
import type { ComponentProps } from 'react';

// A constant sort key + stable sort = original (series) order.
const keepSeriesOrder = () => 0;

export function Legend(props: ComponentProps<typeof RechartsLegend>) {
  return <RechartsLegend itemSorter={null} {...props} />;
}

export function Tooltip(props: ComponentProps<typeof RechartsTooltip>) {
  return <RechartsTooltip itemSorter={keepSeriesOrder} {...props} />;
}
