#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/apple/Documents/Codex/2026-04-27/i-am-builing-an-app-that"
PACK_ROOT="${ROOT}/artifacts/omnivoice_cloud_pack"
PACK_NAME="${PACK_NAME:-omnivoice-cloud-pack-$(date +%Y%m%d-%H%M%S)}"
PACK_DIR="${PACK_ROOT}/${PACK_NAME}"
TARBALL="${PACK_ROOT}/${PACK_NAME}.tar.gz"

rm -rf "${PACK_DIR}"
mkdir -p \
  "${PACK_DIR}/voice_clean" \
  "${PACK_DIR}/scripts" \
  "${PACK_DIR}/deploy/omnivoice-cloud" \
  "${PACK_DIR}/configs"

cp -R "${ROOT}/artifacts/voice_clean/clips" "${PACK_DIR}/voice_clean/clips"
cp "${ROOT}/artifacts/voice_clean/training_metadata.weighted.csv" "${PACK_DIR}/voice_clean/training_metadata.weighted.csv"
cp "${ROOT}/artifacts/voice_clean/weighted_manifest_report.md" "${PACK_DIR}/voice_clean/weighted_manifest_report.md"
cp "${ROOT}/artifacts/voice_clean/review_priority.md" "${PACK_DIR}/voice_clean/review_priority.md"
cp "${ROOT}/scripts/prepare_omnivoice_finetune_data.py" "${PACK_DIR}/scripts/prepare_omnivoice_finetune_data.py"
cp "${ROOT}/deploy/omnivoice-cloud/run_cuda_finetune.sh" "${PACK_DIR}/deploy/omnivoice-cloud/run_cuda_finetune.sh"
cp "${ROOT}/deploy/omnivoice-cloud/train_config_finetune_cuda.json" "${PACK_DIR}/configs/train_config_finetune_cuda.json"
cp "${ROOT}/OMNIVOICE_CLOUD_HANDOFF.md" "${PACK_DIR}/README.md"

chmod +x "${PACK_DIR}/deploy/omnivoice-cloud/run_cuda_finetune.sh"
find "${PACK_DIR}" -name ".DS_Store" -delete

tar -czf "${TARBALL}" -C "${PACK_ROOT}" "${PACK_NAME}"

echo "[cloud-pack] Created bundle directory: ${PACK_DIR}"
echo "[cloud-pack] Created tarball: ${TARBALL}"
du -sh "${TARBALL}"
