import asyncio
import audioop
import base64
import io
import json
import os
import subprocess
import wave
from functools import lru_cache

import numpy as np
from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel


class TtsRequest(BaseModel):
    text: str
    language_code: str | None = None


class KokoroTtsRequest(BaseModel):
    text: str
    language_code: str | None = None


class SttRequest(BaseModel):
    audio_b64: str
    language_code: str | None = None


app = FastAPI(title="Voice Sidecar", version="0.1.0")
_TTS_SEMAPHORE = asyncio.Semaphore(int(os.getenv("VOICE_MAX_CONCURRENT_TTS", "1")))
_STT_SEMAPHORE = asyncio.Semaphore(int(os.getenv("VOICE_MAX_CONCURRENT_STT", "1")))


def _normalize_language(language_code: str | None) -> str:
    lang = (language_code or "").strip()
    if not lang:
        return "en_IN"
    return lang.replace("-", "_")


@lru_cache
def _piper_model_map() -> dict[str, str]:
    model_map: dict[str, str] = {
        "en_IN": os.getenv("PIPER_MODEL_PATH_EN", os.getenv("PIPER_MODEL_PATH", "/models/en_US-lessac-medium.onnx")),
    }
    if os.getenv("PIPER_MODEL_PATH_HI"):
        model_map["hi_IN"] = os.getenv("PIPER_MODEL_PATH_HI", "")
    if os.getenv("PIPER_MODEL_PATH_TE"):
        model_map["te_IN"] = os.getenv("PIPER_MODEL_PATH_TE", "")
    raw = os.getenv("PIPER_MODEL_MAP_JSON", "").strip()
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                for key, value in parsed.items():
                    if isinstance(key, str) and isinstance(value, str):
                        model_map[_normalize_language(key)] = value
        except json.JSONDecodeError:
            pass
    return model_map


def _piper_model_path_for(language_code: str | None) -> str:
    model_map = _piper_model_map()
    normalized = _normalize_language(language_code)
    if normalized in model_map:
        return model_map[normalized]
    family = normalized.split("_", 1)[0]
    for key, path in model_map.items():
        if key.startswith(family + "_"):
            return path
    return model_map["en_IN"]


def _piper_sample_rate() -> int:
    return int(os.getenv("PIPER_SAMPLE_RATE", "22050"))


def _piper_timeout_seconds() -> float:
    return float(os.getenv("PIPER_TIMEOUT_SECONDS", "20"))


def _kokoro_model_path() -> str:
    return os.getenv("KOKORO_MODEL_PATH", "/models/kokoro/kokoro-v1.0.onnx")


def _kokoro_voices_path() -> str:
    return os.getenv("KOKORO_VOICES_PATH", "/models/kokoro/voices-v1.0.bin")


def _kokoro_speed() -> float:
    return float(os.getenv("KOKORO_SPEED", "1.0"))


def _kokoro_chunk_chars() -> int:
    return int(os.getenv("KOKORO_CHUNK_CHARS", "140"))


def _kokoro_voice_for(language_code: str | None) -> str:
    family = _normalize_language(language_code).split("_", 1)[0]
    if family == "hi":
        return os.getenv("KOKORO_VOICE_HI", "hf_alpha")
    if family == "te":
        return os.getenv("KOKORO_VOICE_TE", "tf_dora")
    return os.getenv("KOKORO_VOICE_EN", "af_heart")


def _kokoro_lang_for(language_code: str | None) -> str:
    family = _normalize_language(language_code).split("_", 1)[0]
    if family in {"hi", "te"}:
        return family
    return "en-us"


def _tts_max_chars() -> int:
    return int(os.getenv("VOICE_TTS_MAX_CHARS", "400"))


def _stt_max_seconds() -> float:
    return float(os.getenv("VOICE_STT_MAX_AUDIO_SECONDS", "90"))


def _stt_language_code(language_code: str | None) -> str:
    normalized = _normalize_language(language_code)
    family = normalized.split("_", 1)[0]
    if family in {"en", "hi", "te"}:
        return family
    return "en"


def _whisper_model_name_for(language_code: str | None) -> str:
    family = _stt_language_code(language_code)
    if family == "hi":
        return os.getenv("WHISPER_MODEL_HI", os.getenv("WHISPER_MODEL", "tiny"))
    if family == "te":
        return os.getenv("WHISPER_MODEL_TE", os.getenv("WHISPER_MODEL", "tiny"))
    return os.getenv("WHISPER_MODEL_EN", os.getenv("WHISPER_MODEL", "tiny"))


def _whisper_compute_type() -> str:
    return os.getenv("WHISPER_COMPUTE_TYPE", "int8")


def _whisper_vad_min_silence_ms() -> int:
    return int(os.getenv("WHISPER_VAD_MIN_SILENCE_MS", "500"))


@lru_cache
def _get_whisper_model(model_name: str) -> WhisperModel:
    return WhisperModel(model_name, device="cpu", compute_type=_whisper_compute_type())


def _resolve_stt_engine(language_code: str | None) -> tuple[WhisperModel, str]:
    stt_lang = _stt_language_code(language_code)
    model_name = _whisper_model_name_for(language_code)
    if model_name.endswith(".en") and stt_lang in {"hi", "te"}:
        model_name = os.getenv("WHISPER_MODEL_MULTILINGUAL", "tiny")
    return _get_whisper_model(model_name), stt_lang


