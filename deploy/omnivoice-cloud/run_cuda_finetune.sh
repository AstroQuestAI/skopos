#!/usr/bin/env bash
set -euo pipefail

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OMNI_DIR="${BUNDLE_DIR}/external/OmniVoice"

PYTHON_BIN="${PYTHON_BIN:-python3}"
GPU_IDS="${GPU_IDS:-0}"
NUM_GPUS="${NUM_GPUS:-1}"
TRAIN_CONFIG="${TRAIN_CONFIG:-examples/config/train_config_finetune_cuda.json}"
OUTPUT_DIR="${OUTPUT_DIR:-exp/omnivoice_finetune_cuda}"
STAGE="${STAGE:-0}"
STOP_STAGE="${STOP_STAGE:-1}"
TOKEN_DIR="${TOKEN_DIR:-data/finetune/tokens}"
TOKENIZER_PATH="${TOKENIZER_PATH:-eustlb/higgs-audio-v2-tokenizer}"
DATA_CONFIG="${DATA_CONFIG:-examples/config/data_config_finetune.json}"

if [[ ! -d "${BUNDLE_DIR}/voice_clean/clips" ]]; then
  echo "[cloud-train] Missing voice_clean/clips in bundle: ${BUNDLE_DIR}" >&2
  exit 1
fi

if [[ ! -f "${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" ]]; then
  echo "[cloud-train] Missing weighted CSV in bundle: ${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" >&2
  exit 1
fi

if [[ ! -d "${OMNI_DIR}" ]]; then
  mkdir -p "$(dirname "${OMNI_DIR}")"
  git clone https://github.com/k2-fsa/OmniVoice.git "${OMNI_DIR}"
fi

cd "${OMNI_DIR}"

if [[ ! -d ".venv" ]]; then
  "${PYTHON_BIN}" -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .

cp "${BUNDLE_DIR}/configs/train_config_finetune_cuda.json" examples/config/train_config_finetune_cuda.json

python "${BUNDLE_DIR}/scripts/prepare_omnivoice_finetune_data.py" \
  --input-csv "${BUNDLE_DIR}/voice_clean/training_metadata.weighted.csv" \
  --out-dir "${OMNI_DIR}/data" \
  --clip-dir "${BUNDLE_DIR}/voice_clean/clips" \
  --dev-ratio "${DEV_RATIO:-0.10}" \
  --seed "${SEED:-42}" \
  --fallback-language-id "${FALLBACK_LANG:-te}" \
  --respect-weight

if [[ "${STAGE}" == "0" ]]; then
  rm -rf "${TOKEN_DIR}"
fi

if [[ "${STAGE}" -le 0 && "${STOP_STAGE}" -ge 0 ]]; then
  echo "[cloud-train] Stage 0: tokenizing audio"
  for split in train dev; do
    input_jsonl="data/my_data_${split}.jsonl"
    if [[ ! -f "${input_jsonl}" ]]; then
      continue
    fi

    CUDA_VISIBLE_DEVICES="${GPU_IDS}" \
      python -m omnivoice.scripts.extract_audio_tokens \
      --input_jsonl "${input_jsonl}" \
      --tar_output_pattern "${TOKEN_DIR}/${split}/audios/shard-%06d.tar" \
      --jsonl_output_pattern "${TOKEN_DIR}/${split}/txts/shard-%06d.jsonl" \
      --tokenizer_path "${TOKENIZER_PATH}" \
      --nj_per_gpu "${NJ_PER_GPU:-3}" \
      --shuffle True
  done
fi

if [[ "${STAGE}" -le 1 && "${STOP_STAGE}" -ge 1 ]]; then
  echo "[cloud-train] Stage 1: fine-tuning"
  accelerate launch \
    --gpu_ids "${GPU_IDS}" \
    --num_processes "${NUM_GPUS}" \
    -m omnivoice.cli.train \
    --train_config "${TRAIN_CONFIG}" \
    --data_config "${DATA_CONFIG}" \
    --output_dir "${OUTPUT_DIR}"
fi

echo "[cloud-train] Finished. Output: ${OMNI_DIR}/${OUTPUT_DIR}"
