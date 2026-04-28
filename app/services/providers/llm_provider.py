import json
import os
import re
from typing import Any, Literal

import httpx
from openai import AsyncOpenAI

from app.models import CallSession, ExtractedDetails, LlmDecision


SYSTEM_PROMPT = """
You are an AI call screening assistant for an Indian user.
Goal:
1) Collect caller_name, company, subject, urgency, callback_number.
2) Be polite and concise.
3) Ask only one focused question at a time.
4) End call when all fields are known or caller refuses to continue.
5) Reply in the same language/script style as the caller's most recent utterance.

Return strict JSON with keys:
assistant_reply (string),
should_end (boolean),
summary (string),
details (object with caller_name, company, subject, urgency, callback_number).
"""


def detect_reply_language(session: CallSession) -> str:
    caller_lines = [turn.text for turn in session.transcript if turn.speaker == "caller" and turn.text]
    if not caller_lines:
        return "en"
    latest = caller_lines[-1]
    if re.search(r"[\u0C00-\u0C7F]", latest):
        return "te"
    if re.search(r"[\u0900-\u097F]", latest):
        return "hi"
    lowered = latest.lower()
    telugu_roman_markers = ("andi", "nenu", "meeru", "garu", "cheppandi", "undi")
    hindi_roman_markers = ("mera", "naam", "hai", "aap", "kripya", "bataye", "bol raha")
    if any(marker in lowered for marker in telugu_roman_markers):
        return "te"
    if any(marker in lowered for marker in hindi_roman_markers):
        return "hi"
    return "en"


class _HeuristicDecisionEngine:
    def __init__(self, app_mode: Literal["generic", "dialer"] = "generic") -> None:
        self._app_mode = app_mode

    def local_decide(self, session: CallSession) -> tuple[LlmDecision, float]:
        merged_details = self._merge_details(session.details, self._extract_from_transcript(session))
        language = detect_reply_language(session)
        missing = merged_details.missing()
        confidence = self._local_confidence(session, merged_details)
        if missing:
            prompt_field = missing[0]
            return (
                LlmDecision(
                    assistant_reply=self._question_for(prompt_field, language),
                    should_end=False,
                    details=merged_details,
                ),
                confidence,
            )
        return (
            LlmDecision(
                assistant_reply=self._close_line(language),
                should_end=True,
                summary=self._basic_summary(merged_details),
                details=merged_details,
            ),
            confidence,
        )

    def _question_for(self, field: str, language: str = "en") -> str:
        if language == "hi":
            question_map = {
                "caller_name": "Kripya apna naam batayen.",
                "company": "Aap kis company ya sanstha se bol rahe hain?",
                "subject": "Yeh call kis baare mein hai?",
                "urgency": "Iski priority low, medium, ya high kya rakhen?",
                "callback_number": "Best callback number kya hai?",
            }
            return question_map[field]
        if language == "te":
            question_map = {
                "caller_name": "Mee peru cheppagalarā?",
                "company": "Meeru ē company lēda samstha nunchi matlāḍutunnāru?",
                "subject": "Idi ē vishayam gurinchi call?",
                "urgency": "Dīni urgency low, medium, lēda high ā?",
                "callback_number": "Best callback number cheppandi.",
            }
            return question_map[field]
        if self._app_mode == "dialer":
            question_map = {
                "caller_name": "For call log records, may I have your name?",
                "company": "Which company or organization are you calling from?",
                "subject": "Please tell me the main purpose of this call.",
                "urgency": "Should I mark this as low, medium, or high priority?",
                "callback_number": "What is the best callback number for return call?",
            }
            return question_map[field]
        question_map = {
            "caller_name": "May I know your name, please?",
            "company": "Are you calling from a company or organization?",
            "subject": "What is this regarding?",
            "urgency": "How urgent is this, on a scale of low, medium, or high?",
            "callback_number": "What is the best callback number?",
        }
        return question_map[field]

    def _close_line(self, language: str = "en") -> str:
        if language == "hi":
            return "Dhanyavaad, main yeh jaankari Alex tak pahuncha dunga."
        if language == "te":
            return "Dhanyavaadalu, ee vivaralu Alex ki pampistaanu."
        if self._app_mode == "dialer":
            return "Thank you. I have logged this and will pass it to Alex."
        return "Thanks, I will pass this along."

    def _local_confidence(self, session: CallSession, details: ExtractedDetails) -> float:
        known_ratio = 1.0 - (len(details.missing()) / 5.0)
        caller_turns = [turn.text for turn in session.transcript if turn.speaker == "caller"]
        text = " ".join(caller_turns).lower()
        signal_terms = ["urgent", "callback", "regarding", "from", "call me", "verification"]
        signal_score = min(1.0, sum(1 for token in signal_terms if token in text) / 4.0)
        return max(0.0, min(1.0, 0.65 * known_ratio + 0.35 * signal_score))

    def _basic_summary(self, d: ExtractedDetails) -> str:
        return (
            f"Caller: {d.caller_name or 'Unknown'}, Company: {d.company or 'Unknown'}, "
            f"Subject: {d.subject or 'Unknown'}, Urgency: {d.urgency or 'Unknown'}, "
            f"Callback: {d.callback_number or 'Unknown'}."
        )

    def _extract_from_transcript(self, session: CallSession) -> ExtractedDetails:
        details = ExtractedDetails(**session.details.model_dump())
        caller_turns = [turn.text for turn in session.transcript if turn.speaker == "caller"]
        if not caller_turns:
            return details
        full_text = " ".join(caller_turns)
        text_lower = full_text.lower()
        if not details.caller_name:
            name_match = re.search(
                r"(?:my name is|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?:\s+from\b|,|\.|$)",
                full_text,
                re.IGNORECASE,
            )
            if name_match:
                details.caller_name = name_match.group(1).strip().split(",")[0].strip().title()
        if not details.company:
            company_match = re.search(
                r"(?:from|calling from|at)\s+([a-zA-Z0-9&\-\.\s]{2,50}?)(?:,|\.|$)",
                full_text,
                re.IGNORECASE,
            )
            if company_match:
                company = company_match.group(1).strip().split(",")[0].strip()
                if len(company) > 1:
                    details.company = company
        if not details.callback_number:
            phone_match = re.search(r"(?:\+91[\s\-]?)?[6-9]\d{9}", full_text)
            if phone_match:
                details.callback_number = phone_match.group(0).replace(" ", "").replace("-", "")
        if not details.urgency:
            if any(word in text_lower for word in ["urgent", "immediately", "asap", "emergency"]):
                details.urgency = "high"
            elif any(word in text_lower for word in ["today", "soon", "important"]):
                details.urgency = "medium"
            else:
                details.urgency = "low"
        if not details.subject:
            latest = caller_turns[-1].strip()
            if latest:
                details.subject = latest[:180]
        return details

    def _merge_details(self, base: ExtractedDetails, updates: ExtractedDetails) -> ExtractedDetails:
        merged = ExtractedDetails(**base.model_dump())
        for key, value in updates.model_dump().items():
            if value and not getattr(merged, key):
                setattr(merged, key, value)
        return merged


