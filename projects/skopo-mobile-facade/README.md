# Skopo

Skopo is an India-first call assistant app. This workspace is now for the
Skopo mobile experience and its Skopo-specific call-assistant components.

## Product Boundary

- Skopo is not AstroQuest/Vidhaata.
- Skopo must not call or depend on the Vidhaata astrology backend.
- Skopo data should stay local-first for the MVP.
- Voice direction: OmniVoice.
- Intelligence direction: local/mobile LLM first, with optional Skopo-specific
  backend/sidecars for heavier LLM, STT, TTS, and demo workflows.

## Current App

- Mobile shell: `frontend/`
- Skopo UI: `frontend/src/components/SkopoCallScanApp.tsx`
- Skopo themes: `frontend/src/skopo/themes.ts`
- Deployment notes: `docs/SKOPO_DEPLOYMENT.md`

## Separated Vidhaata Backend

The old Vidhaata/AstroQuest backend artifacts were moved out of this Skopo
workspace into:

```text
../vidhaata-backend-project
```

Keep Vidhaata backend work there. Keep Skopo call-assistant work here.
