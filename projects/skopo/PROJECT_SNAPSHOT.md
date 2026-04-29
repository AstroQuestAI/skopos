# Skopo Project Snapshot

Saved from:

`/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that`

Saved as:

`/Users/apple/Documents/Codex/2026-04-27/skopo`

Current scope:

- Skopo mobile facade app.
- Android package: `com.assistant.skopo`.
- Active entry path: `frontend/app/index.tsx`.
- Local facade demo: Tiny local LLM route + OmniVoice target simulation.
- The app does not directly handle cellular calls; it is the mobile facade for the call workflow running behind the web app/service layer.

Latest smoke report copied with the project:

`artifacts/mobile-smoke/latest.html`

To rebuild locally:

```sh
cd /Users/apple/Documents/Codex/2026-04-27/skopo/frontend
npm install
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
cd android
./gradlew :app:assembleRelease
```
