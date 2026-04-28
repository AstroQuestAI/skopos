#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

import httpx


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        text=True,
    ).strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def detect_language_code(text: str) -> str:
    for ch in text:
        cp = ord(ch)
        if 0x0C00 <= cp <= 0x0C7F:
            return "te-IN"
        if 0x0900 <= cp <= 0x097F:
            return "hi-IN"
    lowered = text.lower()
    if any(token in lowered for token in ("mee ", "andi", "ivala", "cheppagalar", "kavali")):
        return "te-IN"
    if any(token in lowered for token in ("kripya", "mera", "namaste", "batayen")):
        return "hi-IN"
    return "en-IN"


def voice_for_lang(lang: str, speaker: str) -> str | None:
    speaker_key = "ASSISTANT" if speaker == "assistant" else "CALLER"
    env_specific = os.getenv(f"GOOGLE_TTS_VOICE_{lang.replace('-', '_').upper()}_{speaker_key}", "").strip()
    if env_specific:
        return env_specific
    env_by_lang = os.getenv(f"GOOGLE_TTS_VOICE_{lang.replace('-', '_').upper()}", "").strip()
    if env_by_lang:
        return env_by_lang
    defaults = {
        "en-IN": "en-IN-Standard-C",
        "hi-IN": "hi-IN-Standard-A",
        "te-IN": "te-IN-Neural2-A",
    }
    return defaults.get(lang)


def voice_candidates_for_lang(lang: str, speaker: str) -> list[str]:
    primary = voice_for_lang(lang, speaker)
    if lang == "te-IN":
        fallbacks = [
            "te-IN-Chirp3-HD-Sulafat",
            "te-IN-Chirp3-HD-Achernar",
            "te-IN-Neural2-A",
            "te-IN-Standard-A",
        ]
    elif lang == "hi-IN":
        fallbacks = ["hi-IN-Standard-A"]
    else:
        fallbacks = ["en-IN-Standard-C"]
    ordered: list[str] = []
    for v in [primary] + fallbacks:
        if v and v not in ordered:
            ordered.append(v)
    return ordered


def synth_google_wav(text: str, lang: str, speaker: str, out_wav: Path) -> None:
    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    last_exc: Exception | None = None
    for voice_name in voice_candidates_for_lang(lang, speaker):
        try:
            response = client.synthesize_speech(
                request=texttospeech.SynthesizeSpeechRequest(
                    input=texttospeech.SynthesisInput(text=text),
                    voice=texttospeech.VoiceSelectionParams(language_code=lang, name=voice_name),
                    audio_config=texttospeech.AudioConfig(
                        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                        sample_rate_hertz=16000,
                        speaking_rate=1.0,
                    ),
                )
            )
            out_wav.write_bytes(response.audio_content)
            return
        except Exception as exc:  # pragma: no cover - provider/network variance
            last_exc = exc
    if last_exc:
        raise last_exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--assistant-voice", default="Samantha")
    parser.add_argument("--caller-voice", default="Rishi")
    parser.add_argument("--tts-engine", choices=["google", "say"], default="google")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = out_dir / "multi_lang_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    transcript_json = out_dir / "multilingual-dialect-transcript.json"
    script_txt = out_dir / "multilingual-dialect-script.txt"
    voice_wav = out_dir / "multilingual-dialect-voice.wav"

    caller_turns = [
        "Hello, this is Rahul Verma calling from Hyderabad for invoice follow-up.",
        "నమస్తే అండి, నేను శ్రీ లక్ష్మి ట్రేడర్స్ నుంచి మాట్లాడుతున్నాను.",
        "नमस्ते, भुगतान लंबित है और अपडेट चाहिए।",
        "This is about last month shipment payment approval.",
        "Koncham urgent andi, ivala update kavali.",
        "कृपया callback आज ही कर दीजिए।",
        "Mee daggara callback kosam number note cheyandi, 9876543210.",
        "Please mark this as high priority and pass it to Alex.",
        "ధన్యవాదాలు, మీ స్పందన కోసం వేచి చూస్తాను.",
        "बहुत धन्यवाद, मैं फिर से फॉलो-अप करूंगा।",
    ]

    lines: list[dict[str, str]] = []
    with httpx.Client(timeout=30.0) as client:
        start_resp = client.post(
            f"{args.base_url}/api/sim/start",
            json={"from_number": "+919955440011", "to_number": "+919800000000"},
        )
        start_resp.raise_for_status()
        start_data = start_resp.json()
        call_sid = start_data["call_sid"]
        lines.append({"speaker": "assistant", "text": start_data["assistant_reply"]})

        for caller_text in caller_turns:
            lines.append({"speaker": "caller", "text": caller_text})
            turn_resp = client.post(
                f"{args.base_url}/api/sim/turn",
                json={"call_sid": call_sid, "caller_text": caller_text},
            )
            turn_resp.raise_for_status()
            turn_data = turn_resp.json()
            lines.append({"speaker": "assistant", "text": turn_data["assistant_reply"]})
            if bool(turn_data.get("should_end", False)):
                break

    transcript_json.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")

    script_txt_lines: list[str] = []
    for idx, line in enumerate(lines, start=1):
        speaker = "Assistant" if line["speaker"] == "assistant" else "Caller"
        script_txt_lines.append(f"{idx:02d}. {speaker}: {line['text']}")
    script_txt.write_text("\n".join(script_txt_lines) + "\n", encoding="utf-8")

    concat_file = tmp_dir / "concat.txt"
    if concat_file.exists():
        concat_file.unlink()

    for idx, line in enumerate(lines, start=1):
        clip_wav = tmp_dir / f"{idx:02d}.wav"
        is_assistant = line["speaker"] == "assistant"
        speaker = "assistant" if is_assistant else "caller"
        if args.tts_engine == "google":
            lang = detect_language_code(line["text"])
            try:
                synth_google_wav(line["text"], lang, speaker, clip_wav)
            except Exception:
                # Keep previous local fallback if Google credentials/voice are unavailable.
                clip_aiff = tmp_dir / f"{idx:02d}.aiff"
                voice = args.assistant_voice if is_assistant else args.caller_voice
                rate = "176" if is_assistant else "168"
                run(["say", "-v", voice, "-r", rate, "-o", str(clip_aiff), line["text"]])
                run(["ffmpeg", "-y", "-i", str(clip_aiff), "-ar", "16000", "-ac", "1", str(clip_wav)])
        else:
            clip_aiff = tmp_dir / f"{idx:02d}.aiff"
            voice = args.assistant_voice if is_assistant else args.caller_voice
            rate = "176" if is_assistant else "168"
            run(["say", "-v", voice, "-r", rate, "-o", str(clip_aiff), line["text"]])
            run(["ffmpeg", "-y", "-i", str(clip_aiff), "-ar", "16000", "-ac", "1", str(clip_wav)])
        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{clip_wav}'\n")

        pause_wav = tmp_dir / f"{idx:02d}_pause.wav"
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "0.65", str(pause_wav)])
        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{pause_wav}'\n")

    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-ar",
            "16000",
            "-ac",
            "1",
            str(voice_wav),
        ]
    )

    duration = ffprobe_duration(voice_wav)
    print(json.dumps({"voice_wav": str(voice_wav), "duration_sec": round(duration, 2)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
