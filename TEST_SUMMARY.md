# Test Summary - India First Call Assistant MVP

Generated on: 2026-04-27  
Environment: Android Emulator `codex_api35(AVD) - 15` + local FastAPI simulator backend

## 1) Automated UI Test Results

Source:
- Android XML report: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/android-test-app/app/build/outputs/androidTest-results/connected/debug/TEST-codex_api35(AVD) - 15-_app-.xml`
- HTML report: `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/android-test-app/app/build/reports/androidTests/connected/debug/com.example.callassistantsim.MainActivityUiTest.html`

Result summary:
- Total tests: `3`
- Passed: `3`
- Failed: `0`
- Skipped: `0`
- Suite time (XML): `12.981s`

Executed test cases:
1. `initialScreenElements_areVisible` - passed (`3.630s`)
2. `inputs_areEditable` - passed (`3.461s`)
3. `e2e_simulatedCallFlow_backendIntegration` - passed (`4.497s`)

## 2) End-to-End Call Capture (From E2E Test)

Latest E2E call SID: `SIM-23581e51d7`  
Status: `completed`

### Captured Details

| Field | Captured Value |
|---|---|
| caller_name | Rahul Sharma |
| company | HDFC Bank |
| subject | My name is Rahul Sharma from HDFC Bank. This is urgent. Call me at 9876543210 |
| urgency | high |
| callback_number | 9876543210 |

### AI Summary Generated

`Caller: Rahul Sharma, Company: HDFC Bank, Subject: My name is Rahul Sharma from HDFC Bank. This is urgent. Call me at 9876543210, Urgency: high, Callback: 9876543210.`

### Transcript (Readable)

1. Assistant: Hi, you've reached Alex's assistant. May I know who's calling and what this is regarding?
2. Caller: My name is Rahul Sharma from HDFC Bank. This is urgent. Call me at 9876543210
3. Assistant: Thanks, I will pass this along.

## 3) Recent Simulator Call Snapshot

Pulled from `GET /api/sim/calls?limit=20`.

| Call SID | Status | Caller | Company | Urgency | Callback | User Action |
|---|---|---|---|---|---|---|
| SIM-23581e51d7 | completed | Rahul Sharma | HDFC Bank | high | 9876543210 | - |
| SIM-d2745da61f | completed | Rahul Sharma | HDFC Bank | high | 9876543210 | - |
| SIM-b0c38d698a | completed | - | - | - | - | - |
| SIM-56371c7fec | completed | - | - | - | - | callback |
| SIM-5641cc3d9b | completed | - | - | - | - | allow |
| SIM-fdafb13c51 | active | - | - | - | - | allow |
| SIM-4472fa963e | completed | Rahul Sharma | HDFC Bank | high | 9876543210 | callback |

## 4) What This Confirms

- Android UI automation is stable and repeatable from CLI.
- End-to-end UI -> backend simulator flow works.
- Key caller metadata extraction is functioning for structured spam-like input.
- Summary generation and transcript storage are working.

## 5) Known Gaps (Current MVP State)

- STT/TTS in production mode are still placeholders (Deepgram/ElevenLabs not wired for real audio yet).
- Some simulated calls in history contain only greeting turns (expected from earlier manual runs).
