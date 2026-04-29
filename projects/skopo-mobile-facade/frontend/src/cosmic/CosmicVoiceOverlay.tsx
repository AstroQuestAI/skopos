/**
 * CosmicVoiceOverlay — fullscreen "Ask Vidhaata" voice surface.
 *
 * Layout (top → bottom):
 *   • close (X) top-left
 *   • title "Vidhaata" + subtitle (state-driven: tap to talk /
 *     listening… / thinking… / speaking)
 *   • huge orb (200×200) — mic icon when idle/listening,
 *     speaker icon when speaking; pulses with `amplitude` (0..1).
 *   • interim transcript fading below the orb while listening
 *   • mode pill: [ Talk · Chat ] — switching to Chat reveals a
 *     classic text composer with Send so the user can decide.
 *
 * The orb glow is implemented with two extra concentric absolute
 * Views whose opacity + scale are animated by Reanimated based on
 * the amplitude prop.
 */
import React, { useEffect, useState } from 'react';
import {
  Platform, Pressable, StyleSheet, Text, TextInput, View,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';
import type { VoiceState } from './useWebVoice';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

interface Props {
  visible: boolean;
  state: VoiceState;
  amplitude: number;          // 0..1 from useWebVoice
  interim?: string;           // running transcript (listening)
  speakingText?: string;      // text Vidhaata is reading aloud
  supported: boolean;

  onStartListening: () => void;
  onStopListening: () => void;
  onSendText: (text: string) => void;
  onCancelSpeaking: () => void;
  onClose: () => void;
  /** Called BEFORE startListening to prime the TTS engine inside the
      same user-gesture window. Required for Chrome / Safari to honour
      later speak() calls after the LLM response lands. */
  onPrimeTTS?: () => void;
  /** Called when the user taps the "Chat" mode pill — should open the
      regular text chat overlay (screenshot 1 style) and dismiss voice. */
  onSwitchToChat?: () => void;
}

export const CosmicVoiceOverlay: React.FC<Props> = ({
  visible, state, amplitude, interim, speakingText, supported,
  onStartListening, onStopListening, onSendText, onCancelSpeaking, onClose, onPrimeTTS, onSwitchToChat,
}) => {
  const [mode, setMode] = useState<'talk' | 'chat'>('talk');
  const [chatText, setChatText] = useState('');

  // Auto-pulse animation for the idle ring (gentle breathing).
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
  }, [breathe]);

  // Live amplitude → animated rings while listening/speaking.
  const amp = useSharedValue(0);
  useEffect(() => {
    amp.value = withTiming(amplitude, { duration: 90 });
  }, [amplitude, amp]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + amp.value * 0.30 + (state === 'idle' ? (breathe.value - 1) : 0) }],
    opacity: state === 'idle' ? 0.35 : 0.55 + amp.value * 0.45,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + amp.value * 0.55 }],
    opacity: 0.18 + amp.value * 0.38,
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + amp.value * 0.10 }],
  }));

  if (!visible) return null;

  const speaking = state === 'speaking';
  const listening = state === 'listening';
  const thinking = state === 'thinking';

  const subtitle = !supported
    ? 'Voice not supported here — use Chat below.'
    : listening ? 'Listening… speak naturally.'
    : thinking ? 'Vidhaata is consulting the texts…'
    : speaking ? 'Vidhaata is speaking. Tap orb to interrupt.'
    : 'Tap the orb and ask anything.';

  const handleOrbTap = () => {
    if (speaking) { onCancelSpeaking(); return; }
    if (listening) { onStopListening(); return; }
    if (thinking) return;
    if (mode === 'talk') {
      // CRITICAL: prime TTS *inside* this user gesture so a later
      // speak() call (after the LLM round-trip lands) is allowed by
      // Chrome / Safari. Without this, the orb sits in 'thinking'
      // forever because the synthesis call gets silently dropped.
      onPrimeTTS?.();
      onStartListening();
    }
  };

  return (
    <View style={s.overlay}>
      {/* close */}
      <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
        <Ionicons name="close" size={22} color={C.cream} />
      </Pressable>

      <Text style={s.brand}>Vidhaata</Text>
      <Text style={s.subtitle}>{subtitle}</Text>

      {/* Orb stack */}
      <View style={s.orbStack}>
        <Animated.View style={[s.ring, s.ringOuter, isWeb && (s.ringWeb as any), ring2Style]} />
        <Animated.View style={[s.ring, s.ringInner, isWeb && (s.ringWeb as any), ring1Style]} />
        <Animated.View style={orbStyle}>
          <Pressable onPress={handleOrbTap} style={[s.orb, isWeb && (s.orbWeb as any)]}>
            <Ionicons
              name={speaking ? 'volume-high' : thinking ? 'sparkles' : 'mic'}
              size={64}
              color="#1A0F3D"
            />
          </Pressable>
        </Animated.View>
      </View>

      {/* Live transcript */}
      <View style={s.transcriptWrap}>
        {listening && interim ? (
          <Text style={s.transcript} numberOfLines={3}>{interim}</Text>
        ) : speaking && speakingText ? (
          <Text style={s.transcript} numberOfLines={4}>{speakingText}</Text>
        ) : null}
      </View>

      {/* Mode toggle + composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.bottomWrap}
      >
        <View style={s.modeRow}>
          <Pressable
            onPress={() => setMode('talk')}
            style={[s.modePill, mode === 'talk' && s.modePillActive]}
          >
            <Ionicons name="mic-outline" size={14} color={mode === 'talk' ? '#1A0F3D' : C.cream} />
            <Text style={[s.modeText, mode === 'talk' && s.modeTextActive]}>Talk</Text>
          </Pressable>
          <Pressable
            onPress={() => { if (onSwitchToChat) onSwitchToChat(); else setMode('chat'); }}
            style={[s.modePill, mode === 'chat' && s.modePillActive]}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={mode === 'chat' ? '#1A0F3D' : C.cream} />
            <Text style={[s.modeText, mode === 'chat' && s.modeTextActive]}>Chat</Text>
          </Pressable>
        </View>

        {mode === 'chat' ? (
          <View style={s.composer}>
            <TextInput
              value={chatText}
              onChangeText={setChatText}
              placeholder="Ask Vidhaata anything…"
              placeholderTextColor={C.cream45}
              style={s.composerInput}
              onSubmitEditing={() => {
                const t = chatText.trim();
                if (!t) return;
                onSendText(t);
                setChatText('');
              }}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => {
                const t = chatText.trim();
                if (!t) return;
                onSendText(t);
                setChatText('');
              }}
              style={({ pressed }) => [s.sendBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="send" size={16} color="#1A0F3D" />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: '#0B0820',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 60,
    zIndex: 2000,
  },
  closeBtn: {
    position: 'absolute', top: 14, left: 14,
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
  },
  brand: {
    color: C.goldHi, fontSize: 22, fontWeight: '800', letterSpacing: 1.4,
    marginTop: 12,
  },
  subtitle: { color: C.cream65, fontSize: 13, marginTop: 6, marginBottom: 30, textAlign: 'center', paddingHorizontal: 30 },

  orbStack: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(232,201,106,0.25)',
  },
  ringOuter: { width: 280, height: 280 },
  ringInner: { width: 230, height: 230, backgroundColor: 'rgba(242,199,90,0.30)' },
  ringWeb: {
    boxShadow: '0 0 60px rgba(242,199,90,0.45)',
  } as any,
  orb: {
    width: 180, height: 180, borderRadius: 90,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8C96A',
    borderWidth: 2, borderColor: 'rgba(255,236,180,0.85)',
  },
  orbWeb: {
    backgroundImage: 'radial-gradient(circle at 50% 35%, #FFE8A6 0%, #F2C75A 45%, #C9851F 100%)',
    boxShadow: '0 0 60px rgba(242,199,90,0.55), 0 18px 40px rgba(201,133,31,0.45), inset 0 2px 0 rgba(255,255,255,0.4)',
    cursor: 'pointer',
  } as any,

  transcriptWrap: { minHeight: 60, paddingHorizontal: 30, marginTop: 4 },
  transcript: {
    color: C.cream80, fontSize: 16, textAlign: 'center', lineHeight: 22,
    fontStyle: 'italic',
  },

  bottomWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34,22,71,0.78)',
    borderWidth: 1, borderColor: C.cream10,
  },
  modePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999,
  },
  modePillActive: { backgroundColor: C.goldHi },
  modeText: { color: C.cream, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.4 },
  modeTextActive: { color: '#1A0F3D' },

  composer: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginTop: 14,
    padding: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(34,22,71,0.85)',
    borderWidth: 1, borderColor: C.cream10,
    width: '100%', maxWidth: 460,
  },
  composerInput: {
    flex: 1,
    color: C.cream, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.goldHi,
  },
});

export default CosmicVoiceOverlay;
