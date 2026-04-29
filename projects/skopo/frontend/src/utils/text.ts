// Text cleanup and softening helpers.
// Extracted from app/index.tsx (v6.6 Phase 1 refactor).

// --- Text cleanup helpers ---
// Strip markdown/emphasis/citations/shloka markers and extra whitespace for clean display
export const cleanText = (txt: string | undefined | null): string => {
  if (!txt) return '';
  let s = String(txt);
  // Remove markdown bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');
  s = s.replace(/_([^_]+)_/g, '$1');
  // v8.0 — REBRAND: normalise every book/source name to the generic
  // "IndicVedicTexts" label. Any prose the LLM generates that cites
  // specific shastra names is transparently rewritten here so the user
  // never sees the underlying corpus brand.
  const BOOK_NAME_RE = /\b(Dwadasa\s+Bhava\s+Phala\s+Chandrika|Bhava\s+Phala\s+Chandrika|Brihat\s+Parashara\s+Hora\s+Shastra|Brihat\s+Parashari|Parashara\s+Hora\s+Shastra|Muhurta\s+Chintamani|Phaladeepika|Phala\s+Deepika|Jataka\s+Parijata|Jaimini\s+Sutras?|Lal\s+Kitab|Mantra\s+Maha\s+Arnava|DBPC|BPHS)\b/gi;
  s = s.replace(BOOK_NAME_RE, 'IndicVedicTexts');
  // Telugu/Devanagari variants
  s = s.replace(/ద్వాదశ\s*భావ\s*ఫల\s*చంద్రిక/g, 'IndicVedicTexts');
  s = s.replace(/ముహూర్త\s*చింతామణి/g, 'IndicVedicTexts');
  s = s.replace(/బృహత్\s*పరాశర\s*హోరా\s*శాస్త్ర(ం|మ)?/g, 'IndicVedicTexts');
  s = s.replace(/ఫలదీపిక/g, 'IndicVedicTexts');
  s = s.replace(/జాతక\s*పారిజాత/g, 'IndicVedicTexts');
  s = s.replace(/లాల్\s*కితాబ్/g, 'IndicVedicTexts');
  s = s.replace(/మంత్ర\s*మహార్ణవ/g, 'IndicVedicTexts');
  // Remove inline citations like "(BPHS Ch.5.12)" / "[DBPC p.34]" / "DBPC Page X"
  s = s.replace(/\(\s*(BPHS|DBPC|MC|Muhurta Chintamani|Brihat Parashara|IndicVedicTexts)[^)]*\)/gi, '');
  s = s.replace(/\[\s*(BPHS|DBPC|MC|IndicVedicTexts)[^\]]*\]/gi, '');
  s = s.replace(/\b(DBPC|BPHS|MC|IndicVedicTexts)\s*(Page|Ch\.?|Chapter|Shloka|Sloka|Verse)\s*\d+([.,:]?\s*\d+)?/gi, '');
  s = s.replace(/📖[^\n]*?(DBPC|BPHS|IndicVedicTexts|Page|Ch\.?|Chapter)[^\n]*/gi, '');
  s = s.replace(/🕉️\s*(DBPC|BPHS|IndicVedicTexts)\s*—?/gi, '');
  s = s.replace(/📜\s*(DBPC|BPHS|IndicVedicTexts)\s*—?/gi, '');
  // Collapse duplicate "IndicVedicTexts IndicVedicTexts" that can arise
  // from chained replaces above.
  s = s.replace(/(IndicVedicTexts)(\s+IndicVedicTexts)+/g, '$1');
  // Strip shloka number prefixes like "1.2.3:" or "12." at start of line
  s = s.replace(/\n\s*\d{1,3}(\.\d{1,3}){0,3}\s*[:\-]?\s*/g, '\n');
  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, '\n\n');
  // Trim each line and overall
  s = s.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');
  return s.trim();
};

