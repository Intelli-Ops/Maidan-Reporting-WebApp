// Shared deterministic PRNG + date-math helpers for mock dashboard fixtures —
// same inputs always produce the same "random" figures so numbers don't
// jitter between renders/filters.

export function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFor(...parts: (string | number)[]): number {
  const str = parts.join('|');
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return h;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function monthStart(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

/** Last `n` calendar months as 'YYYY-MM-01' strings, oldest first, ending at the current month. */
export function monthsBack(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`);
  }
  return out;
}

/** Mirrors the real backend's DATE -> toISOString() serialization the frontend's apiDate()/format helpers expect. */
export function toApiDatetime(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`;
}
