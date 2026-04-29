export type SkopoLanguageCode = 'en-IN' | 'hi-IN' | 'te-IN' | 'auto';

export type SkopoTurn = {
  speaker: 'caller' | 'assistant';
  text: string;
  languageCode: SkopoLanguageCode;
  at: string;
};

export type SkopoCallerInfo = {
  callerName?: string;
  company?: string;
  subject?: string;
  urgency?: 'low' | 'medium' | 'high';
  callbackNumber?: string;
};

export type SkopoCallSession = {
  id: string;
  fromNumber: string;
  toNumber: string;
  status: 'screening' | 'complete';
  startedAt: string;
  updatedAt: string;
  languageCode: SkopoLanguageCode;
  callerInfo: SkopoCallerInfo;
  transcript: SkopoTurn[];
  summary?: string;
  suggestedAction?: 'allow' | 'block' | 'callback';
};

export type SkopoLlmDecision = {
  replyText: string;
  languageCode: SkopoLanguageCode;
  callerInfo: SkopoCallerInfo;
  complete: boolean;
  summary: string;
  suggestedAction: 'allow' | 'block' | 'callback';
};

export type SkopoVoiceResult = {
  engine: 'omnivoice';
  mode: 'simulated' | 'native';
  audioUri?: string;
  text: string;
  languageCode: SkopoLanguageCode;
};

export type SkopoEngineStatus = {
  llm: {
    provider: 'tiny-local';
    mode: 'simulated' | 'native';
    ready: boolean;
  };
  voice: {
    provider: 'omnivoice';
    mode: 'simulated' | 'native';
    ready: boolean;
  };
  storage: {
    provider: 'async-storage';
    ready: boolean;
  };
};
