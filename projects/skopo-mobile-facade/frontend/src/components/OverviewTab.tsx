/**
 * OverviewTab — AstroQuest v6.46.
 *
 * Design principles (user feedback on v6.44 / v6.45):
 *   • Deep-Purple theme accent present on every card (filled ribbon header).
 *   • Yogas colour-coded RAG — Green / Amber / Red — by classical polarity.
 *   • Dasha cards carry a proper "what this period brings" narrative.
 *   • Every Lagna / Moon-sign / Nakshatra / Yoga / Dosha / Dasha chip is
 *     tappable — taps dispatch a context-rich question directly to
 *     Vidhaata and open the chat overlay.
 *
 * Card order (unchanged from v6.44):
 *   1. Birth Details    2. Active Yogas    3. Today's Panchanga
 *   4. Auspicious Muhurtas    5. Doshas at a Glance
 *   6. Mahadasha   7. Antardasha
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { BRAND } from './mdTheme';
import { findSituationsByYogaName } from '../utils/corpus';
// v8.5.1 — Overview now reads DOB / TOB / Name from the global
// birthDetailsStore (single source of truth populated from LS). The
// backend-computed result.birth_details is kept as a fallback for
// older cached bundles.
import { useBirthDetailsStore } from '../state/birthDetailsStore';

interface Props {
  result: any;
  language: 'en' | 'te';
  todayPanchanga: any | null;
  onYogaPress?: (yoga: any) => void;
  /** v6.46 — tap any Lagna/Moon/Nakshatra/Yoga/Dosha/Dasha item to open
   *  Vidhaata with a pre-filled contextual question. Sent immediately. */
  onAskVidhaata?: (question: string) => void;
  /** v8.6.2 — current-location chip was removed from AppHeader and now
   *  surfaces here in its own card. Optional so older callers still
   *  compile; when absent the card is simply hidden. */
  activeLoc?: { name: string; lat: number; lon: number; tzOffset: number } | null;
  onChangeLocation?: () => void;
}

// Deep-indigo / deep-purple tones lifted from theme.ts for local use.
const P = {
  ink:     theme.colors.primary800,   // '#312E81'
  deep:    theme.colors.primary700,   // '#4338CA'
  mid:     theme.colors.primary600,   // '#4F46E5'
  light:   theme.colors.primary100,   // '#E0E7FF'
  cream:   BRAND.cream,
  gold:    BRAND.goldLine,
  saffron: BRAND.saffron,
  maroon:  BRAND.maroon,
  text:    BRAND.text,
  faint:   BRAND.faint,
};

