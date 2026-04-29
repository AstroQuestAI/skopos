import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { defaultSkopoThemeName, skopoThemes } from '../skopo/themes';

type Conversation = {
  id: string;
  title: string;
  number: string;
  summary: string;
  status: 'screened' | 'missed' | 'allowed';
  language: string;
  time: string;
};

const conversations: Conversation[] = [
  {
    id: '1',
    title: 'Express Rider',
    number: '+91 98765 43210',
    summary: 'Courier delivery OTP. Caller verified name and reason.',
    status: 'screened',
    language: 'English',
    time: '09:42',
  },
  {
    id: '2',
    title: 'Unknown Number',
    number: '+91 80999 10422',
    summary: 'Asked for loan offer. Marked as low trust and blocked.',
    status: 'missed',
    language: 'Hindi',
    time: 'Yesterday',
  },
  {
    id: '3',
    title: 'ICICI Bank',
    number: '+91 98480 22110',
    summary: 'Bank representative requested callback about card KYC.',
    status: 'allowed',
    language: 'Telugu',
    time: '2d ago',
  },
];

const assistantTurns = [
  'Hi, this is Lakshmi’s assistant. May I know who is calling?',
  'Thanks. What is this regarding?',
  'Is it urgent, or should Lakshmi call you back later?',
];

const activeTheme = skopoThemes[defaultSkopoThemeName];
const colors = activeTheme.colors;
const radii = activeTheme.radius;

