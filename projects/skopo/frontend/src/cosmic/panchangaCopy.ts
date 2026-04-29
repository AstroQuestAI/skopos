/**
 * panchangaCopy — positive-toned descriptions for Tithi, Vara, and
 * Nakshatra. All copy is consciously POSITIVE or PASSIVE — we never
 * say "bad day" / "avoid" / "negative". Where classical sources flag a
 * tithi as inauspicious, we surface its *quieter* qualities ("a calm,
 * inward-leaning day for reflection") rather than dampen the user.
 *
 * Used by:
 *   • TodaysBriefingCard — synthesises a 1-2 line narrative keynote
 *   • PanchangaSummaryCard — renders a longer Tithi description
 *
 * Data is fully client-side: no network roundtrip needed.
 */

export type Tone = 'auspicious' | 'gentle';

export interface TithiInfo {
  /** Shukla / Krishna — waxing or waning moon side */
  paksha: 'shukla' | 'krishna' | 'amavasya' | 'purnima';
  /** Sanskrit name (e.g. "Tritiya") */
  name: string;
  /** Short auspicious-or-gentle headline (≤ 60 chars) */
  headline: string;
  /** A single positive-toned paragraph (~30-50 words) */
  description: string;
  tone: Tone;
}

// ────────────────────────────────────────────────────────────────────
// 30 tithis — keyed by 1..30.
//   1..15  = Shukla Pratipada → Purnima (Full Moon)
//   16..30 = Krishna Pratipada → Amavasya (New Moon)
// ────────────────────────────────────────────────────────────────────
const TITHI_TABLE: Record<number, TithiInfo> = {
  1:  { paksha: 'shukla', name: 'Pratipada',   tone: 'auspicious',
        headline: 'A fresh page',
        description:
          'The first day of the waxing moon — a clean slate to set intentions, sketch plans, and quietly begin anything you have been carrying in your mind. Trust the start.' },
  2:  { paksha: 'shukla', name: 'Dwitiya',     tone: 'auspicious',
        headline: 'Build on yesterday',
        description:
          'A continuation day. Pick up the thread you laid down and add one more clear stitch. Conversations and small commitments tend to land well.' },
  3:  { paksha: 'shukla', name: 'Tritiya',     tone: 'auspicious',
        headline: 'Fertile for new beginnings',
        description:
          'A widely celebrated tithi for journeys, learning, devotion, and the start of meaningful projects. The day rewards courage with momentum — lean into anything you have been wanting to begin.' },
  4:  { paksha: 'shukla', name: 'Chaturthi',   tone: 'auspicious',
        headline: 'Clear the way',
        description:
          'Ganesha\'s tithi — favoured for removing obstacles and offering a sankalpa. Even small acts of intention setting carry quiet power today.' },
  5:  { paksha: 'shukla', name: 'Panchami',    tone: 'auspicious',
        headline: 'Knowledge & arts shine',
        description:
          'Saraswati-flavoured. Music, study, writing, design — anything that asks the mind to be both clear and graceful — flowers naturally on this tithi.' },
  6:  { paksha: 'shukla', name: 'Shashthi',    tone: 'auspicious',
        headline: 'Vigour returns',
        description:
          'A day of building strength. Movement, exercise, hands-on work and decisive small wins are well supported.' },
  7:  { paksha: 'shukla', name: 'Saptami',     tone: 'auspicious',
        headline: 'Reach outward',
        description:
          'The world is receptive. Reach out, network, share visible work — the day rewards graceful self-expression and warm connection.' },
  8:  { paksha: 'shukla', name: 'Ashtami',     tone: 'auspicious',
        headline: 'Strength & resolve',
        description:
          'A tithi of courage. Decisions made today tend to be felt deeply and held firmly. Trust the inner strength you have been quietly building.' },
  9:  { paksha: 'shukla', name: 'Navami',      tone: 'auspicious',
        headline: 'Devotional momentum',
        description:
          'Durga\'s flavour — devotion, prayer, and spiritual practice carry extra warmth. A day to soften towards what you love and renew your tether to it.' },
  10: { paksha: 'shukla', name: 'Dashami',     tone: 'auspicious',
        headline: 'Quiet victories',
        description:
          'Achievement-aligned. Recognitions surface, plans crystallise, and what you have been steadily working on tends to land where you wanted it to.' },
  11: { paksha: 'shukla', name: 'Ekadashi',    tone: 'gentle',
        headline: 'Light food, lighter mind',
        description:
          'Traditionally a fasting tithi. Today rewards restraint, prayer, and the inward gestures — even a small simplification of food, words, or tasks brings clarity.' },
  12: { paksha: 'shukla', name: 'Dwadashi',    tone: 'auspicious',
        headline: 'Generosity flows',
        description:
          'Gratitude and giving are well favoured. A natural tithi to thank, to release, to share what feels easy to share.' },
  13: { paksha: 'shukla', name: 'Trayodashi',  tone: 'auspicious',
        headline: 'Pradosha — Shiva\'s evening',
        description:
          'The twilight hours carry Shiva\'s grace. Evening worship, mantra, and quiet reflection hold a particular sweetness on this tithi.' },
  14: { paksha: 'shukla', name: 'Chaturdashi', tone: 'gentle',
        headline: 'Reflective & still',
        description:
          'A more inward tithi. Choose contemplation over loud beginnings; let insights ripen quietly. Spiritual reading and meditation are supported.' },
  15: { paksha: 'purnima', name: 'Purnima',    tone: 'auspicious',
        headline: 'Full Moon — abundance',
        description:
          'The fullness of the lunar cycle. Celebration, completion, and gratitude. A natural pause to honour what has come full circle and savour its glow.' },

  // Krishna paksha (waning moon) — 16..30
  16: { paksha: 'krishna', name: 'Pratipada',   tone: 'gentle',
        headline: 'Take stock, gently',
        description:
          'The first day of the waning moon. A reflective tithi — a chance to look at what you began and quietly refine, edit, and release what no longer fits.' },
  17: { paksha: 'krishna', name: 'Dwitiya',     tone: 'gentle',
        headline: 'Patient integration',
        description:
          'A slower, more inward day. Let the insights of the last cycle settle. There is wisdom in not pushing.' },
  18: { paksha: 'krishna', name: 'Tritiya',     tone: 'auspicious',
        headline: 'Refine your craft',
        description:
          'Crafting and refining are favoured. Polish what is half-built, tighten the rough edges, deepen quality.' },
  19: { paksha: 'krishna', name: 'Chaturthi',   tone: 'auspicious',
        headline: 'Sankashti — release obstacles',
        description:
          'Sankashti Chaturthi — Ganesha\'s waning-moon day. A traditional moment to acknowledge what feels heavy and ask, with intention, for it to be lifted.' },
  20: { paksha: 'krishna', name: 'Panchami',    tone: 'gentle',
        headline: 'Quiet observation',
        description:
          'A watching day. The world will reveal subtler patterns if you slow down enough to notice them.' },
  21: { paksha: 'krishna', name: 'Shashthi',    tone: 'gentle',
        headline: 'Inward strength',
        description:
          'The work continues, just more quietly. Small disciplines kept today compound into visible strength later.' },
  22: { paksha: 'krishna', name: 'Saptami',     tone: 'gentle',
        headline: 'Settle into rhythm',
        description:
          'A day to hold steady. Routine and a calm pace serve you better than fresh launches.' },
  23: { paksha: 'krishna', name: 'Ashtami',     tone: 'auspicious',
        headline: 'Devotional depth',
        description:
          'A Krishna-flavoured tithi — devotion deepens easily. Your softer, more loving instincts are particularly available today.' },
  24: { paksha: 'krishna', name: 'Navami',      tone: 'gentle',
        headline: 'Surrender what is heavy',
        description:
          'A natural day to set down what you have been carrying alone. Lean on prayer, on a friend, on the larger intelligence that holds you.' },
  25: { paksha: 'krishna', name: 'Dashami',     tone: 'auspicious',
        headline: 'Round things off',
        description:
          'Tying-up energy. Close loose threads, send the email, finish the chapter — completion brings unexpected clarity for what comes next.' },
  26: { paksha: 'krishna', name: 'Ekadashi',    tone: 'gentle',
        headline: 'Light food, lighter mind',
        description:
          'A fasting tithi. Even a small simplification today — fewer screens, lighter food, quieter words — leaves the mind unusually clear.' },
  27: { paksha: 'krishna', name: 'Dwadashi',    tone: 'auspicious',
        headline: 'Compassion in action',
        description:
          'Charity and kindness carry extra weight. A natural day for small acts of giving — they return, in unexpected ways.' },
  28: { paksha: 'krishna', name: 'Trayodashi',  tone: 'auspicious',
        headline: 'Pradosha — Shiva\'s evening',
        description:
          'The waning Pradosha — twilight hours hold Shiva\'s grace. Evening worship and mantra carry particular depth.' },
  29: { paksha: 'krishna', name: 'Chaturdashi', tone: 'gentle',
        headline: 'Inner stillness',
        description:
          'The last full waning tithi. Today rewards silence, simple food, and gentle company over decisive action.' },
  30: { paksha: 'amavasya', name: 'Amavasya',   tone: 'auspicious',
        headline: 'New Moon — sankalpa',
        description:
          'The new moon — ancestors, intention setting, and a clean cosmic slate. Whisper into today\'s darkness what you would like the next cycle to carry forward.' },
};