class OnDeviceLlmAdapter:
    def __init__(
        self,
        model_name: str,
        api_url: str = "",
        backend: Literal["openai_compatible", "ollama"] = "openai_compatible",
        timeout_seconds: float = 12.0,
    ) -> None:
        self._model_name = model_name
        self._api_url = api_url.rstrip("/")
        self._backend = backend
        self._timeout_seconds = timeout_seconds
        self._max_transcript_turns = int(os.getenv("LOCAL_LLM_MAX_TRANSCRIPT_TURNS", "12"))
        self._max_transcript_chars = int(os.getenv("LOCAL_LLM_MAX_TRANSCRIPT_CHARS", "2200"))
        limits = httpx.Limits(
            max_keepalive_connections=int(os.getenv("LOCAL_LLM_HTTP_KEEPALIVE", "20")),
            max_connections=int(os.getenv("LOCAL_LLM_HTTP_MAX_CONNECTIONS", "40")),
        )
        self._client = httpx.AsyncClient(timeout=self._timeout_seconds, limits=limits)

    async def decide(self, session: CallSession) -> tuple[LlmDecision, float] | None:
        if not self._api_url:
            return None
        if self._backend == "ollama":
            return await self._decide_ollama(session)
        return await self._decide_openai_compatible(session)

    async def _decide_openai_compatible(self, session: CallSession) -> tuple[LlmDecision, float] | None:
        context = self._build_local_context(session)
        payload = {
            "model": self._model_name,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(context),
                },
            ],
        }
        url = f"{self._api_url}/v1/chat/completions"
        response = await self._client.post(url, json=payload)
        if response.status_code >= 400:
            return None
        data = response.json()
        raw = (((data.get("choices") or [{}])[0]).get("message") or {}).get("content")
        if not raw:
            return None
        return self._parse_decision(raw)

    async def _decide_ollama(self, session: CallSession) -> tuple[LlmDecision, float] | None:
        context = self._build_local_context(session)
        payload = {
            "model": self._model_name,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(context),
                },
            ],
            "options": {"temperature": 0.2},
        }
        url = f"{self._api_url}/api/chat"
        response = await self._client.post(url, json=payload)
        if response.status_code >= 400:
            return None
        data = response.json()
        raw = (data.get("message") or {}).get("content")
        if not raw:
            return None
        return self._parse_decision(raw)

    def _parse_decision(self, raw: str) -> tuple[LlmDecision, float] | None:
        try:
            parsed: dict[str, Any] = json.loads(raw)
        except json.JSONDecodeError:
            return None
        details = ExtractedDetails(**parsed.get("details", {}))
        decision = LlmDecision(
            assistant_reply=parsed.get("assistant_reply", "Could you share more details?"),
            should_end=bool(parsed.get("should_end", False)),
            summary=parsed.get("summary"),
            details=details,
        )
        confidence = 0.88 if len(details.missing()) <= 2 else 0.75
        return decision, confidence

    def _build_local_context(self, session: CallSession) -> dict[str, Any]:
        transcript = [t.model_dump(mode="json") for t in session.transcript[-self._max_transcript_turns :]]
        total_chars = 0
        compact: list[dict[str, Any]] = []
        for item in reversed(transcript):
            text = str(item.get("text", ""))
            remaining = self._max_transcript_chars - total_chars
            if remaining <= 0:
                break
            if len(text) > remaining:
                item["text"] = text[-remaining:]
                compact.append(item)
                total_chars += remaining
                break
            compact.append(item)
            total_chars += len(text)
        compact.reverse()
        return {
            "details": session.details.model_dump(),
            "transcript": compact,
            "preferred_response_language": detect_reply_language(session),
        }


