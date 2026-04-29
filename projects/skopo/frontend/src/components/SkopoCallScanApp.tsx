import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { defaultSkopoThemeName, SkopoTheme, skopoThemes } from '../skopo/themes';
import {
  createSkopoSession,
  getSkopoEngineStatus,
  runSkopoDemoConversation,
  runSkopoTurn,
} from '../skopo/engine';
import { loadLatestSkopoSession } from '../skopo/storage';
import { SkopoCallSession, SkopoEngineStatus } from '../skopo/types';

const calls = [
  { name: 'Priya Menon', number: '+91 98480 33100', time: '2 min ago', risk: 'Safe', initials: 'PM', duration: '3m 42s' },
  { name: 'Unknown Caller', number: '+91 88823 45678', time: '18 min ago', risk: 'Spam', initials: '?', duration: '0m 12s' },
  { name: 'Marcus Rivera', number: '+91 98765 43210', time: '42 min ago', risk: 'Safe', initials: 'MR', duration: '7m 05s' },
  { name: 'IRS Scam Alert', number: '+91 20255 50198', time: '1 hr ago', risk: 'Blocked', initials: '!', duration: '0m 05s' },
  { name: 'Dr. Aisha Okonkwo', number: '+91 61777 49920', time: 'Yesterday', risk: 'Safe', initials: 'AO', duration: '4m 18s' },
];

const week = [
  { day: 'Mon', safe: 18, spam: 4 },
  { day: 'Tue', safe: 22, spam: 9 },
  { day: 'Wed', safe: 15, spam: 11 },
  { day: 'Thu', safe: 28, spam: 6 },
  { day: 'Fri', safe: 31, spam: 14 },
  { day: 'Sat', safe: 12, spam: 7 },
  { day: 'Sun', safe: 9, spam: 5 },
];