@lru_cache
def _get_kokoro_engine():
    from kokoro_onnx import Kokoro

    model_path = _kokoro_model_path()
    voices_path = _kokoro_voices_path()
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Kokoro model not found at {model_path}")
    if not os.path.exists(voices_path):
        raise FileNotFoundError(f"Kokoro voices not found at {voices_path}")
    return Kokoro(model_path, voices_path)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/tts/mulaw-b64")
async def tts_mulaw(payload: TtsRequest) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > _tts_max_chars():
        text = text[: _tts_max_chars()]
    model_path = _piper_model_path_for(payload.language_code)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=500, detail=f"Piper model not found at {model_path}")
    async with _TTS_SEMAPHORE:
        pcm16 = await asyncio.to_thread(_run_piper, text, model_path)
    if not pcm16:
        raise HTTPException(status_code=500, detail="Piper returned empty audio")
    ulaw = _pcm16_to_mulaw_8k(pcm16, _piper_sample_rate())
    return {"audio_b64": base64.b64encode(ulaw).decode("utf-8")}


@app.post("/tts/kokoro-wav-b64")
async def tts_kokoro_wav(payload: KokoroTtsRequest) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > _tts_max_chars():
        text = text[: _tts_max_chars()]
    async with _TTS_SEMAPHORE:
        try:
            wav_bytes, sample_rate = await asyncio.to_thread(_run_kokoro_wav, text, payload.language_code)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Kokoro synthesis failed: {exc}") from exc
    return {"audio_wav_b64": base64.b64encode(wav_bytes).decode("utf-8"), "sample_rate_hz": sample_rate}


@app.post("/tts/kokoro-stream-wav-b64")
async def tts_kokoro_stream_wav(payload: KokoroTtsRequest) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > _tts_max_chars():
        text = text[: _tts_max_chars()]
    parts = _split_text_for_tts(text, _kokoro_chunk_chars())
    chunks: list[str] = []
    sample_rate = 22050
    async with _TTS_SEMAPHORE:
        try:
            for part in parts:
                wav_bytes, sample_rate = await asyncio.to_thread(_run_kokoro_wav, part, payload.language_code)
                chunks.append(base64.b64encode(wav_bytes).decode("utf-8"))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Kokoro stream synthesis failed: {exc}") from exc
    return {"chunks": chunks, "sample_rate_hz": sample_rate}


@app.post("/stt/transcribe-mulaw-b64")
async def stt_transcribe(payload: SttRequest) -> dict:
    try:
        ulaw_bytes = base64.b64decode(payload.audio_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="invalid audio_b64") from exc
    pcm16 = audioop.ulaw2lin(ulaw_bytes, 2)
    audio_np = np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0
    if audio_np.size == 0:
        return {"text": ""}
    max_samples = int(_stt_max_seconds() * 8000)
    if audio_np.size > max_samples:
        audio_np = audio_np[-max_samples:]
    model, stt_lang = _resolve_stt_engine(payload.language_code)
    async with _STT_SEMAPHORE:
        segments, _info = await asyncio.to_thread(
            model.transcribe,
            audio_np,
            language=stt_lang,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": _whisper_vad_min_silence_ms()},
        )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return {"text": text}


def _run_piper(text: str, model_path: str) -> bytes:
    try:
        proc = subprocess.run(
            ["piper", "--model", model_path, "--output_raw"],
            input=(text + "\n").encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=_piper_timeout_seconds(),
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("piper timed out") from exc
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="ignore")
        raise RuntimeError(f"piper failed: {err}")
    return proc.stdout


def _pcm16_to_mulaw_8k(pcm16_bytes: bytes, input_rate: int) -> bytes:
    converted, _state = audioop.ratecv(pcm16_bytes, 2, 1, input_rate, 8000, None)
    return audioop.lin2ulaw(converted, 2)


def _run_kokoro_wav(text: str, language_code: str | None) -> tuple[bytes, int]:
    engine = _get_kokoro_engine()
    voice = _kokoro_voice_for(language_code)
    lang = _kokoro_lang_for(language_code)
    samples, sample_rate = engine.create(text, voice=voice, speed=_kokoro_speed(), lang=lang)
    pcm = np.asarray(samples, dtype=np.float32).clip(-1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype(np.int16)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wavf:
        wavf.setnchannels(1)
        wavf.setsampwidth(2)
        wavf.setframerate(int(sample_rate))
        wavf.writeframes(pcm16.tobytes())
    return bio.getvalue(), int(sample_rate)


def _split_text_for_tts(text: str, max_chars: int) -> list[str]:
    normalized = " ".join(text.split())
    if len(normalized) <= max_chars:
        return [normalized]
    parts: list[str] = []
    current = []
    current_len = 0
    for token in normalized.split(" "):
        needed = len(token) + (1 if current else 0)
        if current and current_len + needed > max_chars:
            parts.append(" ".join(current))
            current = [token]
            current_len = len(token)
        else:
            current.append(token)
            current_len += needed
    if current:
        parts.append(" ".join(current))
    return [p for p in parts if p]
