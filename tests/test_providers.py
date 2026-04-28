import pytest

from app.services.providers.deepgram_provider import DeepgramProvider
from app.services.providers.notifier import PushNotifier
from app.services.providers.tts_provider import ElevenLabsProvider

pytestmark = pytest.mark.asyncio


class _Resp:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _ClientOK:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url: str, json: dict):
        if url.endswith("/stt/transcribe-mulaw-b64"):
            return _Resp(200, {"text": "hello from sidecar"})
        return _Resp(200, {"audio_b64": "QUJD"})


class _ClientFail:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url: str, json: dict):
        return _Resp(500, {})


async def test_deepgram_provider_uses_sidecar_when_available(monkeypatch) -> None:
    monkeypatch.setattr("app.services.providers.deepgram_provider.httpx.AsyncClient", _ClientOK)
    provider = DeepgramProvider(api_key="", sidecar_url="http://localhost:8090")
    text = await provider.transcribe_mulaw_8k_b64("AAAA")
    assert text == "hello from sidecar"


async def test_deepgram_provider_returns_empty_without_api_key(monkeypatch) -> None:
    monkeypatch.setattr("app.services.providers.deepgram_provider.httpx.AsyncClient", _ClientFail)
    provider = DeepgramProvider(api_key="", sidecar_url="http://localhost:8090")
    text = await provider.transcribe_mulaw_8k_b64("AAAA")
    assert text == ""


async def test_tts_provider_uses_sidecar_when_available(monkeypatch) -> None:
    monkeypatch.setattr("app.services.providers.tts_provider.httpx.AsyncClient", _ClientOK)
    provider = ElevenLabsProvider(sidecar_url="http://localhost:8090")
    audio_b64 = await provider.synthesize_mulaw_b64("hello")
    assert audio_b64 == "QUJD"


async def test_tts_provider_returns_none_when_sidecar_fails(monkeypatch) -> None:
    monkeypatch.setattr("app.services.providers.tts_provider.httpx.AsyncClient", _ClientFail)
    provider = ElevenLabsProvider(sidecar_url="http://localhost:8090")
    audio_b64 = await provider.synthesize_mulaw_b64("hello")
    assert audio_b64 is None


async def test_notifier_stub_path_without_webhook(capsys) -> None:
    notifier = PushNotifier(webhook_url="")
    await notifier.notify({"call_sid": "SIM-1"})
    out = capsys.readouterr().out
    assert "Notifier stub payload" in out
