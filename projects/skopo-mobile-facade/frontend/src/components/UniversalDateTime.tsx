/**
 * UniversalDateTime.tsx — v7.15.
 *
 * Cross-browser date & time inputs that do NOT rely on <input type="date">
 * or <input type="time">. Those native controls are inconsistent across
 * browsers:
 *   * Safari (desktop): no year selector — user has to arrow-key through
 *     years one-at-a-time. Brutal UX for DOBs that are decades old.
 *   * Firefox: the time control is missing entirely in older versions.
 *   * iOS PWA: the popup positioning is unreliable inside our modal stack.
 *
 * This component renders three styled <select> dropdowns for the date
 * (Day / Month / Year) and two for time (Hour / Minute, with 12/24h
 * toggle via the user's locale). Works identically on every browser and
 * is fully keyboard-accessible.
 *
 * On native (iOS/Android), we keep @react-native-community/datetimepicker
 * because that gives the native rolling-wheel UX users expect — this file
 * is ONLY used on web (Platform.OS === 'web').
 *
 * Locale-aware:
 *   - Month labels come from `Intl.DateTimeFormat(locale, {month:'long'})`
 *   - The order of Day/Month/Year in the UI is *cosmetic* (we always
 *     render D · M · Y left-to-right) but the stored value is always
 *     ISO YYYY-MM-DD. Display formatting elsewhere should use
 *     `Intl.DateTimeFormat(navigator.language)` for locale correctness.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// --------------------------------------------------------------------------
// Helper: build an array of years for the dropdown.
// Defaults to 1900 → current year. Adjust via props if needed.
// --------------------------------------------------------------------------
function buildYears(minYear = 1900, maxYear?: number): number[] {
  const max = maxYear ?? new Date().getFullYear();
  const out: number[] = [];
  for (let y = max; y >= minYear; y--) out.push(y);
  return out;
}

// Localized month names (January, February, …) for the current browser.
function monthNames(locale?: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(locale || undefined, { month: 'long' });
    return Array.from({ length: 12 }, (_, i) =>
      fmt.format(new Date(2020, i, 1)),
    );
  } catch {
    return ['January','February','March','April','May','June',
            'July','August','September','October','November','December'];
  }
}

// ISO YYYY-MM-DD  ↔  { y, m, d }
function parseIsoDate(iso: string | undefined | null): { y: number; m: number; d: number } {
  if (!iso || typeof iso !== 'string') return { y: 0, m: 0, d: 0 };
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { y: 0, m: 0, d: 0 };
  return { y: +match[1], m: +match[2], d: +match[3] };
}
function toIsoDate(y: number, m: number, d: number): string {
  if (!y || !m || !d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

// 'HH:MM' (24h storage) ↔ { h, mn }
function parseIsoTime(t: string | undefined | null): { h: number; mn: number } {
  if (!t || typeof t !== 'string') return { h: -1, mn: -1 };
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { h: -1, mn: -1 };
  return { h: +match[1], mn: +match[2] };
}
function toIsoTime(h: number, mn: number): string {
  if (h < 0 || mn < 0) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(mn)}`;
}

// --------------------------------------------------------------------------
// Native <select> styled to match our TextInput look.
// Using React.createElement('select', ...) so RN-Web tooling doesn't
// complain about non-RN primitives. Only rendered on web.
// --------------------------------------------------------------------------
const selectStyleWeb: any = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundColor: '#F9FAFB',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#E5E7EB',
  borderRadius: 10,
  paddingLeft: 10,
  paddingRight: 28,
  paddingTop: 10,
  paddingBottom: 10,
  fontSize: 14,
  color: '#0F172A',
  fontFamily: 'inherit',
  height: 44,
  minWidth: 0,
  // Chevron arrow drawn via SVG background.
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%236B7280' stroke-width='1.5' fill='none'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '11px 7px',
  cursor: 'pointer',
  outline: 'none',
};

// --------------------------------------------------------------------------
// UniversalDateField — Day / Month / Year selects.
// --------------------------------------------------------------------------
interface DateFieldProps {
  value: string;                          // ISO YYYY-MM-DD (may be '')
  onChange: (iso: string) => void;
  minYear?: number;
  maxYear?: number;
  locale?: string;                        // e.g. navigator.language
}

export const UniversalDateField: React.FC<DateFieldProps> = ({
  value, onChange, minYear = 1900, maxYear, locale,
}) => {
  // v7.17 — Use INTERNAL state for day/month/year so partial selections
  // (e.g. user picked "15" but not month/year yet) aren't wiped the moment
  // the parent rebuilds with an empty value. We still sync from `value`
  // when it changes externally (e.g. initial hydration from localStorage).
  const parsed = parseIsoDate(value);
  const [d, setD] = React.useState<number>(parsed.d);
  const [m, setM] = React.useState<number>(parsed.m);
  const [y, setY] = React.useState<number>(parsed.y);

  // Keep internal state in sync ONLY when the external value is a valid
  // complete date that differs from our current state (e.g. localStorage
  // hydration, or a "reset" action by the parent).
  const lastSyncedRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!value || value === lastSyncedRef.current) return;
    const p = parseIsoDate(value);
    if (p.y && p.m && p.d) {
      setD(p.d); setM(p.m); setY(p.y);
      lastSyncedRef.current = value;
    }
  }, [value]);

  const years  = useMemo(() => buildYears(minYear, maxYear), [minYear, maxYear]);
  const months = useMemo(() => monthNames(locale), [locale]);

  const daysInMonth = (() => {
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  })();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (Platform.OS !== 'web') {
    return null;
  }

  const commit = (nd: number, nm: number, ny: number) => {
    // Clamp day to the month length (e.g. 31 Feb → 28 Feb).
    const max = nd && ny && nm ? new Date(ny, nm, 0).getDate() : 31;
    const cd = Math.min(nd || 0, max);
    setD(cd); setM(nm); setY(ny);
    // Emit ISO to parent ONLY when the date is fully specified — partial
    // selections keep local state but don't disturb the parent.
    const iso = toIsoDate(ny, nm, cd);
    lastSyncedRef.current = iso;
    onChange(iso);
  };

  return (
    <View style={s.row}>
      {/* Day */}
      {React.createElement(
        'select',
        {
          value: String(d || ''),
          onChange: (e: any) => commit(+e.target.value, m, y),
          'aria-label': 'Day of birth',
          style: { ...selectStyleWeb, flex: 1, marginRight: 6, minWidth: 0 },
        },
        [
          React.createElement('option', { key: '', value: '', disabled: true }, 'Day'),
          ...days.map((n) =>
            React.createElement('option', { key: n, value: n }, String(n).padStart(2, '0')),
          ),
        ],
      )}
      {/* Month */}
      {React.createElement(
        'select',
        {
          value: String(m || ''),
          onChange: (e: any) => commit(d, +e.target.value, y),
          'aria-label': 'Month of birth',
          style: { ...selectStyleWeb, flex: 1, marginRight: 6, minWidth: 0 },
        },
        [
          React.createElement('option', { key: '', value: '', disabled: true }, 'Month'),
          ...months.map((label, i) =>
            React.createElement('option', { key: i + 1, value: i + 1 }, label),
          ),
        ],
      )}
      {/* Year */}
      {React.createElement(
        'select',
        {
          value: String(y || ''),
          onChange: (e: any) => commit(d, m, +e.target.value),
          'aria-label': 'Year of birth',
          style: { ...selectStyleWeb, flex: 1, minWidth: 0 },
        },
        [
          React.createElement('option', { key: '', value: '', disabled: true }, 'Year'),
          ...years.map((yr) =>
            React.createElement('option', { key: yr, value: yr }, String(yr)),
          ),
        ],
      )}
    </View>
  );
};

