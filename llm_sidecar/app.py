import json
import os
import re
import time
from collections import OrderedDict
from hashlib import sha256
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel


class _Msg(BaseModel):
    role: str
    content: str


class _ChatRequest(BaseModel):
    model: str | None = None
    messages: list[_Msg]
    temperature: float | None = 0.2
    response_format: dict[str, Any] | None = None


app = FastAPI(title="LLM Sidecar", version="0.1.0")
_LLM_SEMAPHORE = None
_HTTP_CLIENT = None
_CACHE: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()


def _backend() -> str:
    return os.getenv("LLM_BACKEND", "openai_compatible")


def _upstream_url() -> str:
    return os.getenv("LLM_UPSTREAM_URL", "").rstrip("/")


def _model_name() -> str:
    return os.getenv("LLM_MODEL", "tiny-mini")


def _timeout() -> float:
    return float(os.getenv("LLM_TIMEOUT_SECONDS", "15"))


def _max_concurrent_requests() -> int:
    return int(os.getenv("LLM_MAX_CONCURRENT_REQUESTS", "4"))


def _max_retries() -> int:
    return int(os.getenv("LLM_UPSTREAM_MAX_RETRIES", "1"))


def _cache_enabled() -> bool:
    return os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true"


def _cache_ttl_seconds() -> int:
    return int(os.getenv("LLM_CACHE_TTL_SECONDS", "30"))


def _cache_max_items() -> int:
    return int(os.getenv("LLM_MAX_CACHE_ITEMS", "256"))


def _http_client() -> httpx.AsyncClient:
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        limits = httpx.Limits(
            max_keepalive_connections=int(os.getenv("LLM_HTTP_KEEPALIVE", "20")),
            max_connections=int(os.getenv("LLM_HTTP_MAX_CONNECTIONS", "40")),
        )
        _HTTP_CLIENT = httpx.AsyncClient(timeout=_timeout(), limits=limits)
    return _HTTP_CLIENT


def _llm_semaphore():
    global _LLM_SEMAPHORE
    if _LLM_SEMAPHORE is None:
        import asyncio

        _LLM_SEMAPHORE = asyncio.Semaphore(_max_concurrent_requests())
    return _LLM_SEMAPHORE


@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "backend": _backend(),
        "cache_enabled": _cache_enabled(),
        "cache_items": len(_CACHE),
    }


@app.post("/v1/chat/completions")
async def chat_completions(payload: _ChatRequest) -> dict:
    cache_key = _request_cache_key(payload)
    if _cache_enabled():
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    if _upstream_url():
        async with _llm_semaphore():
            upstream = await _try_upstream(payload)
        if upstream is not None:
            if _cache_enabled():
                _cache_set(cache_key, upstream)
            return upstream
    response = _heuristic_response(payload)
    if _cache_enabled():
        _cache_set(cache_key, response)
    return response


async def _try_upstream(payload: _ChatRequest) -> dict | None:
    backend = _backend()
    client = _http_client()
    for attempt in range(_max_retries() + 1):
        try:
            if backend == "ollama":
                body = {
                    "model": payload.model or _model_name(),
                    "stream": False,
                    "format": "json",
                    "messages": [m.model_dump() for m in payload.messages],
                    "options": {"temperature": payload.temperature or 0.2},
                }
                resp = await client.post(f"{_upstream_url()}/api/chat", json=body)
                if resp.status_code >= 400:
                    continue
                data = resp.json()
                content = (data.get("message") or {}).get("content", "{}")
                return _as_openai_response(content)

            body = {
                "model": payload.model or _model_name(),
                "messages": [m.model_dump() for m in payload.messages],
                "temperature": payload.temperature or 0.2,
                "response_format": payload.response_format or {"type": "json_object"},
            }
            resp = await client.post(f"{_upstream_url()}/v1/chat/completions", json=body)
            if resp.status_code >= 400:
                continue
            return resp.json()
        except httpx.HTTPError:
            if attempt >= _max_retries():
                return None
    return None


def _as_openai_response(content: str) -> dict:
    return {
        "id": "chatcmpl-sidecar",
        "object": "chat.completion",
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": content}, "finish_reason": "stop"}
        ],
    }


