/**
 * PreviewChatLanding — v6.42
 *
 * Layout locked per user reference screenshot:
 *   • Header strip  :  Vidhaata icon + brand · EN/తె toggle · login icon
 *   • Hero          :  saffron-ringed Sri Chakra · "ASK VIDHAATA"  · "Ayushmaan Bhava 🙏 I am Vidhaata"
 *   • 6 rows × 2 cols grid of 12 friendly, intuitive astrology questions
 *   • Type-your-question input  (purple send button)
 *   • Private-data hint caption
 *   • Bottom-right docked "Sign in" card with saffron corner fold
 *
 * Any tap (pill, input, dock) → onRequireLogin → opens real Google Login.
 * Theme tokens come from ../theme.ts (Deep Indigo + Saffron, v6.42).
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GuruAvatar } from './GuruAvatar';
import { theme } from '../theme';

interface Props {
  language: 'en' | 'te';
  setLanguage: (l: 'en' | 'te') => void;
  onRequireLogin: () => void;
}

// 12 friendly, intuitive astrology-curiosity questions — 6 rows × 2 cols.
// Scope-safe (no visa/loan/medical). Same pool that appears inside the
// real ChatOverlay after login so first-time users see familiar prompts.
const QUESTIONS_EN = [
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
];
const QUESTIONS_TE = [
  'నా లగ్నం ఏం చెబుతుంది?',
  'నా కెరీర్‌కి ఏ గ్రహం అధిపతి?',
  'నా మహాదశ అనుకూలమేనా?',
  'తదుపరి శుభ దినం ఎప్పుడు?',
  'నా నక్షత్ర వ్యక్తిత్వం?',
  'నేను మంగళీక్ ఉన్నానా?',
  'నాకు ఏ రత్నం సరిపోతుంది?',
  'నా వివాహ యోగం?',
  "నేటి ఉత్తమ ముహూర్తాలు?",
  'నా జాతకంలో రాజయోగం ఉందా?',
  'నేను విదేశ యాత్ర చేస్తానా?',
  'నా అదృష్ట రంగులు, సంఖ్యలు?',
];

export const PreviewChatLanding: React.FC<Props> = ({
  language, setLanguage, onRequireLogin,
}) => {
  const qs = useMemo(() => (language === 'en' ? QUESTIONS_EN : QUESTIONS_TE), [language]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header strip */}
      <View style={styles.header}>
        <GuruAvatar size={30} glow={false} />
        <Text style={styles.brand}>{language === 'en' ? 'Vidhaata' : 'విధాత'}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setLanguage(language === 'en' ? 'te' : 'en')}
          style={styles.langPill}
          hitSlop={8}
        >
          <Text style={styles.langText}>{language === 'en' ? 'EN' : 'తె'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRequireLogin} style={styles.hdrIcon}>
          <Ionicons name="log-in-outline" size={20} color={theme.colors.hint} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero — saffron-ringed Sri Chakra + greeting */}
          <View style={styles.heroWrap}>
            <View style={styles.auraRing}>
              <GuruAvatar size={72} glow />
            </View>
            <Text style={styles.askLabel}>
              {language === 'en' ? 'ASK VIDHAATA' : 'విధాతను అడగండి'}
            </Text>
            <Text style={styles.greeting}>
              {language === 'en' ? 'Ayushmaan Bhava 🙏 I am Vidhaata' : 'ఆయుష్మాన్ భవ 🙏 నేను విధాత'}
            </Text>
            <Text style={styles.sub}>
              {language === 'en'
                ? 'Ask anything about your chart, dashas, muhurtas or yogas — pick a question below to begin.'
                : 'మీ జాతకం, దశలు, ముహూర్తాలు లేదా యోగాల గురించి అడగండి — క్రింద ఒక ప్రశ్నను ఎంచుకోండి.'}
            </Text>
          </View>

          {/* 6 × 2 grid of 12 friendly pills */}
          <View style={styles.grid}>
            {qs.slice(0, 12).map((q, i) => (
              <TouchableOpacity
                key={i}
                onPress={onRequireLogin}
                activeOpacity={0.75}
                style={styles.pill}
              >
                <Text style={styles.pillText} numberOfLines={3}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Faux chat input */}
          <TouchableOpacity
            onPress={onRequireLogin}
            activeOpacity={0.85}
            style={styles.inputRow}
          >
            <TextInput
              editable={false}
              pointerEvents="none"
              placeholder={language === 'en' ? 'Type your question…' : 'మీ ప్రశ్నను టైప్ చేయండి…'}
              placeholderTextColor={theme.colors.faint}
              style={styles.input}
            />
            <View style={styles.sendBtn}>
              <Ionicons name="send" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.footerHint}>
            {language === 'en'
              ? 'Your chart stays private to your Google account.'
              : 'మీ జాతకం మీ Google ఖాతాకు మాత్రమే.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom-right docked "Sign in" card with saffron corner fold */}
      <TouchableOpacity
        onPress={onRequireLogin}
        activeOpacity={0.85}
        style={styles.loginDock}
        accessibilityLabel="Sign in"
      >
        <View style={styles.loginDockFold} />
        <Ionicons name="logo-google" size={16} color="#FFFFFF" />
        <Text style={styles.loginDockText}>
          {language === 'en' ? 'Sign in' : 'సైన్ ఇన్'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PreviewChatLanding;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.primary50 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: theme.colors.canvas,
    borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
  },
  brand: {
    fontSize: 15, fontWeight: '800',
    color: theme.colors.primary800, letterSpacing: 0.3,
  },
  langPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: theme.colors.primary700,
  },
  langText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  hdrIcon: {
    padding: 6, borderRadius: 999,
    backgroundColor: theme.colors.primary50,
    borderWidth: 1, borderColor: theme.colors.primary100,
  },

  scroll: { padding: 18, paddingBottom: 140 },

  heroWrap: { alignItems: 'center', marginBottom: 18 },
  auraRing: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.canvas,
    borderWidth: 2, borderColor: theme.colors.saffron300,
    shadowColor: theme.colors.primary900, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 14, elevation: 4,
  },
  askLabel: {
    marginTop: 10, fontSize: 12, fontWeight: '800',
    letterSpacing: 2.0, color: theme.colors.saffron700,
    textTransform: 'uppercase',
  },
  greeting: {
    marginTop: 6, fontSize: 20, fontWeight: '800',
    color: theme.colors.primary800, textAlign: 'center',
  },
  sub: {
    marginTop: 8, fontSize: 13.5, lineHeight: 19, color: theme.colors.muted,
    textAlign: 'center', paddingHorizontal: 8,
  },

  // 6 × 2 grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pill: {
    width: '48.5%', marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 14,
    backgroundColor: theme.colors.canvas,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.primary100,
    minHeight: 64, justifyContent: 'center',
    shadowColor: theme.colors.primary900,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 1,
  },
  pillText: {
    fontSize: 12.5, color: theme.colors.primary800,
    fontWeight: '700', lineHeight: 17,
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.canvas, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.colors.primary100,
    marginTop: 4,
  },
  input: {
    flex: 1, fontSize: 14, color: theme.colors.ink,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.primary700,
    alignItems: 'center', justifyContent: 'center',
  },
  footerHint: {
    marginTop: 14, textAlign: 'center',
    fontSize: 11, color: theme.colors.hint, letterSpacing: 0.2,
  },

  // Bottom-right docked "Sign in" card with saffron page-fold
  loginDock: {
    position: 'absolute', right: 14, bottom: 18,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: theme.colors.primary700,
    borderRadius: 14, borderTopRightRadius: 4,
    shadowColor: theme.colors.primary900, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30, shadowRadius: 10, elevation: 8,
  },
  loginDockFold: {
    position: 'absolute', top: 0, right: 0, width: 14, height: 14,
    backgroundColor: theme.colors.saffron500,
    borderBottomLeftRadius: 6,
  },
  loginDockText: {
    color: '#FFFFFF', fontWeight: '800', fontSize: 12.5, letterSpacing: 0.3,
  },
});
