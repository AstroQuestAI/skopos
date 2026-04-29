/**
 * GuruAvatar — Sri Chakra yantra rendered in a clean round frame.
 * Used as GuruJi's icon across the app (FAB, chat header, nudge card).
 *
 * Props:
 *   size  — outer diameter in px.
 *   glow  — optional soft golden halo (default true).
 */
import React from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';

export interface GuruAvatarProps {
  size?: number;
  glow?: boolean;
  /** @deprecated kept for backwards-compat; orbit/planets are no longer drawn */
  showOrbit?: boolean;
}

// Gold Sri Chakra on transparent PNG — bundled as a local asset so it works offline.
const SRI_CHAKRA = require('../../assets/images/guru-sri-chakra.png');

// v6.21: eagerly resolve + prefetch the asset at module load so the icon
// never flashes an empty box on first render. `resolveAssetSource` is sync
// (Metro inlines the URI); `prefetch` warms the web / native image cache.
try {
  // @ts-ignore — Image.resolveAssetSource exists at runtime in both RN & web
  const resolved = Image.resolveAssetSource ? Image.resolveAssetSource(SRI_CHAKRA) : null;
  if (resolved && resolved.uri && Image.prefetch) {
    Image.prefetch(resolved.uri).catch(() => {});
  }
} catch { /* ignore */ }

export const GuruAvatar: React.FC<GuruAvatarProps> = ({ size = 96, glow = true }) => {
  const radius = size / 2;
  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {glow && (
        <View
          style={{
            position: 'absolute', width: size, height: size,
            borderRadius: radius,
            backgroundColor: '#F59E0B',
            opacity: 0.18,
            ...(Platform.OS === 'ios'
              ? { shadowColor: '#F59E0B', shadowRadius: 10, shadowOpacity: 0.55 }
              : { elevation: 3 }),
          }}
        />
      )}
      <View
        style={{
          width: size, height: size,
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: '#B45309',
          // Warm cream-to-saffron radial feel so the gold yantra pops
          backgroundColor: '#FFF7ED',
          overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Image
          source={SRI_CHAKRA}
          style={{ width: size * 0.94, height: size * 0.94 }}
          resizeMode="contain"
          // v6.21 prevents the default cross-fade flash when first mounted
          fadeDuration={0}
          defaultSource={SRI_CHAKRA}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
});

export default GuruAvatar;
