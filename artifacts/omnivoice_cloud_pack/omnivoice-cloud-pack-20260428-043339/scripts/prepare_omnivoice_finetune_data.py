#!/usr/bin/env python3
import argparse
import csv
import json
import random
from pathlib import Path


def _safe_lang(value: str, fallback: str) -> str:
    cleaned = (value or "").strip().lower()
    return cleaned if cleaned else fallback


def _repeat_count(weight: float) -> int:
    if weight <= 1.0:
        return 1
    return max(1, int(round(weight)))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert weighted voice manifest CSV into OmniVoice train/dev JSONL manifests."
    )
    parser.add_argument("--input-csv", required=True, help="Path to weighted manifest CSV.")
    parser.add_argument("--out-dir", required=True, help="Output directory for JSONL files.")
    parser.add_argument("--train-name", default="my_data_train.jsonl")
    parser.add_argument("--dev-name", default="my_data_dev.jsonl")
    parser.add_argument("--dev-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--fallback-language-id",
        default="te",
        help="Used when CSV language is empty.",
    )
    parser.add_argument(
        "--respect-weight",
        action="store_true",
        help="If set, each row is repeated by rounded weight value for oversampling.",
    )
    parser.add_argument(
        "--clip-dir",
        default="",
        help="If set, audio_path is rewritten to this directory plus the clip basename.",
    )
    args = parser.parse_args()

    input_csv = Path(args.input_csv).expanduser().resolve()
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    with input_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        required = {"clip", "text"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV missing required columns: {sorted(missing)}")

        for idx, row in enumerate(reader, start=1):
            clip = (row.get("clip") or "").strip()
            text = (row.get("text") or "").strip()
            if not clip or not text:
                continue
            if args.clip_dir:
                clip = str((Path(args.clip_dir).expanduser().resolve() / Path(clip).name))

            weight_str = (row.get("weight") or "1").strip()
            try:
                weight = float(weight_str)
            except ValueError:
                weight = 1.0

            lang = _safe_lang(row.get("language", ""), args.fallback_language_id)
            base_record = {
                "id": f"sample_{idx:06d}",
                "audio_path": clip,
                "text": text,
                "language_id": lang,
            }

            repeat = _repeat_count(weight) if args.respect_weight else 1
            for r in range(repeat):
                if r == 0:
                    rows.append(base_record)
                else:
                    rows.append({**base_record, "id": f"{base_record['id']}_w{r+1}"})

    if not rows:
        raise ValueError("No usable rows found in input CSV.")

    rng = random.Random(args.seed)
    rng.shuffle(rows)

    dev_count = max(1, int(len(rows) * args.dev_ratio))
    if dev_count >= len(rows):
        dev_count = max(1, len(rows) - 1)

    dev_rows = rows[:dev_count]
    train_rows = rows[dev_count:]

    train_path = out_dir / args.train_name
    dev_path = out_dir / args.dev_name

    with train_path.open("w", encoding="utf-8") as f:
        for row in train_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    with dev_path.open("w", encoding="utf-8") as f:
        for row in dev_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    summary = {
        "input_csv": str(input_csv),
        "train_jsonl": str(train_path),
        "dev_jsonl": str(dev_path),
        "total_rows_after_weighting": len(rows),
        "train_rows": len(train_rows),
        "dev_rows": len(dev_rows),
        "dev_ratio": args.dev_ratio,
        "seed": args.seed,
        "respect_weight": args.respect_weight,
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
