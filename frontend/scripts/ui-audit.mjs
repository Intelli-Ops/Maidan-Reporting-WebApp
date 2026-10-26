/**
 * Layout audit for every reporting dashboard.
 *
 * Drives the real app in a headless browser and measures rendered geometry,
 * because these defects are invisible to tsc and to eslint and expensive to
 * re-check by hand on three dashboards after every change.
 *
 * It asserts three things per dashboard, on every tab:
 *
 *   1. TABLE ALIGNMENT — each column's data lines up with its heading.
 *      Compared on the edge the alignment implies (right edge for right-
 *      aligned columns, centre for centred, left otherwise). Cells whose
 *      content is a badge are compared on the badge's BOX, since a badge is a
 *      distinct object whose own padding legitimately insets its text.
 *
 *   2. VALUE-UNDER-HEADING — the primary value in a numeric cell must sit
 *      beneath its heading, not off to one side. A trailing change-badge used
 *      to take the column's right edge and shove the number ~90px left, which
 *      reads as misalignment even though the cell's right edge is correct.
 *
 *   3. CHART LABELS — no axis or reference-line text may cross the edge of its
 *      SVG, on any side. Recharts centres the outermost tick ON the plot
 *      boundary, so half a label falls outside unless the chart margin
 *      reserves room for it.
 *
 * Usage: npm run audit:ui   (needs both dev servers running)
 */
import { chromium } from 'playwright';

const BASE = process.env.AUDIT_BASE_URL ?? 'http://localhost:5173';
const EMAIL = process.env.AUDIT_EMAIL ?? 'admin@maidan.pk';
const PASSWORD = process.env.AUDIT_PASSWORD;

if (!PASSWORD) {
  console.error('Set AUDIT_PASSWORD (the login password) before running the UI audit.');
  process.exit(2);
}

const DASHBOARDS = [
  { name: 'BOOKINGS', path: '/reporting/bookings', tabs: ['Revenue', 'Patterns'] },
  { name: 'EXPENSES', path: '/reporting/expenses', tabs: ['Overview', 'Categories'] },
  { name: 'INVESTORS', path: '/reporting/investors', tabs: ['Overview', 'Investors'] },
];

/** Pixel slack: sub-pixel rounding and letter-spacing on uppercase headings. */
const TOLERANCE = 1.0;
/** How far a value may sit from its heading before it reads as detached. */
const VALUE_DRIFT_LIMIT = 40;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

const failures = [];
const runtimeErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') runtimeErrors.push(m.text().slice(0, 200));
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

for (const dash of DASHBOARDS) {
  await page.goto(BASE + dash.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  for (const tabName of dash.tabs) {
    const tab = page.getByRole('button', { name: tabName, exact: true });
    if (await tab.count()) {
      await tab.first().click();
      await page.waitForTimeout(2200);
    }
    const where = `${dash.name}/${tabName}`;

    const tableCount = await page.locator('table').count();
    for (let t = 0; t < tableCount; t++) {
      const cols = await page.locator('table').nth(t).evaluate((tbl) => {
        const textEdge = (el) => {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node, box = null;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of range.getClientRects()) {
              if (r.width <= 0) continue;
              box = box
                ? { left: Math.min(box.left, r.left), right: Math.max(box.right, r.right) }
                : { left: r.left, right: r.right };
            }
          }
          return box;
        };
        const outerBox = (td) => {
          const kids = [...td.children];
          if (!kids.length) return textEdge(td);
          let left = Infinity, right = -Infinity;
          for (const k of kids) {
            const b = k.getBoundingClientRect();
            if (b.width <= 0) continue;
            left = Math.min(left, b.left);
            right = Math.max(right, b.right);
          }
          return left === Infinity ? textEdge(td) : { left, right };
        };
        // The first text node is the value; a change badge renders after it.
        const primaryValue = (td) => {
          const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            if (!node.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const r = [...range.getClientRects()].find((x) => x.width > 0);
            if (r) return { left: r.left, right: r.right };
          }
          return null;
        };
        const hasBadge = (td) =>
          [...td.querySelectorAll('*')].some((e) => {
            const bg = getComputedStyle(e).backgroundColor;
            return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          });

        const ths = [...tbl.querySelectorAll('thead th')];
        const row = tbl.querySelector('tbody tr');
        if (!row) return [];
        const tds = [...row.querySelectorAll('td')];

        return ths.map((th, i) => {
          const td = tds[i];
          if (!td) return null;
          const head = textEdge(th);
          // A cell may nominate the element its heading aligns to. Columns
          // that trail a change badge do this, because there the heading is
          // deliberately positioned over the VALUE and the badge sits beyond
          // it — the cell's outer edge is the wrong thing to measure.
          const anchor = td.querySelector('[data-value-anchor]');
          const badge = hasBadge(td);
          const cell = anchor ? textEdge(anchor) : badge ? outerBox(td) : textEdge(td);
          const value = anchor ? textEdge(anchor) : primaryValue(td);
          if (!head || !cell) return null;
          const align = getComputedStyle(th).textAlign;
          const edge = (b) =>
            align === 'right'
              ? b.right - head.right
              : align === 'center'
                ? (b.left + b.right) / 2 - (head.left + head.right) / 2
                : b.left - head.left;
          return {
            col: th.textContent.trim(),
            align,
            delta: +edge(cell).toFixed(1),
            valueDrift: value ? +edge(value).toFixed(1) : 0,
          };
        }).filter(Boolean);
      });

      for (const c of cols) {
        if (Math.abs(c.delta) > TOLERANCE) {
          failures.push(`${where} table[${t}] "${c.col}" (${c.align}) misaligned by ${c.delta}px`);
        }
        if (Math.abs(c.valueDrift) > VALUE_DRIFT_LIMIT) {
          failures.push(`${where} table[${t}] "${c.col}" value sits ${c.valueDrift}px from its heading`);
        }
      }
    }

    const clipped = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('svg.recharts-surface').forEach((svg, i) => {
        const s = svg.getBoundingClientRect();
        svg.querySelectorAll('text').forEach((t) => {
          const b = t.getBoundingClientRect();
          if (b.width === 0) return;
          const sides = [];
          if (b.left < s.left - 0.5) sides.push('left');
          if (b.right > s.right + 0.5) sides.push('right');
          if (b.top < s.top - 0.5) sides.push('top');
          if (b.bottom > s.bottom + 0.5) sides.push('bottom');
          if (sides.length) out.push(`chart[${i}] "${t.textContent}" clipped on ${sides.join('+')}`);
        });
      });
      return out;
    });
    clipped.forEach((c) => failures.push(`${where} ${c}`));
  }
}

await browser.close();

if (runtimeErrors.length) {
  console.log(`\nConsole errors (${runtimeErrors.length}):`);
  [...new Set(runtimeErrors)].slice(0, 10).forEach((e) => console.log(`  ${e}`));
}

if (failures.length) {
  console.log(`\nUI AUDIT FAILED — ${failures.length} problem(s):\n`);
  failures.forEach((f) => console.log(`  ${f}`));
  process.exit(1);
}

console.log('\nUI audit passed: every table column aligns with its heading and no chart label is clipped.');
