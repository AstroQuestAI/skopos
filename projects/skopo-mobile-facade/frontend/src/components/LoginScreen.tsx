/**
 * LoginScreen — v9.0 cosmic rewrite.
 *
 * Google sign-in landing modal. Painted on the cosmic glass aesthetic
 * (deep-cosmic backdrop + frosted glass card + dull glossy gold title).
 * The actual Google button is still rendered by GIS itself for trust.
 */
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform, Image,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { renderGoogleButton, GOOGLE_CLIENT_ID } from '../utils/googleAuth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SRI_CHAKRAM = require('../../assets/cosmic/sri-chakram.png');

export interface LoginScreenProps {
  language: 'en' | 'te';
  setLanguage: (l: 'en' | 'te') => void;
  /** Fired with the Google-signed ID token (JWT) once the user picks an
   *  account. Parent exchanges it for our session via /api/auth/google-login. */
  onCredential: (idToken: string) => void;
  /** --- back-compat (deprecated) --- */
  onGuestContinue?: () => void;
  onGoogleLogin?: () => void;
  onDevLogin?: (sessionToken: string, user: { email: string; name: string }) => void;
  styles?: any;
}

const C = theme.cosmic;
const isWeb = Platform.OS === 'web';

const LoginScreenInner: React.FC<LoginScreenProps> = ({
  language, setLanguage, onCredential,
}) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'signing-in' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const mountRef = React.useRef<HTMLDivElement | null>(null);
  const hasRendered = React.useRef(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      setStatus('idle');
      return;
    }
    if (!GOOGLE_CLIENT_ID) {
      setStatus('error');
      setError(language === 'en'
        ? 'Google sign-in not configured on this build.'
        : 'ఈ బిల్డ్‌లో Google సైన్ ఇన్ కాన్ఫిగర్ చేయబడలేదు.');
      return;
    }

    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById('astroquest-gis-btn-mount') as HTMLDivElement | null;
      if (el && !hasRendered.current) {
        hasRendered.current = true;
        clearInterval(timer);
        mountRef.current = el;
        renderGoogleButton(
          el,
          (idToken) => { setStatus('signing-in'); onCredential(idToken); },
          (msg) => { setStatus('error'); setError(msg); },
          { width: 320 },
        ).then(() => {
          if (status !== 'error' && status !== 'signing-in') setStatus('idle');
        });
      } else if (tries++ > 30) {
        clearInterval(timer);
        if (!hasRendered.current) {
          setStatus('error');
          setError('Could not attach Google sign-in.');
        }
      }
    }, 100);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={s.container}>
      {/* Solid deep-cosmic backdrop covers any modal-default white. */}
      <View pointerEvents="none" style={s.backdrop} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Image source={SRI_CHAKRAM} style={s.chakram} accessibilityLabel="Sri Chakram" />
          <Text style={[s.title, isWeb && (web.title as any)]}>Vidhaata</Text>
          <Text style={s.subtitle}>
            {language === 'en'
              ? 'Classical Vedic horoscopes, muhurtas & your AI guru.'
              : 'శాస్త్రీయ జాతకాలు, ముహూర్తాలు, మీ AI గురువు.'}
          </Text>
        </View>

        {/* v9.6 — language toggle removed from the login screen. The
            user can pick a language from Settings → UI Settings after
            sign-in. Keeping a tiny "English" badge for visual rhythm. */}

        {/* GIS-rendered Google button */}
        {isWeb ? (
          <View style={s.gisMountWrap}>
            {React.createElement('div', {
              id: 'astroquest-gis-btn-mount',
              style: { display: 'flex', justifyContent: 'center' },
            })}
            {status === 'loading' ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={s.loadingText}>
                  {language === 'en' ? 'Preparing Google sign-in…' : 'Google సైన్-ఇన్ సిద్ధమవుతోంది…'}
                </Text>
              </View>
            ) : null}
            {status === 'signing-in' ? (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={s.loadingText}>
                  {language === 'en' ? 'Signing in…' : 'సైన్ ఇన్ అవుతోంది…'}
                </Text>
              </View>
            ) : null}
            {status === 'error' && error ? (
              <Text style={s.errText}>{error}</Text>
            ) : null}
          </View>
        ) : (
          <View style={s.nativeFallback}>
            <Ionicons name="warning-outline" size={18} color={C.cream65} />
            <Text style={s.nativeFallbackText}>
              {language === 'en'
                ? 'This build only supports web sign-in. Please open the PWA in a browser.'
                : 'ఈ బిల్డ్ కేవలం వెబ్ సైన్ ఇన్ సపోర్ట్ చేస్తుంది. దయచేసి బ్రౌజర్‌లో PWA తెరవండి.'}
            </Text>
          </View>
        )}

        {/* Coming soon — glass chips */}
        <View style={s.comingRow}>
          {['logo-facebook', 'logo-whatsapp', 'call'].map((n, i) => (
            <View key={i} style={s.comingPill}>
              <Ionicons name={n as any} size={13} color={C.cream65} />
              <Text style={s.comingText}>
                {n === 'logo-facebook' ? 'Facebook' : n === 'logo-whatsapp' ? 'WhatsApp' : 'Phone'}
              </Text>
            </View>
          ))}
        </View>
        <Text style={s.comingCaption}>
          {language === 'en' ? 'Facebook, WhatsApp & phone sign-in — coming soon.' : 'Facebook, WhatsApp, ఫోన్ — త్వరలో.'}
        </Text>

        <Text style={s.fine}>
          {language === 'en'
            ? 'Signing in starts your 7-day free trial. All chart data is kept private to your Google account.'
            : 'సైన్ ఇన్ చేస్తే 7-రోజుల ఉచిత ట్రయల్ ప్రారంభమవుతుంది. మీ డేటా Google ఖాతాతో మాత్రమే అనుసంధానం.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export const LoginScreen = React.memo(LoginScreenInner);
export default LoginScreen;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bgDeep },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: C.bgDeep },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 28 },

  hero: { alignItems: 'center', marginBottom: 28 },
  chakram: { width: 96, height: 96, resizeMode: 'contain' },
  title: {
    fontSize: 32, fontWeight: '800', color: C.goldHi,
    marginTop: 14, letterSpacing: 0.4,
    fontFamily: Platform.select({
      web: '"Plus Jakarta Sans", "Cinzel", Georgia, serif',
      default: undefined,
    }),
  },
  subtitle: {
    fontSize: 14, color: C.cream65, marginTop: 8,
    textAlign: 'center', lineHeight: 20, paddingHorizontal: 12,
  },

  langRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 26, gap: 8 },
  langPill: {
    paddingHorizontal: 18, paddingVertical: 8,
    backgroundColor: C.glassSoft, borderRadius: 999,
    borderWidth: 1, borderColor: C.cream10,
  },
  langPillActive: {
    backgroundColor: 'rgba(232,201,106,0.18)',
    borderColor: C.goldLine,
  },
  langText:       { color: C.cream65, fontWeight: '700', fontSize: 13 },
  langTextActive: { color: C.goldHi },

  gisMountWrap: {
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
  },
  loadingText: { fontSize: 12, color: C.cream65 },
  errText: {
    marginTop: 10, fontSize: 12, color: C.terracottaLight,
    textAlign: 'center', paddingHorizontal: 16,
  },

  nativeFallback: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.cream10,
  },
  nativeFallbackText: {
    flex: 1, fontSize: 12, color: C.cream65, lineHeight: 17,
  },

  comingRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 26,
  },
  comingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: C.glassSoft,
    borderWidth: 1, borderColor: C.cream10,
  },
  comingText: { fontSize: 11, color: C.cream65, fontWeight: '600' },
  comingCaption: {
    textAlign: 'center', fontSize: 11, color: C.cream45,
    marginTop: 8, letterSpacing: 0.2,
  },
  fine: {
    marginTop: 26, fontSize: 11, color: C.cream45,
    textAlign: 'center', lineHeight: 16, paddingHorizontal: 12,
  },
});

const web = {
  title: {
    backgroundImage: 'linear-gradient(180deg, #E8B86A 0%, #C9A04A 55%, #8A5A1F 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 1px 0 rgba(255,235,170,0.22)',
  },
};
