import {
  SkopoCallSession,
  SkopoCallerInfo,
  SkopoLanguageCode,
  SkopoLlmDecision,
} from './types';

const TELUGU_RE = /[\u0C00-\u0C7F]/;
const HINDI_RE = /[\u0900-\u097F]/;

export function detectSkopoLanguage(text: string): SkopoLanguageCode {
  if (TELUGU_RE.test(text)) return 'te-IN';
  if (HINDI_RE.test(text)) return 'hi-IN';
  return 'en-IN';
}

function mergeInfo(current: SkopoCallerInfo, text: string): SkopoCallerInfo {
  const lower = text.toLowerCase();
  const info: SkopoCallerInfo = { ...current };

  const nameMatch =
    text.match(/(?:my name is|this is|i am|నేను|मेरा नाम)\s+([A-Za-z\u0900-\u097F\u0C00-\u0C7F ]{2,32})/i);
  if (!info.callerName && nameMatch?.[1]) {
    info.callerName = nameMatch[1].replace(/[,.].*$/, '').trim();
  }

  const callbackMatch = text.match(/(?:\+91[-\s]?)?[6-9]\d{9}/);
  if (!info.callbackNumber && callbackMatch?.[0]) {
    info.callbackNumber = callbackMatch[0].replace(/\s+/g, '');
  }

  if (!info.company) {
    const companyMatch = text.match(/(?:from|company|bank|courier|delivery|నుంచి|से)\s+([A-Za-z\u0900-\u097F\u0C00-\u0C7F &.-]{2,40})/i);
    if (companyMatch?.[1]) info.company = companyMatch[1].replace(/[,.].*$/, '').trim();
  }

  if (!info.subject) {
    if (lower.includes('otp') || text.includes('ఓటీపీ')) info.subject = 'OTP or delivery verification';
    else if (lower.includes('loan') || lower.includes('credit card')) info.subject = 'Financial offer';
    else if (lower.includes('delivery') || lower.includes('courier')) info.subject = 'Courier delivery';
    else if (lower.includes('urgent') || text.includes('అర్జెంట్') || text.includes('तुरंत')) info.subject = 'Urgent callback request';
  }

  if (!info.urgency) {
    if (lower.includes('urgent') || lower.includes('emergency') || text.includes('అర్జెంట్') || text.includes('तुरंत')) {
      info.urgency = 'high';
    } else if (lower.includes('today') || text.includes('ఈరోజు') || text.includes('आज')) {
      info.urgency = 'medium';
    } else {
      info.urgency = 'low';
    }
  }

  return info;
}

function missingPrompt(info: SkopoCallerInfo, languageCode: SkopoLanguageCode): string {
  const missing = [
    !info.callerName && 'name',
    !info.company && 'company',
    !info.subject && 'reason',
    !info.callbackNumber && 'callback number',
  ].filter(Boolean);

  if (languageCode === 'te-IN') {
    if (missing.includes('name')) return 'మీ పేరు చెప్పగలరా? మీరు ఏ విషయం కోసం కాల్ చేస్తున్నారు?';
    if (missing.includes('callback number')) return 'ధన్యవాదాలు. తిరిగి కాల్ చేయడానికి మీ నంబర్ చెప్పగలరా?';
    return 'ఇది ఎంత అత్యవసరం? నేను వివరాలు పంపిస్తాను.';
  }

  if (languageCode === 'hi-IN') {
    if (missing.includes('name')) return 'कृपया अपना नाम बताइए। आप किस बारे में कॉल कर रहे हैं?';
    if (missing.includes('callback number')) return 'धन्यवाद। वापस कॉल करने के लिए आपका नंबर क्या है?';
    return 'यह कितना ज़रूरी है? मैं विवरण आगे भेज दूँगा।';
  }

  if (missing.includes('name')) return 'May I know your name and what this is regarding?';
  if (missing.includes('callback number')) return 'Thanks. What number should Alex call back on?';
  return 'How urgent is this? I will pass the details along.';
}

export class LocalTinyLlmAdapter {
  readonly provider = 'tiny-local' as const;
  readonly mode = 'simulated' as const;

  async decide(session: SkopoCallSession, callerText: string): Promise<SkopoLlmDecision> {
    const languageCode = detectSkopoLanguage(callerText);
    const callerInfo = mergeInfo(session.callerInfo, callerText);
    const complete = Boolean(
      callerInfo.callerName &&
      callerInfo.subject &&
      callerInfo.urgency &&
      callerInfo.callbackNumber,
    );

    const suggestedAction =
      callerInfo.subject?.toLowerCase().includes('loan') ||
      callerInfo.subject?.toLowerCase().includes('financial offer')
        ? 'block'
        : callerInfo.urgency === 'high'
          ? 'callback'
          : 'allow';

    const summary = [
      callerInfo.callerName || 'Unknown caller',
      callerInfo.company ? `from ${callerInfo.company}` : '',
      callerInfo.subject ? `called about ${callerInfo.subject}` : 'has not explained the reason yet',
      callerInfo.urgency ? `Urgency: ${callerInfo.urgency}` : '',
    ].filter(Boolean).join(' ');

    return {
      callerInfo,
      complete,
      languageCode,
      replyText: complete ? this.goodbye(languageCode) : missingPrompt(callerInfo, languageCode),
      suggestedAction,
      summary,
    };
  }

  private goodbye(languageCode: SkopoLanguageCode): string {
    if (languageCode === 'te-IN') return 'ధన్యవాదాలు. ఈ వివరాలను నేను వెంటనే పంపిస్తాను.';
    if (languageCode === 'hi-IN') return 'धन्यवाद। मैं ये जानकारी अभी भेज दूँगा।';
    return "Thanks, I'll pass this along now.";
  }
}
