/**
 * Vidhaata Chat — reusable chat UI, rendered either as an absolute overlay
 * (inside the Results modal where nested <Modal> fails on react-native-web)
 * or as a standalone <Modal>-wrapped screen.
 *
 * v6.30 — renamed from "GuruJi" to "Vidhaata" (the divine ordainer);
 * added chart-context-aware starter questions that auto-scroll as a
 * marquee; tapping any pill now auto-sends the question (no extra
 * Send press). Only free-typed custom questions still require pressing
 * Send (gated on `chatInput`).
 *
 * Extracted from app/index.tsx (v6.6 Phase 1 refactor).
 */
import React from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { GuruAvatar } from './GuruAvatar';
import { maskSourceReferences } from '../utils/text';
// v6.26: theme palette lives in a shared module so the Similar Charts
// tab can match Vidhaata's visual language exactly.
import { mdStyles, BRAND } from './mdTheme';
import {
  loadUserPrefs, setUserPref, getCachedPrefs, GURUJI_DEPTH_OPTIONS, GurujiDepth,
} from '../utils/userPrefs';
// v7.5 — Voice conversations (Web Speech API, free, no API key).
import {
  isSTTSupported, isTTSSupported, listenOnce, stopListening,
  speak, stopSpeaking,
} from '../utils/voice';

export interface SuggestedFinder {
  detected_event: string;       // e.g., "upanayana", "marriage"
  finder_event_type: string;    // canonical key for /api/muhurta-finder
  label_en: string;
  label_te: string;
  icon: string;
}

export interface MuhurtaFinderWindow {
  start_time: string;
  end_time: string;
  rating: string;              // "excellent" | "good" | "avoid"
  score?: number;
  reason?: string;
  reason_en?: string;
  reason_te?: string;
  tarabala?: { name_en?: string; name_te?: string; tara_number?: number; polarity?: string } | null;
  chandrabala?: { house?: number; polarity?: string; moon_sign_en?: string; moon_sign_te?: string } | null;
}

export interface MuhurtaFinderResult {
  date: string;
  location?: string;
  sunrise?: string;
  sunset?: string;
  tithi?: {
    paksha_en?: string; paksha_te?: string;
    tithi_number?: number; tithi_in_paksha?: number;
    tithi_name_en?: string; class_en?: string; polarity?: string;
  };
  nakshatra?: string;
  weekday?: string;
  janma_personalized?: boolean;
  panchanga_factors_used?: string[];
  best_windows?: MuhurtaFinderWindow[];
  avoid_windows?: MuhurtaFinderWindow[];
  shlokas_applied?: any[];
  summary_en?: string;
  summary_te?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  suggested_finder?: SuggestedFinder | null;
  finder_results?: MuhurtaFinderResult[] | null;
  // v7.4 — facts Vidhaata captured from the user's previous message.
  captured_facts?: Array<{
    fact_type:   string;
    value:       string;
    source:      string;
    updated?:    boolean;
  }>;
  // v7.6 — short, spoken-prose synopsis used by TTS playback. The on-screen
  // `content` stays fully detailed (tables, bullets); `spoken_summary` is
  // a 4–6 sentence natural-language version suitable for voice reading.
  spoken_summary?: string;
}

/** Chart snapshot used to generate dynamic, chart-aware starter questions. */
export interface ChatChartContext {
  ascendant_sign?: string;
  ascendant_nakshatra?: string;
  moon_sign?: string;
  moon_nakshatra?: string;
  current_mahadasha?: string;
  current_mahadasha_end?: string;
  current_antardasha?: string;
  current_antardasha_end?: string;
  active_yogas?: string[];
  planets?: Array<{ name?: string; sign?: string; house?: number; retrograde?: boolean }>;
  /** v6.32 — used to age-gate life-stage questions (marriage, children). */
  birth_date?: string;
  /** v6.44 — full birth details bundled for Vidhaata context. */
  birth_details?: {
    date?: string; time?: string; location?: string;
    latitude?: number | null; longitude?: number | null;
  };
  /** v6.44 — today's panchanga at the active location. */
  live_panchanga?: any | null;
  /** v6.44 — live transits snapshot. */
  live_transits?: any | null;
}

interface Props {
  language: 'en' | 'te';
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  chatSending: boolean;
  sendChatMessage: (override?: string) => void;
  onClose: () => void;
  onFindMuhurta?: (msgIdx: number, finder: SuggestedFinder) => void;
  finderLoadingForIdx?: number | null;
  /** v6.30 — Passed so we can generate chart-aware starter questions. */
  chartContext?: ChatChartContext | null;
  /** v6.47 — Optional top-of-screen header node. When provided, replaces
   *  the old inline Vidhaata branded header so the parent can mount the
   *  standard AstroQuest AppHeader (time/date, location, Home/User/Exit)
   *  on the Vidhaata chat page. */
  header?: React.ReactNode;
  /** v8.12 — ISO-8601 UTC timestamp when the current `crazyLambo` Expert
   *  Verification Mode session expires. `null` when power mode is OFF.
   *  A 🏎️ countdown pill renders just above the composer when truthy. */
  powerExpiresAt?: string | null;
  /** v8.12 — Called by the pill when its own clock ticks past the expiry,
   *  so the parent can clear `powerExpiresAt` (no backend round-trip). */
  onPowerExpired?: () => void;
}

// ---------------------------------------------------------------------------
// Dynamic, chart-aware question builder
// ---------------------------------------------------------------------------
// Given the user's actual chart snapshot, returns a shuffled list of concrete
// questions that reference THEIR placements by name — not generic ones. If the
// chart is missing (guest mode), returns a sensible default pool.
// ---------------------------------------------------------------------------
function buildDynamicQuestions(
  ctx: ChatChartContext | null | undefined,
  language: 'en' | 'te',
): string[] {
  // v6.48 — user locked the starter question list to the 12 general,
  // plain-English (non-technical) questions shown on the login preview.
  // Vidhaata itself stays chart-aware at answer time; the question
  // CHIPS just need to feel approachable, not technical.
  const en = language === 'en';
  return en ? [
    'What does my Lagna say about me?',
    'Which planet rules my career?',
    'Am I in a favourable Mahadasha?',
    'When is the next auspicious day?',
    'What is my Nakshatra personality?',
    'Am I Manglik?',
    'Which gemstone suits me?',
    'Tell me about my marriage yoga',
    "Today's best muhurtas?",
    'Does my chart show Raja yoga?',
    'When will I travel abroad?',
    'What are my lucky colors & numbers?',
  ] : [
    'నా లగ్నం నా గురించి ఏమి చెబుతుంది?',
    'నా కెరీర్‌ను ఏ గ్రహం పరిపాలిస్తుంది?',
    'నేను అనుకూలమైన మహాదశలో ఉన్నానా?',
    'వచ్చే శుభ దినం ఎప్పుడు?',
    'నా నక్షత్ర వ్యక్తిత్వం ఏమిటి?',
    'నేను మాంగ్లిక్‌నా?',
    'నాకు ఏ రత్నం సరిపోతుంది?',
    'నా వివాహ యోగం గురించి చెప్పండి',
    'ఈరోజు ఉత్తమ ముహూర్తాలు?',
    'నా జాతకంలో రాజయోగం ఉందా?',
    'విదేశ ప్రయాణం ఎప్పుడు?',
    'నా అదృష్ట రంగులు, అంకెలు ఏమిటి?',
  ];
}

