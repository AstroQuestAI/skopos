# Voice Adaptation Runbook

## 1) Confirm data

- Weighted manifest:
  `/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_clean/training_metadata.weighted.csv`
- Recommended: manually fix any flagged transcript rows before full training.

## 2) Create a run scaffold

```bash
cd /Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that
scripts/train_voice_adapt.sh
```

This creates:

- `artifacts/voice_adapt_runs/<run_name>/manifest.csv`
- `artifacts/voice_adapt_runs/<run_name>/train_config.env`
- `artifacts/voice_adapt_runs/<run_name>/README.txt`

## 3) Launch real training

Set your trainer command in `VOICE_TRAIN_CMD`.

Example template:

```bash
export VOICE_TRAIN_CMD='python train.py \
  --manifest "artifacts/voice_adapt_runs/<run_name>/manifest.csv" \
  --epochs 4 \
  --batch-size 8 \
  --lr 1e-5 \
  --val-split 0.15 \
  --output "artifacts/voice_adapt_runs/<run_name>"'
scripts/train_voice_adapt.sh
```

You can override runtime knobs:

- `EPOCHS` (default `4`)
- `BATCH_SIZE` (default `8`)
- `LR` (default `1e-5`)
- `VAL_SPLIT` (default `0.15`)

## 4) Evaluate adapted voice

```bash
scripts/eval_voice_adapt.sh
```

Then score A/B from:

- `artifacts/voice_eval/ab_prompts.txt`
- `artifacts/voice_eval/ab_scorecard.csv`

## 5) Shipping criteria

- Naturalness >= 4.0 average
- Pronunciation >= 4.0 average for target language
- Similarity >= 4.0 average

If below threshold:

1. Fix transcript quality first.
2. Add more clean clips (target 20+ min).
3. Re-run adaptation with small epoch increments.
