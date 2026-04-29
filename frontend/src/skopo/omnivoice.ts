import { Platform } from 'react-native';
import { SkopoLanguageCode, SkopoVoiceResult } from './types';

export class OmniVoiceAdapter {
  readonly provider = 'omnivoice' as const;
  readonly mode = 'simulated' as const;

  async speak(text: string, languageCode: SkopoLanguageCode): Promise<SkopoVoiceResult> {
    return {
      engine: 'omnivoice',
      mode: Platform.OS === 'android' ? 'simulated' : 'simulated',
      text,
      languageCode,
    };
  }

  async transcribeTextForSimulator(text: string, languageCode: SkopoLanguageCode = 'auto') {
    return { text, languageCode };
  }
}