// v6.48 — retained the richer chart-anchored generator as a helper,
// re-enabled via an opt-in flag in future screens if needed.
function buildDynamicQuestionsRich(
  ctx: ChatChartContext | null | undefined,
  language: 'en' | 'te',
): string[] {
  const en = language === 'en';
  const asc = (ctx?.ascendant_sign || '').trim();
  const moon = (ctx?.moon_sign || '').trim();
  const moonNak = (ctx?.moon_nakshatra || '').trim();
  const ascNak = (ctx?.ascendant_nakshatra || '').trim();
  const maha = (ctx?.current_mahadasha || '').trim();
  const mahaEnd = (ctx?.current_mahadasha_end || '').trim();
  const antar = (ctx?.current_antardasha || '').trim();
  const antarEnd = (ctx?.current_antardasha_end || '').trim();
  const yogas = (ctx?.active_yogas || []).filter(Boolean);
  const planets = ctx?.planets || [];
  const findPlanet = (n: string) => planets.find(p => (p.name || '').toLowerCase() === n.toLowerCase());
  const saturn = findPlanet('Saturn') || findPlanet('Shani');
  const jupiter = findPlanet('Jupiter') || findPlanet('Guru');
  const rahu = findPlanet('Rahu');
  const mars = findPlanet('Mars') || findPlanet('Mangala');
  const venus = findPlanet('Venus') || findPlanet('Shukra');
  const sun = findPlanet('Sun') || findPlanet('Surya');

  const out: string[] = [];
  const push = (s: string) => { if (s && !out.includes(s)) out.push(s); };

  // v6.32 — compute approximate age from birth_date so we can hide questions
  // that don't apply to the user's life stage (e.g. "when will I get
  // married?" for a 45-year-old). Accepts ISO "YYYY-MM-DD" and "DD/MM/YYYY".
  let age: number | null = null;
  const bd = (ctx?.birth_date || '').trim();
  if (bd) {
    const iso = bd.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dmy = bd.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})/);
    let birthYear: number | null = null;
    if (iso) birthYear = parseInt(iso[1], 10);
    else if (dmy) birthYear = parseInt(dmy[3], 10);
    if (birthYear && birthYear > 1900) {
      age = new Date().getFullYear() - birthYear;
    }
  }
  const likelyUnmarried = age === null || age < 32;       // gate marriage Qs
  const likelyPreChild  = age === null || age < 38;       // gate children Qs
  const likelyWorking   = age === null || (age >= 20 && age < 62);

  if (en) {
    // ========================================================================
    // v6.46 — Chart-anchored questions are now LAYER 1. Every prompt
    // references the user's actual placements by name so the answer
    // cannot drift into generic astrology. Life-stage questions form
    // LAYER 2, kept age-appropriate.
    // ========================================================================

    // --- LAYER 1: context-anchored (shown first, up to ~8 slots) ---
    if (maha && mahaEnd) {
      const y = mahaEnd.match(/(\d{4})/);
      if (y) push(`What outcomes should I expect from my ongoing ${maha} Mahadasha until ${y[1]}?`);
      else push(`What will my ${maha} Mahadasha bring for career and finances?`);
    } else if (maha) {
      push(`What does the ${maha} Mahadasha period mean for my life phase?`);
    }
    if (maha && antar) {
      push(`I'm in ${maha}-${antar} Bhukti now — what specific events does this sub-period trigger?`);
    }
    if (asc) push(`I have ${asc} Ascendant — what is my core personality, body type, and life purpose?`);
    if (moon && moonNak) push(`My Moon is in ${moon} (${moonNak} nakshatra) — how does my mind and emotional nature actually work?`);
    if (ascNak) push(`My Lagna nakshatra is ${ascNak} — explain its pada characteristics and life path.`);
    if (yogas[0]) push(`Tell me about the ${yogas[0]} yoga in my chart — its trigger and timing.`);
    if (yogas[1]) push(`How does ${yogas[1]} yoga interact with the rest of my chart?`);
    if (saturn?.house) push(`Saturn is in my ${ordinal(saturn.house!)} house — what lessons and delays is it bringing?`);
    if (jupiter?.house) push(`Jupiter is in my ${ordinal(jupiter.house!)} house — where is grace flowing in my life?`);
    if (rahu?.house) push(`Rahu sits in my ${ordinal(rahu.house!)} house — what am I obsessively chasing this lifetime?`);
    if (venus?.house) push(`Venus in my ${ordinal(venus.house!)} house — what is my love and marriage pattern?`);
    if (mars?.house) push(`Mars in my ${ordinal(mars.house!)} house — where is my courage and conflict focused?`);
    if (sun?.house) push(`Sun in my ${ordinal(sun.house!)} house — where will I earn recognition?`);

    // --- LAYER 2: life-stage questions (concrete, no drift) ---
    push('Will my career grow in the next 12 months based on my current dasha?');
    if (likelyWorking) push('Will I get a promotion or job change in the next 6 months?');
    push('Are the next 2 years financially favourable for me?');
    if (likelyUnmarried) push('When is the likely timing of my marriage from my chart?');
    if (likelyPreChild) push('When will I have children — what does my 5th house say?');
    push('Are there foreign-travel or settlement yogas active for me right now?');
    push('Should I start a business this year or wait for a better dasha period?');
    push('Which areas of life need caution over the next 12 months?');
    push('What remedies does my chart specifically need — mantra, stone, or charity?');
    push('Is there a Sade Sati or Ashtama Shani phase active for me now?');
  } else {
    // ========================================================================
    // Telugu pack — same simple-first structure
    // ========================================================================
    push('ఈ సంవత్సరం నా కెరీర్ ఎలా పెరుగుతుంది?');
    if (likelyWorking) push('రాబోయే 6 నెలల్లో ఉద్యోగ మార్పు ఉంటుందా?');
    if (likelyWorking) push('ఈ సంవత్సరం ప్రమోషన్ లేదా జీతం పెరుగుదల ఉంటుందా?');
    push('ఈ సంవత్సరం ఇల్లు కొనుగోలు చేయగలనా?');
    push('నేను విదేశాలకు వెళ్తానా?');
    push('US వీసా వస్తుందా?');
    if (likelyUnmarried) push('నాకు వివాహం ఎప్పుడు అవుతుంది?');
    if (likelyUnmarried) push('ప్రేమ వివాహమా లేక ఏర్పాటు వివాహమా?');
    if (likelyPreChild) push('సంతానం ఎప్పుడు కలుగుతుంది?');
    push('రాబోయే 1 సంవత్సరంలో ఆర్థిక పరిస్థితి మెరుగుపడుతుందా?');
    push('సొంత వ్యాపారం ప్రారంభించాలా? ఎప్పుడు మంచిది?');
    push('నాకు అనుకూల కాలం ఎప్పుడు వస్తుంది?');
    push('రాబోయే 2 సంవత్సరాలు నా జీవితం ఎలా ఉంటుంది?');
    push('నాకు ఆరోగ్య సమస్యలు ఉంటాయా?');
    push('ఈ సంవత్సరం పెద్ద నిర్ణయాలు తీసుకోవచ్చా?');
    push('నా జీవితం ఎప్పుడు స్థిరపడుతుంది?');
    push('ఇప్పుడు భూమి/స్టాక్ లో పెట్టుబడి పెట్టవచ్చా?');
    push('ఈ లేదా వచ్చే సంవత్సరం విదేశ ప్రయాణం?');

    if (maha) {
      if (mahaEnd) {
        const yearMatch = mahaEnd.match(/(\d{4})/);
        if (yearMatch) push(`${yearMatch[1]} వరకు నా ${maha} దశ ఏమి తెస్తుంది?`);
      } else {
        push(`${maha} లో నా జీవితం ఎలా ఉంది?`);
      }
    }
    if (yogas[0]) push(`${yogas[0]} నాకు అనుకూలంగా ఉందా?`);
    if (asc) push('నా చార్ట్ ప్రకారం నేను ఎలాంటి వ్యక్తిని?');
    if (moon) push('నా మనస్సు, భావాలు ఎలా పనిచేస్తాయి?');

    if (saturn?.house) push('శని నన్ను ఇప్పుడు ఆపుతున్నాడా?');
    if (jupiter?.house) push('గురువు ఎక్కడ అదృష్టం ఇస్తున్నాడు?');
    if (rahu?.house) push('ఈ జీవితంలో నేను దేనిని వెతుకుతున్నాను?');
    if (venus?.house) push('నా ప్రేమ జీవితం ఎలా ఉంటుంది?');
  }

  // Shuffle for variety — but stable per render (Fisher-Yates on a copy).
  // Important: shuffle only the first half (curiosity layer) so the simpler
  // questions don't get buried at position 16+. The technical layer stays at
  // the bottom of the pool as natural fill.
  const layer1End = Math.min(18, out.length);
  for (let i = layer1End - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, 16);
}

