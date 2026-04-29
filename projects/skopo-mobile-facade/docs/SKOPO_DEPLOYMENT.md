# Skopo Deployment Notes

Skopo is a separate native Android MVP for call-assistant workflows.
It is not AstroQuest/Vidhaata, and it must not depend on the AstroQuest
astrology backend.

The product direction is local-first, with Skopo-specific server components
available only as optional helpers:

- OmniVoice for assistant voice workflows.
- Local/mobile LLM for spoken input processing and call intent handling.
- In-app storage for calls, transcripts, preferences, and summaries.
- A separate Skopo backend/sidecar may run server-side LLM and OmniVoice for
  heavier MVP testing, demos, or fallback paths.

## Current Deploy Lane

1. Build the Android release APK.

   ```bash
   cd frontend/android
   ./gradlew :app:assembleRelease
   ```

2. Install locally on an attached Android device or emulator.

   ```bash
   ~/Library/Android/sdk/platform-tools/adb install -r frontend/android/app/build/outputs/apk/release/app-release.apk
   ~/Library/Android/sdk/platform-tools/adb shell am start -n com.assistant.skopo/.MainActivity
   ```

3. Run the automated Green Gold UI proof.

   ```bash
   make complete-ui-skin-tests
   ```

4. Use the staged APK for manual phone testing.

   ```text
   artifacts/deploy/skopo-green-gold-release.apk
   ```

## Current UI Baseline

- Skin: Green Gold Light only
- Main pages: Protect, History, Profile
- Latest UI proof report:

  ```text
  artifacts/complete-ui-skin-tests/latest.html
  ```

## Backend Boundary

Do not use the AstroQuest/Vidhaata backend for Skopo.

Skopo's backend, when used, is a separate call-assistant service. It should
have its own package name, env vars, routes, Dockerfile, and database/storage
boundary. That service is only for call sessions, server-side LLM routing,
OmniVoice/STT/TTS workflows, classification, local/offline sync, and assistant
settings.

The old Vidhaata backend files were moved out of this Skopo workspace into:

```text
../vidhaata-backend-project
```

Do not wire Skopo mobile screens to those astrology routes. If Skopo backend
files are added here, keep them under a clearly separate path such as
`skopo-backend/` or `services/skopo-call-assistant/`.

## Notes

The current Android package id is:

```text
com.assistant.skopo
```
