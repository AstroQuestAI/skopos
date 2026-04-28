# AI Call Screener (India-first)

FastAPI backend scaffold for this flow:

1. Unknown caller hits Twilio number.
2. `/api/incoming-call` returns TwiML to open a Media Stream WebSocket.
3. WebSocket loop collects caller context (`caller_name`, `company`, `subject`, `urgency`, `callback_number`).
4. Session is summarized and persisted in MongoDB (or in-memory fallback).
5. Push notifier sends call summary payload to your app/backend webhook.

## Project layout

- `app/main.py`: FastAPI entrypoint
- `app/routes/calls.py`: call webhook + Twilio media stream handler
- `app/services/orchestrator.py`: session state machine
- `app/services/providers/`: Deepgram, OpenAI, ElevenLabs, Mongo, notifier adapters

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Twilio setup

1. Expose local app:
```bash
ngrok http 8000
```
2. Set `APP_PUBLIC_BASE_URL` in `.env` to the ngrok HTTPS URL.
3. In Twilio number voice config:
- Voice webhook: `POST https://<ngrok>/api/incoming-call`
- Status callback: `POST https://<ngrok>/api/call-status`

## Current integration status

- Session orchestration: implemented
- OpenAI dialog extraction: implemented with JSON output
- Mongo persistence: implemented with in-memory fallback
- Push notifications: implemented with webhook fallback stub
- Deepgram real-time STT: adapter placeholder (or local sidecar mode)
- ElevenLabs real-time TTS: adapter placeholder (or local sidecar mode)

## Local voice sidecar (Piper TTS + Whisper STT)

This repo supports a low-cost local voice stack with Docker sidecar:

- TTS: Piper
- STT: faster-whisper (Whisper model)

The API automatically uses sidecar when `VOICE_SIDECAR_URL` is set.

Language-aware sidecar payloads are supported:

- `POST /tts/mulaw-b64` with `{ "text": "...", "language_code": "hi_IN" }` or `te_IN`
- `POST /stt/transcribe-mulaw-b64` with `{ "audio_b64": "...", "language_code": "hi_IN" }` or `te_IN`

If `language_code` is omitted, sidecar defaults to English.

## LLM sidecar (swappable model component)

Backend now supports a dedicated LLM sidecar service:

- API contract: OpenAI-compatible `POST /v1/chat/completions`
- Sidecar health: `GET /health`
- App points to sidecar via `LOCAL_LLM_API_URL=http://llm-sidecar:8095`

You can swap model backends without app code changes:

- `LLM_SIDECAR_BACKEND=openai_compatible|ollama`
- `LLM_SIDECAR_UPSTREAM_URL=...` (optional real model endpoint)
- `LLM_SIDECAR_MODEL=...`

If upstream is unavailable, sidecar falls back to heuristic JSON decision so flow stays functional.

### Performance tuning knobs

LLM path:

- `LOCAL_LLM_MAX_TRANSCRIPT_TURNS` (default `12`)
- `LOCAL_LLM_MAX_TRANSCRIPT_CHARS` (default `2200`)
- `LOCAL_LLM_HTTP_KEEPALIVE` / `LOCAL_LLM_HTTP_MAX_CONNECTIONS`
- `LLM_SIDECAR_MAX_CONCURRENT_REQUESTS` (default `4`)
- `LLM_SIDECAR_UPSTREAM_MAX_RETRIES` (default `1`)
- `LLM_SIDECAR_CACHE_ENABLED` + `LLM_SIDECAR_CACHE_TTL_SECONDS`

Voice sidecar path:

- `VOICE_TTS_MAX_CHARS` (default `400`)
- `VOICE_STT_MAX_AUDIO_SECONDS` (default `90`)
- `VOICE_MAX_CONCURRENT_TTS` / `VOICE_MAX_CONCURRENT_STT` (defaults `1`)
- `PIPER_TIMEOUT_SECONDS` (default `20`)
- `WHISPER_COMPUTE_TYPE` (`int8` for speed/stability)
- `WHISPER_VAD_MIN_SILENCE_MS` (default `500`)
- `GOOGLE_TTS_ENABLED=true` (fallback path for TTS)
- `GOOGLE_TTS_LANGUAGE_CODE=en-IN` (or `hi-IN`, `te-IN`)
- `GOOGLE_TTS_VOICE_NAME=en-IN-Standard-C`
- `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json` (ADC auth for Google SDK)

Suggested presets:

- Faster: keep `int8`, lower `VOICE_STT_MAX_AUDIO_SECONDS` to `45`, keep retries low.
- Better quality: raise Whisper model (`small`/`medium`) and increase timeout/concurrency cautiously.

## Zero-cost simulator mode

This MVP can be tested without Twilio/Deepgram/ElevenLabs.

