import httpx


class PushNotifier:
    def __init__(self, webhook_url: str) -> None:
        self._webhook_url = webhook_url

    async def notify(self, payload: dict) -> None:
        if not self._webhook_url:
            print("Notifier stub payload:", payload)
            return
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(self._webhook_url, json=payload)
