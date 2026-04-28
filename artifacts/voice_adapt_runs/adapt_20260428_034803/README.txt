Voice adaptation run scaffold
-----------------------------
Manifest: /Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_clean/training_metadata.weighted.csv
Run dir: /Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_adapt_runs/adapt_20260428_034803
Epochs: 4
Val split: 0.15
Batch size: 8
LR: 1e-5

To run real training, set VOICE_TRAIN_CMD.
Example:
  export VOICE_TRAIN_CMD='python train.py --manifest \"/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_adapt_runs/adapt_20260428_034803/manifest.csv\" --epochs 4 --batch-size 8 --lr 1e-5 --val-split 0.15 --output \"/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that/artifacts/voice_adapt_runs/adapt_20260428_034803\"'
  scripts/train_voice_adapt.sh
