import pytest

from app.models import CallSession, ExtractedDetails, LlmDecision
from app.services.orchestrator import SessionOrchestrator

pytestmark = pytest.mark.asyncio


class _FakeRepo:
    def __init__(self) -> None:
        self.saved: dict[str, CallSession] = {}

    async def upsert(self, session: CallSession) -> None:
        self.saved[session.call_sid] = session

    async def list_recent(self, limit: int = 50) -> list[dict]:
        items = [s.model_dump(mode="json") for s in self.saved.values()]
        return items[:limit]


class _FakeLlm:
    def __init__(self) -> None:
        self.calls = 0
        self.next = LlmDecision(
            assistant_reply="Please share callback number",
            should_end=False,
            details=ExtractedDetails(caller_name="Rahul"),
        )

    async def decide(self, _session: CallSession) -> LlmDecision:
        self.calls += 1
        return self.next


class _FakeNotifier:
    def __init__(self) -> None:
        self.events: list[dict] = []

    async def notify(self, payload: dict) -> None:
        self.events.append(payload)


async def test_start_and_turn_flow_updates_session() -> None:
    repo = _FakeRepo()
    llm = _FakeLlm()
    notifier = _FakeNotifier()
    orch = SessionOrchestrator(repo=repo, llm=llm, notifier=notifier)

    session = await orch.start_session("SIM-1", "+9199", "+9111")
    assert session.call_sid == "SIM-1"
    assert session.from_number == "+9199"

    await orch.add_caller_turn("SIM-1", "Hi, my name is Rahul")
    reply, should_end = await orch.next_assistant_turn("SIM-1")
    assert reply == "Please share callback number"
    assert should_end is False
    assert llm.calls == 1

    latest = await orch.get_session("SIM-1")
    assert len(latest.transcript) == 2
    assert latest.transcript[0].speaker == "caller"
    assert latest.transcript[1].speaker == "assistant"


async def test_finalize_triggers_summary_and_notify() -> None:
    repo = _FakeRepo()
    llm = _FakeLlm()
    llm.next = LlmDecision(
        assistant_reply="Thanks, noted",
        should_end=True,
        summary="Rahul from HDFC requested KYC callback",
        details=ExtractedDetails(caller_name="Rahul", company="HDFC", subject="KYC", urgency="high", callback_number="9876543210"),
    )
    notifier = _FakeNotifier()
    orch = SessionOrchestrator(repo=repo, llm=llm, notifier=notifier)

    await orch.start_session("SIM-2", None, None)
    await orch.finalize("SIM-2")

    session = await orch.get_session("SIM-2")
    assert session.status == "completed"
    assert session.summary == "Rahul from HDFC requested KYC callback"
    assert llm.calls == 1
    assert len(notifier.events) == 1
    assert notifier.events[0]["call_sid"] == "SIM-2"
