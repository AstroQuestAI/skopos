/**
 * WheelPicker — iOS-style vertical wheel picker for the cosmic
 * onboarding flow. Cross-platform (web + native) with snap-to-interval
 * scrolling, fading edges, and a highlighted center item.
 *
 *   ┌──────────────────┐
 *   │   April          │  ← row n-2  (faded)
 *   │   May            │  ← row n-1  (faded)
 *   │ ╭ June         ╮ │  ← center, selected (bright + bold)
 *   │   July           │  ← row n+1  (faded)
 *   │   August         │  ← row n+2  (faded)
 *   └──────────────────┘
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, NativeSyntheticEvent,
  NativeScrollEvent, Platform, ViewStyle,
} from 'react-native';
import { theme } from '../theme';

const C = theme.cosmic;

interface Props<T extends string | number> {
  items: T[];
  value: T;
  onChange: (next: T) => void;
  itemHeight?: number;        // default 44
  visibleCount?: number;      // default 5 (must be odd)
  width?: number;
  formatItem?: (it: T) => string;
  style?: ViewStyle;
}

export function WheelPicker<T extends string | number>({
  items, value, onChange,
  itemHeight = 44, visibleCount = 5,
  width = 110, formatItem, style,
}: Props<T>) {
  const scrollRef = useRef<ScrollView | null>(null);
  const totalHeight = itemHeight * visibleCount;
  const padCount = Math.floor(visibleCount / 2);

  // v9.11 — Live-tracked centered row index. Updates on every scroll
  // tick (cheap — only when the rounded index actually changes), then
  // commits via a debounced timer so the user's chosen value lands in
  // parent state EVEN when iOS-style `onMomentumScrollEnd` doesn't
  // fire (which is the case in many browsers).
  const [liveIdx, setLiveIdx] = useState<number>(
    Math.max(0, items.indexOf(value))
  );
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveIdxRef = useRef<number>(liveIdx);
  liveIdxRef.current = liveIdx;

  // Sync ONLY when the items array shape/length changes (e.g. days
  // recomputed after month change). Critically we DO NOT include
  // `value` in deps — that would re-run the effect on every onChange
  // we emit and snap the scroll position back, fighting the user's
  // own scroll and making the wheel feel "stuck".
  useEffect(() => {
    const idx = Math.max(0, items.indexOf(value));
    setLiveIdx(idx);
    // Defer one tick so the ScrollView's content has laid out.
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * itemHeight, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const commitValue = (idx: number) => {
    const next = items[idx];
    if (next != null && next !== value) onChange(next);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
    if (idx !== liveIdxRef.current) {
      liveIdxRef.current = idx;
      setLiveIdx(idx);
    }
    // Debounced commit — fires ~150ms after the scroll calms down.
    // Works on every platform regardless of momentum-end reliability.
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commitValue(idx), 150);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
    if (idx !== liveIdxRef.current) {
      liveIdxRef.current = idx;
      setLiveIdx(idx);
    }
    commitValue(idx);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  return (
    <View style={[s.wrap, { width, height: totalHeight }, style]}>
      {/* Center highlight band */}
      <View pointerEvents="none" style={[s.band, { top: padCount * itemHeight, height: itemHeight }]} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.92}
        snapToAlignment="start"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollEndDrag={onMomentumScrollEnd}
        contentContainerStyle={{ paddingTop: padCount * itemHeight, paddingBottom: padCount * itemHeight }}
      >
        {items.map((it, i) => {
          const selected = i === liveIdx;
          const dist = Math.abs(liveIdx - i);
          const opacity = selected ? 1 : Math.max(0.22, 1 - dist * 0.36);
          return (
            <View key={String(it)} style={[s.item, { height: itemHeight, opacity }]}>
              <Text
                numberOfLines={1}
                style={[
                  s.text,
                  selected && s.textSelected,
                  selected && isWeb && (s.textSelectedGlow as any),
                ]}
              >
                {formatItem ? formatItem(it) : String(it)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Top + bottom fade overlays — use absolute Views with linear-gradient
          on web, plain semi-transparent on native (good enough). */}
      <View pointerEvents="none" style={[s.fadeTop,    { height: padCount * itemHeight }]} />
      <View pointerEvents="none" style={[s.fadeBottom, { height: padCount * itemHeight }]} />
    </View>
  );
}

const isWeb = Platform.OS === 'web';
const s = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
  item: { alignItems: 'center', justifyContent: 'center' },
  text: { color: C.cream65, fontSize: 17, fontWeight: '500', textAlign: 'center' },
  // v9.9 — selected row uses bright gold-cream so it's unmistakably
  // active (was C.cream which on top of the dim band looked greyed out).
  textSelected: { color: '#FFE9A8', fontSize: 22, fontWeight: '800' },
  textSelectedGlow: {
    textShadow: '0 0 10px rgba(232,201,106,0.55), 0 0 22px rgba(232,201,106,0.18)',
  } as any,
  band: {
    position: 'absolute', left: 6, right: 6,
    backgroundColor: 'rgba(232,201,106,0.12)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(232,201,106,0.35)',
    ...(isWeb ? {
      boxShadow: '0 0 16px rgba(232,201,106,0.18), inset 0 0 18px rgba(232,201,106,0.08)',
    } as any : {}),
  } as any,
  fadeTop: {
    position: 'absolute', left: 0, right: 0, top: 0,
    backgroundColor: isWeb ? 'transparent' : 'rgba(13,11,30,0.55)',
    ...(isWeb ? {
      backgroundImage: 'linear-gradient(to bottom, rgba(13,11,30,0.95), rgba(13,11,30,0))',
    } as any : {}),
  } as any,
  fadeBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: isWeb ? 'transparent' : 'rgba(13,11,30,0.55)',
    ...(isWeb ? {
      backgroundImage: 'linear-gradient(to top, rgba(13,11,30,0.95), rgba(13,11,30,0))',
    } as any : {}),
  } as any,
});

export default WheelPicker;
