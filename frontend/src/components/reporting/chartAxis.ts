// Shared axis geometry for every currency-scaled chart across the Bookings,
// Expenses, and Investors dashboards.
//
// Two things were being got wrong per-chart, so they live here once:
//
// 1. TOP MARGIN. Recharts draws the highest Y tick centred on the plot's top
//    edge, so half the text sits outside the SVG and the label is sheared off
//    along its top. A chart-level top margin reserves that half-line back.
//
// 2. AXIS WIDTH. Ticks are rendered by formatCurrency, which prefixes the
//    currency — "PKR 181.63M" is 11 characters, and at 11px that overruns the
//    76px these axes used to reserve, clipping the tail of the largest values.

// `top` reserves half a line of 11px text so the highest Y tick sits fully
// inside the SVG. `right` does the same job on the other axis: the LAST X tick
// is centred on the plot's right edge, so half of "Jun '26" hung outside the
// SVG and was sheared vertically. Both are half-a-label, not padding.
export const CHART_MARGIN = { top: 20, right: 28, left: 4, bottom: 0 } as const;

/** Wider variant for charts that also render a right-edge value label or dot. */
export const CHART_MARGIN_WIDE = { top: 20, right: 36, left: 4, bottom: 0 } as const;

/** Fits "PKR 181.63M" (the widest string formatCurrency produces here) at fontSize 11. */
export const CURRENCY_AXIS_WIDTH = 88;

export const AXIS_TICK = { fontSize: 11, fill: '#66716B' } as const;
