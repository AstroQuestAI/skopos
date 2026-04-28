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
    tmp = artifacts / "omnivoice_2female_30s_tmp"
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

    script_txt = artifacts / "omnivoice-2female-30s-script.txt"
    transcript_json = artifacts / "omnivoice-2female-30s-transcript.json"
    voice_wav = artifacts / "omnivoice-2female-30s-voice.wav"

    lines = [
        {"speaker": "female_1", "text": "హాయ్, ఇవాళ మీటింగ్ చాలా బాగానే జరిగింది కదా."},
        {"speaker": "female_2", "text": "అవును, especially చివర్లో టీమ్ ప్లాన్ క్లియర్ అయింది."},
        {"speaker": "female_1", "text": "రేపు క్లయింట్ కాల్ ముందు మనం ఒకసారి notes sync చేద్దామా."},
        {"speaker": "female_2", "text": "ఖచ్చితంగా, నేను slides కూడా update చేసి పంపిస్తాను."},
        {"speaker": "female_1", "text": "సూపర్, నీ delivery style చాలా confident గా ఉంది."},
        {"speaker": "female_2", "text": "థ్యాంక్స్, నువ్వు support చేసినందుకే smooth గా అయ్యింది."},
        {"speaker": "female_1", "text": "సరే, సాయంత్రం చిన్న checklist finalize చేద్దాం."},
        {"speaker": "female_2", "text": "డన్, నేను 6 గంటలకు ping చేస్తాను."},
    ]

    transcript_json.write_text(json.dumps(lines, ensure_ascii=False, indent=2), encoding="utf-8")
    script_txt.write_text(
        "\n".join(f"{idx:02d}. {line['speaker']}[omni te]: {line['text']}" for idx, line in enumerate(lines, start=1)) + "\n",
        encoding="utf-8",
    )

    omni_jsonl = tmp / "omni_batch.jsonl"
    with omni_jsonl.open("w", encoding="utf-8") as fp:
        for idx, item in enumerate(lines, start=1):
            fp.write(
                json.dumps(
                    {"id": f"{idx:02d}", "text": item["text"], "language_id": "te", "language_name": "Telugu"},
                    ensure_ascii=False,
                )
                + "\n"
            )

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
            raise FileNotFoundError(f"Missing Omni output: {src}")
        dst = tmp / f"{idx:02d}.wav"
        if item["speaker"] == "female_1":
            # Brighter female timbre.
            fx = "asetrate=24000*1.22,aresample=16000,atempo=0.92,volume=1.12"
        else:
            # Second female voice with distinct pitch/rhythm from female_1.
            fx = "asetrate=24000*1.30,aresample=16000,atempo=0.86,volume=1.10"
        run(["ffmpeg", "-y", "-i", str(src), "-af", fx, "-ar", "16000", "-ac", "1", str(dst)])
        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{dst}'\n")
        pause = tmp / f"{idx:02d}_pause.wav"
        run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "0.7", str(pause)])
        with concat_file.open("a", encoding="utf-8") as fp:
            fp.write(f"file '{pause}'\n")

    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-ar", "16000", "-ac", "1", str(voice_wav)])
    print(json.dumps({"voice_wav": str(voice_wav), "duration_sec": round(ffprobe_duration(voice_wav), 2)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
