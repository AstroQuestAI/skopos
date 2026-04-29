/**
 * TodayMuhurtaTab — displays the 24-hora schedule for today with classical
 * Do's / Don'ts per hora, color-coded by the 7-tier Best→Worst rating.
 *
 * Visual language matches Vidhaata / Similar Charts tab: saffron & maroon
 * palette (BRAND from mdTheme), cream backgrounds, gold hairlines, bold
 * classical headings.
 *
 * Fetches GET /api/today-muhurtas?lat&lon&tz&lang — refreshes on mount.
 *
 * v6.33.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BRAND } from './mdTheme';
import { ThemedCard, SectionBanner, themedCardStyles } from './SectionBanner';

// ---------------------------------------------------------------------------
// Types (mirror of backend response)
// ---------------------------------------------------------------------------
export interface Hora {
  index: number;
  segment: 'day' | 'night';
  start_time: string;
  end_time: string;
  lord: string;
  lord_display: string;
  rating: 'Best' | 'Better' | 'Good' | 'Okay' | 'Moderate' | 'Bad' | 'Worst';
  score: number;
  do: string[];
  dont: string[];
  notes: string[];
}

export interface TodayMuhurta {
  date: string;
  weekday: string;
  weekday_lord: string;
  sunrise: string;
  sunset: string;
  tithi: { paksha: string; name: string; index_in_paksha: number; is_rikta: boolean };
  moon_sign: string;
  nakshatra: string;
  nakshatra_quality: 'benefic' | 'malefic' | 'neutral';
  rahu_kaal: { start: string; end: string };
  horas: Hora[];
}

// Color palette for the 7-tier rating — chosen to read as a ladder:
// deep green → emerald → light green → amber → orange → red → deep red.
// Each tier has (bg, border, text) triples so tiles feel calm yet distinct.
const RATING_COLORS: Record<Hora['rating'], {
  bg: string; border: string; text: string; label: string; labelTe: string; emoji: string;
}> = {
  Best:     { bg: '#D1FAE5', border: '#047857', text: '#064E3B', label: 'Best',     labelTe: 'అత్యుత్తమం', emoji: '🟢🟢' },
  Better:   { bg: '#DCFCE7', border: '#16A34A', text: '#14532D', label: 'Better',   labelTe: 'మెరుగైనది', emoji: '🟢' },
  Good:     { bg: '#ECFCCB', border: '#65A30D', text: '#365314', label: 'Good',     labelTe: 'మంచిది',   emoji: '✅' },
  Okay:     { bg: '#FEF9C3', border: '#CA8A04', text: '#713F12', label: 'Okay',     labelTe: 'సామాన్యం',  emoji: '🟡' },
  Moderate: { bg: '#FED7AA', border: '#EA580C', text: '#7C2D12', label: 'Moderate', labelTe: 'మధ్యమం',   emoji: '🟠' },
  Bad:      { bg: '#FECACA', border: '#DC2626', text: '#7F1D1D', label: 'Bad',      labelTe: 'దుష్ట',    emoji: '🔴' },
  Worst:    { bg: '#FEE2E2', border: '#991B1B', text: '#7F1D1D', label: 'Worst',    labelTe: 'అత్యంత దుష్ట', emoji: '⛔' },
};

import { BACKEND_URL } from '../utils/backendUrl';

interface Props {
  latitude?: number | null;
  longitude?: number | null;
  timezoneOffset?: number;
  language: 'en' | 'te';
  locationName?: string;
  /** v6.40 — when false, only the first 5 horas per segment are visible;
   *  the remainder renders as a blurred "Upgrade to unlock" teaser. */
  planActive?: boolean;
  onUpgrade?: () => void;
}