// Return a brief single sentence (or clipped) version of the text
export const briefSentence = (txt: string | undefined | null, maxLen = 140): string => {
  const s = cleanText(txt);
  if (!s) return '';
  // Split by sentence boundary
  const parts = s.split(/(?<=[.!?।])\s+/);
  let out = parts[0] || s;
  if (out.length > maxLen) {
    out = out.slice(0, maxLen).trim();
    if (!/[.!?।]$/.test(out)) out += '…';
  }
  return out;
};

// Soften harsh language for user-friendly display
// e.g. "Loss of job" → "Issues with your work"; "Death of parent" → "Concerns about parent's wellbeing"
export const softenText = (txt: string | undefined | null): string => {
  if (!txt) return '';
  let s = String(txt);
  const pairs: [RegExp, string][] = [
    // Job / work
    [/\b(loss of job|lost (his|her|their) job|job loss|unemployment|got fired|dismissed from (job|work)|termination of (job|service|employment))\b/gi, 'challenges with your work situation'],
    [/\b(failure in career|career failure|career ruin|ruined career)\b/gi, 'obstacles in your career path'],
    [/\b(no success in business|business failure|business ruin|bankruptcy)\b/gi, 'difficulties in business matters'],
    // Death / demise
    [/\b(death of (father|his father|her father))\b/gi, "concerns regarding father's wellbeing"],
    [/\b(death of (mother|his mother|her mother))\b/gi, "concerns regarding mother's wellbeing"],
    [/\b(death of (spouse|wife|husband|partner))\b/gi, "serious concerns regarding spouse"],
    [/\b(death of (child|son|daughter))\b/gi, "concerns regarding children"],
    [/\b(death of (brother|sister|sibling))\b/gi, "concerns regarding siblings"],
    [/\b(sudden death|untimely death|premature death|dies early|died young|early demise|death at young age)\b/gi, 'health challenges at a young age'],
    [/\b(will die|shall die|must die|destined to die)\b/gi, 'may face serious health concerns'],
    [/\bdeath\b/gi, 'serious health challenges'],
    [/\bdies\b/gi, 'faces serious health concerns'],
    [/\bkilled\b/gi, 'seriously affected'],
    [/\bmurdered\b/gi, 'seriously harmed'],
    [/\bsuicide\b/gi, 'mental distress'],
    // Money / losses
    [/\b(loss of wealth|huge loss|great loss|severe loss|monetary loss|financial ruin|poverty|extreme poverty|beggar)\b/gi, 'financial setbacks'],
    [/\b(heavy debt|crushing debt|cannot repay debt)\b/gi, 'financial strain'],
    // Relationships
    [/\b(divorce|separation from spouse|breakup of marriage)\b/gi, 'friction in marital life'],
    [/\b(cheating (spouse|wife|husband)|infidelity|adultery|unfaithful)\b/gi, 'trust issues in relationships'],
    [/\b(multiple marriages|second marriage)\b/gi, 'possibility of more than one significant relationship'],
    // Health
    [/\b(incurable disease|terminal illness|fatal disease)\b/gi, 'chronic health concerns'],
    [/\b(mental illness|insanity|madness|lunacy)\b/gi, 'mental health challenges'],
    [/\b(disability|crippled|lame|blindness|deaf)\b/gi, 'physical health challenges'],
    [/\b(accident|misfortune|calamity|disaster|ruin|tragedy)\b/gi, 'unexpected challenges'],
    // Crime / legal
    [/\b(imprisonment|jail|prison|arrested)\b/gi, 'legal difficulties'],
    [/\b(criminal|thief|robber|dacoit)\b/gi, 'association with questionable company'],
    [/\b(enemies will destroy|destroyed by enemies)\b/gi, 'challenges from opposition'],
    // Evil / curse
    [/\b(evil|wicked|sinful|cursed|doomed|misery)\b/gi, 'difficult'],
    [/\b(bad (fate|luck|omen|fortune))\b/gi, 'temporary setbacks'],
    [/\b(hatred|hated)\b/gi, 'strained relationships'],
    [/\b(ruined|destroyed|perished)\b/gi, 'significantly impacted'],
    [/\b(will suffer|must suffer|suffers greatly|great suffering)\b/gi, 'may experience challenges'],
    [/\b(sorrow|grief|misery|anguish|despair)\b/gi, 'emotional difficulties'],
    // Gender
    [/\b(barren|infertile|no issue|no children)\b/gi, 'delays in having children'],
    // Normalizations
    [/\bwill be (poor|in misery)\b/gi, 'may face material challenges'],
    [/\bshall (lose|suffer)\b/gi, 'may face'],
    [/\bnever\b/gi, 'rarely'],
    [/\b(cannot|can not)\b/gi, 'may find it difficult to'],
  ];
  for (const [re, rep] of pairs) {
    s = s.replace(re, rep);
  }
  return s;
};


