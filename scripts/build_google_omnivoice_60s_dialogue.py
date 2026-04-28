#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from google.cloud import texttospeech


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


def google_voice_for_lang(lang: str) -> str:
    if lang == "te-IN":
        return os.getenv("GOOGLE_TTS_VOICE_TE_IN", "te-IN-Neural2-A")
    if lang == "hi-IN":
        return os.getenv("GOOGLE_TTS_VOICE_HI_IN", "hi-IN-Standard-A")
    return os.getenv("GOOGLE_TTS_VOICE_EN_IN", "en-IN-Standard-C")


def omnivoice_lang_id(lang: str) -> str:
    if lang.startswith("te"):
        return "te"
    if lang.startswith("hi"):
        return "hi"
    return "en"


def omnivoice_lang_name(lang: str) -> str:
    if lang.startswith("te"):
        return "Telugu"
    if lang.startswith("hi"):
        return "Hindi"
    return "English"


def main() -> int:
    root = Path("/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that")
    artifacts = root / "artifacts"
    tmp = artifacts / "google_omni_60s_tmp"
    omni_out = tmp / "omni_out"
    artifacts.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    omni_out.mkdir(parents=True, exist_ok=True)

    for p in tmp.glob("*"):
        if p.is_file():
            p.unlink()
    for p in omni_out.glob("*"):
        if p.is_file():
            p.unlink()

    script_txt = artifacts / "google-omni-60s-script.txt"
    transcript_json = artifacts / "google-omni-60s-transcript.json"
    voice_wav = artifacts / "google-omni-60s-voice.wav"

    # Caller lines use Google TTS; assistant lines use OmniVoice.
    lines = [
        {"speaker": "assistant", "lang": "en-IN", "text": "Hi, you have reached Alex assistant. May I know who is calling and what this is regarding?"},
        {"speaker": "caller", "lang": "en-IN", "text": "Hello, this is Ravi from Hyderabad calling about invoice follow up."},
        {"speaker": "assistant", "lang": "te-IN", "text": "మీ కాల్ విషయం ఏంటో కాస్త వివరంగా చెప్పండి."},
        {"speaker": "caller", "lang": "te-IN", "text": "ఇది పెండింగ్ చెల్లింపు గురించి కాల్. ఈరోజే కన్ఫర్మేషన్ కావాలి."},
        {"speaker": "assistant", "lang": "hi-IN", "text": "ठीक है, मैं इसे प्राथमिकता के साथ नोट कर रहा हूँ।"},
        {"speaker": "caller", "lang": "hi-IN", "text": "कृपया इसे हाई अर्जेंसी में डाल दीजिए, आज जवाब चाहिए।"},
        {"speaker": "assistant", "lang": "en-IN", "text": "Sure, please share your callback number slowly so I can capture it correctly."},
        {"speaker": "caller", "lang": "en-IN", "text": "Please note nine eight seven six five four three two one zero."},
        {"speaker": "assistant", "lang": "te-IN", "text": "ధన్యవాదాలు, నేను ఈ వివరాలు అలెక్స్‌కి వెంటనే పంపిస్తాను."},
        {"speaker": "caller", "lang": "te-IN", "text": "బాగుంది, దయచేసి పేమెంట్ టీం నుండి కూడా ఒక అప్డేట్ ఇవ్వండి."},
        {"speaker": "assistant", "lang": "hi-IN", "text": "ज़रूर, मैं कॉल का सारांश और नंबर तुरंत शेयर कर दूँगा।"},
        {"speaker": "caller", "lang": "hi-IN", "text": "धन्यवाद, मैं आपके अपडेट का इंतज़ार करूँगा।"},
    ]

    transcript_json.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    script_lines = []
    for idx, item in enumerate(lines, start=1):
        who = "Assistant(OmniVoice)" if item["speaker"] == "assistant" else "Caller(Google)"
        script_lines.append(f"{idx:02d}. {who} [{item['lang']}]: {item['text']}")
    script_txt.write_text("\n".join(script_lines) + "\n", encoding="utf-8")

    # Build OmniVoice batch list for assistant lines.
    omni_jsonl = tmp / "omni_batch.jsonl"
    with omni_jsonl.open("w", encoding="utf-8") as fp:
        for idx, item in enumerate(lines, start=1):
            if item["speaker"] != "assistant":
                continue
            rec = {
                "id": f"{idx:02d}",
                "text": item["text"],
                "language_id": omnivoice_lang_id(item["lang"]),
                "language_name": omnivoice_lang_name(item["lang"]),
            }
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # Generate assistant audio with one OmniVoice batch run.
    run(
        [
            str(root / ".venv/bin/omnivoice-infer-batch"),
            "--test_list",
            str(omni_jsonl),
            "--res_dir",
            str(omni_out),
        ]
    )

    # Generate caller audio with Google TTS.
    tts_client = texttospeech.TextToSpeechClient()
    concat_file = tmp / "concat.txt"
    if concat_file.exists():
        concat_file.unlink()

    for idx, item in enumerate(lines, start=1):
        clip_wav = tmp / f"{idx:02d}.wav"
        if item["speaker"] == "assistant":
            src = omni_out / f"{idx:02d}.wav"
            if not src.exists():
                raise FileNotFoundError(f"OmniVoice output missing: {src}")
            run(["ffmpeg", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(clip_wav)])
        else:
            resp = tts_client.synthesize_speech(
                request=texttospeech.SynthesizeSpeechRequest(
                    input=texttospeech.SynthesisInput(text=item["text"]),
                    voice=texttospeech.VoiceSelectionParams(
                        language_code=item["lang"],
                        name=google_voice_for_lang(item["lang"]),
                    ),
                    audio_config=texttospeech.AudioConfig(
                        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                        sample_rate_hertz=16000,
                    ),
                )
            )
            clip_wav.write_bytes(resp.audio_content)

        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{clip_wav}'\n")

        pause_wav = tmp / f"{idx:02d}_pause.wav"
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "0.8", str(pause_wav)])
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
    print(json.dumps({"voice_wav": str(voice_wav), "duration_sec": round(ffprobe_duration(voice_wav), 2)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