function houseSuffix(n: number): string {
  if (n >= 11 && n <= 13) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

// v6.46 — compact "1st / 2nd / 3rd / 4th" builder used by the chart-anchored
// question generator so prompts read naturally ("Saturn in my 10th house").
function ordinal(n: number): string {
  return `${n}${houseSuffix(n)}`;
}

// ---------------------------------------------------------------------------
// OPTIONS extraction — parses trailing "OPTIONS: A | B | C" marker emitted by
// Vidhaata when it invites the user to pick. Returns cleaned content + list.
// ---------------------------------------------------------------------------
export function extractOptions(content: string): { cleaned: string; options: string[] } {
  if (!content) return { cleaned: '', options: [] };
  // Match the last OPTIONS: line (tolerates leading whitespace + optional blockquote).
  const re = /(^|\n)\s*>?\s*OPTIONS:\s*([^\n]+)\s*$/i;
  const m = content.match(re);
  if (!m) return { cleaned: content, options: [] };
  const raw = m[2] || '';
  const options = raw
    .split(/\s*\|\s*/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  const cleaned = content.replace(re, '').trimEnd();
  return { cleaned, options };
}

/**
 * v8.6.2 — VidhaataWaitIndicator
 *
 * Live "Vidhaata is thinking… N.Ns" counter — resets each time the
 * host re-mounts this (i.e., every new chatSending cycle) and ticks at
 * 100 ms so users can literally see how fast (or slow) the reply is
 * coming back. Added for latency-testing during the v8.6 / v8.6.1
 * perf rollout — easy to remove later by replacing with a static text.
 */
const VidhaataWaitIndicator: React.FC<{ language: 'en' | 'te' }> = ({ language }) => {
  const startRef = React.useRef<number>(Date.now());
  const [elapsed, setElapsed] = React.useState<number>(0);
  React.useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, []);
  const base = language === 'en' ? 'Vidhaata is thinking…' : 'విధాత ఆలోచిస్తున్నారు…';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <ActivityIndicator size="small" color="#4338CA" />
      <Text style={{ marginLeft: 8, fontSize: 12, color: '#6B7280', fontStyle: 'italic' }}>
        {base}
      </Text>
      <Text style={{
        marginLeft: 6, fontSize: 12, color: '#4338CA', fontWeight: '800',
        fontVariant: ['tabular-nums'],  // keeps the digits from jumping width
      }}>
        {elapsed.toFixed(1)}s
      </Text>
    </View>
  );
};


/**
 * v8.12 — PowerModePill
 *
 * The 🏎️ Expert Verification Mode countdown chip shown just above the
 * composer when the user has an active `crazyLambo` session. Displays
 * remaining minutes/seconds, ticks down locally every 10 s (no backend
 * polling), and fires `onExpired` once the clock passes the expiry.
 * Tapping the chip triggers `onEndSession` so the user can end the
 * session one-handed without typing `exit`.
 */
const PowerModePill: React.FC<{
  language: 'en' | 'te';
  expiresAt?: string | null;
  onExpired?: () => void;
  onEndSession?: () => void;
}> = ({ language, expiresAt, onExpired, onEndSession }) => {
  const [now, setNow] = React.useState<number>(() => Date.now());

  // Re-render every 10 s so the displayed countdown stays fresh without
  // burning CPU with second-by-second repaints.
  React.useEffect(() => {
    if (!expiresAt) return;
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const exp = Date.parse(expiresAt);
  if (!Number.isFinite(exp)) return null;
  const remainingMs = exp - now;

  // Expired — fire the callback once; keep the component rendering
  // a "session ended" chip for ~3 s to give visual confirmation.
  if (remainingMs <= 0) {
    if (onExpired) {
      // Defer to next tick so we don't setState-during-render.
      setTimeout(() => { try { onExpired(); } catch {} }, 0);
    }
    return null;
  }

  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const label = mins >= 1
    ? (language === 'en' ? `${mins} min left` : `${mins} నిమి మిగిలి`)
    : (language === 'en' ? `${secs}s left`   : `${secs}సె మిగిలి`);

  return (
    <TouchableOpacity
      testID="power-mode-pill"
      accessibilityLabel={language === 'en'
        ? `Expert Verification Mode active, ${mins} minutes remaining. Tap to end session.`
        : `నిపుణుల ధృవీకరణ మోడ్ సక్రియంగా ఉంది, ${mins} నిమిషాలు మిగిలి. సెషన్‌ను ముగించడానికి ట్యాప్ చేయండి.`}
      onPress={onEndSession}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 7, paddingHorizontal: 12,
        backgroundColor: '#FEF3C7',
        borderTopWidth: 1, borderTopColor: '#FDE68A',
        borderBottomWidth: 1, borderBottomColor: '#FDE68A',
      }}
    >
      <Text style={{ fontSize: 14, marginRight: 6 }}>🏎️</Text>
      <Text style={{
        color: '#92400E', fontSize: 12, fontWeight: '700',
        marginRight: 8,
      }}>
        {language === 'en' ? 'Expert Verification Mode' : 'నిపుణుల ధృవీకరణ మోడ్'}
      </Text>
      <View style={{
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1, borderColor: '#FCD34D',
      }}>
        <Text style={{
          color: '#92400E', fontSize: 11, fontWeight: '700',
          fontVariant: ['tabular-nums'],
        }}>
          {label}
        </Text>
      </View>
      <Text style={{
        marginLeft: 8, fontSize: 10, color: '#B45309',
        fontStyle: 'italic',
      }}>
        {language === 'en' ? 'tap to end' : 'ట్యాప్ చేసి ముగించండి'}
      </Text>
    </TouchableOpacity>
  );
};