// ── Vara (weekday) ──────────────────────────────────────────────────
const VARA_TABLE: Record<string, { sanskrit: string; ruler: string; essence: string }> = {
  sunday:    { sanskrit: 'Bhanuvara',   ruler: 'Surya',    essence: 'vitality, leadership, and clear visibility'   },
  monday:    { sanskrit: 'Somavara',    ruler: 'Chandra',  essence: 'feelings, family, and creative flow'           },
  tuesday:   { sanskrit: 'Mangalavara', ruler: 'Mangala',  essence: 'initiative, courage, and decisive movement'   },
  wednesday: { sanskrit: 'Budhavara',   ruler: 'Budha',    essence: 'learning, conversation, and clean exchange'   },
  thursday:  { sanskrit: 'Guruvara',    ruler: 'Brihaspati', essence: 'wisdom, dharma, and benevolent expansion'   },
  friday:    { sanskrit: 'Shukravara',  ruler: 'Shukra',   essence: 'beauty, relationships, and sweetness'         },
  saturday:  { sanskrit: 'Shanivara',   ruler: 'Shani',    essence: 'depth, discipline, and patient structure'      },
};

// ── Public helpers ──────────────────────────────────────────────────

/**
 * Look up a tithi by NAME (e.g. "Shukla Tritiya" / "Krishna Ekadashi"
 * / "Purnima" / "Amavasya"). Falls back to a generic positive copy if
 * the name is unrecognised — we never return null so the UI always
 * renders something warm.
 */
