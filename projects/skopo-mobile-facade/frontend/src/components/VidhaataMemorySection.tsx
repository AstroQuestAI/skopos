/**
 * VidhaataMemorySection.tsx — v7.4 (Phase A)
 *
 * Drops into ProfileScreenV2 as its own card. Shows:
 *   - Master toggle "Remember facts from our conversations" (default ON)
 *   - Count of stored facts
 *   - "Manage memories" button → opens the inline modal
 *
 * When the toggle is switched OFF we call /api/memory/toggle {enabled:false}
 * which HARD-DELETES every stored fact for this user.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Switch, Modal, ScrollView,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { BRAND } from './mdTheme';

import { BACKEND_URL } from '../utils/backendUrl';
  '';

interface Fact {
  fact_id:     string;
  fact_type:   string;
  value:       string;
  source:      string;
  captured_at: string;
}

interface Props {
  authUserEmail?: string;
}

// --------------------------------------------------------------------------
export const VidhaataMemorySection: React.FC<Props> = ({ authUserEmail }) => {
  const [enabled, setEnabled]   = useState(true);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);

  const refresh = useCallback(async () => {
    if (!authUserEmail) return;
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND_URL}/api/memory/status`, { withCredentials: true });
      setEnabled(!!r.data?.enabled);
      setCount(Number(r.data?.count || 0));
    } catch {
      /* not signed in → hide section silently */
    } finally {
      setLoading(false);
    }
  }, [authUserEmail]);

  useEffect(() => { refresh(); }, [refresh]);

  const onToggle = async (next: boolean) => {
    if (!next) {
      // Switching OFF — confirm before wiping.
      Alert.alert(
        'Turn memory off?',
        'All facts Vidhaata has learned about you will be permanently erased. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn off & erase', style: 'destructive',
            onPress: async () => {
              try {
                const r = await axios.post(
                  `${BACKEND_URL}/api/memory/toggle`,
                  { enabled: false },
                  { withCredentials: true },
                );
                setEnabled(false);
                setCount(0);
                Alert.alert('Memory off', `${r.data?.wiped || 0} facts erased.`);
              } catch (e: any) {
                Alert.alert('Error', 'Could not turn memory off. Please try again.');
              }
            },
          },
        ],
      );
      return;
    }
    // Switching ON — no destructive action, just flip the pref.
    try {
      await axios.post(
        `${BACKEND_URL}/api/memory/toggle`,
        { enabled: true },
        { withCredentials: true },
      );
      setEnabled(true);
      refresh();
    } catch (e: any) {
      Alert.alert('Error', 'Could not enable memory. Please try again.');
    }
  };

  if (!authUserEmail) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="bookmark" size={15} color="#FFFFFF" />
        <Text style={styles.cardHeaderText}>VIDHAATA MEMORY</Text>
      </View>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND.text }}>
              Remember facts from our conversations
            </Text>
            <Text style={{ fontSize: 12, color: BRAND.faint, marginTop: 4, lineHeight: 17 }}>
              When on, Vidhaata silently remembers durable life facts you mention
              (marriage, children, residence, major events) so future replies fit
              your real life. When off, everything is erased — no mixing with
              anyone else, ever.
            </Text>
          </View>
          {loading
            ? <ActivityIndicator size="small" color={BRAND.saffron} />
            : <Switch
                value={enabled}
                onValueChange={onToggle}
                trackColor={{ false: '#D1D5DB', true: BRAND.saffron }}
                thumbColor={'#FFFFFF'}
              />}
        </View>

        {/* Stats + manage */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1, borderTopColor: BRAND.goldLine,
        }}>
          <Text style={{ fontSize: 12, color: BRAND.faint, flex: 1 }}>
            {count === 0
              ? (enabled ? 'No facts remembered yet — chat with Vidhaata.' : 'Memory turned off.')
              : `${count} fact${count === 1 ? '' : 's'} stored`}
          </Text>
          {enabled ? (
            <TouchableOpacity
              onPress={() => setOpen(true)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12, paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.2, borderColor: BRAND.goldLine,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND.maroon }}>
                Manage →
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <MemoryManagerModal
        visible={open}
        onClose={() => { setOpen(false); refresh(); }}
      />
    </View>
  );
};

