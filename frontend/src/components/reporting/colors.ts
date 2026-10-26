// A restrained, reused-everywhere quartet — same facility/sport keeps the
// same color across every chart in a dashboard instead of Recharts'
// default rainbow palette. Cool tones only (blue, teal, mint, green), all
// from DESIGN_SYSTEM.md's sanctioned chart colors: amber is reserved for
// warning/liability contexts and must never appear as a neutral chart
// series. The second slot is teal rather than a second blue shade — two
// blue tints read as near-identical next to each other in a stacked chart.
export const SERIES_COLORS = ['#185FA5', '#1F7A7A', '#5DCAA5', '#3B6D11'];

export function colorForIndex(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

// Light -> dark stop pairs for the same four series colors, for charts that
// use a subtle top-to-bottom gradient fill instead of a flat color per
// series (e.g. FacilityShareChart's stacked bars).
export const SERIES_GRADIENT_STOPS: [string, string][] = [
  ['#4E9FE0', '#185FA5'],
  ['#6DA9A9', '#1F7A7A'],
  ['#86DFC0', '#5DCAA5'],
  ['#7FB35A', '#3B6D11'],
];

export function gradientStopsForIndex(i: number): [string, string] {
  return SERIES_GRADIENT_STOPS[i % SERIES_GRADIENT_STOPS.length];
}

// Card networks are a genuine CATEGORY — three unrelated values, no order
// between them — so distinct hues are the right encoding here (unlike card
// tier, which is a ladder and would need a single-hue ramp).
//
// Hues are spread across the wheel, not picked for prettiness. The first
// attempt used blue / teal / green, which are adjacent: at badge size, teal on
// a 10% tint was indistinguishable from the blue beside it. Blue, burnt orange
// and green sit far enough apart to survive both a small swatch and a
// colour-blind reader, and burnt orange doubles as a nod to Mastercard's own
// livery. It no longer risks reading as an error state, because the BIN table
// carries no red trend badges any more.
//
// Tints are 14% rather than 10% and text is the full-strength hue, so the pill
// keeps its identity against the card's off-white background.
// `null` covers the handful of BINs whose name states no network at all.
const NETWORK_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  Visa: { dot: '#185FA5', text: 'text-[#154E86]', bg: 'bg-[#185FA5]/14' },
  Mastercard: { dot: '#C2410C', text: 'text-[#9A3412]', bg: 'bg-[#C2410C]/14' },
  UnionPay: { dot: '#3B6D11', text: 'text-[#31590E]', bg: 'bg-[#3B6D11]/14' },
};

const NETWORK_FALLBACK = { dot: '#8A9099', text: 'text-ink-muted', bg: 'bg-ink/[0.06]' };

export function networkStyle(network: string | null) {
  return (network && NETWORK_STYLES[network]) || NETWORK_FALLBACK;
}

// Booking status is a genuine CATEGORY with a meaning attached to each value,
// not an arbitrary series list, so the colours are assigned by what the status
// says about the booking rather than handed out in payload order:
//
//   played and paid   -> the cool brand tones (blue, teal, green)
//   played, not paid  -> amber, the colour of revenue given away
//   never played      -> red for a cancellation, grey for anything still
//                        unresolved — grey reads as "no outcome yet" and
//                        keeps two pending-ish statuses visibly related
//
// This is the one sanctioned use of amber as a chart series (DESIGN_SYSTEM.md
// reserves it for warning/liability contexts): a Complimentary booking IS
// revenue given away, the same thing the amber KPI on the Revenue tab tracks.
//
// Status is free text normalised at import, not a fixed enum, so anything the
// sheets invent tomorrow falls through to the cool quartet rather than
// rendering colourless.
const STATUS_COLORS: Record<string, string> = {
  Done: '#185FA5',
  Academy: '#1F7A7A',
  Payfast: '#3B6D11',
  Complimentary: '#D9A441',
  Cancel: '#E15B5B',
  Pending: '#9AA4AE',
  'Pending Tournament': '#C7CDD3',
};

export function colorForStatus(status: string, fallbackIndex = 0): string {
  return STATUS_COLORS[status] ?? colorForIndex(fallbackIndex);
}
