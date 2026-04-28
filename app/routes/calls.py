import json
from typing import Literal, cast
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, Request, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.dependencies import get_llm, get_orchestrator, get_stt, get_tts
from app.services.orchestrator import SessionOrchestrator
from app.services.providers.deepgram_provider import DeepgramProvider
from app.services.providers.llm_provider import LocalFirstLlmProvider
from app.services.providers.tts_provider import ElevenLabsProvider

router = APIRouter(prefix="/api")


class SimStartRequest(BaseModel):
    from_number: str | None = None
    to_number: str | None = None


class SimTurnRequest(BaseModel):
    call_sid: str
    caller_text: str


class SimActionRequest(BaseModel):
    action: str


class SimEndRequest(BaseModel):
    call_sid: str


def _twiml_stream_response(stream_url: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        "<Connect>"
        f'<Stream url="{stream_url}" track="inbound_track" />'
        "</Connect>"
        "</Response>"
    )


@router.post("/incoming-call")
async def incoming_call(
    _request: Request,
    call_sid: str = Form(alias="CallSid"),
    from_number: str | None = Form(default=None, alias="From"),
    to_number: str | None = Form(default=None, alias="To"),
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
    settings: Settings = Depends(get_settings),
) -> Response:
    await orchestrator.start_session(call_sid=call_sid, from_number=from_number, to_number=to_number)
    host = settings.app_public_base_url.rstrip("/")
    stream_url = host.replace("https://", "wss://").replace("http://", "ws://")
    stream_url = f"{stream_url}/api/media-stream/{call_sid}"
    return Response(content=_twiml_stream_response(stream_url), media_type="text/xml")


@router.post("/call-status")
async def call_status(
    call_sid: str = Form(alias="CallSid"),
    call_status: str = Form(alias="CallStatus"),
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    if call_status in {"completed", "busy", "failed", "no-answer"}:
        await orchestrator.finalize(call_sid)
    return {"ok": True}


@router.websocket("/media-stream/{call_sid}")
async def media_stream(
    websocket: WebSocket,
    call_sid: str,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
    stt: DeepgramProvider = Depends(get_stt),
    tts: ElevenLabsProvider = Depends(get_tts),
) -> None:
    await websocket.accept()
    greeted = False
    stream_sid: str | None = None
    try:
        while True:
            packet = await websocket.receive_text()
            event = json.loads(packet)
            event_type = event.get("event")
            if event_type == "start":
                stream_sid = event.get("start", {}).get("streamSid")
                if stream_sid:
                    await orchestrator.set_stream_sid(call_sid, stream_sid)
            if event_type == "media":
                media_payload = event.get("media", {}).get("payload")
                if not greeted:
                    greeted = True
                    greet = "Hi, you've reached Alex's assistant. May I know who's calling and what this is regarding?"
                    await _send_assistant_reply(websocket, stream_sid, tts, greet)
                    continue
                if not media_payload:
                    continue
                caller_text = await stt.transcribe_mulaw_8k_b64(media_payload)
                if not caller_text:
                    continue
                await orchestrator.add_caller_turn(call_sid, caller_text)
                reply, should_end = await orchestrator.next_assistant_turn(call_sid)
                await _send_assistant_reply(websocket, stream_sid, tts, reply)
                if should_end:
                    await orchestrator.finalize(call_sid)
                    await websocket.close()
                    break
            if event_type == "stop":
                await orchestrator.finalize(call_sid)
                break
    except WebSocketDisconnect:
        await orchestrator.finalize(call_sid)


async def _send_assistant_reply(
    websocket: WebSocket,
    stream_sid: str | None,
    tts: ElevenLabsProvider,
    text: str,
) -> None:
    if not stream_sid:
        return
    audio_payload = await tts.synthesize_mulaw_b64(text)
    if audio_payload is None:
        await websocket.send_json(
            {
                "event": "mark",
                "streamSid": stream_sid,
                "mark": {"name": f"assistant_text:{text[:20]}"},
            }
        )
        return
    await websocket.send_json(
        {
            "event": "media",
            "streamSid": stream_sid,
            "media": {"payload": audio_payload},
        }
    )


@router.post("/sim/start")
async def sim_start(
    payload: SimStartRequest,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    call_sid = f"SIM-{uuid4().hex[:10]}"
    session = await orchestrator.start_session(
        call_sid=call_sid,
        from_number=payload.from_number,
        to_number=payload.to_number,
    )
    greeting = "Hi, you've reached Alex's assistant. May I know who's calling and what this is regarding?"
    await orchestrator.add_assistant_turn(call_sid, greeting)
    return {
        "call_sid": call_sid,
        "assistant_reply": greeting,
        "session": session.model_dump(mode="json"),
    }


@router.post("/sim/turn")
async def sim_turn(
    payload: SimTurnRequest,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    await orchestrator.add_caller_turn(payload.call_sid, payload.caller_text)
    reply, should_end = await orchestrator.next_assistant_turn(payload.call_sid)
    if should_end:
        await orchestrator.finalize(payload.call_sid)
    session = await orchestrator.get_session(payload.call_sid)
    return {
        "assistant_reply": reply,
        "should_end": should_end,
        "session": session.model_dump(mode="json"),
    }


@router.post("/sim/end")
async def sim_end(
    payload: SimEndRequest,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    await orchestrator.finalize(payload.call_sid)
    session = await orchestrator.get_session(payload.call_sid)
    return {"ok": True, "session": session.model_dump(mode="json")}


@router.get("/sim/calls")
async def sim_calls(
    limit: int = 50,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    sessions = await orchestrator.list_sessions(limit=limit)
    return {"items": sessions}


@router.get("/sim/calls/{call_sid}")
async def sim_call_detail(
    call_sid: str,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    session = await orchestrator.get_session(call_sid)
    return {"item": session.model_dump(mode="json")}


@router.post("/sim/calls/{call_sid}/action")
async def sim_call_action(
    call_sid: str,
    payload: SimActionRequest,
    orchestrator: SessionOrchestrator = Depends(get_orchestrator),
) -> dict:
    action = payload.action.strip().lower()
    if action not in {"allow", "block", "callback"}:
        return {"ok": False, "error": "action must be allow, block, or callback"}
    typed_action = cast(Literal["allow", "block", "callback"], action)
    session = await orchestrator.set_user_action(call_sid, action=typed_action)
    return {"ok": True, "item": session.model_dump(mode="json")}


@router.get("/debug/llm-route/{call_sid}")
async def debug_llm_route(
    call_sid: str,
    llm: LocalFirstLlmProvider = Depends(get_llm),
) -> dict:
    if not hasattr(llm, "get_route_history"):
        return {"ok": False, "error": "llm provider does not expose route history"}
    return {"ok": True, "call_sid": call_sid, "items": llm.get_route_history(call_sid)}
