/**
 * CosmicChatOverlay — full Vidhaata chat surface in the "Vidhaata Cosmic"
 * theme. Drop-in replacement for the legacy <ChatBody /> when ?cosmic=1
 * is on. Same Props contract so the parent (app/index.tsx) just swaps
 * one component for the other.
 *
 * Layout (top → bottom):
 *   Header   — small gold orb + "Vidhaata" + close button
 *   Body     — scrolling list of cosmic message bubbles + thinking dots
 *              + suggested-question chips when no messages exist
 *   Composer — frosted-glass pill bar + gold mic/send button
 *
 * Logic reused from the legacy ChatBody:
 *   - sendChatMessage()      (parent-supplied)
 *   - extractOptions()       (mid-message option chips)
 *   - maskSourceReferences() (inline citation markers stripped)
 *   - mdStyles               (Markdown theming)
 *
 * Intentionally omitted in v8.15 to keep the surface focused:
 *   - TTS / STT toggles (legacy mic icon stays in the legacy overlay).
 *   - "Find muhurta" suggestion buttons (legacy CTA flow).
 *   These can be re-added in a follow-up pass.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';

import {
  extractOptions, ChatMessage, ChatChartContext,
} from '../components/ChatOverlay';
import { maskSourceReferences } from '../utils/text';

import { cosmicTokens as T } from './tokens';
import { CosmicComposer } from './CosmicComposer';
import {
  CosmicAssistantBubble, CosmicUserBubble, CosmicThinking, CosmicCitations,
} from './CosmicChatBubbles';

interface Props {
  language: 'en' | 'te';
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  chatSending: boolean;
  sendChatMessage: (override?: string) => void;
  onClose: () => void;
  /** v9.18 — Clear chat history (3-dot menu action). */
  onClearChat?: () => void;
  chartContext?: ChatChartContext | null;
  /** Optional starter question pool (legacy buildDynamicQuestions output). */
  starterQuestions?: string[];
}

