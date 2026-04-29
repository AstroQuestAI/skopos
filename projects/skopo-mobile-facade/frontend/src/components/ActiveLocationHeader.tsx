/**
 * ActiveLocationHeader — the slim sticky bar that shows:
 *   • a live-ticking clock in the user's currently-selected location
 *   • the location label itself, tappable to change
 *
 * All time-sensitive features (Today's Muhurtas, Vidhaata's panchanga
 * answers, 14-day muhurta finder) read from this location rather than
 * the birth-chart location, so a user in Hyderabad who wants auspicious
 * timings for a trip to London can just tap the location and switch
 * without re-computing their birth chart.
 *
 * v6.34.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { BRAND } from './mdTheme';

import { BACKEND_URL } from '../utils/backendUrl';

export interface ActiveLocation {
  name: string;
  lat: number;
  lon: number;
  tzOffset: number;   // hours east of UTC (e.g. IST = +5.5, EST = -5)
}

interface Props {
  value: ActiveLocation;
  onChange: (loc: ActiveLocation) => void;
  language: 'en' | 'te';
}

// Rough TZ offset from longitude — works well for IST / GMT / EST / PST;
// not DST-aware but adequate for a display-time header.
export function estimateTzOffset(lon: number): number {
  // Round to nearest 0.5h
  const h = Math.round((lon / 15) * 2) / 2;
  // Clamp
  return Math.max(-12, Math.min(14, h));
}

export const ActiveLocationHeader: React.FC<Props> = ({ value, onChange, language }) => {
  const [now, setNow] = useState<Date>(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tick every 15 seconds so the seconds-less display stays fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Compose the local time string for the active location. We take real
  // UTC, add tzOffset hours, and format HH:MM + weekday.
  const localTimeStr = useMemo(() => {
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    const local = new Date(utcMs + value.tzOffset * 3_600_000);
    const hh = String(local.getHours()).padStart(2, '0');
    const mm = String(local.getMinutes()).padStart(2, '0');
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const wd = weekdays[local.getDay()];
    const day = local.getDate();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return { time: `${hh}:${mm}`, date: `${wd} ${day} ${months[local.getMonth()]}` };
  }, [now, value.tzOffset]);

  return (
    <>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: BRAND.cream,
        borderBottomWidth: 1, borderBottomColor: BRAND.goldLine,
      }}>
        {/* Clock block */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
          <Ionicons name="time" size={16} color={BRAND.saffron} />
          <View style={{ marginLeft: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND.maroon, lineHeight: 16 }}>
              {localTimeStr.time}
            </Text>
            <Text style={{ fontSize: 9.5, color: BRAND.faint, lineHeight: 12 }}>
              {localTimeStr.date}
            </Text>
          </View>
        </View>

        {/* Location block — tappable */}
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 10, paddingVertical: 6,
            backgroundColor: '#FFFFFF', borderRadius: 20,
            borderWidth: 1, borderColor: BRAND.goldLine,
          }}
        >
          <Ionicons name="location" size={13} color={BRAND.maroon} />
          <Text numberOfLines={1} style={{
            flex: 1, fontSize: 12, fontWeight: '700',
            color: BRAND.text, marginLeft: 6,
          }}>
            {value.name}
          </Text>
          <Text style={{ fontSize: 10, color: BRAND.saffron, fontWeight: '700' }}>
            {language === 'en' ? 'CHANGE' : 'మార్చండి'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={BRAND.saffron} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
      </View>

      {pickerOpen && (
        <LocationPickerModal
          visible={pickerOpen}
          current={value}
          language={language}
          onClose={() => setPickerOpen(false)}
          onPick={(loc) => { onChange(loc); setPickerOpen(false); }}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// LocationPickerModal — city autocomplete (reuses /api/geocode) with a
// starter grid of globally-popular cities so the user doesn't have to type.
// ---------------------------------------------------------------------------
const QUICK_CITIES: Array<{ name: string; lat: number; lon: number; tz: number }> = [
  { name: 'Hyderabad, India',   lat: 17.385,  lon: 78.4867, tz: 5.5 },
  { name: 'Mumbai, India',      lat: 19.076,  lon: 72.8777, tz: 5.5 },
  { name: 'Delhi, India',       lat: 28.6139, lon: 77.2090, tz: 5.5 },
  { name: 'Bangalore, India',   lat: 12.9716, lon: 77.5946, tz: 5.5 },
  { name: 'Chennai, India',     lat: 13.0827, lon: 80.2707, tz: 5.5 },
  { name: 'London, UK',         lat: 51.5074, lon: -0.1278, tz: 0 },
  { name: 'New York, USA',      lat: 40.7128, lon: -74.006, tz: -5 },
  { name: 'San Francisco, USA', lat: 37.7749, lon: -122.4194, tz: -8 },
  { name: 'Dubai, UAE',         lat: 25.2048, lon: 55.2708, tz: 4 },
  { name: 'Singapore',          lat: 1.3521,  lon: 103.8198, tz: 8 },
  { name: 'Sydney, Australia',  lat: -33.8688, lon: 151.2093, tz: 10 },
  { name: 'Toronto, Canada',    lat: 43.6532, lon: -79.3832, tz: -5 },
];

// v6.45 — exported so other screens (AppHeader → index.tsx) can
// mount the picker directly without having to render the full
// ActiveLocationHeader strip.
export const LocationPickerModal: React.FC<{
  visible: boolean;
  current: ActiveLocation;
  language: 'en' | 'te';
  onClose: () => void;
  onPick: (loc: ActiveLocation) => void;
}> = ({ visible, current, language, onClose, onPick }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const resp = await axios.get(`${BACKEND_URL}/api/cities`, { params: { q } });
        // Response shape: { cities: [{ name, latitude, longitude }] }
        setSuggestions((resp.data?.cities || []).slice(0, 8));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
      >
        <View style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24,
          maxHeight: '80%',
        }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="location" size={20} color={BRAND.saffron} />
            <Text style={{ flex: 1, marginLeft: 8, fontSize: 16, fontWeight: '800', color: BRAND.maroon }}>
              {language === 'en' ? 'Change Active Location' : 'ప్రస్తుత స్థానం మార్చండి'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={BRAND.faint} />
            </TouchableOpacity>
          </View>

          {/* Search box */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: BRAND.cream,
            borderRadius: 10, borderWidth: 1, borderColor: BRAND.goldLine,
            paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
          }}>
            <Ionicons name="search" size={16} color={BRAND.faint} />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: BRAND.text, paddingVertical: 8 }}
              placeholder={language === 'en' ? 'Type city name…' : 'నగరం పేరు టైప్ చేయండి…'}
              placeholderTextColor={BRAND.faint}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color={BRAND.saffron} />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            {suggestions.length > 0 && (
              <>
                <Text style={{ fontSize: 10, color: BRAND.faint, fontWeight: '700', marginBottom: 6, letterSpacing: 0.6 }}>
                  {language === 'en' ? 'MATCHES' : 'సరిపోలినవి'}
                </Text>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={`s${i}`}
                    onPress={() => onPick({
                      name: s.name || query,
                      lat: Number(s.latitude),
                      lon: Number(s.longitude),
                      tzOffset: estimateTzOffset(Number(s.longitude)),
                    })}
                    style={{
                      paddingVertical: 10, paddingHorizontal: 10,
                      borderBottomWidth: 1, borderBottomColor: BRAND.hairline,
                    }}
                  >
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: BRAND.text }}>
                      {s.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: BRAND.faint, marginTop: 2 }}>
                      lat {Number(s.latitude).toFixed(3)} · lon {Number(s.longitude).toFixed(3)} · UTC{estimateTzOffset(Number(s.longitude)) >= 0 ? '+' : ''}{estimateTzOffset(Number(s.longitude))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={{ fontSize: 10, color: BRAND.faint, fontWeight: '700', marginTop: 10, marginBottom: 6, letterSpacing: 0.6 }}>
              {language === 'en' ? 'QUICK PICK' : 'త్వరిత ఎంపిక'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {QUICK_CITIES.map((c, i) => {
                const active = c.name === current.name;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => onPick({ name: c.name, lat: c.lat, lon: c.lon, tzOffset: c.tz })}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 8,
                      margin: 4,
                      borderRadius: 18,
                      backgroundColor: active ? BRAND.saffron : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: active ? BRAND.saffron : BRAND.goldLine,
                    }}
                  >
                    <Text style={{
                      fontSize: 11.5, fontWeight: '700',
                      color: active ? '#FFFFFF' : BRAND.text,
                    }}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ActiveLocationHeader;