export function SkopoCallScanApp() {
  const [active, setActive] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'Protect' | 'History' | 'Profile'>('Protect');
  const [lookupCount, setLookupCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(2);
  const [engineStatus] = useState<SkopoEngineStatus>(() => getSkopoEngineStatus());
  const [session, setSession] = useState<SkopoCallSession | null>(null);
  const [engineBusy, setEngineBusy] = useState(false);
  const glow = useRef(new Animated.Value(0)).current;
  const theme = skopoThemes[defaultSkopoThemeName];
  const c = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const maxBar = useMemo(() => Math.max(...week.flatMap((d) => [d.safe, d.spam])), []);
  const kpis = [
    { label: 'Blocked Today', value: active ? '14' : '0', tone: c.spam, bg: c.spamContainer, icon: '⊘' },
    { label: 'Scanned Today', value: active ? '47' : '0', tone: c.accentStrong, bg: c.primaryContainer, icon: '◌' },
    { label: 'Spam Rate', value: active ? '29%' : '0%', tone: c.warning, bg: c.warningContainer, icon: '%' },
    { label: 'Unknown', value: active ? '8' : '0', tone: c.unknown, bg: c.unknownContainer, icon: '?' },
  ];
  const glowStyle = useMemo(
    () => [
      styles.goldenGlow,
      {
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] }) }],
      },
    ],
    [glow, styles],
  );
  const glowOnDarkStyle = useMemo(
    () => [
      styles.goldenGlowOnDark,
      {
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.58, 1] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.992, 1.022] }) }],
      },
    ],
    [glow, styles],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { duration: 1650, toValue: 1, useNativeDriver: true }),
        Animated.timing(glow, { duration: 1650, toValue: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  useEffect(() => {
    let mounted = true;
    loadLatestSkopoSession().then((latest) => {
      if (mounted && latest) setSession(latest);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const runLocalEngineDemo = async () => {
    setEngineBusy(true);
    try {
      const next = await runSkopoDemoConversation();
      setSession(next);
      setSelectedTab('History');
    } finally {
      setEngineBusy(false);
    }
  };

  const runTeluguTurn = async () => {
    setEngineBusy(true);
    try {
      const base = session || createSkopoSession();
      const next = await runSkopoTurn(
        base,
        'నేను లక్ష్మి మాట్లాడుతున్నాను. కొరియర్ డెలివరీ ఓటీపీ కోసం కాల్ చేస్తున్నాను. నా నంబర్ 9876543210.',
        'te-IN',
      );
      setSession(next);
      setSelectedTab('History');
    } finally {
      setEngineBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === 'History' ? (
          <View style={styles.historyTopBar}>
            <TouchableOpacity accessibilityLabel="Back" accessibilityRole="button" style={styles.iconOnly}>
              <Text style={styles.topBarIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>Call History</Text>
            <TouchableOpacity accessibilityLabel="Filters" accessibilityRole="button" style={styles.iconOnly}>
              <Text style={styles.topBarIcon}>☷</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <Text style={styles.brandIcon}>▣</Text>
            </View>
            <View style={styles.brandTextWrap}>
              <GoldenGlowText glowStyle={glowStyle} style={styles.brand}>Skopo</GoldenGlowText>
              <Text style={styles.caption}>
                <GoldenGlowText glowStyle={glowStyle} style={styles.captionGlow}>{theme.label}</GoldenGlowText>
                <Text> • {selectedTab}</Text>
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Notifications"
              accessibilityRole="button"
              accessible
              onPress={() => setNotificationCount((count) => Math.max(0, count - 1))}
              style={styles.headerButton}
            >
              {notificationCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount}</Text></View>}
              <Text style={styles.headerIcon}>◔</Text>
            </TouchableOpacity>
            <View style={styles.avatar}><Text style={styles.avatarText}>LK</Text></View>
          </View>
        )}

        {selectedTab === 'Protect' && (
          <ProtectPage
            active={active}
            glowOnDarkStyle={glowOnDarkStyle}
            kpis={kpis}
            maxBar={maxBar}
            session={session}
            onActiveChange={setActive}
            onRunDemo={runLocalEngineDemo}
            onRunTeluguTurn={runTeluguTurn}
            engineBusy={engineBusy}
            engineStatus={engineStatus}
            styles={styles}
            theme={theme}
          />
        )}
        {selectedTab === 'History' && <HistoryPage session={session} styles={styles} theme={theme} />}
        {selectedTab === 'Profile' && (
          <ProfilePage active={active} engineStatus={engineStatus} styles={styles} theme={theme} onActiveChange={setActive} />
        )}
      </ScrollView>

      {selectedTab === 'Protect' && (
        <TouchableOpacity
          accessibilityLabel="Lookup Number"
          accessibilityRole="button"
          accessible
          onPress={() => setLookupCount((count) => count + 1)}
          style={styles.lookupFab}
        >
          <Text style={styles.lookupIcon}>⌕</Text>
          <GoldenGlowText glowStyle={glowOnDarkStyle} style={styles.lookupText}>
            {lookupCount ? `Lookup ${lookupCount}` : 'Lookup Number'}
          </GoldenGlowText>
        </TouchableOpacity>
      )}

      <View style={styles.nav}>
        <NavItem icon="◆" label="Protect" selected={selectedTab === 'Protect'} onPress={() => setSelectedTab('Protect')} styles={styles} />
        <NavItem icon="◷" label="History" selected={selectedTab === 'History'} onPress={() => setSelectedTab('History')} styles={styles} />
        <NavItem icon="◎" label="Profile" selected={selectedTab === 'Profile'} onPress={() => setSelectedTab('Profile')} styles={styles} />
      </View>
    </SafeAreaView>
  );
}

function ProtectPage({
  active,
  glowOnDarkStyle,
  kpis,
  maxBar,
  session,
  onActiveChange,
  onRunDemo,
  onRunTeluguTurn,
  engineBusy,
  engineStatus,
  styles,
  theme,
}: {
  active: boolean;
  glowOnDarkStyle: object[];
  kpis: Array<{ label: string; value: string; tone: string; bg: string; icon: string }>;
  maxBar: number;
  session: SkopoCallSession | null;
  onActiveChange: (value: boolean) => void;
  onRunDemo: () => void;
  onRunTeluguTurn: () => void;
  engineBusy: boolean;
  engineStatus: SkopoEngineStatus;
  styles: ReturnType<typeof createStyles>;
  theme: SkopoTheme;
}) {
  const c = theme.colors;
  return (
    <>
      <View style={styles.protectionCard}>
        <View style={styles.pulseWrap}>
          <View style={styles.pulseOuter} />
          <View style={styles.shieldCircle}><Text style={styles.shield}>◆</Text></View>
        </View>
        <View style={styles.protectionText}>
          <GoldenGlowText glowStyle={glowOnDarkStyle} style={styles.protectionTitle}>
            {active ? 'Protection Active' : 'Protection Off'}
          </GoldenGlowText>
          <Text style={styles.protectionSub}>
            {active ? 'Assistant facade is synced with the web call flow' : 'Tap to enable the Skopo facade'}
          </Text>
          <View style={styles.livePill}>
            <View style={styles.liveAmber} />
            <GoldenGlowText glowStyle={glowOnDarkStyle} style={styles.liveText}>
              {active ? 'Live • Updated now' : 'Inactive'}
            </GoldenGlowText>
          </View>
        </View>
        <Switch
          accessibilityLabel="Protection toggle"
          value={active}
          onValueChange={onActiveChange}
          thumbColor="#ffffff"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiStrip}>
        {kpis.map((item) => (
          <View key={item.label} style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIcon, { backgroundColor: item.bg }]}>
                <Text style={[styles.kpiIconText, { color: item.tone }]}>{item.icon}</Text>
              </View>
              <Text style={[styles.kpiTrend, { color: item.tone }]}>⌁</Text>
            </View>
            <Text style={styles.kpiValue}>{item.value}</Text>
            <Text style={styles.kpiLabel}>{item.label}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.engineCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.cardTitle}>Local Call Engine</Text>
            <Text style={styles.cardSub}>Facade for web call flow, local LLM, and OmniVoice</Text>
          </View>
          <Text style={styles.engineReady}>{engineBusy ? 'Running' : 'Ready'}</Text>
        </View>
        <View style={styles.enginePipeline}>
          <EngineNode label="Listen" value="speech" styles={styles} />
          <Text style={styles.engineArrow}>›</Text>
          <EngineNode label="Think" value={engineStatus.llm.provider} styles={styles} />
          <Text style={styles.engineArrow}>›</Text>
          <EngineNode label="Speak" value={engineStatus.voice.provider} styles={styles} />
        </View>
        <View style={styles.engineGrid}>
          <View style={styles.engineChip}><Text style={styles.engineLabel}>Caller</Text><Text style={styles.engineValue}>{session?.callerInfo.callerName || 'Waiting'}</Text></View>
          <View style={styles.engineChip}><Text style={styles.engineLabel}>Language</Text><Text style={styles.engineValue}>{session?.languageCode || 'auto'}</Text></View>
          <View style={styles.engineChip}><Text style={styles.engineLabel}>Action</Text><Text style={styles.engineValue}>{session?.suggestedAction || 'screen'}</Text></View>
        </View>
        {session?.summary ? <Text style={styles.engineSummary}>{session.summary}</Text> : null}
        <View style={styles.engineActions}>
          <TouchableOpacity accessibilityLabel="Run web flow demo" accessibilityRole="button" onPress={onRunDemo} style={styles.engineButton}>
            <Text style={styles.engineButtonText}>{engineBusy ? 'Running...' : 'Run web-flow demo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Run Telugu local turn" accessibilityRole="button" onPress={onRunTeluguTurn} style={styles.engineButtonSecondary}>
            <Text style={styles.engineButtonSecondaryText}>Telugu turn</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recentHeader}>
        <Text style={styles.cardTitle}>Recent Calls</Text>
        <Text style={styles.link}>See all</Text>
      </View>
      <CallList styles={styles} theme={theme} />
    </>
  );
}

function HistoryPage({ session, styles, theme }: { session: SkopoCallSession | null; styles: ReturnType<typeof createStyles>; theme: SkopoTheme }) {
  const latestCaller = session?.callerInfo.callerName || 'Priya Menon';
  const latestSubject = session?.callerInfo.subject || 'Courier delivery OTP';
  const latestUrgency = session?.callerInfo.urgency || 'Low';
  const latestAction = session?.suggestedAction || 'allow';
  return (
    <>
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsMonth}>This Month</Text>
          <Text style={styles.updatedPill}>● Updated Apr 29</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCell}><Text style={styles.statValue}>11</Text><Text style={styles.statLabel}>Total Calls</Text></View>
          <View style={styles.statCell}><Text style={[styles.statValue, styles.statSpam]}>4</Text><Text style={styles.statLabel}>Spam</Text></View>
          <View style={styles.statCell}><Text style={[styles.statValue, styles.statBlocked]}>2</Text><Text style={styles.statLabel}>Blocked</Text></View>
          <View style={styles.statCell}><Text style={[styles.statValue, styles.statSafe]}>5</Text><Text style={styles.statLabel}>Safe</Text></View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressSegment, styles.progressSafe]} />
          <View style={[styles.progressSegment, styles.progressSpam]} />
          <View style={[styles.progressSegment, styles.progressBlocked]} />
        </View>
        <Text style={styles.statsNote}>36% of calls were spam or scam attempts</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
        <Text style={[styles.filterPill, styles.filterPillActive]}>☷  All  11</Text>
        <Text style={styles.filterPill}>▴  Spam  4</Text>
        <Text style={styles.filterPill}>⊘  Blocked  2</Text>
        <Text style={styles.filterPill}>●  Safe  5</Text>
      </ScrollView>

      <View style={styles.historySectionHeader}>
        <Text style={styles.sectionTitle}>Today</Text>
      </View>
      <CallList styles={styles} theme={theme} />
      <View style={styles.detailCard}>
        <Text style={styles.cardTitle}>Latest captured info</Text>
        <Text style={styles.detailLine}>From: {session?.fromNumber || '+91 98480 33100'}</Text>
        <Text style={styles.detailLine}>Caller: {latestCaller}</Text>
        <Text style={styles.detailLine}>Subject: {latestSubject}</Text>
        <Text style={styles.detailLine}>Urgency: {latestUrgency}</Text>
        <Text style={styles.detailLine}>Suggested action: {latestAction}</Text>
        <Text style={styles.detailLine}>Turns captured: {session?.transcript.length || 0}</Text>
      </View>
      <TranscriptCard session={session} styles={styles} />
    </>
  );
}

