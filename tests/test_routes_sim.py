from fastapi.testclient import TestClient

from app.dependencies import get_orchestrator
from app.main import app
from app.models import CallSession, TranscriptTurn


class _FakeOrchestrator:
    def __init__(self) -> None:
        self.sessions: dict[str, CallSession] = {}

    async def start_session(self, call_sid: str, from_number: str | None, to_number: str | None) -> CallSession:
        session = CallSession(call_sid=call_sid, from_number=from_number, to_number=to_number)
        self.sessions[call_sid] = session
        return session

    async def add_assistant_turn(self, call_sid: str, text: str) -> None:
        session = self.sessions[call_sid]
        session.transcript.append(TranscriptTurn(speaker="assistant", text=text))

    async def add_caller_turn(self, call_sid: str, text: str) -> None:
        _ = (call_sid, text)

    async def next_assistant_turn(self, call_sid: str) -> tuple[str, bool]:
        _ = call_sid
        return ("Thanks, noted", False)

    async def finalize(self, call_sid: str) -> None:
        if call_sid in self.sessions:
            self.sessions[call_sid].status = "completed"

    async def get_session(self, call_sid: str) -> CallSession:
        return self.sessions[call_sid]

    async def list_sessions(self, limit: int = 50) -> list[dict]:
        items = [s.model_dump(mode="json") for s in self.sessions.values()]
        return items[:limit]

    async def set_user_action(self, call_sid: str, action: str) -> CallSession:
        session = self.sessions[call_sid]
        session.user_action = action  # type: ignore[assignment]
        return session


def test_sim_start_and_action_flow() -> None:
    fake = _FakeOrchestrator()
    app.dependency_overrides[get_orchestrator] = lambda: fake
    client = TestClient(app)
    try:
        start = client.post("/api/sim/start", json={"from_number": "+9199", "to_number": "+9111"})
        assert start.status_code == 200
        data = start.json()
        assert data["assistant_reply"].startswith("Hi, you've reached Alex's assistant")
        call_sid = data["call_sid"]

        action_bad = client.post(f"/api/sim/calls/{call_sid}/action", json={"action": "invalid"})
        assert action_bad.status_code == 200
        assert action_bad.json()["ok"] is False

        action_ok = client.post(f"/api/sim/calls/{call_sid}/action", json={"action": "allow"})
        assert action_ok.status_code == 200
        assert action_ok.json()["ok"] is True
        assert action_ok.json()["item"]["user_action"] == "allow"
    finally:
        app.dependency_overrides.clear()


def test_sim_turn_and_list_flow() -> None:
    fake = _FakeOrchestrator()
    app.dependency_overrides[get_orchestrator] = lambda: fake
    client = TestClient(app)
    try:
        start = client.post("/api/sim/start", json={}).json()
        call_sid = start["call_sid"]

        turn = client.post("/api/sim/turn", json={"call_sid": call_sid, "caller_text": "hello"})
        assert turn.status_code == 200
        assert "assistant_reply" in turn.json()

        calls = client.get("/api/sim/calls?limit=10")
        assert calls.status_code == 200
        assert isinstance(calls.json()["items"], list)
        assert len(calls.json()["items"]) >= 1
    finally:
        app.dependency_overrides.clear()