/**
 * maskSourceReferences — v6.22
 *
 * Replace any remaining source/chapter/example/shloka references with the
 * literal text "INFO MASKED". Runs as a last-mile sanitizer on ANY text
 * that is ultimately shown to the user (GuruJi chat markdown, matched
 * classical examples, etc.) in case the LLM or OCR text slipped through
 * the server-side privacy rules (v6.19 system-prompt + v6.21 UI copy
 * scrub).
 *
 * Catches:
 *   Chapter 7      Example 12       Shloka 45        Situation 3
 *   Chap. 4        Ex. 2            Sl. 17           Rule #8
 *   p.32, pp. 48–50                 page 48          Verse 7
 *   [Source: ...] [Ref: ...] [Citation: ...]
 *
 * Preserves the surrounding sentence so copy remains readable.
 */
export const maskSourceReferences = (txt: string | undefined | null): string => {
  if (!txt) return '';
  let s = String(txt);

  // Full bracketed source/ref citations first (e.g. "[Source: DBPC]")
  s = s.replace(/\[\s*(source|ref|reference|citation|src)\s*:[^\]]*\]/gi, 'INFO MASKED');
  s = s.replace(/\(\s*(source|ref|citation)\s*:[^)]*\)/gi, 'INFO MASKED');

  // Chapter / Example / Shloka / Situation / Verse / Rule with numeric ref
  const CH_EX_SH_PATTERNS: RegExp[] = [
    /\bChapter\s+(?:No\.?\s*)?\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?/gi,
    /\bChap\.\s*\d+[A-Za-z]?/gi,
    /\bExample\s+(?:No\.?\s*)?\d+[A-Za-z]?(?:\s*[-–]\s*\d+)?/gi,
    /\bEx\.\s*\d+[A-Za-z]?/gi,
    /\bShloka\s+(?:No\.?\s*)?\d+(?:[.,]\s*\d+)*/gi,
    /\bSlokas?\s+(?:No\.?\s*)?\d+(?:[.,]\s*\d+)*/gi,
    /\bSl\.\s*\d+/gi,
    /\bVerse\s+(?:No\.?\s*)?\d+/gi,
    /\bSituation\s+(?:No\.?\s*)?\d+/gi,
    /\bRule\s*#?\d+/gi,
    /\bCase\s*#?\d+/gi,
  ];
  for (const re of CH_EX_SH_PATTERNS) {
    s = s.replace(re, 'INFO MASKED');
  }

  // Page references (p.32 / pp. 48-50 / page 48)
  s = s.replace(/\bpp?\.\s*\d+(?:\s*[-–]\s*\d+)?/gi, 'INFO MASKED');
  s = s.replace(/\bpage\s+\d+(?:\s*[-–]\s*\d+)?/gi, 'INFO MASKED');

  // "Chart #252" / "chart no. 252" / "chart 252"
  s = s.replace(/\bChart\s+(?:No\.?\s*|#\s*)\d+/gi, 'INFO MASKED');

  // Telugu equivalents — అధ్యాయం (chapter), ఉదాహరణ (example), శ్లోకం (shloka)
  s = s.replace(/(?:అధ్యాయం|ఉదాహరణ|శ్లోకం|పేజీ|పేజి|సందర్భం)\s*\d+/g, 'INFO MASKED');

  // Collapse any double-masked sequences like "INFO MASKED INFO MASKED"
  s = s.replace(/(INFO MASKED)(\s+\1)+/g, 'INFO MASKED');

  return s;
};
