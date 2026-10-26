// Shared free-text time-slot parser.
//
// Extracted from scripts/parse_time_slots.js so the IMPORTER can parse a slot
// at insert time and the backfill script can still reprocess older rows —
// both from one implementation. They were briefly going to be two copies;
// two copies of a heuristic this fiddly drift, and then a row means one thing
// depending on which code path happened to touch it.
//
// Pure functions only: no database, no dotenv, no process.argv. Callers do
// their own I/O.
//
// -------------------------------------------------------------------------
// HOW THIS WORKS
// -------------------------------------------------------------------------
// time_slot_raw is typed by hand and wildly inconsistent — 251 distinct formats
// in four sample files alone:
//
//   "4:00pm to 6:00pm"   "8 pm to 9 pm"     "1 to 2"       "6:00_7:00Pm"
//   "5-6 pm"             "5.30 to 6.30"     "11-1 am"      "12 amto 1 am"
//
// Separators vary (to / - / _ / glued), minutes use ':' or '.', capitalisation
// varies, and am/pm is often on only one end or missing entirely. Parsing the
// text alone therefore cannot resolve whether "11 to 1" means 11am-1pm or
// 11pm-1am.
//
// The trick is that duration_hours is already populated and independent of the
// text. So instead of guessing, we enumerate every plausible am/pm combination,
// compute each one's span, and keep the one whose span equals duration_hours.
// That resolves the ambiguity from data rather than assumption.
//
// Order of attempts, recorded in time_parse_status:
//   exact    - a candidate respecting the am/pm as written matched duration_hours
//   relaxed  - only matched after overriding a stated am/pm, i.e. the sheet
//              contradicts itself (e.g. "11 pm to 12.30pm" with duration 1.5)
//   inferred - nothing matched duration_hours, so the most plausible candidate
//              was taken. Expected for split-payment rows, where one slot is
//              spread over several rows and each row carries only part of the
//              duration ("7 pm to 8 pm" appearing twice with 0.3 and 0.7).
//   failed   - could not parse at all
//
// Plausibility tie-breaks use the observed booking pattern (busiest 16:00-23:00,
// then 00:00-02:00 and 06:00-11:00, almost nothing 12:00-15:00 — Karachi
// afternoons). It only ever breaks ties; it never overrides a duration match.


function splitParts(raw) {
    let s = String(raw).trim().toLowerCase().replace(/[–—]/g, '-');
    s = s.replace(/(a\.?m|p\.?m)\s*to\b/g, '$1|'); // "12 amto 1 am"
    // `\bto\b` cannot match "to1": both 'o' and '1' are word characters, so
    // there is no boundary between them, and rows typed "12 to1" / "5.30 to6.30"
    // came back as a single part. Anchoring on "not followed by a letter"
    // instead catches the glued digit while still leaving real words alone —
    // "total" is "to" followed by 't', so it is not a separator.
    s = s.replace(/\s*\bto\s*(?![a-z])/g, '|');
    s = s.replace(/\s*_\s*/g, '|');
    s = s.replace(/(?<=[0-9m\s])-(?=[0-9\s])/g, '|');
    let parts = s.split('|').map((x) => x.trim()).filter(Boolean);

    // Some rows carry no separator at all — the two times just sit next to
    // each other divided by a space: "3.30am 5.30.am", "7:30 pm 8:30 pm".
    // They are perfectly readable; there is simply nothing in the text for the
    // rules above to split on, so they used to come back as one part and fail.
    //
    // Only tried when those rules did NOT already produce two parts, and only
    // at a meridiem immediately followed by a digit. Both conditions matter:
    // splitting on bare whitespace would tear "8 pm to 9 pm" into four pieces,
    // and running this ahead of the separator rules would do the same to any
    // row that has a separator AND spaces around its meridiems.
    if (parts.length !== 2) {
        const split = s
            .replace(/(a\.?m|p\.?m)\s+(?=\d)/g, '$1|')
            .split('|')
            .map((x) => x.trim())
            .filter(Boolean);
        if (split.length === 2) parts = split;
    }

    return parts;
}

function parsePart(p) {
    const m = /^(\d{1,2})\s*(?:[:.]\s*(\d{1,2}))?\s*(a\.?m|p\.?m)?/.exec(p.trim());
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mi = m[2] ? parseInt(m[2], 10) : 0;
    let mer = m[3] || null;
    if (mer) mer = mer.startsWith('a') ? 'am' : 'pm';
    if (mi >= 60 || h > 24) return null;
    return { h, mi, mer };
}

