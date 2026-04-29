/**
 * AskVidhaataFab — v6.41
 *
 * The "Ask · Vidhaata" stamp-style floating action button.
 *
 * The circle contains the Sri Chakra avatar at centre, with two pieces of
 * curved text engraved around the ring:
 *
 *     • "ASK"        along the TOP arc   (reads left → right)
 *     • "VIDHAATA"   along the BOTTOM arc (reads left → right, right-side-up)
 *
 * Rendered with react-native-svg <TextPath> so the text hugs the circle
 * consistently on iOS, Android and Web — no platform-specific hacks.
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';
import { GuruAvatar } from './GuruAvatar';
import { theme } from '../theme';

interface Props {
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Top-arc text (default "ASK"). */
  topText?: string;
  /** Bottom-arc text (default "VIDHAATA"). */
  bottomText?: string;
  /** Override colors if needed. */
  ringColor?: string;
  textColor?: string;
}

export const AskVidhaataFab: React.FC<Props> = ({
  size = 96,
  onPress,
  style,
  topText = 'ASK',
  bottomText = 'VIDHAATA',
  ringColor = theme.colors.primary700,
  textColor = '#FFFFFF',
}) => {
  const cx = size / 2;
  const cy = size / 2;
  // Radius used by the text paths — slightly smaller than the outer ring
  // so the glyphs sit comfortably inside the border.
  const rText = size * 0.40;
  // Two semicircle arcs. Each arc runs left → right (clockwise for the top,
  // counter-clockwise for the bottom) so BOTH strings read upright when you
  // hold the phone normally.
  //
  // Top arc:   (cx-r, cy)  →  (cx+r, cy)   via large-arc-flag=0, sweep=1
  // Bottom arc:(cx-r, cy)  →  (cx+r, cy)   via large-arc-flag=0, sweep=0
  //   ↑ same endpoints but bottom uses sweep=0 so glyphs sit on the
  //     outside of the lower arc (i.e. upright).
  const topArc    = `M ${cx - rText} ${cy} A ${rText} ${rText} 0 0 1 ${cx + rText} ${cy}`;
  const bottomArc = `M ${cx - rText} ${cy} A ${rText} ${rText} 0 0 0 ${cx + rText} ${cy}`;

  // Character spacing heuristic — longer strings get tighter spacing.
  // v6.45 — bumped letter size so "ASK" / "VIDHAATA" read larger per user feedback.
  const topFs    = Math.max(10, Math.round(size * 0.15));
  const bottomFs = Math.max(10, Math.round(size * 0.145));

  const Wrapper: any = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.wrap,
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: ringColor,
          borderColor: theme.colors.saffron400,
        },
        style,
      ]}
      accessibilityLabel={`${topText} ${bottomText}`}
    >
      {/* Centred Sri Chakra avatar — v6.44: slightly bigger so it
          nearly touches the curved lettering. */}
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <GuruAvatar size={size * 0.62} glow={false} />
      </View>

      {/* Stamp-style curved text */}
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <Defs>
          <Path id="topArc" d={topArc} />
          <Path id="bottomArc" d={bottomArc} />
        </Defs>

        {/* Inner engraving ring — subtle saffron halo. */}
        <Circle
          cx={cx} cy={cy} r={size * 0.465}
          stroke={theme.colors.saffron300} strokeWidth={0.75}
          fill="none" opacity={0.45}
        />

        <SvgText
          fill={textColor}
          fontWeight="900"
          fontSize={topFs}
          letterSpacing={size * 0.05}
        >
          <TextPath href="#topArc" startOffset="50%" textAnchor="middle">
            {topText}
          </TextPath>
        </SvgText>
        <SvgText
          fill={textColor}
          fontWeight="900"
          fontSize={bottomFs}
          letterSpacing={size * 0.035}
        >
          <TextPath href="#bottomArc" startOffset="50%" textAnchor="middle">
            {bottomText}
          </TextPath>
        </SvgText>
      </Svg>
    </Wrapper>
  );
};

export default AskVidhaataFab;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 9,
  },
});
