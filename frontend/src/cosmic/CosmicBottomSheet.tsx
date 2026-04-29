/**
 * CosmicBottomSheet — compact slide-up popup.
 *
 * v9.4.1 redesign: 4 main items now render as a HORIZONTAL row of
 * icon-tiles (matching the floating bottom-nav language), instead of
 * the previous tall vertical text list. Sign Out lives on its own
 * row below the divider so destructive actions stay deliberate.
 *
 * Tapping the scrim dismisses; tapping any tile fires its onPress
 * after the sheet animates out (~140 ms) so the next surface lands
 * on a clean stack.
 */
import React from 'react';
import {
  Modal, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

export interface SheetItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'gold' | 'danger';
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Primary actions — rendered as a horizontal icon strip. */
  items: SheetItem[];
  /** Optional destructive action under the divider (full-width row). */
  signOut?: SheetItem;
  /** Optional sheet title above the strip. */
  title?: string;
}

export const CosmicBottomSheet: React.FC<Props> = ({
  visible, onClose, items, signOut, title = 'Vidhaata menu',
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, isWeb && (s.sheetWeb as any)]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{title}</Text>

          {/* Horizontal icon strip — same visual language as the floating nav. */}
          <View style={s.tileRow}>
            {items.map((it) => (
              <Tile key={it.id} item={it} onClose={onClose} />
            ))}
          </View>

          {signOut ? (
            <>
              <View style={s.divider} />
              <Pressable
                onPress={() => { onClose(); setTimeout(signOut.onPress, 140); }}
                style={({ pressed }) => [s.signRow, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name={signOut.icon} size={18} color="#E07A45" />
                <Text style={s.signText}>{signOut.label}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

// ── Compact icon tile ──────────────────────────────────────────────────
const Tile: React.FC<{ item: SheetItem; onClose: () => void }> = ({ item, onClose }) => {
  const danger = item.tone === 'danger';
  return (
    <Pressable
      onPress={() => { onClose(); setTimeout(item.onPress, 140); }}
      style={({ pressed }) => [s.tile, pressed && s.tilePressed]}
      accessibilityLabel={item.label}
    >
      <View style={s.tileBubble}>
        <Ionicons
          name={item.icon}
          size={22}
          color={danger ? '#E07A45' : C.goldHi}
        />
      </View>
      <Text style={[s.tileLabel, danger && { color: '#E07A45' }]} numberOfLines={2}>
        {item.label}
      </Text>
    </Pressable>
  );
};

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#221645',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  sheetWeb: {
    backdropFilter: 'blur(28px) saturate(160%)',
    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
    boxShadow: '0 -16px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
  } as any,
  handle: {
    width: 64, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(245,237,214,0.30)',
    marginTop: 8, marginBottom: 14,
  },
  sheetTitle: {
    color: 'rgba(245,237,214,0.55)',
    fontSize: 11, fontWeight: '700', letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 14,
  },

  // Horizontal strip
  tileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4,
    borderRadius: 14,
    minWidth: 64,
  },
  tilePressed: {
    backgroundColor: C.glassSoft,
  },
  tileBubble: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(232,201,106,0.14)',
    borderWidth: 1, borderColor: C.goldLine,
    marginBottom: 6,
  },
  tileLabel: {
    color: C.cream,
    fontSize: 11, fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 14,
  },

  divider: {
    height: 1,
    marginVertical: 10,
    marginHorizontal: 6,
    backgroundColor: 'rgba(245,237,214,0.10)',
  },

  signRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(196,98,45,0.10)',
    borderWidth: 1, borderColor: 'rgba(224,122,69,0.40)',
    marginHorizontal: 4,
  },
  signText: {
    color: '#E07A45',
    fontSize: 13, fontWeight: '800',
    letterSpacing: 0.3,
  },
});

export default CosmicBottomSheet;
