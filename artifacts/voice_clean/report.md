# Voice Cleanup Report

- Source: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/raw_voice.wav`
- Original duration: 9.17 min (550.0s)
- Cleaned compact speech duration: 8.77 min (526.0s)
- Silence/noise removed estimate: 0.40 min
- Clips generated: 66
- Clips kept (>=2s): 66
- Clips dropped (<2s): 0
- Estimated trainable speech (kept clips): 8.77 min (526.0s)

## Files
- Cleaned audio: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_clean/cleaned_compact.wav`
- Clip folder: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_clean/clips/`
- Manifest: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_clean/manifest.csv`

## Next recommended step
1. Manually review top 30-40 clips for background disturbances and delete bad ones.
2. Create transcripts for remaining clips (or run Whisper + manual correction).
3. Start speaker adaptation training once >=15 min clean curated speech is available.