export const TodayMuhurtaTab: React.FC<Props> = ({
  latitude, longitude, timezoneOffset = 5.5, language, locationName,
  planActive = true, onUpgrade,
}) => {
  const [data, setData] = useState<TodayMuhurta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // v8.6.9d — Responsive breakpoint: ≥ 900 px → desktop grid layout.
  const { width: windowWidth } = useWindowDimensions();

  // v8.6.9e — Mobile-first filters:
  //  * activeSegment    : which segment to show on mobile (desktop shows both)
  //  * qualityFilter    : null = show all, else restrict to a single rating tier
  const [activeSegment, setActiveSegment] = useState<'day' | 'night'>('day');
  const [qualityFilter, setQualityFilter] = useState<Hora['rating'] | null>(null);

  const load = async () => {
    try {
      setError(null);
      const params: any = { tz: timezoneOffset, lang: language };
      if (latitude != null) params.lat = latitude;
      if (longitude != null) params.lon = longitude;
      const resp = await axios.get(`${BACKEND_URL}/api/today-muhurtas`, { params });
      setData(resp.data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load today\'s muhurtas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [latitude, longitude, timezoneOffset, language]);

  // --- Legend row (7 tiers) — shown once at top of scroll ---
  // v8.6.9e — Quality Ladder is now an INTERACTIVE filter.
  // Clicking a rating chip restricts the visible horas to that rating only.
  // Clicking the selected chip again (or the "All" chip) clears the filter.
  // Educational labels preserved so the legend still doubles as a key.
  const legend = useMemo(() => {
    const allBtn = (
      <TouchableOpacity
        key="__all__"
        onPress={() => setQualityFilter(null)}
        activeOpacity={0.7}
        style={{
          paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginTop: 4,
          borderRadius: 10,
          borderWidth: qualityFilter === null ? 2 : 1,
          borderColor: qualityFilter === null ? BRAND.maroon : '#D1D5DB',
          backgroundColor: qualityFilter === null ? BRAND.maroon : '#FFFFFF',
        }}
      >
        <Text style={{
          fontSize: 10.5, fontWeight: '800',
          color: qualityFilter === null ? '#FFFFFF' : BRAND.maroon,
        }}>
          {language === 'en' ? 'All' : 'అన్నీ'}
        </Text>
      </TouchableOpacity>
    );
    return (
      <View style={{
        flexDirection: 'row', flexWrap: 'wrap',
        marginBottom: 12, padding: 10,
        backgroundColor: BRAND.cream,
        borderWidth: 1, borderColor: BRAND.goldLine, borderRadius: 8,
      }}>
        <Text style={{
          width: '100%', fontSize: 11, fontWeight: '800',
          color: BRAND.maroon, letterSpacing: 0.8, marginBottom: 6,
        }}>
          {language === 'en' ? '✧ TAP A RATING TO FILTER' : '✧ వడపోతకు గుణాన్ని నొక్కండి'}
        </Text>
        {allBtn}
        {(['Best','Better','Good','Okay','Moderate','Bad','Worst'] as Hora['rating'][]).map((r) => {
          const c = RATING_COLORS[r];
          const selected = qualityFilter === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => setQualityFilter(selected ? null : r)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginTop: 4,
                borderRadius: 10,
                borderWidth: selected ? 2 : 1,
                borderColor: c.border,
                backgroundColor: c.bg,
                opacity: (qualityFilter && !selected) ? 0.55 : 1,
              }}
            >
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: c.text }}>
                {c.emoji} {language === 'te' ? c.labelTe : c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [language, qualityFilter]);

  if (loading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color={BRAND.saffron} size="large" />
        <Text style={{ marginTop: 12, color: BRAND.faint, fontSize: 13 }}>
          {language === 'en' ? 'Computing today\'s horas…' : 'ఈరోజు హోరాలు లెక్కిస్తున్నాం…'}
        </Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Ionicons name="alert-circle" size={40} color={BRAND.rose} />
        <Text style={{ marginTop: 10, color: BRAND.rose, fontSize: 13 }}>
          {error || 'No data'}
        </Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load(); }}
          style={{
            marginTop: 14, paddingHorizontal: 16, paddingVertical: 8,
            backgroundColor: BRAND.saffron, borderRadius: 8,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { horas, tithi } = data;
  const dayHorasAll   = horas.filter(h => h.segment === 'day');
  const nightHorasAll = horas.filter(h => h.segment === 'night');

  // v8.6.9e — apply quality filter (shared across both segments + both layouts).
  const applyFilter = (arr: Hora[]) =>
    qualityFilter ? arr.filter(h => h.rating === qualityFilter) : arr;
  const dayHoras   = applyFilter(dayHorasAll);
  const nightHoras = applyFilter(nightHorasAll);

  // v8.6.9d — Desktop densification: on ≥ 900 px wide screens, render Day and
  // Night hora cards side-by-side (2-column) and center the whole column at
  // max-width 1100 px so landscape desktops don't waste horizontal real estate.
  // Mobile/tablet portrait gets Day/Night sub-tabs instead (one card visible
  // at a time → half the scroll height on phones).
  // v8.6.9f — stretch edge-to-edge on BOTH desktop and mobile. Previously we
  // capped at 1100 px which left visible side-margins on wide monitors.
  const isDesktop = windowWidth >= 900;

  // v8.6.9e — Day / Night sub-tab pills (mobile only).
  const segmentSubTabs = (
    <View style={{
      flexDirection: 'row', gap: 8, marginBottom: 10,
      justifyContent: 'center',
    }}>
      {(['day', 'night'] as const).map((seg) => {
        const selected = activeSegment === seg;
        const label = seg === 'day'
          ? (language === 'en' ? '☀ Day' : '☀ పగలు')
          : (language === 'en' ? '☾ Night' : '☾ రాత్రి');
        const count = seg === 'day' ? dayHoras.length : nightHoras.length;
        return (
          <TouchableOpacity
            key={seg}
            onPress={() => setActiveSegment(seg)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 14, paddingVertical: 8,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: selected ? BRAND.maroon : '#D4D4D8',
              backgroundColor: selected ? BRAND.maroon : '#FFFFFF',
              gap: 6,
              minWidth: 110, justifyContent: 'center',
            }}
          >
            <Text style={{
              fontSize: 13, fontWeight: '800',
              color: selected ? '#FFFFFF' : BRAND.maroon,
            }}>
              {label}
            </Text>
            <View style={{
              paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
              backgroundColor: selected ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: selected ? '#FFFFFF' : '#6B7280',
              }}>
                {count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Reusable hora-column factory (same markup for mobile & desktop, avoids dupe).
  const renderHoraColumn = (segment: 'day' | 'night') => {
    const isDay = segment === 'day';
    const list = isDay ? dayHoras : nightHoras;
    const fullCount = isDay ? dayHorasAll.length : nightHorasAll.length;
    return (
      <ThemedCard flush>
        <SectionBanner
          icon={isDay ? 'sunny' : 'moon'}
          title={
            isDay
              ? (language === 'en' ? 'Day Horas (Sunrise → Sunset)' : 'పగటి హోరాలు')
              : (language === 'en' ? 'Night Horas (Sunset → Sunrise)' : 'రాత్రి హోరాలు')
          }
          badge={
            <Text style={themedCardStyles.bannerBadge}>
              {qualityFilter ? `${list.length}/${fullCount}` : String(list.length)}
            </Text>
          }
        />
        <View style={themedCardStyles.cardBody}>
          {list.length === 0 ? (
            <View style={{ padding: 22, alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>🔎</Text>
              <Text style={{
                marginTop: 8, fontSize: 13, color: BRAND.faint,
                textAlign: 'center',
              }}>
                {language === 'en'
                  ? `No ${qualityFilter ?? ''} horas in this segment today.`
                  : 'ఈ విభాగంలో హోరాలు లేవు.'}
              </Text>
              {qualityFilter ? (
                <TouchableOpacity
                  onPress={() => setQualityFilter(null)}
                  style={{
                    marginTop: 10,
                    paddingHorizontal: 14, paddingVertical: 6,
                    borderRadius: 14, backgroundColor: BRAND.maroon,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '700' }}>
                    {language === 'en' ? 'Clear filter' : 'వడపోత తీసివేయండి'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <>
              {(planActive ? list : list.slice(0, 5)).map((h) =>
                <HoraCard key={h.index} hora={h} language={language} />)}
              {!planActive && list.length > 5 ? (
                <MuhurtaMaskBlock
                  hiddenCount={list.length - 5}
                  language={language}
                  onUpgrade={onUpgrade}
                />
              ) : null}
            </>
          )}
        </View>
      </ThemedCard>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      contentContainerStyle={{
        // v8.6.9f — stretch edge-to-edge on BOTH desktop and mobile. No
        // maxWidth / centered wrap anymore. Only minimal horizontal padding
        // so cards don't touch the viewport edges.
        paddingHorizontal: isDesktop ? 16 : 10,
        paddingTop: isDesktop ? 16 : 12,
        paddingBottom: 40,
        width: '100%',
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={BRAND.saffron}
        />
      }
    >
      {/* --- Header card (date / tithi / nakshatra / sunrise / rahu-kaal) --- */}
      <ThemedCard flush style={{ marginBottom: 14 }}>
        <SectionBanner
          icon="calendar"
          title={language === 'en' ? "Today's Panchanga" : 'ఈరోజు పంచాంగం'}
          badge={
            <Text style={themedCardStyles.bannerBadge}>
              {data.weekday.toUpperCase()}
            </Text>
          }
        />
        <View style={themedCardStyles.cardBody}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#312E81' }}>
            {data.date} · {data.weekday}
          </Text>
          <Text style={{ fontSize: 12, color: BRAND.faint, marginTop: 2 }}>
            {language === 'en' ? 'ruled by ' : 'అధిపతి '}{data.weekday_lord}
          </Text>
          <View style={{ height: 1, backgroundColor: BRAND.goldLine, marginVertical: 10 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <InfoPill label={language === 'en' ? 'Tithi' : 'తిథి'}
                      value={`${tithi.paksha} ${tithi.name}`}
                      warn={tithi.is_rikta} />
            <InfoPill label={language === 'en' ? 'Nakshatra' : 'నక్షత్రం'}
                      value={data.nakshatra}
                      good={data.nakshatra_quality === 'benefic'}
                      warn={data.nakshatra_quality === 'malefic'} />
            <InfoPill label={language === 'en' ? 'Moon' : 'చంద్రుడు'} value={data.moon_sign} />
            <InfoPill label={language === 'en' ? 'Sunrise' : 'సూర్యోదయం'} value={data.sunrise} />
            <InfoPill label={language === 'en' ? 'Sunset' : 'సూర్యాస్తమయం'} value={data.sunset} />
            <InfoPill label={language === 'en' ? 'Rahu Kaal' : 'రాహుకాలం'}
                      value={`${data.rahu_kaal.start}–${data.rahu_kaal.end}`} warn />
          </View>
          {tithi.is_rikta && (
            <Text style={{ marginTop: 8, fontSize: 11, color: BRAND.rose, fontStyle: 'italic' }}>
              ⚠ {language === 'en'
                ? 'Rikta tithi today — classical rule: avoid all new initiations, auspicious rites, marriages.'
                : 'ఈ రోజు రిక్తా తిథి — కొత్త ప్రారంభాలు, శుభ కార్యాలు మానాలి.'}
            </Text>
          )}
        </View>
      </ThemedCard>

      {legend}

      {/* --- Mobile: sub-tab toggle, desktop: 2-column side-by-side --- */}
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{renderHoraColumn('day')}</View>
          <View style={{ flex: 1 }}>{renderHoraColumn('night')}</View>
        </View>
      ) : (
        <>
          {segmentSubTabs}
          {renderHoraColumn(activeSegment)}
        </>
      )}

      {/* Footer disclaimer — keeps things grounded */}
      <Text style={{
        marginTop: 16, fontSize: 11, color: BRAND.faint,
        textAlign: 'center', fontStyle: 'italic', lineHeight: 16,
      }}>
        {language === 'en'
          ? 'Ratings blend the hora lord, current tithi, nakshatra quality, and Rahu-kaal overlap. For life-event specific muhurtas, use the Muhurta Finder or ask Vidhaata.'
          : 'హోరా అధిపతి, తిథి, నక్షత్రం, రాహుకాలంపై ఆధారపడిన రేటింగ్. వ్యక్తిగత ముహూర్తాలకు విధాతను అడగండి.'}
      </Text>
      <View style={{
        marginTop: 12, padding: 10, borderRadius: 8,
        backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
      }}>
        <Text style={{ fontSize: 10.5, color: '#92400E', fontStyle: 'italic', lineHeight: 15, textAlign: 'center' }}>
          {language === 'en'
            ? '🪷 Classical astrology illuminates tendencies, not guarantees. As Varāhamihira reminds in the phalashruti of Brihat Jataka, the fruit is shaped by prior karma, right effort, and the grace of the Divine — no chart alone determines the outcome.'
            : '🪷 శాస్త్రీయ జ్యోతిషం ధోరణులను సూచిస్తుంది, ఫలితాన్ని హామీ ఇవ్వదు. వరాహమిహిర బృహజ్జాతక ఫలశ్రుతిలో చెప్పినట్లు, ఫలం పూర్వ కర్మ, సత్ప్రయత్నం, దేవానుగ్రహంతో నిర్ణయింపబడుతుంది.'}
        </Text>
      </View>
    </ScrollView>
  );
};

const InfoPill: React.FC<{ label: string; value: string; good?: boolean; warn?: boolean }> = ({
  label, value, good, warn,
}) => (
  <View style={{
    paddingHorizontal: 9, paddingVertical: 5,
    marginRight: 6, marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: warn ? BRAND.rose : good ? BRAND.emerald : BRAND.goldLine,
    backgroundColor: warn ? '#FEF2F2' : good ? '#ECFDF5' : '#FFFFFF',
  }}>
    <Text style={{ fontSize: 9.5, color: BRAND.faint, letterSpacing: 0.5 }}>
      {label.toUpperCase()}
    </Text>
    <Text style={{
      fontSize: 12, fontWeight: '700',
      color: warn ? BRAND.rose : good ? BRAND.emerald : BRAND.text,
    }}>
      {value}
    </Text>
  </View>
);

// v6.40 — teaser block shown when the user isn't on a paid plan.
const MuhurtaMaskBlock: React.FC<{
  hiddenCount: number;
  language: 'en' | 'te';
  onUpgrade?: () => void;
}> = ({ hiddenCount, language, onUpgrade }) => (
  <View style={{
    marginTop: 6, marginBottom: 10, padding: 14, borderRadius: 12,
    backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE',
  }}>
    <View style={{ height: 8, backgroundColor: '#C7D2FE', borderRadius: 4, width: '92%', marginBottom: 6, opacity: 0.55 }} />
    <View style={{ height: 8, backgroundColor: '#C7D2FE', borderRadius: 4, width: '76%', marginBottom: 6, opacity: 0.40 }} />
    <View style={{ height: 8, backgroundColor: '#C7D2FE', borderRadius: 4, width: '85%', marginBottom: 10, opacity: 0.25 }} />
    <Text style={{ fontSize: 12, color: '#3730A3', fontWeight: '700' }}>
      🔒 {hiddenCount} more {language === 'en' ? 'horas hidden' : 'హోరాలు దాచబడ్డాయి'}.
    </Text>
    {onUpgrade ? (
      <TouchableOpacity onPress={onUpgrade} style={{
        marginTop: 8, paddingVertical: 8, paddingHorizontal: 12,
        backgroundColor: '#3730A3', borderRadius: 8, alignSelf: 'flex-start',
      }}>
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
          {language === 'en' ? 'Upgrade to unlock full schedule' : 'పూర్తి హోరాలకు Upgrade చేయండి'}
        </Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// v6.48 — indigo-themed section header strip (matches Overview ribbons).
const SectionHeader: React.FC<{ icon: any; text: string }> = ({ icon, text }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    marginTop: 4, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#4338CA',
  }}>
    <Ionicons name={icon} size={15} color="#FFFFFF" />
    <Text style={{
      marginLeft: 8, fontSize: 12, fontWeight: '800', color: '#FFFFFF',
      letterSpacing: 1.2,
    }}>
      {text.toUpperCase()}
    </Text>
  </View>
);

const HoraCard: React.FC<{ hora: Hora; language: 'en' | 'te' }> = ({ hora, language }) => {
  const c = RATING_COLORS[hora.rating];
  return (
    <View style={{
      marginBottom: 10,
      borderRadius: 10,
      borderWidth: 1.3, borderColor: c.border,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    }}>
      {/* Rating ribbon header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: c.bg,
        paddingHorizontal: 12, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: c.border,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: c.text, marginRight: 8 }}>
          {c.emoji} {language === 'te' ? c.labelTe : c.label}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND.text }}>
          {hora.start_time}–{hora.end_time}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: BRAND.faint }}>
          H{hora.index} · {hora.lord_display}
        </Text>
      </View>

      {/* Do's */}
      {hora.do.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND.emerald, letterSpacing: 0.5 }}>
            ✓ {language === 'en' ? 'SUITABLE FOR' : 'అనుకూలం'}
          </Text>
          {hora.do.map((d, i) => (
            <Text key={i} style={{ fontSize: 12, color: BRAND.text, marginTop: 3, lineHeight: 17 }}>
              •  {d}
            </Text>
          ))}
        </View>
      )}

      {/* Don'ts */}
      {hora.dont.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: BRAND.rose, letterSpacing: 0.5 }}>
            ✗ {language === 'en' ? 'AVOID' : 'నిషేధం'}
          </Text>
          {hora.dont.map((d, i) => (
            <Text key={i} style={{ fontSize: 12, color: BRAND.text, marginTop: 3, lineHeight: 17 }}>
              •  {d}
            </Text>
          ))}
        </View>
      )}

      {/* Notes (e.g., Rahu-kaal overlap, Rikta downgrade) */}
      {hora.notes.length > 0 && (
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6,
          backgroundColor: '#FFFBEB',
          borderTopWidth: 1, borderTopColor: BRAND.goldLine,
        }}>
          {hora.notes.map((n, i) => (
            <Text key={i} style={{ fontSize: 11, color: BRAND.saffron, fontStyle: 'italic' }}>
              ⓘ {n}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

export default TodayMuhurtaTab;
