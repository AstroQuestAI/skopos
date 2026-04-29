/**
 * CosmicThemeToggle — drop-in row for the Profile screen that lets the
 * user switch the "Vidhaata Cosmic" theme on/off without ever touching
 * the URL. Reads/writes via useCosmic + setCosmic (URL + localStorage).
 *
 * Visual: a single horizontal card with a sparkle icon + title +
 * subtitle on the left, and a Switch on the right. The card itself
 * adapts to the current theme (light when off, gold-glow when on).
 */

import React from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCosmic, setCosmic } from './useCosmic';
import { cosmicTokens as T } from './tokens';

interface Props {
  /** Optional override for the toggle title. */
  title?: string;
  /** Optional override for the helper line below the title. */
  subtitle?: string;
}

export const CosmicThemeToggle: React.FC<Props> = ({
  title = 'Cosmic theme',
  subtitle = 'Glossy, glassy gold-on-indigo skin · matches the mobile design preview.',
}) => {
  const on = useCosmic();
  const isWeb = Platform.OS === 'web';
  return (
    <View style={[s.row, on ? s.rowOn : s.rowOff, on && isWeb && (web.rowOn as any)]}>
      <View style={[s.iconWrap, on ? s.iconWrapOn : s.iconWrapOff, on && isWeb && (web.iconWrapOn as any)]}>
        <Ionicons name="sparkles" size={18} color={on ? '#0D0B1E' : '#C9A84C'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.title, on && s.titleOn]}>{title}</Text>
        <Text style={[s.sub, on && s.subOn]}>{subtitle}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={(v) => setCosmic(v)}
        thumbColor={on ? '#0D0B1E' : '#FFFFFF'}
        trackColor={{ false: '#E5E7EB', true: T.gold }}
        ios_backgroundColor="#E5E7EB"
      />
    </View>
  );
};

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginVertical: 10,
  },
  rowOff: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rowOn: {
    backgroundColor: 'rgba(34,22,71,0.62)',
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapOff: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.40)',
  },
  iconWrapOn: {
    backgroundColor: T.gold,
  },
  title: {
    fontSize: 14, fontWeight: '700', color: '#1F2937', marginBottom: 2,
    letterSpacing: -0.1,
  },
  titleOn: { color: T.text },
  sub: {
    fontSize: 11.5, color: '#6B7280', lineHeight: 16,
  },
  subOn: { color: T.text2 },
});

const web = {
  rowOn: {
    backdropFilter: 'blur(28px) saturate(150%)',
    WebkitBackdropFilter: 'blur(28px) saturate(150%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.18)',
  },
  iconWrapOn: {
    backgroundImage: 'linear-gradient(135deg, #E8C96A, #C9A84C)',
    boxShadow: '0 0 14px rgba(232,201,106,0.45)',
  },
};

export default CosmicThemeToggle;