function ProfilePage({
  active,
  engineStatus,
  onActiveChange,
  styles,
}: {
  active: boolean;
  engineStatus: SkopoEngineStatus;
  onActiveChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
  theme: SkopoTheme;
}) {
  return (
    <>
      <View style={styles.pageHero}>
        <Text style={styles.pageKicker}>Device first</Text>
        <Text style={styles.pageTitle}>Lakshmi's assistant</Text>
        <Text style={styles.pageCopy}>Green Gold skin is locked for regular testing. The mobile app is the facade while the call workflow runs behind the web app.</Text>
      </View>
      <View style={styles.settingsCard}>
        <View style={styles.settingsRow}>
          <View>
            <Text style={styles.settingTitle}>Protection</Text>
            <Text style={styles.settingSub}>Screen unknown callers</Text>
          </View>
          <Switch accessibilityLabel="Profile protection toggle" value={active} onValueChange={onActiveChange} thumbColor="#ffffff" />
        </View>
        <View style={styles.settingsRow}>
          <View>
            <Text style={styles.settingTitle}>Assistant voice</Text>
            <Text style={styles.settingSub}>OmniVoice local-first target</Text>
          </View>
          <Text style={styles.settingValue}>{engineStatus.voice.provider}</Text>
        </View>
        <View style={styles.settingsRow}>
          <View>
            <Text style={styles.settingTitle}>Local reasoning</Text>
            <Text style={styles.settingSub}>Tiny model route for fast turns</Text>
          </View>
          <Text style={styles.settingValue}>{engineStatus.llm.provider}</Text>
        </View>
        <View style={styles.settingsRowLast}>
          <View>
            <Text style={styles.settingTitle}>Storage</Text>
            <Text style={styles.settingSub}>{engineStatus.storage.provider}</Text>
          </View>
          <Text style={styles.settingValue}>{engineStatus.storage.ready ? 'Ready' : 'Off'}</Text>
        </View>
      </View>
    </>
  );
}

