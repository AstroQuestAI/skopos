/**
 * CosmicComposer — gold-mic chat input bar from theme26/chat.html.
 *
 * Drop-in replacement for the chat input row when ?cosmic=1 is on.
 * Wraps a normal RN TextInput with a frosted-glass pill bar + a
 * gold-gradient mic/send button. Calls onSend() when the user hits
 * the send icon or presses Enter on web.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cosmicTokens as T } from './tokens';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMicLongPress?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function CosmicComposer({
  value, onChange, onSend, placeholder = 'Ask Vidhaata anything…', disabled,
}: Props) {
  const isWeb = Platform.OS === 'web';
  const handleKeyPress = (e: any) => {
    // RN-Web: submit on Enter (Shift+Enter for newline).
    if (isWeb && e?.nativeEvent?.key === 'Enter' && !e?.nativeEvent?.shiftKey) {
      e.preventDefault?.();
      if (!disabled && value.trim()) onSend();
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, isWeb && (webOnly.bar as any)]}>
        <Pressable style={styles.addBtn}>
          <Ionicons name="add" size={18} color={T.text2} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.textMu}
          style={[styles.input, isWeb && ({ outlineStyle: 'none' } as any)]}
          editable={!disabled}
          onKeyPress={handleKeyPress as any}
          returnKeyType="send"
          onSubmitEditing={() => { if (!disabled && value.trim()) onSend(); }}
        />
        <Pressable
          onPress={() => { if (!disabled && value.trim()) onSend(); }}
          style={[styles.micBtn, isWeb && (webOnly.micBtn as any), disabled && { opacity: 0.5 }]}
          disabled={disabled}
        >
          <Ionicons
            name={value.trim() ? 'send' : 'mic'}
            size={14}
            color={T.bgDeep}
          />
        </Pressable>
      </View>
      <Text style={styles.hint}>Press and hold mic to speak · Enter to send</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 16,
    paddingRight: 5,
    borderRadius: T.rPill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: T.borderSub,
    gap: 8,
  },
  addBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: T.text,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    minHeight: 32,
  },
  micBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.gold,
  },
  hint: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 9.5,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: T.textMu,
  },
});

const webOnly = {
  bar: {
    backdropFilter: 'blur(28px) saturate(150%)',
    WebkitBackdropFilter: 'blur(28px) saturate(150%)',
    boxShadow: '0 0 22px rgba(201,168,76,0.16)',
  },
  micBtn: {
    backgroundImage: 'linear-gradient(135deg,#E8C96A,#C9A84C)',
    boxShadow:
      '0 4px 12px rgba(201,168,76,0.30), 0 0 0 1px rgba(232,201,106,0.35)',
  },
};

export default CosmicComposer;
