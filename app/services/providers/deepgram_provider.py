import base64

import httpx


class DeepgramProvider:
    def __init__(self, api_key: str, sidecar_url: str = "") -> None:
        self._api_key = api_key
        self._sidecar_url = sidecar_url.rstrip("/")

    async def transcribe_mulaw_8k_b64(self, media_payload_b64: str) -> str:
        if self._sidecar_url:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self._sidecar_url}/stt/transcribe-mulaw-b64",
                    json={"audio_b64": media_payload_b64},
                )
                if response.status_code == 200:
                    return response.json().get("text", "")
        if not self._api_key:
            return ""
        # Placeholder for real-time Deepgram integration.
        # The Twilio media payload is already base64, so decode here if needed.
        _audio_bytes = base64.b64decode(media_payload_b64)
        return ""