export function SkopoApp() {
  const [assistantOn, setAssistantOn] = useState(true);
  const [demoRunning, setDemoRunning] = useState(false);

  const activeCopy = useMemo(() => {
    if (!demoRunning) return 'Ready for local call screening';
    return 'Listening to caller... asking verification questions';
  }, [demoRunning]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} accessibilityLabel="Open menu">
            <Text style={styles.iconText}>☰</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.brand}>Skopo</Text>
            <Text style={styles.caption}>India-first call assistant</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} accessibilityLabel="Open settings">
            <Text style={styles.iconText}>⚙</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTextWrap}>
            <View style={styles.row}>
              <View style={styles.liveDot} />
              <Text style={styles.statusTitle}>AI Assistant is {assistantOn ? 'On' : 'Off'}</Text>
            </View>
            <Text style={styles.statusSub}>Private, on-device screening for unknown calls.</Text>
          </View>
          <Switch value={assistantOn} onValueChange={setAssistantOn} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>ACTIVE CALL SIMULATOR</Text>
          <View style={styles.callHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>?</Text>
            </View>
            <View style={styles.callText}>
              <Text style={styles.callNumber}>+91 98765 43210</Text>
              <Text style={styles.callMeta}>Unknown • Mobile • Telugu/English</Text>
            </View>
            <Text style={styles.timer}>{demoRunning ? '00:18' : 'Idle'}</Text>
          </View>

          <Text style={styles.activeCopy}>{activeCopy}</Text>

          <View style={styles.wave}>
            {Array.from({ length: 24 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  { height: demoRunning ? 8 + ((index * 7) % 28) : 8 },
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.primaryButton, styles.allowButton]}>
              <Text style={styles.primaryButtonText}>Allow</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, styles.blockButton]}>
              <Text style={[styles.primaryButtonText, styles.blockButtonText]}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, styles.callbackButton]}>
              <Text style={[styles.primaryButtonText, styles.callbackButtonText]}>Callback</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={demoRunning ? styles.stopDemoButton : styles.demoButton}
            onPress={() => setDemoRunning((value) => !value)}
          >
            <Text style={demoRunning ? styles.stopDemoText : styles.demoButtonText}>
              {demoRunning ? 'End demo call' : 'Run demo call'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assistant Questions</Text>
          <Text style={styles.sectionLink}>Local LLM</Text>
        </View>
        <View style={styles.questionCard}>
          {assistantTurns.map((turn, index) => (
            <View key={turn} style={styles.turnRow}>
              <Text style={styles.turnNumber}>{index + 1}</Text>
              <Text style={styles.turnText}>{turn}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Conversations</Text>
          <Text style={styles.sectionLink}>View all</Text>
        </View>
        <View style={styles.list}>
          {conversations.map((item) => (
            <View key={item.id} style={styles.conversationRow}>
              <View style={styles.conversationIcon}>
                <Text style={styles.conversationIconText}>
                  {item.status === 'screened' ? '✓' : item.status === 'missed' ? '!' : '↗'}
                </Text>
              </View>
              <View style={styles.conversationBody}>
                <View style={styles.rowBetween}>
                  <Text style={styles.conversationTitle}>{item.title}</Text>
                  <Text style={styles.conversationTime}>{item.time}</Text>
                </View>
                <Text style={styles.conversationSummary}>{item.summary}</Text>
                <Text style={styles.conversationMeta}>{item.number} • {item.language}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.icon,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconText: { color: colors.text, fontSize: 22, fontWeight: '800' },
  brand: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: 0 },
  caption: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 18,
  },
  statusTextWrap: { flex: 1, paddingRight: 12 },
  row: { alignItems: 'center', flexDirection: 'row' },
  liveDot: { backgroundColor: colors.accent, borderRadius: 6, height: 12, marginRight: 10, width: 12 },
  statusTitle: { color: colors.text, fontSize: 21, fontWeight: '900' },
  statusSub: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  hero: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderSoft,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 18,
  },
  heroLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, marginBottom: 16 },
  callHeader: { alignItems: 'center', flexDirection: 'row' },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginRight: 12,
    width: 56,
  },
  avatarText: { color: colors.textSoft, fontSize: 24, fontWeight: '900' },
  callText: { flex: 1 },
  callNumber: { color: colors.text, fontSize: 18, fontWeight: '900' },
  callMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 4 },
  timer: { color: colors.accentStrong, fontSize: 14, fontWeight: '900' },
  activeCopy: { color: colors.textSoft, fontSize: 15, fontWeight: '700', marginTop: 18 },
  wave: { alignItems: 'center', flexDirection: 'row', height: 42, justifyContent: 'center', marginVertical: 12 },
  waveBar: { backgroundColor: colors.blue, borderRadius: 8, marginHorizontal: 2, width: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryButton: {
    alignItems: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '900' },
  allowButton: { backgroundColor: colors.buttonSurface, borderColor: '#89b8ff' },
  blockButton: { backgroundColor: colors.dangerSoft, borderColor: '#ef9a8b' },
  blockButtonText: { color: colors.danger },
  callbackButton: { backgroundColor: colors.buttonSurface, borderColor: '#aeb8b2' },
  callbackButtonText: { color: colors.textSoft },
  demoButton: {
    alignItems: 'center',
    backgroundColor: colors.accentStrong,
    borderRadius: radii.pill,
    marginTop: 16,
    paddingVertical: 14,
  },
  demoButtonText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  stopDemoButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.accentStrong,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 14,
  },
  stopDemoText: { color: colors.accentStrong, fontSize: 16, fontWeight: '900' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sectionLink: { color: colors.accentStrong, fontSize: 13, fontWeight: '900' },
  questionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 14,
  },
  turnRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 8 },
  turnNumber: {
    color: colors.surface,
    backgroundColor: colors.text,
    borderRadius: 14,
    fontSize: 13,
    fontWeight: '900',
    height: 28,
    lineHeight: 28,
    marginRight: 12,
    textAlign: 'center',
    width: 28,
  },
  turnText: { color: colors.textSoft, flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  conversationRow: {
    flexDirection: 'row',
    padding: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  conversationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
    width: 48,
  },
  conversationIconText: { color: colors.accentStrong, fontSize: 18, fontWeight: '900' },
  conversationBody: { flex: 1 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  conversationTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '900', paddingRight: 10 },
  conversationTime: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  conversationSummary: { color: colors.textSoft, fontSize: 14, fontWeight: '600', lineHeight: 20, marginTop: 4 },
  conversationMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 6 },
});

export default SkopoApp;
