/**
 * CosmicAudioBriefing — Daily Briefing audio card with REAL playback
 * controls (v9.11).
 *
 * Self-contained player:
 *   • Tap play  → fetches Piper-generated WAV from /api/tts/speak,
 *                 plays it via HTMLAudio, animates waveform + scrub line.
 *   • Tap again → pauses (resumes on next tap).
 *   • Back-10 / Forward-10 → seeks the audio element by ±10 seconds.
 *
 * The card is now a stateful player. The parent passes a
 * `getSpeechText()` function that returns the briefing copy to read.
 * The card stays on the home page — it does NOT open the Vidhaata
 * voice overlay, so there's no clash between the two TTS engines.
 *
 * The component only requests audio ONCE per mount (until the user
 * navigates away and remounts), so paging/scrubbing is instant.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cosmicTokens as T } from './tokens';
import { MellowText } from './MellowText';
import { fetchPiperAudioUrl, fetchGreetingAudioUrl, playPiperStreamed, stopPiperStream, prefetchGreeting, getBackendVoiceId, type PiperVoice } from './piperSpeech';
import { getCachedGreetingUrl, type Lang } from './voicePref';
import { trCurrent } from './cosmicI18n';

interface Props {
  title?: string;
  subtitle?: string;
  /**
   * Async or sync function returning the text to read. Called only
   * when the user first taps play (audio is then cached for the
   * lifetime of the component).
   */
  getSpeechText?: () => string | Promise<string>;
  voice?: PiperVoice;
  /** v9.20 — current UI language. Determines which voice pref to read. */
  language?: Lang;
  speed?: number;
  /**
   * Optional pre-stop hook — called right before audio starts playing
   * (e.g. so the parent can `voice.cancelSpeaking()` to halt any
   * concurrent Web Speech utterance).
   */
  onBeforePlay?: () => void;
  /** Legacy prop kept for backward compat — fires once when the user
   *  taps play with no `getSpeechText` set. */
  onPlay?: () => void;
}

const WAVEFORM_BARS = 56;
const isWeb = Platform.OS === 'web';