// --------------------------------------------------------------------------
const MemoryManagerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
}> = ({ visible, onClose }) => {
  const [facts, setFacts]   = useState<Fact[]>([]);
  const [loading, setLoading] = useState(false);
  const [newType, setNewType] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${BACKEND_URL}/api/memory/list`, { withCredentials: true });
      setFacts(Array.isArray(r.data?.facts) ? r.data.facts : []);
    } catch {
      setFacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const onDelete = (f: Fact) => {
    Alert.alert(
      'Erase this memory?',
      `"${f.fact_type.replace(/_/g, ' ')}: ${f.value}"\n\nThis cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase', style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(
                `${BACKEND_URL}/api/memory/item/${f.fact_id}`,
                { withCredentials: true },
              );
              setFacts((prev) => prev.filter((x) => x.fact_id !== f.fact_id));
            } catch {
              Alert.alert('Error', 'Could not erase. Try again.');
            }
          },
        },
      ],
    );
  };

  const onAdd = async () => {
    if (!newType.trim() || !newValue.trim()) return;
    setAdding(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/memory/add`,
        { fact_type: newType.trim().toLowerCase().replace(/\s+/g, '_'),
          value: newValue.trim() },
        { withCredentials: true },
      );
      setNewType(''); setNewValue('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not add fact.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: 1, borderBottomColor: BRAND.goldLine,
          backgroundColor: '#FFFFFF',
        }}>
          <Ionicons name="bookmark" size={18} color={BRAND.maroon} />
          <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '800', color: BRAND.text, flex: 1 }}>
            Vidhaata Memory
          </Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={24} color={BRAND.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 60 }}>
          {/* Add manual fact */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="add-circle" size={15} color="#FFFFFF" />
              <Text style={styles.cardHeaderText}>ADD A FACT MANUALLY</Text>
            </View>
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 11, color: BRAND.faint, marginBottom: 6, letterSpacing: 0.4 }}>
                TYPE (e.g. marital_status, has_children, occupation)
              </Text>
              <TextInput
                value={newType}
                onChangeText={setNewType}
                placeholder="marital_status"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={{ fontSize: 11, color: BRAND.faint, marginTop: 10, marginBottom: 6, letterSpacing: 0.4 }}>
                VALUE
              </Text>
              <TextInput
                value={newValue}
                onChangeText={setNewValue}
                placeholder="married since 2022"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={onAdd}
                disabled={adding || !newType.trim() || !newValue.trim()}
                activeOpacity={0.85}
                style={[{
                  marginTop: 12,
                  backgroundColor: BRAND.saffron,
                  paddingVertical: 11,
                  borderRadius: 8,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                }, (adding || !newType.trim() || !newValue.trim()) && { opacity: 0.5 }]}
              >
                {adding ? <ActivityIndicator color="#FFFFFF" />
                        : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>
                            Save fact
                          </Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Existing facts */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="list" size={15} color="#FFFFFF" />
              <Text style={styles.cardHeaderText}>
                REMEMBERED FACTS · {facts.length}
              </Text>
            </View>
            <View style={{ padding: 4 }}>
              {loading ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <ActivityIndicator color={BRAND.saffron} />
                </View>
              ) : facts.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: BRAND.faint, fontSize: 13 }}>
                    Nothing stored yet. Chat with Vidhaata and facts you mention
                    (like "I'm married" or "I moved to UK in 2023") will show here.
                  </Text>
                </View>
              ) : (
                facts.map((f) => (
                  <View key={f.fact_id} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 12, paddingVertical: 11,
                    borderBottomWidth: 1, borderBottomColor: BRAND.goldLine,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10.5, color: BRAND.faint, letterSpacing: 0.5, fontWeight: '700' }}>
                        {f.fact_type.toUpperCase().replace(/_/g, ' ')}
                      </Text>
                      <Text style={{ fontSize: 14, color: BRAND.text, fontWeight: '600', marginTop: 2 }}>
                        {f.value}
                      </Text>
                      <Text style={{ fontSize: 10, color: BRAND.faint, marginTop: 3, fontStyle: 'italic' }}>
                        via {f.source} · {new Date(f.captured_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => onDelete(f)}
                      activeOpacity={0.7}
                      style={{ padding: 8 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={BRAND.rose} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          <Text style={{ fontSize: 11, color: BRAND.faint, textAlign: 'center',
                         marginTop: 14, fontStyle: 'italic', lineHeight: 16 }}>
            🔒 Your memories are private to your account. They are never shared
            with other users and never used to train any AI model.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

// --------------------------------------------------------------------------
import { StyleSheet } from 'react-native';
const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.cream,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1.3,
    borderColor: BRAND.goldLine,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: '#4338CA',
    borderBottomWidth: 1, borderBottomColor: BRAND.goldLine,
  },
  cardHeaderText: {
    color: '#FFFFFF',
    fontSize: 11, fontWeight: '800',
    letterSpacing: 1.4,
  },
  input: {
    fontSize: 14, color: BRAND.text,
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: BRAND.goldLine,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
  },
});
