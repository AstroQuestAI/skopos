#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path


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


def main() -> int:
    root = Path("/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that")
    artifacts = root / "artifacts"
    tmp = artifacts / "omnivoice_telugu_3way_60s_tmp"
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

    script_txt = artifacts / "omnivoice-telugu-3way-60s-script.txt"
    transcript_json = artifacts / "omnivoice-telugu-3way-60s-transcript.json"
    voice_wav = artifacts / "omnivoice-telugu-3way-60s-voice.wav"

    # First half: two female coworkers talk.
    # Second half: male coworker joins and all three continue.
    lines = [
        {"speaker": "female_1", "text": "హాయ్ నిహారిక, మన టీమ్‌లో కొత్తగా వచ్చిన ఆదిత్య చాలా హ్యాండ్సమ్‌గా ఉన్నాడు కదా."},
        {"speaker": "female_2", "text": "అవును శ్రేయ, అతని స్టైల్ కూడా చాలా neat గా ఉంటుంది."},
        {"speaker": "female_1", "text": "నిన్న స్టాండ్‌ప్‌లో మాట్లాడిన తీరు చాలా కాన్ఫిడెంట్‌గా అనిపించింది."},
        {"speaker": "female_2", "text": "అలాగే అందరితో చాలా politely మాట్లాడాడు, అది నాకు బాగా నచ్చింది."},
        {"speaker": "female_1", "text": "లంచ్ బ్రేక్‌లో మాట్లాడితే ఫ్రెండ్లీగా ఉంటాడేమో అనిపిస్తోంది."},
        {"speaker": "female_2", "text": "నిజం, అతని smile కూడా చాలా charming గా ఉంది."},
        {"speaker": "female_1", "text": "ఓహ్ ఒక నిమిషం, అతను ఇప్పుడు కాల్‌లోకి జాయిన్ అవుతున్నట్టు ఉంది."},
        {"speaker": "female_2", "text": "సరే, cool గా మాట్లాడుదాం."},
        {"speaker": "male", "text": "హాయ్ మీ ఇద్దరికీ, నా గురించి మాట్లాడుతున్నట్టు వినిపించింది, ఏమైంది."},
        {"speaker": "female_1", "text": "హాయ్ ఆదిత్య, మీ presentation clarity గురించి మేము మాట్లాడుతున్నాం."},
        {"speaker": "male", "text": "అది విని చాలా ఆనందంగా ఉంది, థ్యాంక్యూ."},
        {"speaker": "female_2", "text": "మీరు టీమ్‌లోకి వచ్చాక మంచి positive vibe వచ్చింది."},
        {"speaker": "male", "text": "చాలా ధన్యవాదాలు, మనం కలిసి మంచి పని చేద్దాం."},
        {"speaker": "female_1", "text": "ఖచ్చితంగా, త్వరలో కాఫీ దగ్గర ఇంకాస్త మాట్లాడుకుందాం."},
        {"speaker": "female_2", "text": "సూపర్, అప్పుడు కలుద్దాం."},
        {"speaker": "male", "text": "సరే, మీ ఇద్దరికీ మంచి రోజు."},
    ]

    transcript_json.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    script_lines: list[str] = []
    for idx, item in enumerate(lines, start=1):
        label = item["speaker"]
        script_lines.append(f"{idx:02d}. {label}[omni te]: {item['text']}")
    script_txt.write_text("\n".join(script_lines) + "\n", encoding="utf-8")

    omni_jsonl = tmp / "omni_batch.jsonl"
    with omni_jsonl.open("w", encoding="utf-8") as fp:
        for idx, item in enumerate(lines, start=1):
            rec = {
                "id": f"{idx:02d}",
                "text": item["text"],
                "language_id": "te",
                "language_name": "Telugu",
            }
            fp.write(json.dumps(rec, ensure_ascii=False) + "\n")

    run(
        [
            str(root / ".venv/bin/omnivoice-infer-batch"),
            "--test_list",
            str(omni_jsonl),
            "--res_dir",
            str(omni_out),
        ]
    )

    concat_file = tmp / "concat.txt"
    if concat_file.exists():
        concat_file.unlink()

    for idx, item in enumerate(lines, start=1):
        src = omni_out / f"{idx:02d}.wav"
        if not src.exists():
            raise FileNotFoundError(f"OmniVoice output missing: {src}")

        clip_wav = tmp / f"{idx:02d}.wav"
        speaker = item["speaker"]
        if speaker == "female_1":
            filter_chain = "asetrate=24000*1.04,aresample=16000,atempo=1.03,volume=1.10"
        elif speaker == "female_2":
            filter_chain = "asetrate=24000*1.08,aresample=16000,atempo=1.05,volume=1.08"
        else:
            filter_chain = "asetrate=24000*0.90,aresample=16000,atempo=0.96,volume=1.12"

        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(src),
                "-af",
                filter_chain,
                "-ar",
                "16000",
                "-ac",
                "1",
                str(clip_wav),
            ]
        )

        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{clip_wav}'\n")

        pause_wav = tmp / f"{idx:02d}_pause.wav"
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1.0", str(pause_wav)])
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