class LlmProvider:
    def __init__(self, api_key: str, model: str, app_mode: Literal["generic", "dialer"] = "generic") -> None:
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None
        self._model = model
        self._heuristic = _HeuristicDecisionEngine(app_mode=app_mode)

    async def decide(self, session: CallSession) -> LlmDecision:
        if self._client is None:
            decision, _confidence = self._heuristic.local_decide(session)
            return decision

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "details": session.details.model_dump(),
                        "transcript": [t.model_dump(mode="json") for t in session.transcript],
                        "preferred_response_language": detect_reply_language(session),
                    }
                ),
            },
        ]
        response = await self._client.chat.completions.create(
            model=self._model,
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.2,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        details = ExtractedDetails(**data.get("details", {}))
        return LlmDecision(
            assistant_reply=data.get("assistant_reply", "Could you share more details?"),
            should_end=bool(data.get("should_end", False)),
            summary=data.get("summary"),
            details=details,
        )


class LocalFirstLlmProvider:
    def __init__(
        self,
        cloud_provider: LlmProvider,
        on_device_adapter: OnDeviceLlmAdapter | None = None,
        app_mode: Literal["generic", "dialer"] = "generic",
        strategy: Literal["local_first", "local_only", "cloud_only"] = "local_first",
        local_confidence_threshold: float = 0.72,
    ) -> None:
        self._cloud_provider = cloud_provider
        self._on_device_adapter = on_device_adapter
        self._local = _HeuristicDecisionEngine(app_mode=app_mode)
        self._strategy = strategy
        self._local_confidence_threshold = local_confidence_threshold
        self._trace_by_call_sid: dict[str, list[dict[str, Any]]] = {}

    async def decide(self, session: CallSession) -> LlmDecision:
        if self._strategy == "cloud_only":
            decision = await self._cloud_provider.decide(session)
            self._record_trace(session.call_sid, route="cloud_only", confidence=1.0)
            return decision

        adapter_result = None
        if self._on_device_adapter is not None:
            adapter_result = await self._on_device_adapter.decide(session)
        if adapter_result is not None:
            local_decision, confidence = adapter_result
            local_route = "local_sidecar"
        else:
            local_decision, confidence = self._local.local_decide(session)
            local_route = "local_heuristic"

        if self._strategy == "local_only":
            self._record_trace(session.call_sid, route=local_route, confidence=confidence)
            return local_decision
        if confidence >= self._local_confidence_threshold:
            self._record_trace(session.call_sid, route=local_route, confidence=confidence)
            return local_decision

        cloud_decision = await self._cloud_provider.decide(session)
        # If cloud misses structured fields but local has them, keep local extraction.
        if cloud_decision.details.missing() and not local_decision.details.missing():
            cloud_decision.details = local_decision.details
        self._record_trace(
            session.call_sid,
            route="cloud_fallback",
            confidence=confidence,
            local_route=local_route,
        )
        return cloud_decision

    def get_route_history(self, call_sid: str) -> list[dict[str, Any]]:
        return list(self._trace_by_call_sid.get(call_sid, []))

    def _record_trace(
        self,
        call_sid: str,
        route: str,
        confidence: float,
        local_route: str | None = None,
    ) -> None:
        history = self._trace_by_call_sid.setdefault(call_sid, [])
        item: dict[str, Any] = {
            "turn_index": len(history) + 1,
            "route": route,
            "confidence": round(float(confidence), 4),
            "strategy": self._strategy,
        }
        if local_route:
            item["local_route"] = local_route
        history.append(item)