// ---------------------------------------------------------------------------
// SectionBanner — the deep-purple filled ribbon that opens every card.
// ---------------------------------------------------------------------------
const SectionBanner: React.FC<{ icon: any; title: string; badge?: React.ReactNode }> = ({
  icon, title, badge,
}) => (
  <View style={styles.banner}>
    <Ionicons name={icon} size={16} color="#FFFFFF" />
    <Text style={styles.bannerText}>{title.toUpperCase()}</Text>
    {badge ? <View style={{ marginLeft: 'auto' }}>{badge}</View> : null}
  </View>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const OverviewTab: React.FC<Props> = ({
  result, language, todayPanchanga, onYogaPress, onAskVidhaata, activeLoc, onChangeLocation,
}) => {
  if (!result) return null;

  // ---------- i18n labels ----------
  const t = {
    birth:      language === 'en' ? 'Birth Details'              : 'జనన వివరాలు',
    name:       language === 'en' ? 'Name'                       : 'పేరు',
    date:       language === 'en' ? 'Date'                       : 'తేదీ',
    day:        language === 'en' ? 'Day'                        : 'వారం',
    time:       language === 'en' ? 'Time'                       : 'సమయం',
    place:      language === 'en' ? 'Place'                      : 'ప్రదేశం',
    lagna:      language === 'en' ? 'Lagna'                      : 'లగ్నం',
    moonSign:   language === 'en' ? 'Moon Sign'                  : 'చంద్ర రాశి',
    nakshatra:  language === 'en' ? 'Nakshatra'                  : 'నక్షత్రం',
    // v8.6.3 — Pada shown alongside the rest of the birth details.
    pada:       language === 'en' ? 'Pada'                       : 'పాదం',
    yogas:      language === 'en' ? 'Active Yogas'               : 'క్రియాశీల యోగాలు',
    tapYoga:    language === 'en'
                ? 'Tap a yoga to ask Vidhaata about it — green = benefic, amber = mixed, red = malefic.'
                : 'ఏదైనా యోగం నొక్కి విధాతను అడగండి — ఆకుపచ్చ శుభం, పసుపు మిశ్రమం, ఎరుపు అశుభం.',
    panchanga:  language === 'en' ? "Today's Panchanga"          : 'ఈరోజు పంచాంగం',
    tithi:      language === 'en' ? 'Tithi'                      : 'తిథి',
    moon:       language === 'en' ? 'Moon'                       : 'చంద్రుడు',
    sunrise:    language === 'en' ? 'Sunrise'                    : 'సూర్యోదయం',
    sunset:     language === 'en' ? 'Sunset'                     : 'సూర్యాస్తమయం',
    rahu:       language === 'en' ? 'Rahu Kaal'                  : 'రాహుకాలం',
    auspicious: language === 'en' ? "Today's Auspicious Muhurtas": 'ఈరోజు శుభ ముహూర్తాలు',
    avoid:      language === 'en' ? 'AVOID'                      : 'నిషేధం',
    doshas:     language === 'en' ? 'Doshas at a Glance'         : 'దోషాలు',
    mangal:     language === 'en' ? 'Mangal'                     : 'మంగళ',
    kalaSarpa:  language === 'en' ? 'Kala Sarpa'                 : 'కాల సర్ప',
    sadeSati:   language === 'en' ? 'Sade Sati'                  : 'సాడే సాతి',
    active:     language === 'en' ? 'Active'                     : 'సక్రియం',
    clear:      language === 'en' ? 'Clear'                      : 'లేదు',
    mahadasha:  language === 'en' ? 'Mahadasha · Major Life Period' : 'మహాదశ · ప్రధాన జీవిత కాలం',
    antardasha: language === 'en' ? 'Antardasha · Sub-Period'    : 'అంతర్దశ · ఉపకాలం',
    startsOn:   language === 'en' ? 'Starts'                     : 'ప్రారంభం',
    endsOn:     language === 'en' ? 'Ends'                       : 'ముగింపు',
    remaining:  language === 'en' ? 'Remaining'                  : 'మిగిలింది',
    themes:     language === 'en' ? 'THEMES OF THIS PERIOD'      : 'ఈ కాలం యొక్క అంశాలు',
    askMore:    language === 'en' ? 'Tap for detailed reading →' : 'వివరంగా తెలుసుకోవడానికి నొక్కండి →',
  };

  // ---------- Dosha detection (same heuristics as v6.42) ----------
  const planets = result.chart_data?.planets || [];
  const byName = (names: string[]) => planets.find((p: any) => names.includes(p.name));
  const mars = byName(['Mangala', 'Mars']);
  const rahu = byName(['Rahu']);
  const ketu = byName(['Ketu']);
  const manglikHouses = [1, 2, 4, 7, 8, 12];
  const hasMangal = !!(mars && manglikHouses.includes(Number(mars.house)));
  const allSeven = [['Surya','Sun'],['Chandra','Moon'],['Mangala','Mars'],['Budha','Mercury'],
                    ['Guru','Jupiter'],['Shukra','Venus'],['Shani','Saturn']];
  let hasKalaSarpa = false;
  if (rahu && ketu) {
    const rh = Number(rahu.longitude ?? rahu.lon ?? 0);
    const kh = Number(ketu.longitude ?? ketu.lon ?? 0);
    const arc = (kh - rh + 360) % 360;
    hasKalaSarpa = allSeven.every((aliases) => {
      const pl = byName(aliases);
      const L = Number(pl?.longitude ?? pl?.lon ?? NaN);
      if (!Number.isFinite(L)) return false;
      const a = (L - rh + 360) % 360;
      return a > 0 && a < arc;
    });
  }
  const sade = result.transit_info?.sade_sati_status
    ? (language === 'te' ? result.transit_info.sade_sati_status_local : result.transit_info.sade_sati_status)
    : null;
  const sadeActive = !!sade && !/none|no\b|nil|^no$/i.test(String(sade).trim());

  // ---------- Auspicious hora picks ----------
  const topHoras = todayPanchanga?.horas
    ? (todayPanchanga.horas as any[])
        .filter((h: any) => ['Best', 'Better', 'Good'].includes(h.rating))
        .slice(0, 3)
    : [];
  const rahuHora = todayPanchanga?.horas
    ? (todayPanchanga.horas as any[]).find((h: any) => (h.notes || []).some((n: string) => /rahu/i.test(n))) ||
      (todayPanchanga.horas as any[]).find((h: any) => h.rating === 'Worst')
    : null;

  // ---------- Active yogas ----------
  const activeStd = (result.yogas || []).filter((y: any) => y.is_present);
  const activeDbpc = result.dbpc_yogas || [];
  const totalYogas = activeStd.length + activeDbpc.length;

  // ---------- Birth weekday ----------
  // v8.5.1 — Read the canonical DOB / TOB / Name from the global
  // birthDetailsStore (which mirrors localStorage) so the Overview
  // always matches the Profile page. Falls back to backend-computed
  // result.birth_details for cached bundles predating v8.5.
  const storeBirth = useBirthDetailsStore((s) => s.birth);
  const storeDob   = storeBirth?.dob   || result.birth_details?.date || '';
  const storeTob   = storeBirth?.tob   || result.birth_details?.time || '';
  const storePlace = storeBirth?.birth_place || result.birth_details?.location || '';
  const fullName   = `${storeBirth?.first_name || ''} ${storeBirth?.last_name || ''}`.trim();

  // v8.6.3 — pull the Moon's nakshatra pada (1..4) out of chart_data.
  // The Moon planet in the planets list carries its own nakshatra_pada;
  // some bundles store the entry under localised names, so we match by
  // English OR local Sanskrit/Telugu name ("Chandra" / "చంద్ర").
  const moonPada: number | null = React.useMemo(() => {
    try {
      const planets = result?.chart_data?.planets;
      if (!Array.isArray(planets)) return null;
      const m = planets.find((p: any) => {
        const n = (p?.name || '').toLowerCase();
        const ln = (p?.name_local || '').toLowerCase();
        return n === 'moon' || n.includes('moon') || ln.includes('చంద్ర') || ln.includes('chandra');
      });
      const p = Number(m?.nakshatra_pada);
      return Number.isFinite(p) && p >= 1 && p <= 4 ? p : null;
    } catch { return null; }
  }, [result?.chart_data?.planets]);

  // v8.6.2 — Current local date/time in the *activeLoc* timezone, not
  // the device's. We ticker every 60s so the panel stays fresh.
  const [, _setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => _setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowLocal = React.useMemo(() => {
    try {
      if (!activeLoc) return null;
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
      const loc = new Date(utc + activeLoc.tzOffset * 3_600_000);
      const dayStr = loc.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
      const hh = String(loc.getHours()).padStart(2, '0');
      const mm = String(loc.getMinutes()).padStart(2, '0');
      return { dayStr, timeStr: `${hh}:${mm}` };
    } catch { return null; }
  }, [activeLoc?.tzOffset, activeLoc?.name]);

  // Format DOB as "12 Mar 1990".
  let dobDisplay = '—';
  let weekdayStr = '—';
  try {
    if (storeDob) {
      const d = new Date(storeDob);
      if (!isNaN(d.getTime())) {
        const months = language === 'en'
          ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          : ['జన','ఫిబ్ర','మార్చి','ఏప్రి','మే','జూన్','జూలై','ఆగ','సెప్','అక్టో','నవం','డిసెం'];
        dobDisplay = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        // v8.6.2 — Use SHORT weekday (Mon/Tue/Wed) in the passport table
        // to avoid the awful "Wednesd/ay" line-wrap on narrow phones.
        weekdayStr = d.toLocaleDateString(undefined, { weekday: 'short' });
      }
    }
  } catch { /* ignore */ }

  // ---------- Dasha derived details ----------
  const maha = result.dasha_info?.current_mahadasha;
  const antar = result.dasha_info?.current_antardasha;
  const mahaThemes = dashaThemes(maha?.planet, language);
  const antarThemes = dashaThemes(antar?.planet, language);
  const mahaRemaining = humanRemaining(maha?.end_date, language);
  const antarRemaining = humanRemaining(antar?.end_date, language);

  // ---------- Tap helpers ----------
  const ask = (q: string) => onAskVidhaata?.(q);

  return (
    <View>
      {/* v8.6.2 — Current-location strip MOVED to the tabs card
          (owned by app/index.tsx). Overview now starts with Birth
          Details at the top, un-interrupted. */}

      {/* ========== 1. BIRTH DETAILS ========== */}
      <View style={styles.card}>
        <SectionBanner icon="person-circle" title={t.birth} />
        <View style={styles.cardBody}>
          {/* v8.6.2 — Birth Details is ONE uniform unit: a single
              bordered container with the name row on top and the
              4-cell Date/Day/Time/Place row beneath, sharing padding
              and font stack so the whole block reads like a passport
              page. */}
          <View style={styles.birthTable}>
            {fullName ? (
              <View style={styles.birthNameCell}>
                <Ionicons name="person-circle" size={18} color={P.deep} />
                <Text style={styles.birthNameText} numberOfLines={1}>
                  {fullName}
                </Text>
              </View>
            ) : null}
            {/* v8.6.4 — CRITICAL: both rows MUST use identical flex
                values so the 4 columns align vertically like a real
                table. Previously Row 2 used 1.2/1/0.9/1.4 and Row 3
                used 1.1/1.1/1.3/0.6 — the columns were staggered.
                These values are sized for the WIDEST expected value
                per column across both rows:
                  col 1 (Date / Lagna)         → "22 Aug 1980" / "Vrischika"
                  col 2 (Day  / Moon Sign)     → "Wed"         / "Dhanu"
                  col 3 (Time / Nakshatra)     → "12:20"       / "Purva Ashadha"  ← widest
                  col 4 (Place/ Pada)          → "Nellore"     / "1"
             */}
            <View style={styles.birthTableRow}>
              <BirthCell label={t.date}  value={dobDisplay}        flex={1.2} />
              <BirthCell label={t.day}   value={weekdayStr}        flex={0.8} />
              <BirthCell label={t.time}  value={storeTob || '—'}  flex={1.5} />
              <BirthCell label={t.place} value={storePlace || '—'} flex={1.1} last />
            </View>
            {/* v8.6.3 — Lagna · Moon Sign · Nakshatra · Pada row. Now
                INSIDE the same passport container as the birth details
                above, so the whole block reads as "one identity unit".
                Each cell is tappable — taps open Vidhaata with a
                targeted prompt (same behaviour as the previous
                free-standing TappableField chips). */}
            <View style={[styles.birthTableRow, styles.birthTableRowBordered]}>
              <TappableBirthCell
                label={t.lagna}
                value={result.chart_data?.ascendant_sign_local || result.chart_data?.ascendant_sign || '—'}
                flex={1.2}
                onPress={() => ask(
                  language === 'en'
                    ? `Explain my Lagna (Ascendant) ${result.chart_data?.ascendant_sign}. What kind of personality, body type, and life-purpose does this sign indicate for me? Please include classical rulings from Parashara/Jaimini where relevant.`
                    : `నా లగ్నం ${result.chart_data?.ascendant_sign} గురించి వివరించండి. ఇది నా వ్యక్తిత్వం, శరీర స్వభావం, జీవిత లక్ష్యం ఎలా సూచిస్తుంది?`
                )}
              />
              <TappableBirthCell
                label={t.moonSign}
                value={result.moon_sign_local || result.moon_sign || '—'}
                flex={0.8}
                onPress={() => ask(
                  language === 'en'
                    ? `My Moon sign is ${result.moon_sign}. What does this say about my mind, emotions, relationships, and inner temperament? How does its current transit affect me?`
                    : `నా చంద్ర రాశి ${result.moon_sign}. నా మనస్సు, భావాలు, సంబంధాలు ఎలా ఉంటాయో వివరించండి.`
                )}
              />
              <TappableBirthCell
                label={t.nakshatra}
                value={result.moon_nakshatra_local || result.moon_nakshatra || '—'}
                flex={1.5}
                onPress={() => ask(
                  language === 'en'
                    ? `My birth Nakshatra is ${result.moon_nakshatra}${moonPada ? ` Pada ${moonPada}` : ''}. Explain its ruling deity, lord, pada characteristics, and how it shapes my life path, career, and compatibility.`
                    : `నా జన్మ నక్షత్రం ${result.moon_nakshatra}${moonPada ? ` ${moonPada}వ పాదం` : ''}. దాని అధిదేవత, అధిపతి, జీవిత మార్గం ఎలా ఉంటుందో చెప్పండి.`
                )}
              />
              <TappableBirthCell
                label={t.pada}
                value={moonPada ? String(moonPada) : '—'}
                flex={1.1}
                last
                onPress={() => ask(
                  language === 'en'
                    ? `I was born in Nakshatra ${result.moon_nakshatra} Pada ${moonPada}. Detail the specific traits, deity, planetary lord, and life-path indications for this exact pada as per Parashara and the classical IndicVedicTexts.`
                    : `నేను ${result.moon_nakshatra} నక్షత్రం ${moonPada}వ పాదంలో జన్మించాను. ఈ పాదానికి సంబంధించిన లక్షణాలు, దేవత, గ్రహాధిపతి, జీవిత మార్గం గురించి వివరించండి.`
                )}
              />
            </View>
          </View>
          <Text style={styles.tapHint}>{t.askMore}</Text>
        </View>
      </View>

      {/* ========== 2. ACTIVE YOGAS ========== */}
      {totalYogas > 0 ? (
        <View style={styles.card}>
          <SectionBanner
            icon="star"
            title={`${totalYogas} ${t.yogas}`}
            badge={<Text style={styles.bannerBadge}>RAG</Text>}
          />
          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
              {activeStd.map((y: any, i: number) => {
                const color = classifyYoga(y.name, y.description);
                return (
                  <TouchableOpacity
                    key={`std-${i}`}
                    activeOpacity={0.75}
                    onPress={() => ask(
                      language === 'en'
                        ? `Explain the ${y.name} yoga in my chart — the exact combination forming it, its classical reference, what outcomes it grants, its activation timing, and remedies if any.`
                        : `నా జాతకంలో ${y.name} యోగం గురించి వివరించండి — ఏ గ్రహాల సంయోగం, శాస్త్రీయ ఆధారం, ఫలితాలు ఏమిటి?`
                    )}
                    style={[styles.yogaChip, { backgroundColor: color.bg, borderColor: color.border }]}
                  >
                    <View style={[styles.yogaDot, { backgroundColor: color.dot }]} />
                    <Text style={[styles.yogaChipText, { color: color.text }]}>
                      {language === 'te' ? (y.name_local || y.name) : y.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {activeDbpc.map((y: any, i: number) => {
                const color = classifyYogaByPolarity(y.positive_or_negative);
                let enrichedY = y;
                if (!y.headline_outcome_en && !(y.details && y.details.length)) {
                  try {
                    const sits = findSituationsByYogaName(y.yoga_name || y.name || '');
                    if (sits && sits.length) {
                      const top = sits[0];
                      enrichedY = {
                        ...y,
                        headline_trigger_en: top.trigger_en || top.trigger || '',
                        headline_outcome_en: top.outcome_en || top.outcome || '',
                        headline_timing: top.timing_notes || top.timing || '',
                        details: sits.slice(0, 4),
                        _source: 'offline-corpus',
                      };
                    }
                  } catch { /* ignore */ }
                }
                const hasDetails = !!(enrichedY.headline_outcome_en || (enrichedY.details && enrichedY.details.length));
                const yName = y.yoga_name || y.name || 'this yoga';
                return (
                  <TouchableOpacity
                    key={`dbpc-${i}`}
                    onPress={() => {
                      // Always ask Vidhaata (primary action).
                      ask(
                        language === 'en'
                          ? `Explain the ${yName} yoga from IndicVedicTexts as it appears in my chart. What is the trigger planetary combination, what outcomes does it give, and what is the likely timing in my dasha sequence?`
                          : `${yName} యోగం నా జాతకంలో ఏ ఫలితాలు ఇస్తుంది? ఏ గ్రహాల సంయోగం, ఎప్పుడు ఫలితం?`
                      );
                      // Also offer the classical-corpus preview sheet.
                      if (hasDetails) onYogaPress?.(enrichedY);
                    }}
                    activeOpacity={0.75}
                    style={[styles.yogaChip, { backgroundColor: color.bg, borderColor: color.border, flexDirection: 'row', alignItems: 'center' }]}
                  >
                    <View style={[styles.yogaDot, { backgroundColor: color.dot }]} />
                    <Text style={[styles.yogaChipText, { color: color.text }]}>
                      🕉️ {language === 'te' ? (y.yoga_name_telugu || yName) : yName}
                    </Text>
                    {hasDetails ? <Text style={[styles.yogaChipText, { marginLeft: 4, color: color.text, opacity: 0.8 }]}>▸</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* RAG legend */}
            <View style={styles.legendRow}>
              <LegendDot color="#16A34A" label={language === 'en' ? 'Benefic' : 'శుభ'} />
              <LegendDot color="#D97706" label={language === 'en' ? 'Mixed' : 'మిశ్రమ'} />
              <LegendDot color="#DC2626" label={language === 'en' ? 'Malefic' : 'అశుభ'} />
            </View>
            <Text style={styles.helperText}>{t.tapYoga}</Text>
          </View>
        </View>
      ) : null}

      {/* ========== 3. TODAY'S PANCHANGA ========== */}
      {todayPanchanga ? (
        <View style={styles.card}>
          {/* v8.6.6 — Location pill now lives in THIS section header
              (moved from the tabs row where it was overlapping the
              Today's Muhurtas tab on narrow phones). Panchanga is
              inherently location-dependent — tithi / sunrise /
              rahukala all change by place — so this is the most
              honest home for the location selector. */}
          <SectionBanner
            icon="calendar"
            title={t.panchanga}
            badge={activeLoc ? (
              <TouchableOpacity
                onPress={onChangeLocation}
                activeOpacity={onChangeLocation ? 0.75 : 1}
                hitSlop={6}
                style={styles.panchangaLocPill}
              >
                <Ionicons name="location-sharp" size={11} color="#FFFFFF" />
                <Text style={styles.panchangaLocText} numberOfLines={1}>
                  {activeLoc.name.split(',')[0]}
                </Text>
                {onChangeLocation ? (
                  <Ionicons name="chevron-down" size={10} color="#FFFFFF" />
                ) : null}
              </TouchableOpacity>
            ) : null}
          />
          <View style={styles.cardBody}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: P.ink, marginTop: 2 }}>
              {todayPanchanga.date} · {todayPanchanga.weekday}
            </Text>
            {todayPanchanga.weekday_lord ? (
              <Text style={{ fontSize: 11.5, color: P.faint, marginTop: 2, fontStyle: 'italic' }}>
                {language === 'en' ? 'ruled by ' : 'అధిపతి '}{todayPanchanga.weekday_lord}
              </Text>
            ) : null}
            <View style={styles.hrGold} />
            <View style={styles.rowWrap}>
              <Pill label={t.tithi}
                    value={`${todayPanchanga.tithi?.paksha || ''} ${todayPanchanga.tithi?.name || ''}`.trim() || '—'}
                    warn={todayPanchanga.tithi?.is_rikta} />
              <Pill label={t.nakshatra}
                    value={todayPanchanga.nakshatra || '—'}
                    good={todayPanchanga.nakshatra_quality === 'benefic'}
                    warn={todayPanchanga.nakshatra_quality === 'malefic'} />
              <Pill label={t.moon}    value={todayPanchanga.moon_sign || '—'} />
              <Pill label={t.sunrise} value={todayPanchanga.sunrise || '—'} />
              <Pill label={t.sunset}  value={todayPanchanga.sunset || '—'} />
              {todayPanchanga.rahu_kaal ? (
                <Pill label={t.rahu}
                      value={`${todayPanchanga.rahu_kaal.start}–${todayPanchanga.rahu_kaal.end}`} warn />
              ) : null}
            </View>
            {todayPanchanga.tithi?.is_rikta ? (
              <Text style={{ fontSize: 11, color: BRAND.rose, fontStyle: 'italic', marginTop: 8 }}>
                ⚠ {language === 'en'
                  ? 'Rikta tithi today — classical rule: avoid new initiations.'
                  : 'ఈరోజు రిక్తా తిథి — కొత్త ప్రారంభాలు మానండి.'}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ========== 4. TODAY'S AUSPICIOUS MUHURTAS ========== */}
      {topHoras.length > 0 ? (
        <View style={styles.card}>
          <SectionBanner icon="sparkles" title={t.auspicious} />
          <View style={styles.cardBody}>
            {topHoras.map((h: any, i: number) => (
              <View key={i} style={styles.horaRow}>
                <View style={styles.horaTimeBlock}>
                  <Text style={styles.horaTime}>{h.start_time}</Text>
                  <Text style={styles.horaTimeSep}>—</Text>
                  <Text style={styles.horaTime}>{h.end_time}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <View style={[styles.ratingChip, { backgroundColor: h.rating === 'Best' ? '#047857' : h.rating === 'Better' ? '#16A34A' : '#65A30D' }]}>
                      <Text style={styles.ratingChipText}>{h.rating}</Text>
                    </View>
                    <Text style={{ fontSize: 10.5, color: P.faint, marginLeft: 6, fontWeight: '700' }}>
                      H{h.index} · {h.lord_display}
                    </Text>
                  </View>
                  {h.do?.length ? (
                    <Text style={styles.horaDo} numberOfLines={2}>
                      ✓ {h.do.slice(0, 2).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
            {rahuHora ? (
              <View style={styles.rahuWarn}>
                <Ionicons name="alert-circle" size={14} color={BRAND.rose} />
                <Text style={styles.rahuWarnText}>
                  ✗ {t.avoid} · {rahuHora.start_time}–{rahuHora.end_time}
                  {rahuHora.dont?.length ? ` · ${rahuHora.dont[0]}` : ''}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.helperText, { color: P.saffron }]}>
              {language === 'en'
                ? 'Open the Today tab for the full 24-hora schedule.'
                : 'పూర్తి 24 హోరా కోసం "Today" ట్యాబ్ తెరవండి.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ========== 5. DOSHAS ========== */}
      <View style={styles.card}>
        <SectionBanner icon="shield-checkmark" title={t.doshas} />
        <View style={styles.cardBody}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <DoshaItem
              label={t.mangal}
              active={hasMangal}
              activeLabel={t.active}
              clearLabel={t.clear}
              hint={hasMangal && mars ? `${language === 'en' ? 'Mars' : 'కుజుడు'} · H${mars.house}` : undefined}
              onPress={() => ask(
                hasMangal
                  ? (language === 'en'
                      ? `I have Mangal Dosha (Mars in house ${mars?.house}). What are the classical implications, how will it affect marriage, and what remedies does Jyotisha prescribe for my specific placement?`
                      : `నాకు మంగళ దోషం (కుజుడు ${mars?.house}వ భావంలో). ఫలితం, వివాహంపై ప్రభావం, పరిహారం వివరించండి.`)
                  : (language === 'en'
                      ? 'Explain what Mangal Dosha is, why my chart is clear of it, and how Mars still influences my life.'
                      : 'మంగళ దోషం అంటే ఏమిటి? నా జాతకంలో ఎందుకు లేదు? కుజుడు ప్రభావం ఎలా?')
              )}
            />
            <DoshaItem
              label={t.kalaSarpa}
              active={hasKalaSarpa}
              activeLabel={t.active}
              clearLabel={t.clear}
              hint={hasKalaSarpa ? (language === 'en' ? 'All planets in Rahu-Ketu arc' : 'రాహు-కేతు మధ్య') : undefined}
              onPress={() => ask(
                hasKalaSarpa
                  ? (language === 'en'
                      ? 'My chart has Kala Sarpa Dosha — all seven grahas trapped between Rahu and Ketu. Explain the type of Kala Sarpa present, life impact, and the specific classical remedies.'
                      : 'నా జాతకంలో కాల సర్ప దోషం ఉంది. రకం, జీవితంలో ప్రభావం, పరిహారాలు చెప్పండి.')
                  : (language === 'en'
                      ? 'Explain Kala Sarpa Dosha — its twelve types, how one recognises it, and why my chart does not have it.'
                      : 'కాల సర్ప దోషం గురించి వివరించండి — 12 రకాలు, నా జాతకంలో ఎందుకు లేదు?')
              )}
            />
            <DoshaItem
              label={t.sadeSati}
              active={sadeActive}
              activeLabel={t.active}
              clearLabel={t.clear}
              hint={sadeActive ? String(sade) : undefined}
              onPress={() => ask(
                sadeActive
                  ? (language === 'en'
                      ? `I'm currently in ${sade} phase. What does this Sade Sati phase specifically bring for me — career, health, relationships — and what remedies will genuinely help?`
                      : `నేను ${sade} దశలో ఉన్నాను. సాడే సాతి ప్రభావం — ఉద్యోగం, ఆరోగ్యం, సంబంధాలు — పరిహారం చెప్పండి.`)
                  : (language === 'en'
                      ? 'Explain Sade Sati — the 7.5 year Saturn transit over the Moon — and when my chart is next due for one.'
                      : 'సాడే సాతి అంటే ఏమిటి? నాకు తరువాత ఎప్పుడు వస్తుంది?')
              )}
            />
          </View>
          <Text style={styles.helperText}>
            {language === 'en'
              ? 'Classical heuristics — tap any dosha for a personal reading and remedies.'
              : 'శాస్త్రీయ సూచనలు — ఏదైనా దోషం నొక్కి వ్యక్తిగత పరిహారాల కోసం అడగండి.'}
          </Text>
        </View>
      </View>

      {/* ========== 6. MAHADASHA ========== */}
      {maha ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => ask(
            language === 'en'
              ? `I'm running ${maha.planet} Mahadasha from ${maha.start_date} to ${maha.end_date}. What are the dominant themes, typical life events, career and relationship outcomes during this period based on my chart? What is the Bhukti sequence I should watch for?`
              : `${maha.start_date} నుండి ${maha.end_date} వరకు ${maha.planet} మహాదశ. ప్రధాన అంశాలు, ఫలితాలు, జాగ్రత్తలు వివరించండి.`
          )}
          style={styles.card}
        >
          <SectionBanner icon="hourglass" title={t.mahadasha} />
          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: P.ink, marginRight: 10 }}>
                {maha.planet_local || maha.planet}
              </Text>
              {mahaRemaining ? (
                <View style={styles.remainingChip}>
                  <Text style={styles.remainingChipText}>{t.remaining}: {mahaRemaining}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 6, gap: 16 }}>
              <DateBlock label={t.startsOn} value={maha.start_date} />
              <DateBlock label={t.endsOn}   value={maha.end_date} />
            </View>
            {mahaThemes.length ? (
              <>
                <Text style={styles.themesHeader}>{t.themes}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {mahaThemes.map((th, i) => (
                    <View key={i} style={styles.themeChip}>
                      <Text style={styles.themeChipText}>{th}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {result.dasha_info?.current_dasha_prediction ? (
              <Text style={{ fontSize: 12.5, color: P.text, marginTop: 10, lineHeight: 18 }}>
                {(language === 'te' ? result.dasha_info.current_dasha_prediction_local : result.dasha_info.current_dasha_prediction)
                  ?.split('\n').filter((l: string) => l.trim()).slice(0, 3).join('\n')}
              </Text>
            ) : null}
            <Text style={styles.tapHint}>{t.askMore}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* ========== 7. ANTARDASHA ========== */}
      {antar ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => ask(
            language === 'en'
              ? `I'm in ${maha?.planet}-${antar.planet} Antardasha (Bhukti) from ${antar.start_date} to ${antar.end_date}. What does this specific sub-period give me — timing of events, opportunities, challenges? How does the Bhukti lord interact with the Mahadasha lord in my chart?`
              : `${antar.start_date} నుండి ${antar.end_date} వరకు ${maha?.planet}-${antar.planet} అంతర్దశ. ఫలితాలు, అవకాశాలు, సవాళ్లు వివరించండి.`
          )}
          style={styles.card}
        >
          <SectionBanner icon="time" title={t.antardasha} />
          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: P.maroon, marginRight: 10 }}>
                {antar.planet_local || antar.planet}
              </Text>
              {antarRemaining ? (
                <View style={[styles.remainingChip, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                  <Text style={[styles.remainingChipText, { color: '#92400E' }]}>{t.remaining}: {antarRemaining}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 6, gap: 16 }}>
              <DateBlock label={t.startsOn} value={antar.start_date} />
              <DateBlock label={t.endsOn}   value={antar.end_date}   />
            </View>
            {antarThemes.length ? (
              <>
                <Text style={styles.themesHeader}>{t.themes}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {antarThemes.map((th, i) => (
                    <View key={i} style={styles.themeChip}>
                      <Text style={styles.themeChipText}>{th}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.tapHint}>{t.askMore}</Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ===========================================================================
// Sub-components
// ===========================================================================
const Field: React.FC<{ label: string; value: string; flex?: number; tint?: 'indigo' | 'saffron' }> = ({
  label, value, flex = 1, tint,
}) => (
  <View style={{ flex }}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
    <Text style={[
      styles.fieldValue,
      tint === 'indigo'  && { color: P.ink },
      tint === 'saffron' && { color: P.saffron },
    ]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

// v8.5.2 — Boxed table cell for the Birth Details record. All four
// cells (Date · Day · Time · Place) share height, have a subtle indigo
// border, and sit in a single row so they read like a passport record.
const BirthCell: React.FC<{ label: string; value: string; flex?: number; last?: boolean }> = ({
  label, value, flex = 1, last,
}) => (
  <View style={[styles.birthCell, { flex }, !last && styles.birthCellDivider]}>
    <Text style={styles.birthCellLabel}>{label.toUpperCase()}</Text>
    <Text style={styles.birthCellValue} numberOfLines={2}>{value}</Text>
  </View>
);

// v8.6.3 — Tappable variant. Same dimensions as BirthCell (so the two
// rows of the passport table align perfectly), but wrapped in a
// TouchableOpacity with a saffron-tinted value to signal "ask Vidhaata".
const TappableBirthCell: React.FC<{
  label: string; value: string; flex?: number; last?: boolean; onPress: () => void;
}> = ({ label, value, flex = 1, last, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    style={[styles.birthCell, { flex }, !last && styles.birthCellDivider]}
  >
    <Text style={styles.birthCellLabel}>{label.toUpperCase()}</Text>
    <Text style={[styles.birthCellValue, { color: P.saffron }]} numberOfLines={2}>
      {value}
    </Text>
  </TouchableOpacity>
);

const TappableField: React.FC<{
  label: string; value: string; onPress: () => void;
  flex?: number; tint?: 'indigo' | 'saffron';
}> = ({ label, value, onPress, flex = 1, tint }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex }}>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[
        styles.fieldValue,
        tint === 'indigo'  && { color: P.deep },
        tint === 'saffron' && { color: P.saffron },
        { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: tint === 'saffron' ? P.saffron : P.mid },
      ]} numberOfLines={2}>
        {value}
      </Text>
      <Ionicons name="chatbubble-ellipses" size={12} color={tint === 'saffron' ? P.saffron : P.mid} style={{ marginLeft: 4 }} />
    </View>
  </TouchableOpacity>
);

const Pill: React.FC<{ label: string; value: string; good?: boolean; warn?: boolean }> = ({
  label, value, good, warn,
}) => (
  <View style={[
    styles.pill,
    warn ? styles.pillWarn : good ? styles.pillGood : null,
  ]}>
    <Text style={styles.pillLabel}>{label.toUpperCase()}</Text>
    <Text style={[
      styles.pillValue,
      warn ? { color: BRAND.rose } : good ? { color: BRAND.emerald } : null,
    ]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const DoshaItem: React.FC<{
  label: string; active: boolean; activeLabel: string; clearLabel: string;
  hint?: string; onPress?: () => void;
}> = ({ label, active, activeLabel, clearLabel, hint, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    onPress={onPress}
    style={[
      styles.doshaItem,
      { backgroundColor: active ? '#FEF2F2' : '#ECFDF5',
        borderColor: active ? '#FCA5A5' : '#BBF7D0' },
    ]}
  >
    <Ionicons
      name={active ? 'alert-circle' : 'shield-checkmark'}
      size={18}
      color={active ? BRAND.rose : BRAND.emerald}
    />
    <Text style={[
      styles.doshaLabel,
      { color: active ? '#7F1D1D' : '#064E3B' },
    ]}>
      {label}
    </Text>
    <Text style={[
      styles.doshaStatus,
      { color: active ? BRAND.rose : BRAND.emerald },
    ]}>
      {active ? activeLabel : clearLabel}
    </Text>
    {hint ? <Text style={styles.doshaHint} numberOfLines={2}>{hint}</Text> : null}
    <Ionicons name="chatbubble-ellipses" size={11} color={P.faint} style={{ marginTop: 4 }} />
  </TouchableOpacity>
);

const DateBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View>
    <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
    <Text style={[styles.fieldValue, { color: P.ink }]}>
      {value}
    </Text>
  </View>
);

const LegendDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 4 }} />
    <Text style={{ fontSize: 10, color: P.faint, fontWeight: '700' }}>{label}</Text>
  </View>
);

// ===========================================================================
// Helpers
// ===========================================================================

// Maps classical yoga names to RAG category.
const MALEFIC_KEYWORDS = ['daridra', 'daridr', 'kaal sarpa', 'kaalsarpa', 'vish', 'dosha', 'bhanga', 'kemadruma', 'angaarak', 'pishacha', 'preta', 'graha yuddha'];
const BENEFIC_KEYWORDS = ['raj', 'rajya', 'dhana', 'lakshmi', 'gajakesari', 'vipareeta', 'pancha', 'mahapurusha', 'ruchaka', 'bhadra', 'hamsa', 'malavya', 'sasa', 'chamara', 'akhand', 'saraswati', 'gaja', 'amla', 'guru', 'vasumati', 'budha-aditya', 'budhaditya', 'viparita'];
function classifyYoga(name: string, desc?: string): { bg: string; border: string; text: string; dot: string } {
  const hay = `${name || ''} ${desc || ''}`.toLowerCase();
  if (MALEFIC_KEYWORDS.some((k) => hay.includes(k))) {
    return { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', dot: '#DC2626' };
  }
  if (BENEFIC_KEYWORDS.some((k) => hay.includes(k))) {
    return { bg: '#DCFCE7', border: '#86EFAC', text: '#166534', dot: '#16A34A' };
  }
  // Default = amber / mixed
  return { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', dot: '#D97706' };
}

function classifyYogaByPolarity(pol: string | undefined) {
  const p = (pol || '').toLowerCase();
  if (p === 'positive') return { bg: '#DCFCE7', border: '#86EFAC', text: '#166534', dot: '#16A34A' };
  if (p === 'negative') return { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B', dot: '#DC2626' };
  return { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', dot: '#D97706' };
}

// Classical Vimshottari dasha themes (short-form, used as theme chips).
const DASHA_THEMES: Record<string, { en: string[]; te: string[] }> = {
  Sun:      { en: ['Authority', 'Government / Leadership', 'Father figure', 'Fame', 'Health - heart'],                     te: ['అధికారం', 'ప్రభుత్వం', 'తండ్రి', 'కీర్తి', 'ఆరోగ్యం'] },
  Moon:     { en: ['Emotions', 'Mother', 'Home & property', 'Public image', 'Mind'],                                       te: ['భావోద్వేగాలు', 'తల్లి', 'ఇల్లు', 'ప్రజా ఆదరణ', 'మనస్సు'] },
  Mars:     { en: ['Drive', 'Property / land', 'Siblings', 'Conflict & courage', 'Real estate'],                           te: ['ధైర్యం', 'ఆస్తి', 'సోదరులు', 'వాదం', 'భూమి'] },
  Mercury:  { en: ['Commerce', 'Communication', 'Writing / study', 'Short trips', 'Intellect'],                            te: ['వ్యాపారం', 'సంభాషణ', 'విద్య', 'యాత్రలు', 'బుద్ధి'] },
  Jupiter:  { en: ['Wisdom', 'Children', 'Teachers / gurus', 'Wealth expansion', 'Spiritual growth'],                      te: ['జ్ఞానం', 'పిల్లలు', 'గురువులు', 'ధనం', 'ఆధ్యాత్మికత'] },
  Venus:    { en: ['Marriage / partnerships', 'Luxury & comfort', 'Art & beauty', 'Vehicles', 'Relationships'],            te: ['వివాహం', 'భోగం', 'కళ', 'వాహనాలు', 'సంబంధాలు'] },
  Saturn:   { en: ['Discipline & delay', 'Career consolidation', 'Service & labour', 'Longevity', 'Hard lessons'],         te: ['క్రమశిక్షణ', 'వృత్తి', 'సేవ', 'ఆయుష్షు', 'కష్టాలు'] },
  Rahu:     { en: ['Foreign / tech', 'Sudden gains', 'Unconventional paths', 'Obsessions', 'Mass fame'],                   te: ['విదేశాలు', 'ఆకస్మిక లాభం', 'అసాధారణ మార్గం', 'మైకం', 'ప్రజా కీర్తి'] },
  Ketu:     { en: ['Detachment', 'Spiritual insight', 'Research / occult', 'Endings & renunciation', 'Moksha'],            te: ['వైరాగ్యం', 'ఆధ్యాత్మిక దృష్టి', 'శోధన', 'త్యాగం', 'మోక్షం'] },
};
function dashaThemes(planet: string | undefined, lang: 'en' | 'te'): string[] {
  if (!planet) return [];
  const aliases: Record<string, string> = {
    Surya: 'Sun', Chandra: 'Moon', Mangala: 'Mars', Budha: 'Mercury',
    Guru: 'Jupiter', Shukra: 'Venus', Shani: 'Saturn',
  };
  const key = aliases[planet] || planet;
  const e = DASHA_THEMES[key];
  if (!e) return [];
  return lang === 'te' ? e.te : e.en;
}

// Returns a compact human-readable time remaining like "2y 3m" / "8m" / "21d".
function humanRemaining(endDate: string | undefined, lang: 'en' | 'te'): string {
  if (!endDate) return '';
  try {
    const end = new Date(endDate);
    const now = new Date();
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return lang === 'en' ? 'ended' : 'ముగిసింది';
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    if (years >= 1) return lang === 'en' ? `${years}y ${months}m` : `${years}సం ${months}నె`;
    if (months >= 1) {
      const rem = days % 30;
      return lang === 'en' ? `${months}m ${rem}d` : `${months}నె ${rem}రో`;
    }
    return lang === 'en' ? `${days}d` : `${days}రో`;
  } catch { return ''; }
}

// ===========================================================================
// Styles
// ===========================================================================
const styles = StyleSheet.create({
  // v6.46 — Deep-Purple ribbon atop cream body.
  card: {
    backgroundColor: BRAND.cream,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.3,
    borderColor: BRAND.goldLine,
    overflow: 'hidden',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.colors.primary700, // deep indigo/purple
    borderBottomWidth: 1,
    borderBottomColor: BRAND.goldLine,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  bannerBadge: {
    color: '#FDE68A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 14,
  },
  // v8.6.2 — Now-strip (current location + live time, sits above the
  // Birth Details card). Replaces the ugly cramped pill that used to
  // live inside the header.
  nowStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF7ED',       // soft saffron-tinted cream
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 10,
  },
  nowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
  },
  nowPlace: {
    fontSize: 13,
    fontWeight: '700',
    color: P.saffron,
    flexShrink: 1,
  },
  nowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  nowDate: {
    fontSize: 12,
    color: P.ink,
    fontWeight: '600',
  },
  nowTime: {
    fontSize: 15,
    color: P.ink,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // v8.6.2 — Birth Details = ONE bordered container holding a full-
  // width Name row + a 4-cell Date/Day/Time/Place row. Shared padding
  // and typography make them read like a single passport record.
  birthTable: {
    borderWidth: 1,
    borderColor: P.light,
    borderRadius: 10,
    backgroundColor: '#FAFBFF',
    overflow: 'hidden',
    marginBottom: 4,
  },
  birthNameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: P.light,
    gap: 8,
    backgroundColor: '#F5F7FF',
  },
  birthNameText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: P.ink,
    letterSpacing: 0.2,
  },
  birthTableRow: {
    flexDirection: 'row',
  },
  // v8.6.3 — second row (Lagna/Moon/Nakshatra/Pada) gets a hairline
  // divider above so it visually belongs to the same passport unit
  // while still being distinguishable as "derived chart data".
  birthTableRowBordered: {
    borderTopWidth: 1,
    borderTopColor: P.light,
    backgroundColor: '#FFFFFF',
  },
  // v8.6.6 — Location pill that sits in the Today's Panchanga banner
  // (saffron-tinted on a deep-indigo banner background). Chosen look:
  // semi-transparent white fill so it reads as "chip on header" while
  // still respecting the banner's purple/gold theme.
  panchangaLocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  panchangaLocText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    maxWidth: 140,
  },
  birthCell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'flex-start',
    minHeight: 56,
  },
  birthCellDivider: {
    borderRightWidth: 1,
    borderRightColor: P.light,
  },
  birthCellLabel: {
    fontSize: 9,
    color: BRAND.faint,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  birthCellValue: {
    fontSize: 13,
    color: P.ink,
    fontWeight: '700',
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 9.5,
    color: BRAND.faint,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 13.5,
    color: BRAND.text,
    fontWeight: '700',
    marginTop: 3,
  },
  hrGold: {
    height: 1,
    backgroundColor: BRAND.goldLine,
    marginVertical: 10,
  },
  tapHint: {
    fontSize: 10,
    color: theme.colors.primary700,
    fontWeight: '700',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  yogaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1.2,
  },
  yogaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  yogaChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.goldLine,
  },
  helperText: {
    fontSize: 10.5,
    color: BRAND.faint,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 15,
  },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND.goldLine,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
    marginTop: 6,
  },
  pillGood: {
    borderColor: '#BBF7D0',
    backgroundColor: '#ECFDF5',
  },
  pillWarn: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  pillLabel: {
    fontSize: 9.5,
    color: BRAND.faint,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pillValue: {
    fontSize: 12,
    color: BRAND.text,
    fontWeight: '700',
    marginTop: 2,
  },
  doshaItem: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  doshaLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
  },
  doshaStatus: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  doshaHint: {
    fontSize: 9.5,
    color: BRAND.faint,
    marginTop: 3,
    textAlign: 'center',
  },
  horaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.goldLine,
    gap: 10,
  },
  horaTimeBlock: {
    alignItems: 'center',
    minWidth: 64,
  },
  horaTime: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.maroon,
  },
  horaTimeSep: {
    fontSize: 10,
    color: BRAND.faint,
  },
  ratingChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ratingChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  horaDo: {
    fontSize: 11.5,
    color: BRAND.emerald,
    fontWeight: '600',
    lineHeight: 15,
  },
  rahuWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rahuWarnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.rose,
    flex: 1,
  },
  remainingChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.primary100,
    borderWidth: 1,
    borderColor: theme.colors.primary600,
    marginBottom: 4,
  },
  remainingChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: theme.colors.primary800,
    letterSpacing: 0.4,
  },
  themesHeader: {
    fontSize: 9.5,
    color: BRAND.faint,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  themeChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND.goldLine,
    marginRight: 5,
    marginBottom: 5,
  },
  themeChipText: {
    fontSize: 10.5,
    color: BRAND.maroon,
    fontWeight: '700',
  },
});

export default OverviewTab;