/** Inner body of the chat screen (header + scrolling messages + input bar). */
export const ChatBody: React.FC<Props> = ({
  language, chatMessages, chatInput, setChatInput, chatSending,
  sendChatMessage, onClose, onFindMuhurta, finderLoadingForIdx,
  chartContext, header,
  powerExpiresAt, onPowerExpired,
}) => {
  // v7.5 — Voice conversation state (Web Speech API).
  //   listening = mic is recording
  //   ttsEnabled = user has toggled "read replies aloud"
  //   isSpeaking = speechSynthesis is currently playing (polled from API)
  //   sttAvailable / ttsAvailable = client-only capability detection
  //     (uses useEffect so we don't evaluate `window` during SSR/static export).
  const [listening, setListening]   = React.useState(false);
  const [ttsEnabled, setTtsEnabled] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [sttAvailable, setSttAvailable] = React.useState(false);
  const [ttsAvailable, setTtsAvailable] = React.useState(false);
  const lastSpokenIdx = React.useRef<number>(-1);

  // Client-only capability sniff — runs AFTER hydration so the mic / speaker
  // icons show up on browsers that support Web Speech (Chrome / Edge /
  // Safari / Brave) and stay hidden on Firefox / SSR render.
  React.useEffect(() => {
    setSttAvailable(isSTTSupported());
    setTtsAvailable(isTTSSupported());
  }, []);

  // v7.6 — Poll `speechSynthesis.speaking` every 300 ms so the UI
  // (a) disables the mic while TTS is playing (no self-echo)
  // (b) shows a "🔊 Vidhaata is speaking…" banner
  // (c) auto-stops any active listening session if TTS kicks in.
  React.useEffect(() => {
    if (!ttsAvailable) return;
    const iv = setInterval(() => {
      try {
        const synth: any = (typeof window !== 'undefined')
          ? (window as any).speechSynthesis
          : null;
        const sp = !!(synth && (synth.speaking || synth.pending));
        setIsSpeaking((prev) => (prev !== sp ? sp : prev));
        if (sp && listening) {
          try { stopListening(); } catch { /* ignore */ }
          setListening(false);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearInterval(iv);
  }, [ttsAvailable, listening]);

  // Auto-speak the latest assistant reply when TTS is ON.
  // v7.6 — prefer the backend-provided `spoken_summary` (4–6 sentence
  // conversational synopsis). Fall back to the full reply only if the
  // summary is absent (e.g. legacy cached replies, teaser-masked replies).
  React.useEffect(() => {
    if (!ttsEnabled || !ttsAvailable) return;
    if (!chatMessages || chatMessages.length === 0) return;
    const lastIdx = chatMessages.length - 1;
    const last = chatMessages[lastIdx];
    if (last?.role !== 'assistant') return;
    if (lastSpokenIdx.current === lastIdx) return;
    lastSpokenIdx.current = lastIdx;
    const textToSpeak = (last.spoken_summary && last.spoken_summary.trim())
      ? last.spoken_summary
      : (last.content || '');
    speak(textToSpeak, language);
  }, [chatMessages, ttsEnabled, ttsAvailable, language]);

  // Stop any ongoing speech when closing the chat / unmounting.
  React.useEffect(() => {
    return () => {
      try { stopSpeaking(); } catch { /* ignore */ }
      try { stopListening(); } catch { /* ignore */ }
    };
  }, []);

  const handleMicPress = async () => {
    if (!sttAvailable || chatSending) return;
    if (listening) {
      // user tapped again to stop early
      try { stopListening(); } catch { /* ignore */ }
      setListening(false);
      return;
    }
    try {
      setListening(true);
      const finalText = await listenOnce(language, (interim) => {
        setChatInput(interim);
      });
      setListening(false);
      const cleaned = (finalText || '').trim();
      if (cleaned) {
        setChatInput(cleaned);
        // Auto-send the heard question — voice users expect hands-free.
        setTimeout(() => sendChatMessage(cleaned), 80);
      }
    } catch (e) {
      setListening(false);
    }
  };

  const handleToggleTTS = () => {
    if (!ttsAvailable) return;
    if (ttsEnabled) {
      try { stopSpeaking(); } catch { /* ignore */ }
    }
    setTtsEnabled((v) => !v);
  };
  // v6.30: dynamic, chart-aware questions. Re-memoed when language or the
  // core chart identity (ascendant/moon/mahadasha) changes — NOT on every
  // re-render, so the marquee doesn't reshuffle while the user is reading.
  const dynamicQuestions = React.useMemo(
    () => buildDynamicQuestions(chartContext, language),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      language,
      chartContext?.ascendant_sign,
      chartContext?.moon_sign,
      chartContext?.current_mahadasha,
      chartContext?.current_antardasha,
      (chartContext?.active_yogas || []).join('|'),
    ],
  );

  // v6.21: rotating elegant taglines shown below each Vidhaata reply in place
  // of the old "📚 Sources: …" line (which was leaking source labels like
  // "DBPC Famous Chart: …", "DBPC TOC Situation: …", etc.).
  const taglines = language === 'en' ? [
    '🪷 Rooted in classical tradition',
    '✨ Timeless wisdom, personal insight',
    '🕉 From the living tradition',
    '🌸 Ancient lineage, contemplative guidance',
    '📜 Drawn from the classical corpus',
    '☀️ Grounded in dharmic tradition',
  ] : [
    '🪷 శాస్త్రీయ సంప్రదాయంలో పాతుకుపోయింది',
    '✨ శాశ్వత జ్ఞానం, వ్యక్తిగత అంతర్దృష్టి',
    '🕉 జీవంత సంప్రదాయం నుండి',
    '🌸 ప్రాచీన వంశం, ప్రతిబింబ మార్గదర్శనం',
    '📜 శాస్త్రీయ సంకలనం నుండి',
    '☀️ ధర్మ సంప్రదాయంలో ఆధారపడిన',
  ];
  const pickTagline = (i: number) => taglines[i % taglines.length];

  return (
    <>
      {/* v6.47 — Unified header.
          When `header` is provided (parent injects the standard AstroQuest
          AppHeader with clock + location + Home/Profile/Logout), use it.
          Else fall back to the legacy Vidhaata-branded bar. */}
      {header ? (
        header
      ) : (
        <View style={{
          flexDirection: 'row', alignItems: 'center', padding: 12,
          borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#FFFFFF',
        }}>
          <GuruAvatar size={68} glow />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1F2937' }}>
              {language === 'en' ? 'Vidhaata' : 'విధాత'}
            </Text>
            <Text style={{ fontSize: 10, color: '#6B7280' }}>
              {language === 'en' ? '🪷 Rooted in classical wisdom' : '🪷 శాస్త్రీయ జ్ఞానంలో పాతుకుపోయిన'}
            </Text>
          </View>
          <TouchableOpacity testID="close-chat-btn" onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        style={{ flex: 1, padding: 12 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        ref={(ref) => { if (ref) setTimeout(() => ref.scrollToEnd({ animated: true }), 100); }}
      >
        {chatMessages.length === 0 && (
          <View style={{ alignItems: 'center', padding: 16 }}>
            {/* v6.48 — consolidated intro: small Guru avatar + the unified
                6×2 grid. The old stacked double-title block was removed
                since the v6.48 block below already carries the label. */}
            <GuruAvatar size={54} glow />

            {/* v6.48 — 6×2 grid (12 chips), matching the login-preview
                landing. Deep-indigo text on white, soft purple border.
                Questions are plain-English (non-technical) per user
                feedback — chart-aware reasoning happens server-side. */}
            <Text style={{
              fontSize: 14, fontWeight: '800', color: '#C2410C',
              marginTop: 20, marginBottom: 6,
              textAlign: 'center', letterSpacing: 1.4,
            }}>
              {language === 'en' ? 'ASK VIDHAATA' : 'విధాతను అడగండి'}
            </Text>
            <Text style={{
              fontSize: 20, fontWeight: '800', color: '#312E81',
              textAlign: 'center', marginBottom: 8,
            }}>
              {language === 'en' ? 'Ayushmaan Bhava 🙏 I am Vidhaata' : 'ఆయుష్మాన్ భవ 🙏 నేను విధాత'}
            </Text>
            <Text style={{
              fontSize: 12.5, color: '#475569',
              textAlign: 'center', marginBottom: 16, lineHeight: 18,
              paddingHorizontal: 6,
            }}>
              {language === 'en'
                ? 'Ask anything about your chart, dashas, muhurtas or yogas — pick a question below to begin.'
                : 'మీ జాతకం, దశలు, ముహూర్తాలు లేదా యోగాల గురించి ఏదైనా అడగండి — ప్రారంభించడానికి క్రింద ఒక ప్రశ్నను ఎంచుకోండి.'}
            </Text>
            <View style={{
              width: '100%',
              flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
            }}>
              {dynamicQuestions.slice(0, 12).map((q, i) => (
                <TouchableOpacity
                  key={i}
                  disabled={chatSending}
                  activeOpacity={0.75}
                  onPress={() => sendChatMessage(q)}
                  style={{
                    width: '48.5%',
                    paddingHorizontal: 14, paddingVertical: 14,
                    marginBottom: 10,
                    borderRadius: 14,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1.2, borderColor: '#C7D2FE',
                    shadowColor: '#312E81',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 1,
                    minHeight: 64,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontSize: 13, color: '#312E81', fontWeight: '700', lineHeight: 17 }}
                    numberOfLines={3}
                  >
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {chatMessages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              // v7.3 — restored classical aesthetic (per user screenshot):
              //   assistant: cream body + gold hairline, indigo "Vidhaata" label
              //   user:      deep indigo bubble for thread clarity
              backgroundColor: m.role === 'user' ? '#4338CA' : BRAND.cream,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              marginBottom: 10,
              maxWidth: m.role === 'assistant' ? '98%' : '88%',
              borderWidth: m.role === 'assistant' ? 1.2 : 0,
              borderColor: BRAND.goldLine,
            }}
          >
            {m.role === 'assistant' && (
              <Text style={{
                fontSize: 12, fontWeight: '700',
                color: '#4338CA',
                marginBottom: 6,
              }}>
                🧘‍♂️ Vidhaata
              </Text>
            )}
            {m.role === 'assistant' ? (
              (() => {
                // v6.31: extract trailing OPTIONS line → render as tappable pills.
                // v6.39: also strip the [[TEASER_MASK]] marker and render a
                //   blurred teaser block in its place with an upgrade CTA.
                const raw = m.content || '';
                const hasTeaser = raw.includes('[[TEASER_MASK]]');
                const withoutMask = raw.replace(/\n*\[\[TEASER_MASK\]\]\n*/g, '');
                const { cleaned, options } = extractOptions(withoutMask);
                return (
                  <>
                    <Markdown style={mdStyles as any}>
                      {maskSourceReferences(cleaned)}
                    </Markdown>
                    {hasTeaser ? (
                      <View style={{
                        marginTop: 10, padding: 12, borderRadius: 10,
                        backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE',
                      }}>
                        <View style={{
                          height: 10, backgroundColor: '#C7D2FE', borderRadius: 4,
                          width: '90%', marginBottom: 6, opacity: 0.6,
                        }} />
                        <View style={{
                          height: 10, backgroundColor: '#C7D2FE', borderRadius: 4,
                          width: '74%', marginBottom: 6, opacity: 0.45,
                        }} />
                        <View style={{
                          height: 10, backgroundColor: '#C7D2FE', borderRadius: 4,
                          width: '82%', marginBottom: 10, opacity: 0.3,
                        }} />
                        <Text style={{ fontSize: 12, color: '#3730A3', fontWeight: '700', letterSpacing: 0.2 }}>
                          🔒 Deep analysis hidden — Upgrade to Full Access for the complete reading.
                        </Text>
                      </View>
                    ) : null}
                    {options.length > 0 && (
                      <View style={{
                        flexDirection: 'row', flexWrap: 'wrap',
                        marginTop: 10, marginHorizontal: -3,
                      }}>
                        {options.map((opt, oi) => (
                          <TouchableOpacity
                            key={oi}
                            disabled={chatSending}
                            activeOpacity={0.75}
                            onPress={() => sendChatMessage(opt)}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 8,
                              margin: 3,
                              borderRadius: 20,
                              backgroundColor: '#EEF2FF',
                              borderWidth: 1.3, borderColor: '#4338CA',
                            }}
                          >
                            <Text style={{ fontSize: 12, color: '#312E81', fontWeight: '700' }}>
                              ▸ {opt}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()
            ) : (
              <Text style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 20 }}>
                {m.content}
              </Text>
            )}
            {m.sources && m.sources.length > 0 && (
              <Text style={{ fontSize: 9, color: '#B45309', marginTop: 6, fontStyle: 'italic', opacity: 0.85 }}>
                {pickTagline(i)}
              </Text>
            )}
            {/* v7.4 — Memory capture chip. Shown below the reply whenever
                Vidhaata stored one or more durable life facts from the
                user's previous message. Tappable → takes user to Profile. */}
            {m.role === 'assistant' && m.captured_facts && m.captured_facts.length > 0 && (
              <View style={{
                marginTop: 10,
                flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
                gap: 6,
                paddingTop: 8,
                borderTopWidth: 1, borderTopColor: BRAND.goldLine,
              }}>
                <Ionicons name="bookmark" size={11} color={BRAND.maroon} />
                <Text style={{
                  fontSize: 10.5, fontWeight: '800',
                  color: BRAND.maroon,
                  letterSpacing: 0.5,
                }}>
                  REMEMBERED:
                </Text>
                {m.captured_facts.slice(0, 3).map((f, fi) => (
                  <View
                    key={fi}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 999,
                      paddingHorizontal: 8, paddingVertical: 3,
                      borderWidth: 1, borderColor: BRAND.goldLine,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, color: BRAND.text, fontWeight: '600' }}>
                      {f.fact_type.replace(/_/g, ' ')}: {f.value}
                    </Text>
                  </View>
                ))}
                <Text style={{ fontSize: 10, color: BRAND.faint, marginLeft: 2, fontStyle: 'italic' }}>
                  (Profile → Vidhaata Memory to edit)
                </Text>
              </View>
            )}
            {m.role === 'assistant' && m.finder_results && m.finder_results.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <View style={{
                  paddingHorizontal: 10, paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: '#FFF7ED',   // BRAND.cream
                  borderWidth: 1.2, borderColor: '#F3D9A4',  // BRAND.goldLine
                  marginBottom: 10,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309', letterSpacing: 1.2 }}>
                    {language === 'en' ? '✦ AUSPICIOUS DATES — NEXT 14 DAYS' : '✦ శుభ తేదీలు — రాబోయే 14 రోజులు'}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#7F1D1D', marginTop: 4 }}>
                    {language === 'en' ? `${m.finder_results.length} windows selected` : `${m.finder_results.length} ముహూర్తాలు`}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' }}>
                    {language === 'en'
                      ? 'Ranked by Tarabala · Chandrabala · Tithi class — personalized from your Janma Nakshatra.'
                      : 'తారాబలం · చంద్రబలం · తిథి — మీ జన్మ నక్షత్రం ఆధారంగా.'}
                  </Text>
                </View>

                {m.finder_results.slice(0, 7).map((fr, fi) => {
                  const tithiName = fr.tithi
                    ? `${fr.tithi.paksha_en || ''} ${fr.tithi.tithi_name_en || ''}`.trim()
                    : '—';
                  const tithiClass = (fr.tithi?.class_en || '').toLowerCase();
                  const isRikta = tithiClass.includes('rikta');
                  const isNanda = tithiClass.includes('nanda');
                  const isBhadra = tithiClass.includes('bhadra');
                  const isJaya = tithiClass.includes('jaya');
                  const isPoorna = tithiClass.includes('poorna') || tithiClass.includes('purna');
                  // --- Do/Don't derivation (classical Muhurta Chintamani) ---
                  const dos: string[] = [];
                  const donts: string[] = [];
                  if (isNanda)  dos.push(language === 'en' ? 'Celebrations, arts, music, naming rites' : 'వేడుకలు, కళలు, నామకరణం');
                  if (isBhadra) dos.push(language === 'en' ? 'Business launches, vehicle/property, courage-demanding work' : 'వ్యాపార ప్రారంభం, వాహనం/ఆస్తి');
                  if (isJaya)   dos.push(language === 'en' ? 'Competitions, lawsuits, bold decisions, land deals' : 'పోటీలు, వివాదాలు, భూ వ్యవహారాలు');
                  if (isPoorna) dos.push(language === 'en' ? 'Marriage, housewarming, finishing big projects, sacred rites' : 'వివాహం, గృహప్రవేశం, శుభ కార్యాలు');
                  if (isRikta)  donts.push(language === 'en' ? 'ALL new initiations — Rikta tithi is inauspicious for shubh karya' : 'కొత్త ప్రారంభాలు అన్నీ — రిక్తా తిథి నిషేధం');
                  // Nakshatra hints
                  const nak = (fr.nakshatra || '').toLowerCase();
                  if (nak.includes('pushya')) dos.push(language === 'en' ? 'King of nakshatras — suits almost all auspicious works' : 'పుష్యమి — అన్ని శుభ కార్యాలకు శ్రేష్ఠం');
                  if (nak.includes('rohini') || nak.includes('mrigashira') || nak.includes('hasta') || nak.includes('uttara') || nak.includes('shravana') || nak.includes('sravana') || nak.includes('anuradha') || nak.includes('revati')) {
                    dos.push(language === 'en' ? 'Marriage, travel, foundation-laying, vows' : 'వివాహం, ప్రయాణం, ప్రతిష్ఠ');
                  }
                  if (nak.includes('bharani') || nak.includes('krittika') || nak.includes('ashlesha') || nak.includes('magha') || nak.includes('jyeshtha') || nak.includes('mula') || nak.includes('ashvini')) {
                    donts.push(language === 'en' ? `${fr.nakshatra} — avoid marriage, housewarming, delicate rites` : `${fr.nakshatra} — శుభ కార్యాలు వదిలేయండి`);
                  }
                  // Weekday hints
                  const wd = (fr.weekday || '').toLowerCase();
                  if (wd.includes('tuesday')) donts.push(language === 'en' ? 'Tuesday — avoid marriage, lending, medicine' : 'మంగళవారం — వివాహం, అప్పులు వదిలేయండి');
                  if (wd.includes('saturday')) donts.push(language === 'en' ? 'Saturday — avoid new ventures, travel for pleasure' : 'శనివారం — కొత్త ప్రారంభాలు వదిలేయండి');
                  if (wd.includes('thursday')) dos.push(language === 'en' ? 'Thursday (Guru-vara) — ideal for marriage, study, charity' : 'గురువారం — వివాహం, దాన ధర్మాలు');
                  if (wd.includes('friday'))  dos.push(language === 'en' ? 'Friday (Shukra-vara) — ideal for arts, purchases, romance' : 'శుక్రవారం — కళలు, కొనుగోళ్లు');
                  // Dedupe & cap
                  const uniq = (arr: string[]) => Array.from(new Set(arr)).slice(0, 3);
                  const dosL = uniq(dos);
                  const dontsL = uniq(donts);

                  return (
                    <View
                      key={fi}
                      style={{
                        borderWidth: 1.3,
                        borderColor: isRikta ? '#9F1239' : '#F3D9A4',
                        borderRadius: 10,
                        marginBottom: 12,
                        backgroundColor: '#FFFFFF',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Header ribbon */}
                      <View style={{
                        backgroundColor: isRikta ? '#FEE2E2' : '#FFF7ED',
                        paddingHorizontal: 12, paddingVertical: 8,
                        borderBottomWidth: 1, borderBottomColor: '#F3D9A4',
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#7F1D1D' }}>
                          {fr.date} · {fr.weekday || '—'}
                        </Text>
                        <Text style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3 }}>
                          {language === 'en' ? 'Tithi: ' : 'తిథి: '}{tithiName}
                          {fr.tithi?.class_en ? ` (${fr.tithi.class_en})` : ''}
                          {fr.nakshatra ? ` · ${language === 'en' ? 'Nakshatra' : 'నక్షత్రం'}: ${fr.nakshatra}` : ''}
                        </Text>
                        {(fr.sunrise || fr.sunset) && (
                          <Text style={{ fontSize: 10.5, color: '#6B7280', marginTop: 2 }}>
                            ☀︎ {fr.sunrise || '—'} – {fr.sunset || '—'}
                          </Text>
                        )}
                      </View>

                      {/* Best windows */}
                      {(fr.best_windows && fr.best_windows.length > 0) && (
                        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.5 }}>
                            ✓ {language === 'en' ? 'AUSPICIOUS WINDOWS' : 'శుభ సమయాలు'}
                          </Text>
                          {fr.best_windows.map((w, wi) => (
                            <View key={`b${wi}`} style={{
                              flexDirection: 'row', alignItems: 'center',
                              marginTop: 5, paddingVertical: 4, paddingHorizontal: 8,
                              backgroundColor: '#ECFDF5',
                              borderRadius: 6,
                              borderWidth: 1, borderColor: '#A7F3D0',
                            }}>
                              <Ionicons name="time" size={13} color="#047857" />
                              <Text style={{ flex: 1, fontSize: 12, color: '#065F46', fontWeight: '700', marginLeft: 6 }}>
                                {w.start_time}–{w.end_time}
                              </Text>
                              {w.tarabala?.name_en && (
                                <View style={{
                                  paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
                                  backgroundColor: '#D1FAE5',
                                }}>
                                  <Text style={{ fontSize: 9.5, color: '#047857', fontWeight: '700' }}>
                                    {w.tarabala.name_en}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Do's */}
                      {dosL.length > 0 && (
                        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.5 }}>
                            ✓ {language === 'en' ? 'SUITABLE FOR' : 'అనుకూలం'}
                          </Text>
                          {dosL.map((d, di) => (
                            <Text key={di} style={{ fontSize: 11.5, color: '#1F2937', marginTop: 3, lineHeight: 17 }}>
                              •  {d}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Avoid windows */}
                      {(fr.avoid_windows && fr.avoid_windows.length > 0) && (
                        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#9F1239', letterSpacing: 0.5 }}>
                            ✗ {language === 'en' ? 'AVOID WINDOWS' : 'వర్జితం'}
                          </Text>
                          {fr.avoid_windows.map((w, wi) => (
                            <View key={`a${wi}`} style={{
                              flexDirection: 'row', alignItems: 'center',
                              marginTop: 5, paddingVertical: 4, paddingHorizontal: 8,
                              backgroundColor: '#FEF2F2',
                              borderRadius: 6,
                              borderWidth: 1, borderColor: '#FECACA',
                            }}>
                              <Ionicons name="close-circle" size={13} color="#9F1239" />
                              <Text style={{ flex: 1, fontSize: 12, color: '#7F1D1D', fontWeight: '700', marginLeft: 6 }}>
                                {w.start_time}–{w.end_time}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Don'ts */}
                      {dontsL.length > 0 && (
                        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#9F1239', letterSpacing: 0.5 }}>
                            ✗ {language === 'en' ? 'AVOID' : 'నిషేధం'}
                          </Text>
                          {dontsL.map((d, di) => (
                            <Text key={di} style={{ fontSize: 11.5, color: '#1F2937', marginTop: 3, lineHeight: 17 }}>
                              •  {d}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {/* Muhurta suggestion CTA */}
            {m.role === 'assistant' && m.suggested_finder && onFindMuhurta && !m.finder_results && (
              <TouchableOpacity
                onPress={() => onFindMuhurta(i, m.suggested_finder as SuggestedFinder)}
                disabled={finderLoadingForIdx === i}
                style={{
                  marginTop: 8, paddingVertical: 8, paddingHorizontal: 12,
                  backgroundColor: '#4338CA', borderRadius: 10,
                  flexDirection: 'row', alignItems: 'center',
                }}
              >
                {finderLoadingForIdx === i ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="calendar" size={14} color="#FFFFFF" />
                )}
                <Text style={{ marginLeft: 8, color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  {language === 'en'
                    ? `Find best dates for ${m.suggested_finder.label_en}`
                    : `${m.suggested_finder.label_te} శుభ తేదీలు చూపించు`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* v8.6.2 — Vidhaata wait indicator with live seconds counter.
            Resets on every new chatSending transition and ticks every
            100 ms so the user sees "Vidhaata is thinking… 2.4 s". */}
        {chatSending && <VidhaataWaitIndicator language={language} />}
      </ScrollView>

      {/* v6.28 — depth selector chip row sits above the input so the user can
          tune answer verbosity without leaving the chat. */}
      <DepthChipsRow language={language} />

      {/* Smart follow-up chips — context-aware + chart-aware, horizontally
          scrollable. Renders 12 pills blending conversation topic with the
          user's actual chart data. Tapping auto-sends (no Send press). */}
      {chatMessages.length > 0 && (
        <ChatSuggestionChips
          messages={chatMessages}
          language={language}
          sending={chatSending}
          chartContext={chartContext}
          dynamicChartQuestions={dynamicQuestions}
          onTap={(txt) => sendChatMessage(txt)}
        />
      )}

      {/* v7.6 — "Vidhaata is speaking" banner while TTS is playing.
          Renders ABOVE the input bar so the user clearly sees why the mic
          is temporarily unavailable. Tapping anywhere on the banner
          instantly mutes/cancels the speech. */}
      {isSpeaking ? (
        <TouchableOpacity
          testID="speaking-banner"
          onPress={() => { try { stopSpeaking(); } catch {} setIsSpeaking(false); }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 8, paddingHorizontal: 12,
            backgroundColor: '#E0E7FF',
            borderTopWidth: 1, borderTopColor: '#C7D2FE',
          }}
          accessibilityLabel={language === 'en' ? 'Tap to stop voice playback' : 'వాయిస్ ప్లేబ్యాక్ ఆపడానికి ట్యాప్ చేయండి'}
        >
          <Ionicons name="volume-high" size={14} color="#4338CA" />
          <Text style={{ color: '#4338CA', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
            {language === 'en' ? 'Vidhaata is speaking — tap to stop' : 'విధాత మాట్లాడుతున్నారు — ఆపడానికి ట్యాప్ చేయండి'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* v8.12 — Expert Verification Mode (crazyLambo) countdown pill.
          Renders only when `powerExpiresAt` is set. Tapping it types `exit`
          into the composer as a shortcut to end the session immediately. */}
      <PowerModePill
        language={language}
        expiresAt={powerExpiresAt}
        onExpired={onPowerExpired}
        onEndSession={() => {
          // Type `exit` into composer + send, to let the backend tear down
          // the session cleanly (delete DB row + confirmation reply).
          try { sendChatMessage('exit'); } catch {}
        }}
      />

      {/* Input — typed custom questions STILL require pressing Send */}
      <View style={{
        flexDirection: 'row', padding: 10, borderTopWidth: 1,
        borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF',
        alignItems: 'center',
      }}>
        {/* v7.5 — Speaker toggle: reads replies aloud. Hidden if TTS unsupported. */}
        {ttsAvailable ? (
          <TouchableOpacity
            testID="tts-toggle-btn"
            onPress={handleToggleTTS}
            accessibilityLabel={ttsEnabled
              ? (language === 'en' ? 'Turn off voice replies' : 'వాయిస్ సమాధానాలు ఆపు')
              : (language === 'en' ? 'Turn on voice replies' : 'వాయిస్ సమాధానాలు ఆన్ చేయి')}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: ttsEnabled ? '#E0E7FF' : '#F3F4F6',
              borderWidth: ttsEnabled ? 1.5 : 0,
              borderColor: '#4338CA',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 6,
            }}
          >
            <Ionicons
              name={ttsEnabled ? 'volume-high' : 'volume-mute'}
              size={18}
              color={ttsEnabled ? '#4338CA' : '#6B7280'}
            />
          </TouchableOpacity>
        ) : null}
        <TextInput
          style={{
            flex: 1, padding: 10, backgroundColor: '#F3F4F6',
            borderRadius: 20, fontSize: 14, marginRight: 8,
          }}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder={
            listening
              ? (language === 'en' ? '🎙 Listening…' : '🎙 వింటున్నాను…')
              : (language === 'en' ? 'Ask Vidhaata anything…' : 'విధాతను ఏదైనా అడగండి…')
          }
          onSubmitEditing={() => sendChatMessage()}
          multiline
          maxLength={500}
          editable={!listening}
        />
        {/* v7.5 — Mic button (STT). Hidden if browser lacks speech recognition.
            v7.6 — ALSO disabled while TTS is speaking to prevent the mic from
            picking up the synthesized voice (self-echo loop). */}
        {sttAvailable ? (
          <TouchableOpacity
            testID="mic-btn"
            onPress={handleMicPress}
            disabled={chatSending || isSpeaking}
            accessibilityLabel={listening
              ? (language === 'en' ? 'Stop listening' : 'వినడం ఆపండి')
              : isSpeaking
                ? (language === 'en' ? 'Mic disabled while Vidhaata is speaking' : 'విధాత మాట్లాడుతున్నప్పుడు మైక్ నిలిపివేయబడింది')
                : (language === 'en' ? 'Speak your question' : 'మీ ప్రశ్న మాట్లాడండి')}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: listening ? '#DC2626' : '#F59E0B',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 8,
              opacity: (chatSending || isSpeaking) ? 0.4 : 1,
            }}
          >
            <Ionicons
              name={listening ? 'stop' : 'mic'}
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          testID="send-chat-btn"
          onPress={() => sendChatMessage()}
          disabled={!chatInput.trim() || chatSending}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: chatInput.trim() ? '#4338CA' : '#D1D5DB',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* v6.34 — persistent disclaimer under input. Small, italic, with a
          classical phalashruti pointer so users understand astrology
          illuminates tendencies, it does not guarantee outcomes. */}
      <View style={{
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: '#FFFBEB',
        borderTopWidth: 1, borderTopColor: '#FDE68A',
      }}>
        <Text style={{ fontSize: 9.5, color: '#92400E', textAlign: 'center', fontStyle: 'italic', lineHeight: 14 }}>
          {language === 'en'
            ? '🪷 Classical astrology illuminates tendencies, not guarantees. As Varāhamihira reminds in the phalashruti of Brihat Jataka, the fruit is shaped by prior karma, right effort, and the grace of the Divine — no chart alone determines the outcome.'
            : '🪷 శాస్త్రీయ జ్యోతిషం ధోరణులను సూచిస్తుంది, ఫలితాన్ని హామీ ఇవ్వదు. వరాహమిహిర బృహజ్జాతక ఫలశ్రుతిలో చెప్పినట్లు, ఫలం పూర్వ కర్మ, సత్ప్రయత్నం, దేవానుగ్రహంతో నిర్ణయింపబడుతుంది.'}
        </Text>
      </View>
    </>
  );
};

/**
 * DepthChipsRow — lets the user pick Vidhaata's answer verbosity tier.
 * The selection is persisted in AsyncStorage via userPrefs and read by
 * sendChatMessage() when it builds the request payload.
 */
const DepthChipsRow: React.FC<{ language: 'en' | 'te' }> = ({ language }) => {
  const [depth, setDepth] = React.useState<GurujiDepth>(getCachedPrefs().gurujiDepth);
  React.useEffect(() => {
    loadUserPrefs().then((p) => setDepth(p.gurujiDepth));
  }, []);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 6,
      backgroundColor: '#F9FAFB',
      borderTopWidth: 1, borderTopColor: '#E5E7EB',
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#6B7280', marginRight: 8 }}>
        {language === 'en' ? 'DEPTH' : 'లోతు'}
      </Text>
      {GURUJI_DEPTH_OPTIONS.map((opt) => {
        const active = depth === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={async () => { setDepth(opt.key); await setUserPref('gurujiDepth', opt.key); }}
            style={{
              paddingHorizontal: 10, paddingVertical: 4,
              marginRight: 6, borderRadius: 12,
              backgroundColor: active ? '#4338CA' : '#FFFFFF',
              borderWidth: 1, borderColor: active ? '#4338CA' : '#D1D5DB',
            }}
          >
            <Text style={{
              fontSize: 10.5, fontWeight: '600',
              color: active ? '#FFFFFF' : '#4B5563',
            }}>
              {language === 'te' ? opt.labelTe : opt.labelEn}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * ChatSuggestionChips — horizontally scrollable follow-up pills (12 total).
 * Renders below the latest assistant reply, above the input box.
 * v6.31 — blends CONVERSATION-TOPIC chips (from last assistant reply) with
 * CHART-AWARE chips (from user's ascendant / moon / dasha / yogas) so every
 * row feels both contextual to the thread AND personal to the user.
 */
const ChatSuggestionChips: React.FC<{
  messages: ChatMessage[];
  language: 'en' | 'te';
  sending: boolean;
  chartContext?: ChatChartContext | null;
  dynamicChartQuestions?: string[];
  onTap: (text: string) => void;
}> = ({ messages, language, sending, chartContext, dynamicChartQuestions, onTap }) => {
  const lastAsst = [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';
  // Strip OPTIONS line so it doesn't leak into the regex keyword match.
  const lower = extractOptions(lastAsst).cleaned.toLowerCase();

  const EN_PACKS: { test: RegExp; chips: string[] }[] = [
    { test: /\b(yoga|rajayoga|gaja.?kesari|dhana|neecha|panch.?mahapurusha|viparita|malavya|ruchaka|hamsa|bhadra|sasa|kesari)\b/i,
      chips: ['Explain this yoga simply', 'Which dasha activates it?', 'Do I have any malefic yogas?', 'Famous charts with this yoga'] },
    { test: /\b(muhurta|auspicious|favou?rable date|tithi|nakshatra timing|shubh)\b/i,
      chips: ['Best muhurta for marriage', 'Best muhurta for starting business', 'Best muhurta for travel', 'Which dates to avoid?'] },
    { test: /\b(marriage|spouse|wife|husband|7th house|vivaha|wedding)\b/i,
      chips: ['When will I marry?', "Spouse's nature & background", 'Any manglik dosha?', 'Compatibility factors'] },
    { test: /\b(career|job|profession|10th house|work|promotion)\b/i,
      chips: ['What career suits my chart?', 'When will I get promotion?', 'Any career changes ahead?', 'Business or service — which?'] },
    { test: /\b(children|son|daughter|kid|5th house|santana|progeny)\b/i,
      chips: ['Any children yogas?', 'Timing of child birth', 'Sons or daughters indicated?', 'Any obstacles for children?'] },
    { test: /\b(health|disease|illness|6th house|eyes|speech|body|longevity)\b/i,
      chips: ['Health areas to watch', 'Dasha for health issues', 'Classical remedies', 'Life span indicators'] },
    { test: /\b(wealth|money|finance|2nd house|11th house|dhana|income|gain)\b/i,
      chips: ['Dhana yogas in my chart', 'When will I gain wealth?', 'Best investment timing', 'Savings vs spending'] },
    { test: /\b(dosha|mangal|manglik|kaalsarpa|kala sarpa|shani dosha|pitra)\b/i,
      chips: ['Do I have any dosha?', 'Severity of the dosha', 'Classical remedies', 'When does it activate?'] },
    { test: /\b(sade sati|shani|saturn|dasha|mahadasha|antardasha|bhukti)\b/i,
      chips: ['Current mahadasha effects', 'Next dasha transition', 'Impact of Sade Sati', 'Beneficial periods ahead'] },
    { test: /\b(foreign|abroad|overseas|12th house|settle|immigration|visa)\b/i,
      chips: ['Which years favour a foreign move?', 'Short trip or long settlement?', 'Dasha supporting the shift', 'Classical remedies before travel'] },
    { test: /\b(famous|bose|gandhi|sai baba|nehru|tagore|chandra bose|ambedkar|tendulkar|ntr|vyasa)\b/i,
      chips: ['Charts similar to mine', 'Famous charts with my lagna', 'Charts with my moon sign', 'Charts with my yogas'] },
    { test: /\b(transit|gochara|current planet|today|this week|live)\b/i,
      chips: ['What transits affect me now?', 'When does Jupiter turn favourable?', 'Saturn transit impact', 'Rahu-Ketu axis right now'] },
    { test: /\b(remed|upay|pariha|mantra|gemstone|puja|donation|fast)\b/i,
      chips: ['Remedies for my weakest planet', 'Gemstones to wear', 'Mantras to chant', 'Which days to fast?'] },
  ];
  const TE_PACKS: { test: RegExp; chips: string[] }[] = [
    { test: /\b(యోగ|యోగము|రాజయోగ|గజకేసరి|మాలవ్య)\b/,
      chips: ['ఈ యోగాన్ని వివరించండి', 'ఈ యోగం ఏ దశలో పనిచేస్తుంది?', 'నా చార్ట్\u200cలో దుష్ట యోగాలు', 'ప్రసిద్ధ చార్ట్\u200cలు'] },
    { test: /\b(ముహూర్తం|శుభ తేదీ|తిథి)\b/,
      chips: ['వివాహ ముహూర్తం', 'వ్యాపార ప్రారంభ ముహూర్తం', 'ప్రయాణ ముహూర్తం', 'ఏ తేదీలు వదిలేయాలి?'] },
    { test: /\b(వివాహ|భార్య|భర్త|కల్యాణ)\b/,
      chips: ['నాకు ఎప్పుడు వివాహం?', 'జీవిత భాగస్వామి స్వభావం', 'మాంగళ్య దోషం ఉందా?', 'జాతక అనుకూలత'] },
    { test: /\b(ఉద్యోగ|జీవనోపాధి|వృత్తి|కార్య)\b/,
      chips: ['నా వృత్తి ఏది?', 'ప్రమోషన్ ఎప్పుడు?', 'వృత్తిలో మార్పులు?', 'వ్యాపారం vs ఉద్యోగం?'] },
    { test: /\b(సంతాన|పుత్ర|పుత్రిక|పిల్లలు)\b/,
      chips: ['సంతాన యోగాలు', 'పుత్ర/పుత్రిక యోగం', 'సంతాన సమయం', 'సంతానానికి అడ్డంకులు?'] },
    { test: /\b(ఆరోగ్య|రోగ|వ్యాధి|ఆయుర్దాయ)\b/,
      chips: ['ఆరోగ్య సమస్యలు', 'ఆరోగ్య దశలు', 'శాస్త్ర పరిహారాలు', 'ఆయుర్దాయ సూచనలు'] },
    { test: /\b(ధన|సంపద|డబ్బు|లాభ)\b/,
      chips: ['ధన యోగాలు', 'సంపాదన సమయం', 'ఉత్తమ పెట్టుబడి కాలం', 'ఖర్చులు vs పొదుపులు'] },
    { test: /\b(దోష|మాంగల్య|కాలసర్ప|శని దోష)\b/,
      chips: ['నాకు ఏ దోషం ఉంది?', 'దోష తీవ్రత', 'శాస్త్ర పరిహారాలు', 'ఎప్పుడు సక్రియం?'] },
    { test: /\b(దశ|మహాదశ|అంతర్దశ|సాడేసాతి|భుక్తి)\b/,
      chips: ['ప్రస్తుత మహాదశ ప్రభావం', 'తరువాతి దశ మార్పు', 'సాడేసాతి ప్రభావం', 'అనుకూల కాలాలు'] },
    { test: /\b(విదేశ|విదేశాలు|ప్రవాస|యాత్ర)\b/,
      chips: ['ఏ దేశాలు అనుకూలం?', 'విదేశ ప్రయాణ సమయం?', 'శాశ్వత నివాసం లేదా చిన్న పర్యటన?', 'విదేశ ఉద్యోగ సమయం'] },
    { test: /\b(ప్రసిద్ధ|బోస్|గాంధీ|సాయిబాబా|నెహ్రూ)\b/,
      chips: ['నా చార్ట్ లాంటి జాతకాలు', 'నా లగ్నం కలిగిన ప్రముఖులు', 'నా రాశి కలిగిన ప్రముఖులు', 'నా యోగాలు కలిగిన జాతకాలు'] },
    { test: /\b(గోచార|ప్రస్తుత గ్రహ|ఇప్పుడు)\b/,
      chips: ['నా మీద ప్రస్తుత గోచారాలు', 'గురు అనుకూలం ఎప్పుడు?', 'శని గోచార ప్రభావం', 'రాహు-కేతు అక్షం'] },
    { test: /\b(పరిహార|మంత్ర|రత్న|దాన|వ్రత)\b/,
      chips: ['బలహీన గ్రహానికి పరిహారం', 'ధరించాల్సిన రత్నం', 'జపించాల్సిన మంత్రాలు', 'ఏ రోజుల్లో ఉపవాసం?'] },
  ];

  // Compact chart-aware one-liners — built fresh each render from chartContext.
  const buildChartChips = (ctx?: ChatChartContext | null): string[] => {
    const out: string[] = [];
    if (!ctx) return out;
    const maha = (ctx.current_mahadasha || '').trim();
    // Robust year extraction — dates may arrive as "2028-07-10" (ISO) OR
    // "06 July 2028" (human). A regex grabs the 4-digit year in either case.
    const mahaEndStr = ctx.current_mahadasha_end || '';
    const yearMatch = mahaEndStr.match(/(\d{4})/);
    const mahaEndYear = yearMatch ? yearMatch[1] : '';
    const moon = (ctx.moon_sign || '').trim();
    const asc = (ctx.ascendant_sign || '').trim();
    const yogas = (ctx.active_yogas || []).filter(Boolean);
    if (language === 'en') {
      if (maha && mahaEndYear) out.push(`${maha} dasha until ${mahaEndYear}`);
      else if (maha) out.push(`${maha} mahadasha effects`);
      if (asc) out.push(`${asc} ascendant traits`);
      if (moon) out.push(`${moon} moon mindset`);
      if (yogas[0]) out.push(`${yogas[0]} explained`);
      if (yogas[1]) out.push(`${yogas[1]} details`);
      out.push('5-year life preview');
      out.push('Best years for marriage');
      out.push('Foreign travel years');
      out.push('Remedies for me');
    } else {
      if (maha && mahaEndYear) out.push(`${mahaEndYear} వరకు ${maha} దశ`);
      else if (maha) out.push(`${maha} మహాదశ ప్రభావం`);
      if (asc) out.push(`${asc} లగ్న లక్షణాలు`);
      if (moon) out.push(`${moon} చంద్ర మనస్తత్వం`);
      if (yogas[0]) out.push(`${yogas[0]} వివరణ`);
      if (yogas[1]) out.push(`${yogas[1]} వివరాలు`);
      out.push('5 సంవత్సరాల సమీక్ష');
      out.push('వివాహ అనుకూల సంవత్సరాలు');
      out.push('విదేశ ప్రయాణ సంవత్సరాలు');
      out.push('నాకు పరిహారాలు');
    }
    return out;
  };

  const STARTERS_EN = [
    "Today's panchanga for me", 'Auspicious dates (14 days)',
    'My current dasha effects', 'Matching famous charts',
    'Any doshas in my chart?', 'Career outlook',
  ];
  const STARTERS_TE = [
    'ఈరోజు నా పంచాంగం', '14 రోజుల్లో శుభ తేదీలు',
    'ప్రస్తుత దశ ప్రభావం', 'నా లాంటి ప్రసిద్ధ జాతకాలు',
    'నా చార్ట్\u200cలో దోషాలు?', 'వృత్తి అవకాశాలు',
  ];

  const packs = language === 'te' ? TE_PACKS : EN_PACKS;
  const starters = language === 'te' ? STARTERS_TE : STARTERS_EN;
  const matched = packs.find((p) => p.test.test(lower));

  // Blend: 4 conversation-aware (from matched pack)
  //      + 4 chart-aware one-liners
  //      + 4 generic starters/dynamic fallbacks   → de-duped, capped at 12.
  const chartChips = buildChartChips(chartContext).slice(0, 4);
  const convChips = (matched?.chips || []).slice(0, 4);
  const fillerChips = (dynamicChartQuestions && dynamicChartQuestions.length
    ? dynamicChartQuestions.slice(0, 4)
    : starters.slice(0, 4));

  const seen = new Set<string>();
  const chips: string[] = [];
  const pushAll = (arr: string[]) => {
    for (const c of arr) {
      const k = c.trim();
      if (!k || seen.has(k.toLowerCase())) continue;
      seen.add(k.toLowerCase());
      chips.push(k);
      if (chips.length >= 12) return;
    }
  };
  pushAll(convChips);
  pushAll(chartChips);
  pushAll(fillerChips);
  pushAll(starters);  // final fill if we're short

  return (
    <View style={{
      borderTopWidth: 1, borderTopColor: '#FDE68A',
      backgroundColor: '#FFFBEB',
    }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 6 }}
      >
        {chips.map((c, i) => (
          <TouchableOpacity
            key={i}
            disabled={sending}
            activeOpacity={0.75}
            onPress={() => onTap(c)}
            style={{
              paddingHorizontal: 10, paddingVertical: 6,
              marginRight: 6,
              borderRadius: 16,
              borderWidth: 1, borderColor: '#F59E0B',
              backgroundColor: sending ? '#FEF3C7' : '#FFFFFF',
              maxWidth: 260,
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: '#B45309', fontWeight: '700' }}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

/**
 * Absolute-positioned overlay version — used inside the Results modal to work
 * around react-native-web's limitation on nested <Modal> stacking.
 */
export const ChatOverlay: React.FC<Props> = (props) => (
  <View
    testID="chat-overlay"
    style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#FAF5FF', zIndex: 1000,
    }}
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={20}
    >
      <ChatBody {...props} />
    </KeyboardAvoidingView>
  </View>
);

export default ChatBody;