- `POST /api/sim/start`: start a simulated call
- `POST /api/sim/turn`: send caller text and receive assistant reply
- `POST /api/sim/end`: finalize a call
- `GET /api/sim/calls`: list call sessions
- `GET /api/sim/calls/{call_sid}`: get call detail
- `POST /api/sim/calls/{call_sid}/action`: set `allow`, `block`, or `callback`

## Local-first LLM router (generic + dialer modes)

Backend LLM behavior is routed through a local-first provider:

- `APP_MODE=generic|dialer`
- `LLM_STRATEGY=local_first|local_only|cloud_only`
- `LOCAL_LLM_ENABLED=true|false`
- `LOCAL_LLM_BACKEND=openai_compatible|ollama`
- `LOCAL_LLM_API_URL=http://127.0.0.1:11434` (ollama) or local llama.cpp-compatible URL
- `LOCAL_LLM_TIMEOUT_SECONDS=12`
- `LOCAL_LLM_CONFIDENCE_THRESHOLD=0.72`

When `LOCAL_LLM_API_URL` is set, backend calls a real on-device model adapter first.
If unavailable or low-confidence, router falls back to cloud/local heuristic per strategy.
This keeps one shared backend core for both app variants.

Sample:

```bash
curl -X POST http://127.0.0.1:8000/api/sim/start \
  -H "Content-Type: application/json" \
  -d '{"from_number":"+919999999999","to_number":"+911111111111"}'
```

```bash
curl -X POST http://127.0.0.1:8000/api/sim/turn \
  -H "Content-Type: application/json" \
  -d '{"call_sid":"SIM-xxxx","caller_text":"Hi my name is Rahul from HDFC. This is urgent. Call me at 9876543210"}'
```

## Android test app (local emulator)

Project path: `android-test-app`

1. Keep backend running on host machine at `0.0.0.0:8000`
2. Open `android-test-app` in Android Studio
3. Let Gradle sync
4. Run on Android emulator

The app uses `http://10.0.2.2:8000` (emulator -> host loopback), and supports:

- Start simulated call
- Send caller turns
- End call
- View recent calls
- Set quick actions (`allow`, `block`, `callback`)

## Containerized local run (Docker)

Files added:

- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`

Start local stack (API + Mongo):

```bash
docker-compose up -d --build
docker-compose ps
```

Local container endpoints:

- API health: `http://127.0.0.1:8010/health`
- Simulator API: `http://127.0.0.1:8010/api/sim/*`
- Voice sidecar health: `http://127.0.0.1:8090/health`

Smoke test:

```bash
curl -s http://127.0.0.1:8010/health
curl -s -X POST http://127.0.0.1:8010/api/sim/start \
  -H "Content-Type: application/json" \
  -d '{"from_number":"+919900001111","to_number":"+911234567890"}'

make test-voice-sidecar
```

Stop stack:

```bash
docker-compose down
```

### Makefile shortcuts

Dev:

```bash
make up
make ps
make test
make test-voice-sidecar
make logs
make down
```

Staging (local Docker):

```bash
make up-staging
make ps-staging
make test-staging
make test-voice-sidecar-staging
make logs-staging
make down-staging
```

## Voice Lab demo mode (emulator)

Run this to auto-prepare demo state:

```bash
/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/scripts/run-voice-lab-demo.sh +919887766554
```

What it does:
- checks emulator + backend health
- installs latest debug APK
- grants mic/call/notification permissions
- launches app
- triggers incoming emulator call, waits, then cancels call

Then in app:
1. Tap `Voice Lab Start`
2. Tap `Voice Lab Listen`
3. Speak as caller; assistant replies with voice

## Docker Swarm deployment

Swarm stack file:

- `deploy/swarm/stack.yml`

Build and deploy:

```bash
docker build -t call-assistant-api:latest .
docker swarm init
docker stack deploy -c deploy/swarm/stack.yml call-assistant
docker stack services call-assistant
```

## Kubernetes deployment (managed cluster ready)

Manifest files:

- `deploy/k8s/namespace.yaml`
- `deploy/k8s/configmap.yaml`
- `deploy/k8s/secrets.example.yaml`
- `deploy/k8s/mongo.yaml`
- `deploy/k8s/api.yaml`
- `deploy/k8s/ingress.example.yaml`

Deploy sequence:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/configmap.yaml
# copy secrets.example.yaml -> secrets.yaml and set real keys
kubectl apply -f deploy/k8s/secrets.yaml
kubectl apply -f deploy/k8s/mongo.yaml
kubectl apply -f deploy/k8s/api.yaml
kubectl apply -f deploy/k8s/ingress.example.yaml
kubectl -n call-assistant get pods,svc,ingress
```

## India deployment notes

- Use explicit caller consent prompt before recording/processing.
- Keep language mode configurable (`en-IN`, Hindi, mixed code-switching).
- Add allow/block lists tied to user profile + spam heuristics for local patterns.
