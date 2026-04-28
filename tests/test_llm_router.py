import pytest

from app.models import CallSession, ExtractedDetails, LlmDecision, TranscriptTurn
from app.services.providers.llm_provider import LocalFirstLlmProvider


def _session(caller_lines: list[str], details: ExtractedDetails | None = None) -> CallSession:
    transcript = [TranscriptTurn(speaker="caller", text=line) for line in caller_lines]
    return CallSession(
        call_sid="SIM-test-router",
        details=details or ExtractedDetails(),
        transcript=transcript,
    )


class _StubCloudProvider:
    def __init__(self, decision: LlmDecision) -> None:
        self._decision = decision
        self.calls = 0

    async def decide(self, _session: CallSession) -> LlmDecision:
        self.calls += 1
        return self._decision


class _StubAdapter:
    def __init__(self, result: tuple[LlmDecision, float] | None) -> None:
        self._result = result
        self.calls = 0

    async def decide(self, _session: CallSession) -> tuple[LlmDecision, float] | None:
        self.calls += 1
        return self._result


@pytest.mark.asyncio
async def test_local_only_uses_on_device_adapter_when_available() -> None:
    adapter_decision = LlmDecision(
        assistant_reply="Adapter reply",
        should_end=False,
        details=ExtractedDetails(caller_name="Rahul"),
    )
    adapter = _StubAdapter((adapter_decision, 0.95))
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_only",
        local_confidence_threshold=0.72,
    )
    result = await router.decide(_session(["My name is Rahul"]))
    assert result.assistant_reply == "Adapter reply"
    assert adapter.calls == 1
    assert cloud.calls == 0


@pytest.mark.asyncio
async def test_local_only_falls_back_to_heuristic_if_adapter_unavailable() -> None:
    adapter = _StubAdapter(None)
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_only",
        local_confidence_threshold=0.72,
    )
    result = await router.decide(_session(["My name is Rahul from ACME", "Call me at 9876543210"]))
    assert result.assistant_reply
    assert isinstance(result.should_end, bool)
    assert adapter.calls == 1
    assert cloud.calls == 0


@pytest.mark.asyncio
async def test_local_first_uses_cloud_when_local_confidence_low() -> None:
    adapter_decision = LlmDecision(
        assistant_reply="Adapter uncertain reply",
        should_end=False,
        details=ExtractedDetails(),
    )
    adapter = _StubAdapter((adapter_decision, 0.2))
    cloud_decision = LlmDecision(
        assistant_reply="Cloud confident reply",
        should_end=False,
        details=ExtractedDetails(subject="KYC verification"),
    )
    cloud = _StubCloudProvider(cloud_decision)
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_first",
        local_confidence_threshold=0.72,
    )
    result = await router.decide(_session(["Need urgent help with KYC"]))
    assert result.assistant_reply == "Cloud confident reply"
    assert adapter.calls == 1
    assert cloud.calls == 1


@pytest.mark.asyncio
async def test_local_first_keeps_local_when_confident() -> None:
    adapter_decision = LlmDecision(
        assistant_reply="Adapter confident reply",
        should_end=False,
        details=ExtractedDetails(caller_name="Rahul", company="HDFC", subject="KYC", urgency="high", callback_number="9876543210"),
    )
    adapter = _StubAdapter((adapter_decision, 0.91))
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_first",
        local_confidence_threshold=0.72,
    )
    result = await router.decide(_session(["My name is Rahul from HDFC", "Urgent KYC, call me at 9876543210"]))
    assert result.assistant_reply == "Adapter confident reply"
    assert adapter.calls == 1
    assert cloud.calls == 0


@pytest.mark.asyncio
async def test_cloud_only_bypasses_local_paths() -> None:
    adapter = _StubAdapter(
        (
            LlmDecision(assistant_reply="Adapter reply", should_end=False, details=ExtractedDetails()),
            0.99,
        )
    )
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud only reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="cloud_only",
        local_confidence_threshold=0.72,
    )
    result = await router.decide(_session(["anything"]))
    assert result.assistant_reply == "Cloud only reply"
    assert cloud.calls == 1
    assert adapter.calls == 0


@pytest.mark.asyncio
async def test_local_heuristic_replies_in_hindi_for_hindi_input() -> None:
    adapter = _StubAdapter(None)
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_only",
    )
    result = await router.decide(_session(["नमस्ते, मेरा नाम राहुल है"]))
    assert "Kripya" in result.assistant_reply
    assert cloud.calls == 0


@pytest.mark.asyncio
async def test_local_heuristic_replies_in_telugu_for_telugu_input() -> None:
    adapter = _StubAdapter(None)
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_only",
    )
    result = await router.decide(_session(["నమస్కారం, నేను రమేష్ మాట్లాడుతున్నాను"]))
    assert "cheppagalarā" in result.assistant_reply
    assert cloud.calls == 0


@pytest.mark.asyncio
async def test_local_heuristic_switches_language_mid_conversation() -> None:
    adapter = _StubAdapter(None)
    cloud = _StubCloudProvider(
        LlmDecision(assistant_reply="Cloud reply", should_end=False, details=ExtractedDetails())
    )
    router = LocalFirstLlmProvider(
        cloud_provider=cloud,
        on_device_adapter=adapter,
        strategy="local_only",
    )
    session = _session(["नमस्ते, मेरा नाम राहुल है"])
    first = await router.decide(session)
    assert "Kripya" in first.assistant_reply

    session.transcript.append(TranscriptTurn(speaker="assistant", text=first.assistant_reply))
    session.transcript.append(TranscriptTurn(speaker="caller", text="నమస్కారం, నేను హైదరాబాదు నుండి మాట్లాడుతున్నాను"))
    second = await router.decide(session)
    assert "Meeru" in second.assistant_reply or "Mee" in second.assistant_reply
    assert cloud.calls == 0
