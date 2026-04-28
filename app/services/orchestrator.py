from datetime import datetime, timezone
from typing import Literal

from app.models import CallSession, TranscriptTurn
from app.services.providers.llm_provider import LlmProvider
from app.services.providers.mongo_repo import CallRepository
from app.services.providers.notifier import PushNotifier


class SessionOrchestrator:
    def __init__(
        self,
        repo: CallRepository,
        llm: LlmProvider,
        notifier: PushNotifier,
    ) -> None:
        self._repo = repo
        self._llm = llm
        self._notifier = notifier
        self._sessions: dict[str, CallSession] = {}

    async def start_session(
        self, call_sid: str, from_number: str | None, to_number: str | None
    ) -> CallSession:
        session = CallSession(call_sid=call_sid, from_number=from_number, to_number=to_number)
        self._sessions[call_sid] = session
        await self._repo.upsert(session)
        return session

    async def get_or_create_session(self, call_sid: str) -> CallSession:
        if call_sid in self._sessions:
            return self._sessions[call_sid]
        session = CallSession(call_sid=call_sid)
        self._sessions[call_sid] = session
        await self._repo.upsert(session)
        return session

    async def get_session(self, call_sid: str) -> CallSession:
        session = await self.get_or_create_session(call_sid)
        return session

    async def list_sessions(self, limit: int = 50) -> list[dict]:
        return await self._repo.list_recent(limit=limit)

    async def set_stream_sid(self, call_sid: str, stream_sid: str) -> None:
        session = await self.get_or_create_session(call_sid)
        session.stream_sid = stream_sid
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)

    async def add_caller_turn(self, call_sid: str, text: str) -> None:
        if not text.strip():
            return
        session = await self.get_or_create_session(call_sid)
        session.transcript.append(TranscriptTurn(speaker="caller", text=text.strip()))
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)

    async def next_assistant_turn(self, call_sid: str) -> tuple[str, bool]:
        session = await self.get_or_create_session(call_sid)
        decision = await self._llm.decide(session)
        session.details = decision.details
        session.summary = decision.summary or session.summary
        session.transcript.append(TranscriptTurn(speaker="assistant", text=decision.assistant_reply))
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)
        return decision.assistant_reply, decision.should_end

    async def add_assistant_turn(self, call_sid: str, text: str) -> None:
        if not text.strip():
            return
        session = await self.get_or_create_session(call_sid)
        session.transcript.append(TranscriptTurn(speaker="assistant", text=text.strip()))
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)

    async def set_user_action(
        self, call_sid: str, action: Literal["allow", "block", "callback"]
    ) -> CallSession:
        session = await self.get_or_create_session(call_sid)
        session.user_action = action
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)
        return session

    async def finalize(self, call_sid: str) -> None:
        session = await self.get_or_create_session(call_sid)
        if not session.summary:
            decision = await self._llm.decide(session)
            session.summary = decision.summary
            session.details = decision.details
        session.status = "completed"
        session.updated_at = datetime.now(timezone.utc)
        await self._repo.upsert(session)
        await self._notifier.notify(
            {
                "call_sid": session.call_sid,
                "status": session.status,
                "from_number": session.from_number,
                "summary": session.summary,
                "details": session.details.model_dump(),
                "transcript": [turn.model_dump(mode="json") for turn in session.transcript],
            }
        )
