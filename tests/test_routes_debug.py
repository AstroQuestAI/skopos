from fastapi.testclient import TestClient

from app.dependencies import get_llm
from app.main import app


class _FakeLlm:
    def __init__(self) -> None:
        self.data = {
            "SIM-abc": [
                {"turn_index": 1, "route": "local_sidecar", "confidence": 0.91, "strategy": "local_first"},
                {"turn_index": 2, "route": "cloud_fallback", "confidence": 0.33, "strategy": "local_first"},
            ]
        }

    def get_route_history(self, call_sid: str):
        return self.data.get(call_sid, [])


def test_debug_llm_route_endpoint_returns_items() -> None:
    app.dependency_overrides[get_llm] = lambda: _FakeLlm()
    client = TestClient(app)
    try:
        resp = client.get("/api/debug/llm-route/SIM-abc")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["ok"] is True
        assert payload["call_sid"] == "SIM-abc"
        assert len(payload["items"]) == 2
        assert payload["items"][0]["route"] == "local_sidecar"
    finally:
        app.dependency_overrides.clear()
