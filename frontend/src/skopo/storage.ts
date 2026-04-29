import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkopoCallSession } from './types';

const SESSION_PREFIX = '@skopo.callSession.';
const SESSION_INDEX = '@skopo.callSession.index.v1';

export async function saveSkopoSession(session: SkopoCallSession): Promise<void> {
  const raw = await AsyncStorage.getItem(SESSION_INDEX);
  const ids = raw ? JSON.parse(raw) as string[] : [];
  const nextIds = [session.id, ...ids.filter((id) => id !== session.id)].slice(0, 50);
  await AsyncStorage.multiSet([
    [`${SESSION_PREFIX}${session.id}`, JSON.stringify(session)],
    [SESSION_INDEX, JSON.stringify(nextIds)],
  ]);
}

export async function loadLatestSkopoSession(): Promise<SkopoCallSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_INDEX);
  const ids = raw ? JSON.parse(raw) as string[] : [];
  const first = ids[0];
  if (!first) return null;
  const sessionRaw = await AsyncStorage.getItem(`${SESSION_PREFIX}${first}`);
  return sessionRaw ? JSON.parse(sessionRaw) as SkopoCallSession : null;
}
