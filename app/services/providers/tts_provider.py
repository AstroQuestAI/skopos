import httpx


class ElevenLabsProvider:
    def __init__(
        self,
        sidecar_url: str = "",
    ) -> None:
        self._sidecar_url = sidecar_url.rstrip("/")

    async def synthesize_mulaw_b64(self, text: str) -> str | None:
        if self._sidecar_url:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self._sidecar_url}/tts/mulaw-b64",
                    json={"text": text},
                )
                if response.status_code == 200:
                    return response.json().get("audio_b64")
        return None
