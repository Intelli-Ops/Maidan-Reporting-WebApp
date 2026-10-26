'use strict';

/**
 * bank_bin_reference.card_type is bank-supplied free text with no enum behind
 * it — "Visa Infinite Debit Card", "MasterCard World Elite Debit Card",
 * "Signature Master Debit", "Platinum Card". Rendering it raw makes the BIN
 * table unscannable and makes any colour-coding guesswork.
 *
 * Measured against the full reference table (68 BINs), the strings decompose
 * cleanly into three orthogonal dimensions:
 *
 *   tier     ladder position   66/68 before 'ladies', 68/68 after
 *   network  Visa/MC/UnionPay  67/68 (the miss is a mobile wallet, not a card)
 *   funding  debit vs credit   57/68 (the rest genuinely don't say)
 *
 * TIER is deliberately an ORDERED ladder, not a set of categories: Infinite
 * outranks Signature outranks Platinum outranks Gold. Order matters for
 * matching too — "Premium Platinum Credit Card" must resolve to Platinum, not
 * Premium, and "World Elite" must be tested before bare "World", so the list
 * is scanned most-specific-first and the first hit wins.
 */

// Most specific / highest tier first — first match wins.
const TIER_RULES = [
  { tier: 'Infinite', rank: 1, re: /infinite/i },
  { tier: 'World Elite', rank: 2, re: /world\s*elite/i },
  { tier: 'Signature', rank: 3, re: /signature/i },
  // Tested before the bare tier words so "Premium Platinum" -> Platinum,
  // but after Signature so "Premium Signature" -> Signature.
  { tier: 'Platinum', rank: 4, re: /platinum/i },
  { tier: 'Titanium', rank: 5, re: /titanium/i },
  { tier: 'World', rank: 6, re: /world/i },
  { tier: 'Premium', rank: 7, re: /premi(um|er)/i },
  { tier: 'Gold', rank: 8, re: /gold/i },
  { tier: 'Green', rank: 9, re: /green/i },
  { tier: 'Classic', rank: 10, re: /classic/i },
  { tier: 'Student', rank: 11, re: /student/i },
  // 'ladies'/'women' are marketed as a segment rather than a tier; grouped at
  // standard level because that's how their discounts actually price.
  { tier: 'Women', rank: 12, re: /women|ladies/i },
  { tier: 'Standard', rank: 13, re: /standard|classic|debit|credit|card|wallet|pay/i },
];

// 'Signature Master Debit' has no "MasterCard" token, so match on the bare
// brand word rather than the compound.
const NETWORK_RULES = [
  { network: 'Visa', re: /visa/i },
  { network: 'Mastercard', re: /master\s*card|mastercard|\bmaster\b/i },
  { network: 'UnionPay', re: /union\s*pay|unionpay/i },
];

const FUNDING_RULES = [
  { funding: 'Credit', re: /credit/i },
  { funding: 'Debit', re: /debit/i },
];

function firstMatch(rules, text, key) {
  const hit = rules.find((r) => r.re.test(text));
  return hit ? hit[key] : null;
}

/**
 * @param {string|null} cardType raw bank_bin_reference.card_type
 * @returns {{tier: string|null, tier_rank: number|null, network: string|null,
 *            funding: string|null, card_label: string}}
 *          card_label is the display string: the three parts that resolved,
 *          joined with a middot ("Visa · Infinite · Debit"). Falls back to the
 *          raw text when nothing parses, so nothing is ever swallowed.
 */
function normalizeCardType(cardType) {
  const raw = (cardType || '').trim();
  if (!raw) {
    return { tier: null, tier_rank: null, network: null, funding: null, card_label: '—' };
  }

  const tierHit = TIER_RULES.find((r) => r.re.test(raw)) || null;
  const network = firstMatch(NETWORK_RULES, raw, 'network');
  const funding = firstMatch(FUNDING_RULES, raw, 'funding');

  const parts = [network, tierHit ? tierHit.tier : null, funding].filter(Boolean);

  // "Standard" is the catch-all at the bottom of the ladder, so on its own it
  // carries no information the raw string didn't. When it's the ONLY thing
  // that resolved — no network, no funding — the bank's own wording is
  // strictly more useful ("Tap Pay – JC App & Google wallet" beats
  // "Standard"). Same for a string nothing matched at all.
  const labelIsEmpty = parts.length === 0;
  const labelIsBareStandard = parts.length === 1 && tierHit && tierHit.tier === 'Standard';

  return {
    tier: tierHit ? tierHit.tier : null,
    tier_rank: tierHit ? tierHit.rank : null,
    network,
    funding,
    card_label: labelIsEmpty || labelIsBareStandard ? raw : parts.join(' · '),
  };
}

module.exports = { normalizeCardType };