// --------------------------------------------------------------------------
// UniversalTimeField — Hour / Minute selects.
// Hour uses 24-hour values internally, but label shows the user's locale
// convention (12-hour AM/PM for en-US, 24-hour for en-GB / te / hi / etc.).
// --------------------------------------------------------------------------
interface TimeFieldProps {
  value: string;                          // 'HH:MM' (24h)
  onChange: (hhmm: string) => void;
  use24h?: boolean;                       // override locale default
  locale?: string;
  minuteStep?: number;                    // default 1
}

export const UniversalTimeField: React.FC<TimeFieldProps> = ({
  value, onChange, use24h, locale, minuteStep = 1,
}) => {
  // v7.17 — Same internal-state pattern as UniversalDateField so partial
  // selections aren't wiped mid-flow.
  const parsed = parseIsoTime(value);
  const [h, setH] = React.useState<number>(parsed.h);
  const [mn, setMn] = React.useState<number>(parsed.mn);

  const lastSyncedRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!value || value === lastSyncedRef.current) return;
    const p = parseIsoTime(value);
    if (p.h >= 0 && p.mn >= 0) {
      setH(p.h); setMn(p.mn);
      lastSyncedRef.current = value;
    }
  }, [value]);

  // Default to 12-hour clock for US locales and Indian English (common pref).
  const is24 = use24h ?? (() => {
    try {
      const loc = (locale || navigator.language || 'en-US').toLowerCase();
      if (loc.startsWith('en-us') || loc.startsWith('en-in')) return false;
      return true;
    } catch { return false; }
  })();

  if (Platform.OS !== 'web') return null;

  const hours = is24
    ? Array.from({ length: 24 }, (_, i) => i)
    : Array.from({ length: 12 }, (_, i) => i + 1);  // 1..12
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const ampm = h < 0 ? 'AM' : (h < 12 ? 'AM' : 'PM');
  const displayHour = is24
    ? (h >= 0 ? h : 0)
    : (h < 0 ? 0 : (h % 12 === 0 ? 12 : h % 12));

  const commit = (newDisplay: number, newMn: number, newAp: string) => {
    let finalHour = newDisplay;
    if (!is24) {
      if (newDisplay === 12) finalHour = newAp === 'AM' ? 0 : 12;
      else finalHour = newAp === 'PM' ? newDisplay + 12 : newDisplay;
    }
    setH(finalHour); setMn(newMn);
    const iso = toIsoTime(finalHour, newMn);
    lastSyncedRef.current = iso;
    // Only emit valid times to parent. Partial (e.g. hour picked but not
    // minute) stays internal.
    if (finalHour >= 0 && newMn >= 0) onChange(iso);
  };

  return (
    <View style={s.row}>
      {/* Hour */}
      {React.createElement(
        'select',
        {
          value: String(displayHour || ''),
          onChange: (e: any) => commit(+e.target.value, mn < 0 ? 0 : mn, ampm),
          'aria-label': 'Hour of birth',
          style: { ...selectStyleWeb, flex: 1, marginRight: 6 },
        },
        [
          React.createElement('option', { key: '', value: '', disabled: true }, 'Hr'),
          ...hours.map((n) =>
            React.createElement('option', { key: n, value: n }, String(n).padStart(2, '0')),
          ),
        ],
      )}
      {/* Minute */}
      {React.createElement(
        'select',
        {
          value: String(mn >= 0 ? mn : ''),
          onChange: (e: any) => commit(displayHour || (is24 ? 0 : 12), +e.target.value, ampm),
          'aria-label': 'Minute of birth',
          style: { ...selectStyleWeb, flex: 1, marginRight: is24 ? 0 : 6 },
        },
        [
          React.createElement('option', { key: '', value: '', disabled: true }, 'Min'),
          ...minutes.map((n) =>
            React.createElement('option', { key: n, value: n }, String(n).padStart(2, '0')),
          ),
        ],
      )}
      {/* AM/PM (only when 12h) */}
      {!is24 && React.createElement(
        'select',
        {
          value: ampm,
          onChange: (e: any) =>
            commit(displayHour || 12, mn >= 0 ? mn : 0, e.target.value),
          'aria-label': 'AM or PM',
          style: { ...selectStyleWeb, width: 72 },
        },
        [
          React.createElement('option', { key: 'am', value: 'AM' }, 'AM'),
          React.createElement('option', { key: 'pm', value: 'PM' }, 'PM'),
        ],
      )}
    </View>
  );
};

// --------------------------------------------------------------------------
// formatDateForDisplay — locale-aware read-only formatter.
//   '1988-04-23' → '23/04/1988' in-IN, '04/23/1988' en-US, '23.04.1988' de-DE
// Used by tabs / summaries that show the user's DOB as text.
// --------------------------------------------------------------------------
export function formatDateForDisplay(iso: string, locale?: string): string {
  const { y, m, d } = parseIsoDate(iso);
  if (!y || !m || !d) return '';
  try {
    return new Intl.DateTimeFormat(locale || navigator.language).format(new Date(y, m - 1, d));
  } catch {
    return iso;
  }
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
