import { useEffect, useMemo, useRef, useState } from 'react';
import { DataTable } from '@/components/reporting/DataTable';
import { networkStyle } from '@/components/reporting/colors';
import { formatCompactNumber, formatPercent, num } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { UnderusedHighValueBins } from '@/lib/types/bookingsDashboard';

// The payload carries every BIN in the reference table (68 today), so both the
// default view and the bank browser are served from one response with no
// request per keystroke.
//
// Two distinct modes, deliberately:
//   default  - the metric. High-value cards nobody uses, fewest-used first.
//   by bank  - a catalogue. Everything one bank offers, most-used first.
// The second is a lookup ("what does HBL give our customers?"), not a ranking,
// which is why its sort is inverted and its high-value filter is lifted.

const PAGE = 10;

export function UnderusedBinsTable({ data }: { data: UnderusedHighValueBins }) {
  const [bank, setBank] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const banks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.rows) counts.set(r.bank_name, (counts.get(r.bank_name) ?? 0) + 1);
    return [...counts.entries()].map(([name, cards]) => ({ name, cards })).sort((a, b) => b.cards - a.cards);
  }, [data.rows]);

  // Reset paging when the mode changes, so switching banks never lands you
  // mid-way down a previous list.
  useEffect(() => setShowAll(false), [bank]);

  const pool = useMemo(() => {
    if (!bank) return data.rows.filter((r) => r.is_high_value);
    return [...data.rows.filter((r) => r.bank_name === bank)].sort(
      (a, b) => b.usage_count - a.usage_count || num(b.avg_saving) - num(a.avg_saving)
    );
  }, [data.rows, bank]);

  const limit = bank ? PAGE : data.binLimit;
  const visible = showAll ? pool : pool.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-ink-faint">
          {bank ? (
            <>
              <span className="font-semibold text-ink-muted">{bank}</span> · {pool.length}{' '}
              {pool.length === 1 ? 'card' : 'cards'} on file, most used first
            </>
          ) : (
            <>
              Showing {visible.length} of {data.highValueCount} high-value underused · {data.rows.length} cards on file
            </>
          )}
        </p>

        <BankPicker banks={banks} value={bank} onChange={setBank} />
      </div>

      {/* Expanded lists scroll inside the card rather than stretching the
          page: HBL alone has 31 cards, and pushing the two charts above it far
          off-screen to show them all makes the tab hard to get back to. */}
      <div className={cn(showAll && pool.length > PAGE && 'max-h-[420px] overflow-y-auto pr-1')}>
        <DataTable
          gridlines
          columns={[
            { key: 'bank', label: 'Bank', align: 'center', render: (r) => r.bank_name, pill: true, width: '21%' },
            {
              key: 'network',
              label: 'Network',
              align: 'center',
              width: '15%',
              // Network is the one genuinely categorical attribute on the row
              // (Visa / Mastercard / UnionPay — three unrelated values), so it
              // is the only thing here that earns colour. Tier is a ladder and
              // stays as text.
              render: (r) => {
                const s = networkStyle(r.network);
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      s.bg,
                      s.text
                    )}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.dot }} />
                    {r.network ?? 'Other'}
                  </span>
                );
              },
            },
            {
              key: 'card',
              label: 'Card',
              align: 'center',
              width: '38%',
              // The bank's own wording leads, because that's the name a user
              // recognises and the one printed on the card. The normalized tier
              // sits underneath as a quiet second line: it makes the column
              // scannable without renaming anything out from under the reader.
              render: (r) => (
                // items-center: the two lines are a block-level flex column, so
                // without it the name row spans the cell and sits left while
                // the plain tier span below it inherits the centring — one
                // cell, two different alignments.
                <span className="flex flex-col items-center gap-0.5 py-0.5">
                  <span className="flex items-center gap-2 text-[13px] leading-snug text-ink">
                    {r.card_type ?? '—'}
                    {r.usage_count === 0 && (
                      <span className="shrink-0 rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
                        never used
                      </span>
                    )}
                  </span>
                  {r.tier && (
                    <span className="text-[11px] leading-snug text-ink-faint">
                      {[r.tier, r.funding].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              ),
            },
            // Centered rather than right-aligned: these values vary in width
            // under short headers, and right-aligning only makes their right
            // EDGES agree while their visual centers stay offset — which reads
            // as misaligned. Centering puts each header over its value block.
            {
              key: 'discount',
              label: 'Discount',
              align: 'center',
              width: '12%',
              render: (r) => (r.discount_pct ? formatPercent(num(r.discount_pct) * 100, 0) : '—'),
            },
            {
              key: 'usage',
              label: 'Times Used',
              align: 'center',
              width: '14%',
              // A plain count for the selected period — no period-over-period
              // tag. The question this table answers is "which good cards is
              // nobody using", which the absolute number answers on its own;
              // the trend badge was a second story competing with it.
              render: (r) => formatCompactNumber(r.usage_count),
            },
          ]}
          rows={visible}
          fixedLayout
          rowKey={(r) => r.bin_number}
          emptyMessage={bank ? `No cards on file for ${bank}.` : 'No card data for this period.'}
        />
      </div>

      {pool.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="self-start text-[12px] font-semibold text-blue transition-opacity hover:opacity-70"
        >
          {showAll ? `Show top ${limit}` : `Show all ${pool.length} cards`}
        </button>
      )}

    </div>
  );
}

// A bank must be PICKED, not typed. Free text conflated banks that share a
// word: searching "habib" silently merged Habib Bank Limited (31 cards) with
// Habib Metropolitan Bank Limited (5) and reported "36 cards", which belongs
// to no bank that exists. Typing now filters a list of real bank names and the
// selection is always one of them.
function BankPicker({
  banks,
  value,
  onChange,
}: {
  banks: { name: string; cards: number }[];
  value: string | null;
  onChange: (bank: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? banks.filter((b) => b.name.toLowerCase().includes(q)) : banks;
  }, [banks, query]);

  function select(name: string | null) {
    onChange(name);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={open ? query : (value ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search a bank…"
          className={cn(
            'h-9 w-60 rounded-lg border bg-surface px-3 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-blue',
            value ? 'border-blue/40 font-medium' : 'border-border'
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => select(null)}
            className="shrink-0 text-[12px] font-semibold text-blue transition-opacity hover:opacity-70"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-black/[0.04] bg-surface p-1 shadow-[0_4px_12px_rgb(16_24_40_/_0.06),0_16px_40px_-8px_rgb(16_24_40_/_0.16)]">
          {matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-ink-faint">No bank matches “{query.trim()}”.</p>
          ) : (
            matches.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => select(b.name)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-muted',
                  b.name === value ? 'font-semibold text-blue' : 'text-ink'
                )}
              >
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">{b.cards}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
