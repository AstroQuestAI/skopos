/**
 * CosmicChatBubbles — message bubble primitives that match
 * /app/uat/theme26/chat.html.
 *
 * Two flavors:
 *   <CosmicUserBubble>      — gold-gradient pill on the right, dark text.
 *   <CosmicAssistantBubble> — frosted-glass card on the left with a gold
 *                             vertical accent + "✦ Vidhaata" eyebrow.
 *
 * Both wrap their children freely, so the caller can put plain <Text>,
 * Markdown output, or chips inside.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { cosmicTokens as T } from './tokens';

export const CosmicUserBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={ub.row}>
      <View style={[ub.bubble, isWeb && (ubWeb.bubble as any)]}>
        {typeof children === 'string'
          ? <Text style={ub.text}>{children}</Text>
          : children}
      </View>
    </View>
  );
};

export const CosmicAssistantBubble: React.FC<{
  children: React.ReactNode;
  showEyebrow?: boolean;
}> = ({ children, showEyebrow = true }) => {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={ab.row}>
      <View style={[ab.bubble, isWeb && (abWeb.bubble as any)]}>
        {showEyebrow ? (
          <Text style={[ab.eyebrow, isWeb && (abWeb.glow as any)]}>✦ Vidhaata</Text>
        ) : null}
        {typeof children === 'string'
          ? <Text style={ab.text}>{children}</Text>
          : children}
      </View>
    </View>
  );
};

/**
 * 3-dot pulsing indicator that renders in place of an assistant bubble
 * while the model is generating. Web uses a CSS keyframe animation that
 * lives in CosmicGlobalStyle (aq-thinking-dot).
 *
 * v9.10 — keeps a subtle "Vidhaata is consulting the texts…" status
 * line so the chat retains its personality (without duplicating the
 * bold "✦ VIDHAATA" eyebrow that already lives in the chat header).
 */
export const CosmicThinking: React.FC<{ statusText?: string }> = ({
  statusText = 'Vidhaata is consulting the texts…',
}) => {
  const isWeb = Platform.OS === 'web';
  return (
    <View style={ab.row}>
      <View style={[ab.bubble, ab.thinkBubble, isWeb && (abWeb.bubble as any)]}>
        <View style={dots.thinkRow}>
          <View style={dots.row}>
            <View style={[dots.dot, isWeb && ({ animation: 'aq-thinking-dot 1.2s ease-in-out infinite' } as any)]} />
            <View style={[dots.dot, isWeb && ({ animation: 'aq-thinking-dot 1.2s ease-in-out 0.2s infinite' } as any)]} />
            <View style={[dots.dot, isWeb && ({ animation: 'aq-thinking-dot 1.2s ease-in-out 0.4s infinite' } as any)]} />
          </View>
          <Text style={dots.thinkLabel} numberOfLines={1}>{statusText}</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * Format a raw source label into a clean human-readable chip.
 * Removes the noisy "IndicVedicTexts" prefix and reshapes things like
 *   "IndicVedicTexts TOC Situation: Wealth"   → "Situation · Wealth"
 *   "IndicVedicTexts Famous Chart: Bill Gates" → "Famous Chart · Bill Gates"
 *   "IndicVedicTexts BPHS Ch.5.12"            → "BPHS · Ch.5.12"
 */
function prettifySource(raw: string): string {
  let s = String(raw || '').trim();
  // Drop the "IndicVedicTexts" / "DBPC" / "BPHS" canonical-corpus tag so
  // the chip surfaces the *content* facet (Situation, Chart, Yoga, …).
  s = s.replace(/^\s*IndicVedicTexts\s+/i, '');
  // "TOC Situation: Wealth" → "Situation · Wealth"
  s = s.replace(/^TOC\s+/i, '');
  // "Foo: Bar" → "Foo · Bar"
  s = s.replace(/:\s+/, ' · ');
  // Collapse multiple spaces.
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

/**
 * Citation chips row. Renders as small gold-bordered pills under an
 * assistant message. Pass an array of source label strings.
 */
export const CosmicCitations: React.FC<{ sources: string[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;
  // De-duplicate cleaned labels so we don't show "Situation · Wealth"
  // four times when the LLM cited four sub-pages of the same chapter.
  const seen = new Set<string>();
  const cleaned = sources
    .map(prettifySource)
    .filter((label) => {
      if (!label) return false;
      const k = label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  if (cleaned.length === 0) return null;
  return (
    <View style={cit.row}>
      {cleaned.slice(0, 4).map((src, i) => (
        <View key={i} style={cit.chip}>
          <Text style={cit.chipText} numberOfLines={1}>📜 {src.slice(0, 42)}</Text>
        </View>
      ))}
    </View>
  );
};

const ub = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
    paddingLeft: 60,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: T.rBubble,
    borderBottomRightRadius: 6,
    backgroundColor: T.gold,
  },
  text: {
    color: T.bgDeep,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
});
const ubWeb = {
  bubble: {
    backgroundImage: 'linear-gradient(135deg,#E8C96A,#C9A84C)',
    boxShadow:
      '0 4px 14px rgba(201,168,76,0.28), 0 0 0 1px rgba(232,201,106,0.32)',
  },
};

const ab = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    paddingRight: 60,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: T.rBubble,
    borderBottomLeftRadius: 6,
    backgroundColor: 'rgba(34,22,71,0.62)',
    maxWidth: '94%',
  },
  thinkBubble: { paddingVertical: 14, paddingHorizontal: 18 },
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '700',
    color: T.goldLight,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  text: {
    color: T.text,
    fontSize: 14,
    lineHeight: 22,
  },
});
const abWeb = {
  bubble: {
    backgroundImage:
      'linear-gradient(180deg,rgba(35,29,69,0.55) 0%,rgba(26,21,53,0.45) 100%)',
    backdropFilter: 'blur(28px) saturate(150%)',
    WebkitBackdropFilter: 'blur(28px) saturate(150%)',
    boxShadow:
      '0 0 22px rgba(201,168,76,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  glow: {
    textShadow: '0 0 8px rgba(201,168,76,0.35)',
  },
};

const dots = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.gold, opacity: 0.45 },
  thinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  thinkLabel: {
    color: T.text2, fontSize: 12.5, fontStyle: 'italic',
    fontWeight: '500', letterSpacing: 0.2,
  },
});

const cit = StyleSheet.create({
  row: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.40)',
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  chipText: {
    color: T.goldLight,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default CosmicAssistantBubble;
