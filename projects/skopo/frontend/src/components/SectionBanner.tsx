/**
 * SectionBanner.tsx — shared AstroQuest card + deep-indigo ribbon banner.
 *
 * Every tab (Overview / Charts / Dasha / Today Muhurtas / Similar Charts)
 * should use THIS component to render its section headers so the app
 * speaks one visual language.
 *
 * Example:
 *   <ThemedCard>
 *     <SectionBanner icon="grid" title="North Indian Chart" />
 *     <View style={themedCardStyles.body}>...your content...</View>
 *   </ThemedCard>
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { BRAND } from './mdTheme';

// ---------------------------------------------------------------------------
// SectionBanner — deep indigo ribbon with white uppercase title + optional badge
// ---------------------------------------------------------------------------
export interface SectionBannerProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  badge?: React.ReactNode;
  iconColor?: string;
}

export const SectionBanner: React.FC<SectionBannerProps> = ({
  icon, title, badge, iconColor,
}) => (
  <View style={styles.banner}>
    <Ionicons name={icon} size={16} color={iconColor || '#FFFFFF'} />
    <Text style={styles.bannerText}>{title.toUpperCase()}</Text>
    {badge ? <View style={{ marginLeft: 'auto' }}>{badge}</View> : null}
  </View>
);

// ---------------------------------------------------------------------------
// ThemedCard — cream body with gold hairline border, banner-friendly
// ---------------------------------------------------------------------------
export const ThemedCard: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, omit horizontal margin (for use inside full-width wrappers). */
  flush?: boolean;
}> = ({ children, style, flush }) => (
  <View style={[styles.card, flush ? null : styles.cardInset, style]}>
    {children}
  </View>
);

// ---------------------------------------------------------------------------
// CardBody — padded inner content container (matches OverviewTab padding)
// ---------------------------------------------------------------------------
export const CardBody: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => (
  <View style={[styles.cardBody, style]}>{children}</View>
);

// ---------------------------------------------------------------------------
// Styles (identical look & feel to OverviewTab.tsx .card / .banner)
// ---------------------------------------------------------------------------
export const themedCardStyles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.cream,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.3,
    borderColor: BRAND.goldLine,
    overflow: 'hidden',
  },
  cardInset: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.colors.primary700,
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
});

// Alias — internal shorthand used by the components above.
const styles = themedCardStyles;