export function lookupTithi(rawName?: string | null): TithiInfo {
  const fallback: TithiInfo = {
    paksha: 'shukla', name: '—', tone: 'auspicious',
    headline: 'A fresh window of intention',
    description:
      "Today carries its own quiet rhythm. Set one small intention, take one mindful step, and let the day's pace meet you halfway.",
  };
  if (!rawName) return fallback;
  const s = String(rawName).trim().toLowerCase();
  if (s.includes('purnima') || s.includes('full moon')) return TITHI_TABLE[15];
  if (s.includes('amavasya') || s.includes('new moon')) return TITHI_TABLE[30];

  const isShukla = s.includes('shukla') || s.includes('shukla') || s.includes('śukla') ||
                   s.includes('waxing') || s.includes('bright');
  const isKrishna = s.includes('krishna') || s.includes('kṛṣṇa') ||
                    s.includes('waning') || s.includes('dark');
  // Strip paksha tokens to leave the Sanskrit name.
  const cleaned = s
    .replace(/shukla|kṛṣṇa|krishna|śukla|waxing|waning|bright|dark|paksha/g, '')
    .trim();
  // Map Sanskrit names → 1..15 index.
  const NAME_TO_IDX: Record<string, number> = {
    'pratipada': 1, 'pratipat': 1, 'prathama': 1, '1': 1,
    'dwitiya': 2, 'dvitiya': 2, '2': 2,
    'tritiya': 3, '3': 3,
    'chaturthi': 4, 'caturthi': 4, '4': 4,
    'panchami': 5, 'pañcami': 5, '5': 5,
    'shashthi': 6, 'sasthi': 6, 'shasthi': 6, '6': 6,
    'saptami': 7, '7': 7,
    'ashtami': 8, 'astami': 8, '8': 8,
    'navami': 9, '9': 9,
    'dashami': 10, 'dasami': 10, '10': 10,
    'ekadashi': 11, 'ekadasi': 11, '11': 11,
    'dwadashi': 12, 'dvadashi': 12, '12': 12,
    'trayodashi': 13, 'trayodasi': 13, '13': 13,
    'chaturdashi': 14, 'caturdasi': 14, '14': 14,
    'pournami': 15, 'purnima': 15, '15': 15,
  };
  let idx = 0;
  for (const k of Object.keys(NAME_TO_IDX)) {
    if (cleaned.includes(k)) { idx = NAME_TO_IDX[k]; break; }
  }
  if (!idx) return fallback;
  if (isKrishna && idx <= 15) idx = idx + 15;        // 16..30 are Krishna
  if (idx > 30) return fallback;
  return TITHI_TABLE[idx] || fallback;
}