// Markdown styles tuned for the cosmic theme (light text on dark glass).
const cosmicMd = {
  body:        { color: T.text, fontSize: 14, lineHeight: 22 },
  paragraph:   { color: T.text, fontSize: 14, lineHeight: 22, marginTop: 0, marginBottom: 6 },
  strong:      { color: T.goldLight, fontWeight: '700' as const },
  em:          { color: T.text2, fontStyle: 'italic' as const },
  bullet_list: { marginTop: 4, marginBottom: 4 },
  list_item:   { color: T.text },
  bullet_list_icon: { color: T.gold, fontSize: 14, lineHeight: 22 },
  blockquote:  {
    borderLeftWidth: 2, borderLeftColor: T.gold,
    backgroundColor: 'rgba(201,168,76,0.06)',
    paddingHorizontal: 12, paddingVertical: 6,
    marginVertical: 6, borderRadius: 8,
  },
  link:        { color: T.goldLight, textDecorationLine: 'underline' as const },
  code_inline: {
    backgroundColor: 'rgba(201,168,76,0.10)',
    color: T.goldLight, paddingHorizontal: 4, borderRadius: 4,
  },
  code_block:  {
    backgroundColor: 'rgba(13,11,30,0.6)',
    color: T.text, padding: 10, borderRadius: 10,
    borderWidth: 1, borderColor: T.borderSub,
  },
  heading1: { color: T.goldLight, fontSize: 18, fontWeight: '700' as const, marginTop: 8, marginBottom: 6 },
  heading2: { color: T.goldLight, fontSize: 16, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  heading3: { color: T.goldLight, fontSize: 14, fontWeight: '700' as const, marginTop: 6, marginBottom: 4 },
};

const DEFAULT_STARTERS_EN = [
  'What does my Lagna say about me?',
  'Which planet rules my career?',
  'Am I in a favourable Mahadasha?',
  'When is the next auspicious day?',
  'What is my Nakshatra personality?',
  'Tell me about my marriage yoga',
];

const DEFAULT_STARTERS_TE = [
  'నా లగ్నం నా గురించి ఏం చెబుతుంది?',
  'నా కెరీర్‌ను ఏ గ్రహం పాలిస్తుంది?',
  'నేను అనుకూల మహాదశలో ఉన్నానా?',
  'తదుపరి శుభముహూర్తం ఎప్పుడు?',
  'నా నక్షత్ర వ్యక్తిత్వం ఏమిటి?',
  'నా వివాహ యోగం గురించి చెప్పండి',
];

export const CosmicChatOverlay: React.FC<Props> = ({
  language, chatMessages, chatInput, setChatInput, chatSending,
  sendChatMessage, onClose, starterQuestions, onClearChat,
}) => {
  const isWeb = Platform.OS === 'web';
  const scrollRef = useRef<ScrollView>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const starters = useMemo(() => {
    const pool = starterQuestions && starterQuestions.length > 0
      ? starterQuestions
      : (language === 'te' ? DEFAULT_STARTERS_TE : DEFAULT_STARTERS_EN);
    return pool.slice(0, 8);
  }, [starterQuestions, language]);

  // Auto-scroll to bottom on new message / thinking start
  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd?.({ animated: true }),
      80
    );
    return () => clearTimeout(t);
  }, [chatMessages.length, chatSending]);

  const placeholder = language === 'te'
    ? 'విధాతను అడగండి…'
    : 'Ask Vidhaata anything…';

  return (
    <View style={styles.root}>
      {/* ── Header ── back + Vidhaata + green dot + subtitle + menu ── */}
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={T.text} />
        </Pressable>
        <View style={styles.headerLeft}>
          <View style={[styles.headerOrb, isWeb && (webOnly.headerOrb as any)]} />
          <View>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, isWeb && (webOnly.titleGlow as any)]}>
                Vidhaata
              </Text>
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.headerSub}>
              {language === 'te' ? 'మీ కాస్మిక్ సహచరి' : 'Your cosmic companion'}
            </Text>
          </View>
        </View>
        {/* v9.18b — 3-dot menu removed by user request (no useful actions). */}
      </View>

      {/* ── Body ── messages or starter chips ── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {chatMessages.length === 0 ? (
          <View style={styles.startersWrap}>
            <Text style={[styles.greetingTitle, isWeb && (webOnly.titleGlow as any)]}>
              Ayushmaan Bhava 🙏
            </Text>
            <Text style={styles.greetingSub}>
              {language === 'te'
                ? 'మీ చార్ట్, దశలు, ముహూర్తాలు లేదా యోగాల గురించి ఏదైనా అడగండి — మొదలుపెట్టడానికి దిగువ ఒక ప్రశ్నను ఎంచుకోండి.'
                : 'Ask anything about your chart, dashas, muhurtas or yogas — pick a question below to begin.'}
            </Text>
            <View style={styles.starterChipsRow}>
              {starters.map((q, i) => (
                <Pressable
                  key={i}
                  onPress={() => sendChatMessage(q)}
                  style={({ pressed }) => [
                    styles.starterChip,
                    isWeb && (webOnly.starterChip as any),
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.starterChipText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          chatMessages.map((m, idx) => {
            if (m.role === 'user') {
              return <CosmicUserBubble key={idx}>{m.content}</CosmicUserBubble>;
            }
            // assistant
            const masked = maskSourceReferences(m.content || '');
            const { cleaned, options } = extractOptions(masked || '');
            const sources = (m.sources || []).filter(Boolean);
            return (
              <CosmicAssistantBubble key={idx} showEyebrow={false}>
                <Markdown style={cosmicMd as any}>{cleaned || ''}</Markdown>
                {options.length > 0 ? (
                  <View style={styles.inlineOptionsRow}>
                    {options.map((opt, oi) => (
                      <Pressable
                        key={oi}
                        onPress={() => sendChatMessage(opt)}
                        style={({ pressed }) => [
                          styles.inlineOptChip,
                          isWeb && (webOnly.inlineOptChip as any),
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.inlineOptChipText}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <CosmicCitations sources={sources} />
              </CosmicAssistantBubble>
            );
          })
        )}

        {chatSending ? <CosmicThinking /> : null}
      </ScrollView>

      {/* ── Composer ── frosted-glass pill bar ── */}
      <CosmicComposer
        value={chatInput}
        onChange={setChatInput}
        onSend={() => { if (!chatSending && chatInput.trim()) sendChatMessage(); }}
        placeholder={placeholder}
        disabled={chatSending}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 6,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerOrb: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: T.goldLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 16, fontWeight: '700', color: T.text,
    letterSpacing: -0.2,
  },
  onlineDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#7EB88A',
  },
  headerSub: {
    fontSize: 11, color: T.text2,
    letterSpacing: 0.3,
  },
  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  // v9.18 — 3-dot menu popover
  menuBackdrop: {
    position: 'absolute', top: -200, left: -2000, right: -2000, bottom: -2000,
    zIndex: 90,
  } as any,
  menuPopover: {
    position: 'absolute',
    top: 56, right: 12,
    minWidth: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(20,15,40,0.96)',
    borderWidth: 1, borderColor: T.borderSub,
    paddingVertical: 6,
    zIndex: 100,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(12px)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(232,201,106,0.06)',
    } as any : {}),
  } as any,
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
  },
  menuItemText: { color: T.text, fontSize: 13.5, fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: T.borderSub, marginHorizontal: 8 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },

  body: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14 },

  // Starter / empty state
  startersWrap: { paddingHorizontal: 6, paddingTop: 8 },
  greetingTitle: {
    fontSize: 22, fontWeight: '700', color: T.goldLight,
    marginBottom: 6, letterSpacing: -0.3,
  },
  greetingSub: {
    fontSize: 13.5, lineHeight: 20, color: T.text2,
    marginBottom: 18, maxWidth: 580,
  },
  starterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starterChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: T.rPill,
    borderWidth: 1, borderColor: T.border,
    backgroundColor: 'rgba(201,168,76,0.07)',
  },
  starterChipText: {
    color: T.text, fontSize: 12.5, fontWeight: '500', letterSpacing: 0.1,
  },

  // Inline option chips inside an assistant bubble
  inlineOptionsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10,
  },
  inlineOptChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: T.rPill,
    backgroundColor: 'rgba(232,201,106,0.18)',
    borderWidth: 1, borderColor: 'rgba(232,201,106,0.45)',
  },
  inlineOptChipText: {
    color: T.goldLight, fontSize: 12, fontWeight: '600',
  },
});

const webOnly = {
  headerOrb: {
    backgroundImage: 'radial-gradient(circle at 32% 30%, #E8C96A, #C9A84C 60%, #8A6F2E)',
    boxShadow: '0 0 18px rgba(232,201,106,0.55), 0 0 40px rgba(201,168,76,0.20), inset -4px -3px 8px rgba(13,11,30,0.4)',
  },
  titleGlow: {
    textShadow: '0 0 1px rgba(245,237,214,0.5), 0 0 18px rgba(201,168,76,0.18)',
  },
  starterChip: {
    backgroundImage: 'linear-gradient(135deg, rgba(201,168,76,0.10), rgba(201,168,76,0.04))',
    backdropFilter: 'blur(20px) saturate(140%)',
    WebkitBackdropFilter: 'blur(20px) saturate(140%)',
    boxShadow: '0 2px 10px rgba(13,11,30,0.18)',
    cursor: 'pointer',
    transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
  },
  inlineOptChip: {
    cursor: 'pointer',
  },
};

export default CosmicChatOverlay;
