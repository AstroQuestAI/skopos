/**
 * cosmicI18n.ts — translation helper for the Cosmic UI surfaces.
 *
 * Holds a Telugu translation table for all user-facing strings in the
 * Home/Today/Profile/Settings surfaces. The `tr(key, lang)` helper
 * gracefully falls back to the English key when no Telugu mapping
 * exists, so partial translations never produce blank or "undefined"
 * UI — the user simply sees the English word.
 *
 * Add new entries via `STRINGS[language][key]`. Keep keys human-
 * readable English so missing-translation fallback reads naturally.
 */

export type Lang = 'en' | 'te';

export const STRINGS: Record<Lang, Record<string, string>> = {
  en: {},
  te: {
    // ── Section kickers / headers ────────────────────────────────
    "TODAY'S BRIEFING":        'ఈరోజు సంక్షిప్తం',
    'AUSPICIOUS TIMINGS · NEXT 6H': 'శుభ సమయాలు · తరువాతి ౬ గం',
    'AUSPICIOUS TIMINGS':      'శుభ సమయాలు',
    'ACTIVE YOGAS':            'ప్రస్తుత యోగాలు',
    'DOSHAS AT A GLANCE':      'దోషాల పరిశీలన',
    'DASHA':                   'దశ',
    'TRANSITS':                'గోచారం',
    'INSIGHTS':                'అంతర్దృష్టులు',
    'BIRTH DETAILS':           'జన్మ వివరాలు',
    'CHART POINTS':            'జాతక బిందువులు',
    'COSMIC ALIGNMENT':        'కాస్మిక్ సమన్వయం',
    'MOON PHASE':              'చంద్ర దశ',

    // ── Card labels (audio briefing) ─────────────────────────────
    'Daily Briefing':          'ఈరోజు సంక్షిప్తం',
    'Your cosmic briefing is ready': 'మీ కాస్మిక్ సంక్షిప్తం సిద్ధమైంది',
    'Loading…':                'లోడ్ అవుతోంది…',
    'Updated':                 'నవీకరించబడింది',
    'No high-rated horas in the next 6 hours.':
                               'తరువాతి ౬ గంటలలో అధిక శ్రేణి హోరలు లేవు.',

    // ── Birth details rows ───────────────────────────────────────
    'Date of Birth':           'జన్మ తేదీ',
    'Time of Birth':           'జన్మ సమయం',
    'Place of Birth':          'జన్మ స్థలం',
    'Lagna (Asc)':             'లగ్నం',
    'Sun Sign':                'రవి రాశి',
    'Moon Sign':               'చంద్ర రాశి',
    'Nakshatra':               'నక్షత్రం',
    'Pada':                    'పాదం',

    // ── Greeting words ───────────────────────────────────────────
    'Good morning':            'శుభోదయం',
    'Good afternoon':           'శుభ మధ్యాహ్నం',
    'Good evening':            'శుభ సాయంత్రం',
    'Pranam':                  'ప్రణామ్',

    // ── Buttons / actions ────────────────────────────────────────
    'Ask Vidhaata':            'విధాతను అడగండి',
    'Ask Vidhaata →':          'విధాతను అడగండి →',
    'Continue':                'కొనసాగించండి',
    'Reveal my chart':         'నా జాతకాన్ని చూపండి',
    'Begin My Cosmic Journey': 'నా కాస్మిక్ ప్రయాణాన్ని ప్రారంభించండి',
    'Settings':                'సెట్టింగులు',
    'Profile':                 'ప్రొఫైల్',
    'Sign out':                'సైన్ అవుట్',
    'Re-enter birth details':  'జన్మ వివరాలు మళ్ళీ నమోదు చేయండి',

    // ── Audio briefing controls ─────────────────────────────────
    'Play briefing':           'సంక్షిప్తం వినండి',
    'Pause briefing':          'సంక్షిప్తం ఆపండి',

    // ── Auspicious / dosha labels ───────────────────────────────
    'AUSPICIOUS':              'శుభం',
    'GENTLE':                  'మృదువు',
    'AshtamaShani':            'అష్టమశని',
    'Arthaa · Saturn cycle':   'అర్థాష్టమశని · శని చక్రం',
    'Mangal Dosha':            'మంగళ దోషం',
    'Kala Sarpa':              'కాల సర్ప',
    'PRESENT':                 'ఉంది',
    'CLEAR':                   'లేదు',

    // ── Dasha card ──────────────────────────────────────────────
    'CURRENT DASHA':           'ప్రస్తుత దశ',
    'MAHADASHA':               'మహాదశ',
    'ANTARDASHA':              'అంతర్దశ',
    "TODAY'S TITHI":           'ఈరోజు తిథి',
    'Tap to ask Vidhaata about today  ›':
                               'ఈరోజు గురించి విధాతను అడగడానికి నొక్కండి  ›',
    'No notable yogas active in your chart today.':
                               'ఈరోజు మీ జాతకంలో ప్రముఖ యోగాలు లేవు.',

    // ── Today's Briefing card ───────────────────────────────────
    'MOON PHASE':              'చంద్ర దశ',
    'Daily Briefing':          'ఈరోజు సంక్షిప్తం',
    'Today':                   'ఈరోజు',
    '♃ Today ':                '♃ ఈరోజు ',

    // ── Panchanga pills ────────────────────────────────────────
    'TITHI':                   'తిథి',
    'NAKSHATRA':               'నక్షత్రం',
    'MOON':                    'చంద్ర',
    'SUNRISE':                 'సూర్యోదయం',
    'SUNSET':                  'సూర్యాస్తమయం',
    'RAHU KAAL':               'రాహు కాలం',

    // ── Settings · voice picker (v9.20) ─────────────────────────
    'English voice':           'ఇంగ్లీష్ వాయిస్',
    'Telugu voice (తెలుగు)':    'తెలుగు వాయిస్',
    'FREE · OS / BROWSER':     'ఉచితం · OS / బ్రౌజర్',
    'NEURAL · GOOGLE CLOUD':   'న్యూరల్ · గూగుల్ క్లౌడ్',
    'Used for the Daily Briefing and Vidhaata in English. Free OS voices play instantly; cosmic neural voices use Google Cloud TTS for studio quality.':
                               'ఈరోజు సంక్షిప్తం మరియు ఇంగ్లీష్‌లో విధాత కోసం ఉపయోగించబడుతుంది. ఉచిత OS వాయిస్‌లు తక్షణం వినిపిస్తాయి; కాస్మిక్ న్యూరల్ వాయిస్‌లు స్టూడియో నాణ్యత కోసం గూగుల్ క్లౌడ్ TTS ఉపయోగిస్తాయి.',
    'Studio-quality Google Chirp3-HD voices for Telugu — used for Daily Briefing and Vidhaata when the app is in Telugu mode.':
                               'తెలుగు కోసం స్టూడియో నాణ్యత గల గూగుల్ Chirp3-HD వాయిస్‌లు — యాప్ తెలుగు మోడ్‌లో ఉన్నప్పుడు ఈరోజు సంక్షిప్తం మరియు విధాత కోసం ఉపయోగించబడతాయి.',

    // ── Voice mode disabled banner (v9.19) ──────────────────────
    'Voice mode unavailable in Telugu':
                               'తెలుగులో వాయిస్ మోడ్ అందుబాటులో లేదు',
    'Switch to English in Settings to use voice features.':
                               'వాయిస్ ఫీచర్‌లను ఉపయోగించడానికి సెట్టింగులలో ఇంగ్లీష్‌కు మారండి.',
  },
};

/**
 * Translate a key to the target language. Falls back to the key
 * itself (treated as English) if no mapping exists. NEVER returns
 * undefined / empty — partial translations are safe.
 */
export function tr(key: string, lang: Lang): string {
  if (!key) return '';
  if (lang === 'en') return key;
  const t = STRINGS[lang]?.[key];
  return t || key;   // English fallback if Telugu missing
}

// ── Module-level current-language cache (v9.19) ──────────────────────
// Set by app/index.tsx whenever the user toggles language so that
// components which don't yet receive `lang` as a prop can call
// `trCurrent(key)` and still localize. Keeps the migration to fully-
// propagated `lang` props incremental rather than big-bang.
let _CURRENT_LANG: Lang = 'en';
export function setCurrentLang(l: Lang): void { _CURRENT_LANG = l; }
export function getCurrentLang(): Lang { return _CURRENT_LANG; }
export function trCurrent(key: string): string { return tr(key, _CURRENT_LANG); }
