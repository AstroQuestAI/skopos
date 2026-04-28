#!/usr/bin/env sh
set -eu

MODEL_PATH="${PIPER_MODEL_PATH:-/models/en_US-lessac-medium.onnx}"
MODEL_URL="${PIPER_MODEL_URL:-https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true}"
CONFIG_PATH="${MODEL_PATH}.json"
CONFIG_URL="${PIPER_CONFIG_URL:-https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true}"
MODEL_PATH_HI="${PIPER_MODEL_PATH_HI:-/models/hi_IN-priyamvada-medium.onnx}"
MODEL_URL_HI="${PIPER_MODEL_URL_HI:-}"
CONFIG_URL_HI="${PIPER_CONFIG_URL_HI:-}"
MODEL_PATH_TE="${PIPER_MODEL_PATH_TE:-/models/te_IN-maya-medium.onnx}"
MODEL_URL_TE="${PIPER_MODEL_URL_TE:-}"
CONFIG_URL_TE="${PIPER_CONFIG_URL_TE:-}"

mkdir -p "$(dirname "${MODEL_PATH}")"

ensure_model_pair() {
  mp="$1"
  mu="$2"
  cu="$3"
  cp="${mp}.json"

  mkdir -p "$(dirname "${mp}")"

  if [ ! -f "${mp}" ]; then
    if [ -n "${mu}" ]; then
      echo "[sidecar] Downloading Piper model: ${mp}"
      curl -fL "${mu}" -o "${mp}"
    else
      echo "[sidecar] Skipping model download (no URL): ${mp}"
    fi
  fi

  if [ ! -f "${cp}" ]; then
    if [ -n "${cu}" ]; then
      echo "[sidecar] Downloading Piper model config: ${cp}"
      curl -fL "${cu}" -o "${cp}"
    else
      echo "[sidecar] Skipping config download (no URL): ${cp}"
    fi
  fi

  if [ -f "${mp}" ] && [ -f "${cp}" ]; then
    echo "[sidecar] Piper model ready: ${mp}"
    echo "[sidecar] Piper config ready: ${cp}"
    return 0
  fi
  return 1
}

if ! ensure_model_pair "${MODEL_PATH}" "${MODEL_URL}" "${CONFIG_URL}"; then
  echo "[sidecar] Required default Piper model/config missing."
  exit 1
fi

ensure_model_pair "${MODEL_PATH_HI}" "${MODEL_URL_HI}" "${CONFIG_URL_HI}" || true
ensure_model_pair "${MODEL_PATH_TE}" "${MODEL_URL_TE}" "${CONFIG_URL_TE}" || true
