/**
 * MellowText — slow breathing-glow text wrapper.
 *
 * Adds a 3-4 s sinusoidal opacity oscillation between ~0.78 and 1.0
 * plus an animated text-shadow on web for a "glossy / glassy / mellow
 * dimming-and-brightening" feel. Use sparingly on titles, hero values
 * and gold accents — overuse breaks the cosmic stillness.
 */
import React, { useEffect } from 'react';
import { Platform, Text, TextProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';

interface Props extends TextProps {
  glowColor?: string;
  /** Cycle length in ms (default 3600). */
  duration?: number;
  /** Lower bound for opacity dimming (default 0.78). */
  minOpacity?: number;
  children?: React.ReactNode;
}

const AText = Animated.createAnimatedComponent(Text);
const isWeb = Platform.OS === 'web';

export const MellowText: React.FC<Props> = ({
  glowColor = '#F2C75A',
  duration = 3600,
  minOpacity = 0.78,
  style,
  children,
  ...rest
}) => {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [t, duration]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(t.value, [0, 1], [minOpacity, 1]);
    const blur    = interpolate(t.value, [0, 1], [4, 14]);
    if (isWeb) {
      return {
        opacity,
        // Animated halo for that classy/glossy feel.
        textShadow: `0 0 ${blur}px ${glowColor}, 0 0 ${blur * 2}px ${glowColor}55` as any,
      };
    }
    return { opacity };
  });

  return (
    <AText {...rest} style={[style, animatedStyle]}>
      {children}
    </AText>
  );
};

export default MellowText;