function to24(h, mer) {
    // An hour already written on a 24-hour clock ("18:30", "20 to 22") carries
    // its own meaning, and some rows pair one with a stray meridiem. Applying
    // the pm offset to those pushed the hour past the end of the day and
    // produced times Postgres rejects outright — "20:30 pm" became 32:30, which
    // aborted the whole backfill transaction. Above 12 the meridiem adds
    // nothing, so it is ignored; 24:00 is midnight.
    if (h > 12) return h === 24 ? 0 : h;
    if (mer === 'pm') return h === 12 ? 12 : h + 12;
    return h === 12 ? 0 : h;
}

function buildCandidate(a, b, ao, bo) {
    const sh = to24(a.h, ao);
    const eh = to24(b.h, bo);
    const start = sh * 60 + a.mi;
    const end = eh * 60 + b.mi;
    let span = (end - start) / 60;
    let crosses = false;
    if (span <= 0) { span += 24; crosses = true; }
    return { sh, sm: a.mi, eh, em: b.mi, span, crosses };
}

function candidates(a, b, relax) {
    const aOpts = relax || !a.mer ? ['am', 'pm'] : [a.mer];
    const bOpts = relax || !b.mer ? ['am', 'pm'] : [b.mer];
    const out = [];
    for (const ao of aOpts) {
        for (const bo of bOpts) {
            const c = buildCandidate(a, b, ao, bo);
            // Both bounds must be real clock hours before anything downstream
            // tries to store them, whatever the text said.
            if (c.sh < 0 || c.sh > 23 || c.eh < 0 || c.eh > 23) continue;
            if (c.span > 0 && c.span <= 12) out.push(c);   // a single booking >12h isn't real
        }
    }
    return out;
}

// Observed operating pattern — used ONLY to break ties between candidates that
// are equally consistent with duration_hours.
function plausibility(hour) {
    if (hour >= 16 && hour <= 23) return 3;
    if (hour <= 2) return 2;
    if (hour >= 6 && hour <= 11) return 2;
    return 0;
}

function parseTimeSlot(raw, durationHours) {
    if (!raw || !String(raw).trim()) {
        return { status: 'failed', reason: 'empty' };
    }
    const parts = splitParts(raw);
    if (parts.length !== 2) {
        return { status: 'failed', reason: `expected 2 time parts, got ${parts.length}` };
    }
    const a = parsePart(parts[0]);
    const b = parsePart(parts[1]);
    if (!a || !b) {
        return { status: 'failed', reason: 'could not read hour/minute' };
    }

    const dur = typeof durationHours === 'number' ? durationHours : Number(durationHours);
    const hasDur = Number.isFinite(dur) && dur > 0;

    const pick = (list) => {
        list.sort((x, y) => plausibility(y.sh) - plausibility(x.sh) || x.span - y.span);
        return list[0];
    };

    // When the sheet states am/pm on BOTH ends, the text is not ambiguous and
    // is taken exactly as written — "9 pm 10 pm" is the 9-to-10pm slot, full
    // stop. This outranks the duration check on purpose.
    //
    // duration_hours disagreeing is the NORMAL case here, not a contradiction:
    // a slot paid for in parts is entered once per payment, each row carrying
    // its share of the hour ("9 pm 10 pm" twice, at 0.3 and 0.7). Reading that
    // as "the times must be wrong" and re-deriving the hour from 0.3h was
    // backwards — it threw away the one part of the row the staff typed
    // unambiguously, and flagged a correctly-filled sheet as needing fixing.
    //
    // The span guard inside candidates() is what makes this safe to trust: a
    // genuinely self-contradictory row like "11 pm to 12.30pm" spans 13.5
    // hours as written, produces no candidate at all, and still falls through
    // to the duration-driven logic below.
    const stated = a.mer && b.mer ? candidates(a, b, false) : [];
    if (stated.length) {
        const best = pick(stated);
        // 'exact' when the duration agrees anyway, so the two windows stay
        // distinguishable in time_parse_status for anyone auditing later.
        const agrees = hasDur && Math.abs(best.span - dur) < 0.02;
        return { status: agrees ? 'exact' : 'stated', ...best };
    }

    if (hasDur) {
        const strict = candidates(a, b, false).filter((c) => Math.abs(c.span - dur) < 0.02);
        if (strict.length) return { status: 'exact', ...pick(strict) };

        const loose = candidates(a, b, true).filter((c) => Math.abs(c.span - dur) < 0.02);
        if (loose.length) return { status: 'relaxed', ...pick(loose) };
    }

    const any = candidates(a, b, false);
    if (!any.length) return { status: 'failed', reason: 'no plausible interpretation' };
    return { status: 'inferred', ...pick(any) };
}

const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

module.exports = { parseTimeSlot, hhmm, splitParts, parsePart };
