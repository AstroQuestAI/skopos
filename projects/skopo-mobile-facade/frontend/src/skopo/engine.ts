import { LocalTinyLlmAdapter } from './localTinyLlm';
import { OmniVoiceAdapter } from './omnivoice';
import { saveSkopoSession } from './storage';
import { SkopoCallSession, SkopoEngineStatus, SkopoLanguageCode, SkopoTurn } from './types';

const llm = new LocalTinyLlmAdapter();
const voice = new OmniVoiceAdapter();

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `skopo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function getSkopoEngineStatus(): SkopoEngineStatus {
  return {
    llm: { provider: llm.provider, mode: llm.mode, ready: true },
    voice: { provider: voice.provider, mode: voice.mode, ready: true },
    storage: { provider: 'async-storage', ready: true },
  };
}

export function createSkopoSession(
  fromNumber = '+91 98765 43210',
  toNumber = '+91 90000 00000',
): SkopoCallSession {
  const at = nowIso();
  return {
    id: newId(),
    fromNumber,
    toNumber,
    status: 'screening',
    startedAt: at,
    updatedAt: at,
    languageCode: 'auto',
    callerInfo: {},
    transcript: [],
  };
}

export async function runSkopoTurn(
  session: SkopoCallSession,
  callerText: string,
  languageCode: SkopoLanguageCode = 'auto',
): Promise<SkopoCallSession> {
  const at = nowIso();
  const callerTurn: SkopoTurn = { speaker: 'caller', text: callerText, languageCode, at };
  const decision = await llm.decide(
    { ...session, transcript: [...session.transcript, callerTurn] },
    callerText,
  );
  const spoken = await voice.speak(decision.replyText, decision.languageCode);
  const assistantTurn: SkopoTurn = {
    speaker: 'assistant',
    text: spoken.text,
    languageCode: spoken.languageCode,
    at: nowIso(),
  };

  const next: SkopoCallSession = {
    ...session,
    callerInfo: decision.callerInfo,
    languageCode: decision.languageCode,
    status: decision.complete ? 'complete' : 'screening',
    suggestedAction: decision.suggestedAction,
    summary: decision.summary,
    transcript: [...session.transcript, callerTurn, assistantTurn],
    updatedAt: nowIso(),
  };
  await saveSkopoSession(next);
  return next;
}

export async function runSkopoDemoConversation(): Promise<SkopoCallSession> {
  let session = createSkopoSession();
  session = await runSkopoTurn(session, 'This is Priya from Express Rider courier. I am calling about delivery OTP today.', 'en-IN');
  session = await runSkopoTurn(session, 'My callback number is 9876543210. It is not urgent.', 'en-IN');
  return session;
}