function EngineNode({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.engineNode}>
      <Text style={styles.engineNodeLabel}>{label}</Text>
      <Text style={styles.engineNodeValue}>{value}</Text>
    </View>
  );
}

function TranscriptCard({ session, styles }: { session: SkopoCallSession | null; styles: ReturnType<typeof createStyles> }) {
  if (!session?.transcript.length) {
    return (
      <View style={styles.transcriptCard}>
        <Text style={styles.cardTitle}>Conversation</Text>
        <Text style={styles.emptyTranscript}>Run a local call to see caller and assistant turns here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.transcriptCard}>
      <Text style={styles.cardTitle}>Conversation</Text>
      {session.transcript.map((turn, index) => (
        <View
          key={`${turn.at}-${index}`}
          style={[styles.turnBubble, turn.speaker === 'assistant' ? styles.assistantTurn : styles.callerTurn]}
        >
          <Text style={styles.turnSpeaker}>
            {turn.speaker === 'assistant' ? 'Skopo' : 'Caller'} • {turn.languageCode}
          </Text>
          <Text style={styles.turnText}>{turn.text}</Text>
        </View>
      ))}
    </View>
  );
}

function CallList({ styles, theme }: { styles: ReturnType<typeof createStyles>; theme: SkopoTheme }) {
  const c = theme.colors;
  return (
    <View style={styles.recentCard}>
      {calls.map((call, index) => {
        const spam = call.risk === 'Spam';
        const tone = spam ? c.spam : index === 2 ? c.secondary : c.accentStrong;
        return (
          <TouchableOpacity
            accessibilityLabel={`Open call ${call.name}`}
            key={call.number}
            style={[styles.callRow, spam && styles.spamLeft]}
          >
            <View style={[styles.callAvatar, { backgroundColor: spam ? c.spamContainer : c.primaryContainer }]}>
              <Text style={[styles.callAvatarText, { color: tone }]}>
                {spam ? '?' : call.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
              </Text>
            </View>
            <View style={styles.callInfo}>
              <Text style={styles.callName}>{call.name}</Text>
              <Text style={styles.callNumber}>{call.number}</Text>
              <Text style={styles.callDuration}>◷ 9:14 AM · {index === 0 ? '3m 42s' : index === 1 ? '0m 12s' : '1m 05s'}</Text>
            </View>
            <View style={styles.callMeta}>
              <Text style={[styles.riskPill, { color: tone, backgroundColor: spam ? c.spamContainer : c.primaryContainer }]}>
                {call.risk}
              </Text>
              {spam && <Text style={styles.spamScore}>⚑ 847</Text>}
              <Text style={styles.callTime}>{call.time}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function GoldenGlowText({
  children,
  glowStyle,
  style,
}: {
  children: React.ReactNode;
  glowStyle: object;
  style?: object | object[];
}) {
  return (
    <Animated.Text style={[style, glowStyle]}>
      {children}
    </Animated.Text>
  );
}

function LegendDot({ color, label, styles }: { color: string; label: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.legend}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function NavItem({
  icon,
  label,
  onPress,
  selected,
  styles,
}: {
  icon: string;
  label: 'Protect' | 'History' | 'Profile';
  onPress: () => void;
  selected?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={`Tab ${label}`}
      accessibilityRole="tab"
      accessible
      onPress={onPress}
      style={styles.navItem}
    >
      <View style={selected ? styles.navSelected : undefined}>
        <Text style={[styles.navIcon, selected && styles.navIconSelected]}>{icon}</Text>
      </View>
      {selected ? (
        <Text style={[styles.navLabel, styles.navLabelSelected]}>{label}</Text>
      ) : (
        <Text style={styles.navLabel}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(theme: SkopoTheme) {
  const c = theme.colors;
  const isDark = theme.mode === 'Dark';
  const glowInk = isDark ? '#e88b2e' : '#2d1f13';
  const glowHalo = isDark ? 'rgba(232, 139, 46, 0.9)' : 'rgba(217, 119, 6, 0.28)';
  const glowOnDarkInk = '#ffe06a';
  const glowOnDarkHalo = 'rgba(255, 224, 106, 0.52)';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    content: { padding: 14, paddingBottom: 112 },
    historyTopBar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 14,
      paddingTop: 4,
    },
    iconOnly: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
    topBarIcon: { color: '#17182a', fontSize: 34, fontWeight: '500', lineHeight: 36 },
    screenTitle: { color: '#17182a', fontSize: 27, fontWeight: '900' },
    header: { alignItems: 'center', flexDirection: 'row', paddingBottom: 12, paddingTop: 6 },
    brandMark: {
      alignItems: 'center',
      backgroundColor: c.accentStrong,
      borderRadius: 20,
      height: 48,
      justifyContent: 'center',
      shadowColor: c.accentStrong,
      shadowOpacity: 0.16,
      shadowRadius: 12,
      width: 48,
    },
    brandIcon: { color: '#ffffff', fontSize: 19, fontWeight: '900' },
    brandTextWrap: { flex: 1, marginLeft: 10 },
    brand: { color: c.text, fontSize: 28, fontWeight: '900' },
    caption: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginTop: 1 },
    captionGlow: { color: glowInk, fontSize: 12, fontWeight: '900' },
    goldenGlow: {
      color: glowInk,
      textShadowColor: glowHalo,
      textShadowOffset: { height: 0, width: 0 },
      textShadowRadius: isDark ? 10 : 5,
    },
    goldenGlowOnDark: {
      color: glowOnDarkInk,
      textShadowColor: glowOnDarkHalo,
      textShadowOffset: { height: 0, width: 0 },
      textShadowRadius: 13,
    },
    headerButton: { alignItems: 'center', height: 42, justifyContent: 'center', marginRight: 8, width: 42 },
    headerIcon: { color: c.text, fontSize: 25, fontWeight: '800' },
    badge: {
      alignItems: 'center',
      backgroundColor: c.accentStrong,
      borderRadius: 9,
      height: 18,
      justifyContent: 'center',
      position: 'absolute',
      right: 2,
      top: 1,
      width: 18,
      zIndex: 2,
    },
    badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
    avatar: { alignItems: 'center', backgroundColor: c.primaryContainer, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
    avatarText: { color: c.accentStrong, fontSize: 12, fontWeight: '900' },
    tabStrip: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      marginBottom: 16,
      padding: 5,
    },
    topTab: {
      alignItems: 'center',
      borderRadius: 14,
      flex: 1,
      minHeight: 50,
      justifyContent: 'center',
    },
    topTabSelected: {
      backgroundColor: c.accentStrong,
      shadowColor: c.accentStrong,
      shadowOpacity: 0.14,
      shadowRadius: 9,
    },
    topTabText: { color: c.textMuted, fontSize: 15, fontWeight: '900' },
    topTabTextSelected: { color: '#ffffff' },
    themeRail: { gap: 8, paddingBottom: 14 },
    themeChip: {
      alignItems: 'center',
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      minHeight: 46,
      paddingHorizontal: 10,
      paddingVertical: 8,
      width: 128,
    },
    themeChipSelected: { backgroundColor: c.primaryContainer, borderColor: c.accentStrong },
    swatch: { borderRadius: 7, height: 14, marginRight: 8, width: 14 },
    themeChipText: { color: c.textSoft, flex: 1, fontSize: 11, fontWeight: '900', lineHeight: 13 },
    themeChipTextSelected: { color: c.accentStrong },
    modeText: { color: c.textMuted, fontSize: 10, fontWeight: '800' },
    protectionCard: {
      alignItems: 'center',
      backgroundColor: c.accentStrong,
      borderRadius: 22,
      flexDirection: 'row',
      minHeight: 126,
      overflow: 'hidden',
      padding: 20,
      shadowColor: c.accentStrong,
      shadowOpacity: 0.20,
      shadowRadius: 18,
    },
    pulseWrap: { alignItems: 'center', height: 68, justifyContent: 'center', marginRight: 16, width: 68 },
    pulseOuter: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 34, height: 68, position: 'absolute', width: 68 },
    shieldCircle: {
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderColor: 'rgba(255,255,255,0.42)',
      borderRadius: 28,
      borderWidth: 1,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    shield: { color: '#ffffff', fontSize: 25, fontWeight: '900' },
    protectionText: { flex: 1 },
    protectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    protectionSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600', marginTop: 4 },
    livePill: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 18,
      flexDirection: 'row',
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    liveAmber: { backgroundColor: c.accent, borderRadius: 3, height: 6, marginRight: 6, width: 6 },
    liveText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '900' },
    kpiStrip: { gap: 10, paddingVertical: 16 },
    kpiCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 18,
      borderWidth: 1,
      height: 108,
      justifyContent: 'space-between',
      padding: 14,
      width: 148,
    },
    kpiTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    kpiIcon: { alignItems: 'center', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
    kpiIconText: { fontSize: 17, fontWeight: '900' },
    kpiTrend: { fontSize: 14, fontWeight: '900' },
    kpiValue: { color: c.text, fontSize: 23, fontWeight: '900' },
    kpiLabel: { color: c.textSoft, fontSize: 11, fontWeight: '700' },
    chartCard: { backgroundColor: c.surface, borderColor: c.border, borderRadius: 20, borderWidth: 1, padding: 20 },
    engineCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      shadowColor: c.accentStrong,
      shadowOpacity: isDark ? 0.16 : 0.08,
      shadowRadius: 14,
    },
    rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    cardTitle: { color: c.text, fontSize: 17, fontWeight: '900' },
    cardSub: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
    engineReady: {
      backgroundColor: c.primaryContainer,
      borderRadius: 14,
      color: c.accentStrong,
      fontSize: 11,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    engineGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
    enginePipeline: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginTop: 16,
    },
    engineNode: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderSoft,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      minHeight: 58,
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    engineNodeLabel: { color: c.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    engineNodeValue: { color: c.accentStrong, fontSize: 12, fontWeight: '900', marginTop: 4 },
    engineArrow: { color: c.warning, fontSize: 22, fontWeight: '900' },
    engineChip: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderSoft,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      padding: 10,
    },
    engineLabel: { color: c.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    engineValue: { color: c.text, fontSize: 12, fontWeight: '900', marginTop: 4 },
    engineActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    engineButton: {
      alignItems: 'center',
      backgroundColor: c.accentStrong,
      borderRadius: 16,
      flex: 1,
      justifyContent: 'center',
      minHeight: 46,
    },
    engineButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
    engineButtonSecondary: {
      alignItems: 'center',
      backgroundColor: c.warningContainer,
      borderColor: c.warning,
      borderRadius: 16,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 46,
    },
    engineButtonSecondaryText: { color: c.warning, fontSize: 13, fontWeight: '900' },
    engineSummary: {
      color: c.textSoft,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 19,
      marginTop: 14,
    },
    legendRow: { flexDirection: 'row', gap: 12 },
    legend: { alignItems: 'center', flexDirection: 'row' },
    legendDot: { borderRadius: 5, height: 10, marginRight: 5, width: 10 },
    legendText: { color: c.textSoft, fontSize: 11, fontWeight: '700' },
    chart: { alignItems: 'flex-end', flexDirection: 'row', height: 190, justifyContent: 'space-between', marginTop: 16 },
    dayColumn: { alignItems: 'center', flex: 1 },
    barGroup: { alignItems: 'flex-end', flexDirection: 'row', height: 150 },
    bar: { borderTopLeftRadius: 5, borderTopRightRadius: 5, marginHorizontal: 2, width: 8 },
    dayLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginTop: 8 },
    recentHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
    link: { color: c.accentStrong, fontSize: 13, fontWeight: '900' },
    recentCard: { backgroundColor: c.surface, borderColor: c.borderSoft, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    statsCard: {
      backgroundColor: c.accentStrong,
      borderRadius: 18,
      marginBottom: 12,
      padding: 16,
      shadowColor: c.accentStrong,
      shadowOpacity: 0.16,
      shadowRadius: 14,
    },
    statsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    statsMonth: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
    updatedPill: {
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 14,
      color: '#fff7da',
      fontSize: 11,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    statCell: { alignItems: 'center', flex: 1 },
    statValue: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
    statSpam: { color: '#ffd166' },
    statBlocked: { color: '#ffb86b' },
    statSafe: { color: '#b8f4c9' },
    statLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', marginTop: 4 },
    progressTrack: { borderRadius: 4, flexDirection: 'row', height: 6, marginTop: 16, overflow: 'hidden' },
    progressSegment: { height: 7 },
    progressSafe: { backgroundColor: '#b8f4c9', flex: 5 },
    progressSpam: { backgroundColor: '#ffd166', flex: 4 },
    progressBlocked: { backgroundColor: '#f59e0b', flex: 2 },
    statsNote: { color: 'rgba(255,255,255,0.84)', fontSize: 12, fontWeight: '700', marginTop: 10 },
    filterRail: { gap: 9, paddingBottom: 14 },
    filterPill: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 18,
      borderWidth: 1,
      color: c.textSoft,
      fontSize: 12,
      fontWeight: '800',
      overflow: 'hidden',
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    filterPillActive: {
      backgroundColor: c.primaryContainer,
      borderColor: c.accentStrong,
      color: c.accentStrong,
    },
    historySectionHeader: { marginBottom: 8 },
    sectionTitle: { color: c.textSoft, fontSize: 13, fontWeight: '900' },
    pageHero: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 14,
      padding: 20,
    },
    pageKicker: { color: c.warning, fontSize: 12, fontWeight: '900', letterSpacing: 0, textTransform: 'uppercase' },
    pageTitle: { color: c.text, fontSize: 24, fontWeight: '900', marginTop: 6 },
    pageCopy: { color: c.textSoft, fontSize: 14, fontWeight: '600', lineHeight: 21, marginTop: 8 },
    detailCard: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderSoft,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 14,
      padding: 18,
    },
    detailLine: { color: c.textSoft, fontSize: 14, fontWeight: '700', lineHeight: 23, marginTop: 6 },
    transcriptCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 14,
      padding: 18,
    },
    emptyTranscript: { color: c.textMuted, fontSize: 13, fontWeight: '700', lineHeight: 20, marginTop: 10 },
    turnBubble: {
      borderRadius: 16,
      marginTop: 10,
      padding: 12,
    },
    callerTurn: {
      backgroundColor: c.surfaceAlt,
      borderColor: c.borderSoft,
      borderWidth: 1,
    },
    assistantTurn: {
      backgroundColor: c.primaryContainer,
      borderColor: c.accentStrong,
      borderWidth: 1,
    },
    turnSpeaker: { color: c.textMuted, fontSize: 10, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' },
    turnText: { color: c.text, fontSize: 13, fontWeight: '700', lineHeight: 19 },
    settingsCard: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderRadius: 22,
      borderWidth: 1,
      overflow: 'hidden',
    },
    settingsRow: {
      alignItems: 'center',
      borderBottomColor: c.borderSoft,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 74,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    settingsRowLast: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 74,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    settingTitle: { color: c.text, fontSize: 15, fontWeight: '900' },
    settingSub: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
    settingValue: { color: c.accentStrong, fontSize: 13, fontWeight: '900' },
    callRow: { alignItems: 'center', borderBottomColor: c.borderSoft, borderBottomWidth: 1, flexDirection: 'row', minHeight: 78, paddingHorizontal: 14, paddingVertical: 10 },
    spamLeft: { borderLeftColor: c.spam, borderLeftWidth: 4 },
    callAvatar: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', marginRight: 13, width: 48 },
    callAvatarText: { fontSize: 13, fontWeight: '900' },
    callInfo: { flex: 1 },
    callName: { color: c.text, fontSize: 15, fontWeight: '800' },
    callNumber: { color: c.textSoft, fontSize: 12, fontWeight: '600', marginTop: 2 },
    callDuration: { color: c.textMuted, fontSize: 10, fontWeight: '700', marginTop: 3 },
    callMeta: { alignItems: 'flex-end' },
    riskPill: { borderRadius: 10, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
    spamScore: { color: c.spam, fontSize: 10, fontWeight: '900', marginTop: 6 },
    callTime: { color: c.textMuted, fontSize: 11, fontWeight: '700', marginTop: 5 },
    lookupFab: {
      alignItems: 'center',
      backgroundColor: c.accentStrong,
      borderColor: isDark ? c.border : 'transparent',
      borderRadius: 18,
      borderWidth: isDark ? 1 : 0,
      bottom: 82,
      flexDirection: 'row',
      paddingHorizontal: 18,
      paddingVertical: 14,
      position: 'absolute',
      right: 18,
    },
    lookupIcon: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginRight: 8 },
    lookupText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
    nav: {
      alignItems: 'center',
      backgroundColor: c.surface,
      borderTopColor: c.border,
      borderTopWidth: 1,
      bottom: 0,
      flexDirection: 'row',
      height: 72,
      justifyContent: 'space-around',
      left: 0,
      position: 'absolute',
      right: 0,
    },
    navItem: { alignItems: 'center', flex: 1 },
    navSelected: { backgroundColor: '#e4efff', borderRadius: 22, paddingHorizontal: 22, paddingVertical: 7 },
    navIcon: { color: c.textMuted, fontSize: 19, fontWeight: '900' },
    navIconSelected: { color: c.accentStrong },
    navLabel: { color: c.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },
    navLabelSelected: { color: c.accentStrong, fontWeight: '900' },
  });
}

export default SkopoCallScanApp;