const fmtTime = (sec: number): string => {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const CosmicAudioBriefing: React.FC<Props> = ({
  title = 'Your Daily Briefing',
  subtitle = 'Your cosmic briefing is ready',
  getSpeechText,
  voice = 'norman',
  language = 'en',
  speed = 1.0,
  onBeforePlay,
  onPlay,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stable pseudo-random waveform heights (deterministic per render).
  const heights = useMemo(() => {
    const h: number[] = [];
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      const s = Math.sin(i * 0.41) * 0.5 + Math.cos(i * 0.93) * 0.4;
      h.push(8 + Math.abs(s) * 22 + (i % 7 === 0 ? 6 : 0));
    }
    return h;
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      try { abortRef.current?.abort(); } catch {}
      const a = audioRef.current;
      if (a) {
        try { a.pause(); a.src = ''; } catch {}
      }
      const u = objectUrlRef.current;
      if (u) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    };
  }, []);

  /** Lazy-load Piper audio (first play only). */
  const ensureLoaded = async (): Promise<HTMLAudioElement> => {
    if (audioRef.current) return audioRef.current;
    if (!isWeb) throw new Error('Audio playback only supported on web');
    setError(null);
    setLoading(true);
    try {
      const text = (typeof getSpeechText === 'function')
        ? await getSpeechText()
        : '';
      if (!text || !text.trim()) throw new Error('No briefing text available');

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      // v9.13 — use the daily-cached fetcher; pulls from localStorage
      // when warm (instant), falls back to Piper when cold.
      const url = await fetchGreetingAudioUrl(text, getBackendVoiceId(language) as PiperVoice, speed, ctrl.signal);
      objectUrlRef.current = url;

      const a = new Audio(url);
      a.preload = 'auto';

      a.addEventListener('loadedmetadata', () => setDuration(a.duration || 0));
      a.addEventListener('durationchange', () => setDuration(a.duration || 0));
      a.addEventListener('timeupdate', () => setCurrentTime(a.currentTime || 0));
      a.addEventListener('play', () => setIsPlaying(true));
      a.addEventListener('pause', () => setIsPlaying(false));
      a.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        try { a.currentTime = 0; } catch {}
      });
      a.addEventListener('error', () => {
        setError('Audio error');
        setIsPlaying(false);
      });

      audioRef.current = a;
      return a;
    } finally {
      setLoading(false);
    }
  };

  const onPressPlay = async () => {
    try {
      // Halt any concurrent Web Speech utterance (e.g. Vidhaata overlay).
      try { onBeforePlay?.(); } catch {}

      // v9.17 — Fast-path: if cache is COLD, use sentence-streamed
      // playback so audio starts ~1.5 s after tap (instead of waiting
      // 4-6 s for the full WAV). The cache also gets warmed in the
      // background so the next tap is instant with full scrub control.
      if (!audioRef.current && isWeb) {
        const text = (typeof getSpeechText === 'function')
          ? await getSpeechText()
          : '';
        const v = getBackendVoiceId(language) as PiperVoice;
        const hit = text ? getCachedGreetingUrl(text, v) : null;
        if (text && !hit) {
          // Cold cache → stream now + warm cache in the background.
          setLoading(true);
          setIsPlaying(true);
          setError(null);
          // Background prefetch for next-time scrubbable playback.
          prefetchGreeting(text, v).catch(() => {});
          try {
            await playPiperStreamed(text, {
              voice: v,
              speed: 1.0,
              onSentenceStart: (i, total) => {
                // Surface a coarse progress bar via duration/currentTime.
                setDuration(total);
                setCurrentTime(i);
              },
              onError: (e) => console.warn('[stream] segment error', e),
            });
          } finally {
            setIsPlaying(false);
            setLoading(false);
            setCurrentTime(0);
            setDuration(0);
          }
          try { onPlay?.(); } catch {}
          return;
        }
        // hit exists → fall through to ensureLoaded which uses cache.
        if (hit) { try { URL.revokeObjectURL(hit); } catch {} }
      }

      const a = await ensureLoaded();
      if (a.paused) {
        await a.play();
      } else {
        a.pause();
      }
      try { onPlay?.(); } catch {}
    } catch (e: any) {
      console.warn('[audio-card] play failed', e);
      setError(e?.message || 'Could not load audio');
    }
  };

  const onPressBack = () => {
    const a = audioRef.current;
    if (!a) return;
    try { a.currentTime = Math.max(0, a.currentTime - 10); } catch {}
  };
  const onPressFwd = () => {
    const a = audioRef.current;
    if (!a) return;
    try { a.currentTime = Math.min(a.duration || 0, a.currentTime + 10); } catch {}
  };

  // Animated waveform: when playing, bars to the LEFT of the playhead
  // are "active" (gold), bars to the right are dim. Playhead position
  // is computed from progress.
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const playheadBar = Math.floor(progress * WAVEFORM_BARS);
  const durationLabel = duration > 0 ? fmtTime(duration) : '—:—';

  return (
    <View style={[s.card, isWeb && (web.card as any)]}>
      <View style={s.topRow}>
        <View style={[s.tag, isWeb && (web.tag as any)]}>
          <Text style={s.tagSparkle}>✦ </Text>
          <Text style={s.tagText}>{trCurrent('Daily Briefing')}</Text>
        </View>
        <Text style={s.duration}>{loading ? 'Loading…' : durationLabel}</Text>
      </View>

      <MellowText
        style={[s.title, isWeb && (web.titleGlow as any)]}
        glowColor="#E8C96A"
        duration={4200}
        minOpacity={0.94}
      >
        {title}
      </MellowText>
      <Text style={s.subtitle}>{error || subtitle}</Text>

      {/* Waveform — bars left of the playhead glow gold while playing. */}
      <View style={s.wave}>
        {heights.map((h, i) => {
          const active = i <= playheadBar;
          return (
            <View
              key={i}
              style={[
                s.bar,
                { height: h },
                active ? s.barActive : null,
                isPlaying && active && isWeb && ({ animationDelay: `${(i % 8) * 80}ms` } as any),
              ]}
            />
          );
        })}
      </View>

      {/* Scrub line — REAL progress, not a static line */}
      <View style={s.scrubRow}>
        <Text style={s.scrubTime}>{fmtTime(currentTime)}</Text>
        <View style={s.scrubLineWrap}>
          <View style={s.scrubLine} />
          <View style={[s.scrubFill, { width: `${progress * 100}%` }]} />
          <View style={[s.scrubDot, { left: `${progress * 100}%` }]} />
        </View>
        <Text style={s.scrubTime}>{durationLabel}</Text>
      </View>

      {/* Controls */}
      <View style={s.ctrlRow}>
        <Pressable onPress={onPressBack} style={s.ctrlBtn} disabled={!audioRef.current} accessibilityLabel="Back 10 seconds">
          <Ionicons name="play-back" size={16} color={audioRef.current ? T.text2 : T.textMu} />
          <Text style={[s.ctrlNum, !audioRef.current && { opacity: 0.5 }]}>10</Text>
        </Pressable>
        <Pressable
          onPress={onPressPlay}
          style={[s.playBtn, isWeb && (web.playBtn as any), loading && { opacity: 0.6 }]}
          accessibilityLabel={isPlaying ? 'Pause briefing' : 'Play briefing'}
          disabled={loading}
        >
          <Ionicons
            name={loading ? 'hourglass' : isPlaying ? 'pause' : 'play'}
            size={22}
            color={T.bgDeep}
            style={{ marginLeft: isPlaying || loading ? 0 : 3 }}
          />
        </Pressable>
        <Pressable onPress={onPressFwd} style={s.ctrlBtn} disabled={!audioRef.current} accessibilityLabel="Forward 10 seconds">
          <Ionicons name="play-forward" size={16} color={audioRef.current ? T.text2 : T.textMu} />
          <Text style={[s.ctrlNum, !audioRef.current && { opacity: 0.5 }]}>10</Text>
        </Pressable>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(34,22,71,0.62)',
    marginBottom: 14,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: T.rPill,
    backgroundColor: 'rgba(201,168,76,0.16)',
  },
  tagSparkle: { color: T.gold, fontSize: 12, fontWeight: '700' },
  tagText:    { color: T.goldLight, fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 },
  duration:   { color: T.text2, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  title: {
    color: '#FFE9A8', fontSize: 24, fontWeight: '800',
    letterSpacing: -0.4, marginBottom: 4,
  },
  subtitle: { color: T.text2, fontSize: 13, marginBottom: 16 },

  wave: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    height: 36, marginBottom: 12,
  },
  bar: {
    width: 3, borderRadius: 2,
    backgroundColor: 'rgba(245,237,214,0.30)',
  },
  barActive: { backgroundColor: T.gold },

  scrubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  scrubLineWrap: { flex: 1, height: 14, justifyContent: 'center', position: 'relative' },
  scrubLine: { height: 1, backgroundColor: 'rgba(245,237,214,0.18)' },
  scrubFill: {
    position: 'absolute', top: '50%', left: 0,
    height: 2, backgroundColor: T.gold, borderRadius: 1,
  },
  scrubDot: {
    position: 'absolute', top: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: T.goldLight, marginLeft: -4,
    ...(isWeb ? { boxShadow: '0 0 8px rgba(232,201,106,0.7)' } as any : {}),
  } as any,
  scrubTime: { color: T.textMu, fontSize: 11, fontVariant: ['tabular-nums'], minWidth: 32 },

  ctrlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  ctrlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
  ctrlNum: { color: T.text2, fontSize: 9, fontWeight: '700' },
  playBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.gold,
  },
});

const web = {
  card: {
    backdropFilter: 'blur(32px) saturate(160%)',
    WebkitBackdropFilter: 'blur(32px) saturate(160%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 28px rgba(0,0,0,0.20)',
  },
  tag: {
    backgroundImage: 'linear-gradient(135deg, rgba(232,201,106,0.22), rgba(201,168,76,0.10))',
    boxShadow: '0 0 12px rgba(201,168,76,0.18)',
  },
  titleGlow: {
    textShadow: '0 0 1px rgba(245,237,214,0.4), 0 0 14px rgba(201,168,76,0.10)',
  },
  playBtn: {
    backgroundImage: 'linear-gradient(135deg, #F2C75A 0%, #E8A24A 50%, #DD7E3F 100%)',
    boxShadow:
      '0 0 22px rgba(232,201,106,0.55), 0 6px 18px rgba(221,126,63,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
    cursor: 'pointer',
  },
};

export default CosmicAudioBriefing;