/** Look up a Vara by weekday name (English or Sanskrit). */
export function lookupVara(rawDay?: string | null): { sanskrit: string; ruler: string; essence: string } {
  const fallback = { sanskrit: '—', ruler: 'today', essence: "the day's own gentle rhythm" };
  if (!rawDay) return fallback;
  const s = String(rawDay).trim().toLowerCase();
  for (const k of Object.keys(VARA_TABLE)) {
    if (s.includes(k.toLowerCase()) || s.includes(VARA_TABLE[k].sanskrit.toLowerCase())) return VARA_TABLE[k];
  }
  // Try to map Sanskrit endings ("vara") + planet
  if (s.includes('bhanu') || s.includes('ravi') || s.includes('aditya')) return VARA_TABLE.sunday;
  if (s.includes('soma'))   return VARA_TABLE.monday;
  if (s.includes('mangala') || s.includes('bhauma')) return VARA_TABLE.tuesday;
  if (s.includes('budha'))  return VARA_TABLE.wednesday;
  if (s.includes('guru') || s.includes('brihaspati')) return VARA_TABLE.thursday;
  if (s.includes('shukra')) return VARA_TABLE.friday;
  if (s.includes('shani'))  return VARA_TABLE.saturday;
  return fallback;
}

/**
 * Build a single positive-toned narrative paragraph for the day, given
 * the Panchanga inputs. Always 1-3 sentences, never negative.
 */
export function buildDailyKeynote(args: {
  vara?: string | null;
  tithi?: string | null;
  nakshatra?: string | null;
  moonPhase?: string | null;
}): string {
  const v = lookupVara(args.vara);
  const t = lookupTithi(args.tithi);
  const nak = (args.nakshatra || '').trim();

  const a = `Under ${v.ruler}'s flavour, the day favours ${v.essence}.`;
  const b = t.tone === 'auspicious'
    ? `${t.paksha === 'krishna' ? 'Krishna' : 'Shukla'} ${t.name} is ${t.headline.toLowerCase()} — ${t.description.replace(/^.{1}/, c => c.toLowerCase())}`
    : `${t.paksha === 'krishna' ? 'Krishna' : 'Shukla'} ${t.name} carries a quieter quality: ${t.description.replace(/^.{1}/, c => c.toLowerCase())}`;
  const c = nak ? ` With ${nak} anchoring the sky, that energy lands gently and clearly.` : '';
  // Compose. Trim to ~60 words for the briefing keynote.
  const composed = `${a} ${b}${c}`.replace(/\s+/g, ' ').trim();
  // Soft clamp
  const words = composed.split(/\s+/);
  if (words.length > 70) {
    return words.slice(0, 70).join(' ').replace(/[.,;]?\s*$/, '') + '.';
  }
  return composed;
}