def _heuristic_response(payload: _ChatRequest) -> dict:
    details, transcript = _extract_context(payload.messages)
    merged = _merge_details(details, _extract_from_transcript(transcript))
    missing = [k for k, v in merged.items() if not v]
    if missing:
        field = missing[0]
        reply = {
            "caller_name": "May I know your name, please?",
            "company": "Are you calling from a company or organization?",
            "subject": "What is this regarding?",
            "urgency": "How urgent is this: low, medium, or high?",
            "callback_number": "What is the best callback number?",
        }[field]
        body = {
            "assistant_reply": reply,
            "should_end": False,
            "summary": None,
            "details": merged,
        }
        return _as_openai_response(json.dumps(body))
    body = {
        "assistant_reply": "Thanks, I will pass this along.",
        "should_end": True,
        "summary": (
            f"Caller: {merged.get('caller_name') or 'Unknown'}, "
            f"Company: {merged.get('company') or 'Unknown'}, "
            f"Subject: {merged.get('subject') or 'Unknown'}, "
            f"Urgency: {merged.get('urgency') or 'Unknown'}, "
            f"Callback: {merged.get('callback_number') or 'Unknown'}."
        ),
        "details": merged,
    }
    return _as_openai_response(json.dumps(body))


def _extract_context(messages: list[_Msg]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    if not messages:
        return {}, []
    last = messages[-1].content
    try:
        user_json = json.loads(last)
        details = user_json.get("details", {})
        transcript = user_json.get("transcript", [])
        if isinstance(details, dict) and isinstance(transcript, list):
            return details, transcript
    except Exception:
        pass
    return {}, []


def _merge_details(base: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = {
        "caller_name": base.get("caller_name"),
        "company": base.get("company"),
        "subject": base.get("subject"),
        "urgency": base.get("urgency"),
        "callback_number": base.get("callback_number"),
    }
    for key, value in updates.items():
        if value and not merged.get(key):
            merged[key] = value
    return merged


def _extract_from_transcript(transcript: list[dict[str, str]]) -> dict[str, Any]:
    caller_turns = [t.get("text", "") for t in transcript if t.get("speaker") == "caller"]
    if not caller_turns:
        return {}
    full_text = " ".join(caller_turns)
    text_lower = full_text.lower()
    details: dict[str, Any] = {}

    name_match = re.search(
        r"(?:my name is|i am|this is)\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?:\s+from\b|,|\.|$)",
        full_text,
        re.IGNORECASE,
    )
    if name_match:
        details["caller_name"] = name_match.group(1).strip().split(",")[0].strip().title()

    company_match = re.search(
        r"(?:from|calling from|at)\s+([a-zA-Z0-9&\-\.\s]{2,50}?)(?:,|\.|$)",
        full_text,
        re.IGNORECASE,
    )
    if company_match:
        details["company"] = company_match.group(1).strip().split(",")[0].strip()

    phone_match = re.search(r"(?:\+91[\s\-]?)?[6-9]\d{9}", full_text)
    if phone_match:
        details["callback_number"] = phone_match.group(0).replace(" ", "").replace("-", "")

    if any(word in text_lower for word in ["urgent", "immediately", "asap", "emergency"]):
        details["urgency"] = "high"
    elif any(word in text_lower for word in ["today", "soon", "important"]):
        details["urgency"] = "medium"
    else:
        details["urgency"] = "low"

    latest = caller_turns[-1].strip()
    if latest:
        details["subject"] = latest[:180]
    return details


def _request_cache_key(payload: _ChatRequest) -> str:
    raw = json.dumps(
        {
            "model": payload.model or _model_name(),
            "messages": [m.model_dump() for m in payload.messages],
            "temperature": payload.temperature or 0.2,
        },
        sort_keys=True,
    )
    return sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> dict | None:
    if key not in _CACHE:
        return None
    ts, value = _CACHE[key]
    if time.time() - ts > _cache_ttl_seconds():
        _CACHE.pop(key, None)
        return None
    _CACHE.move_to_end(key)
    return value


def _cache_set(key: str, value: dict) -> None:
    _CACHE[key] = (time.time(), value)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _cache_max_items():
        _CACHE.popitem(last=False)
