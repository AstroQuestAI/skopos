# OmniVoice Cloud Handoff

This bundle lets us fine-tune OmniVoice on a CUDA GPU while keeping the Mac for data prep and app testing.

## Recommended machine

Use a rented CUDA box with at least:

- NVIDIA GPU with 16 GB VRAM minimum
- 24 GB VRAM preferred
- Ubuntu 22.04 or similar
- Python 3.10 or 3.11 preferred
- `git`, `ffmpeg`, and CUDA-ready PyTorch environment

For a low-cost first run, use one GPU and keep the default `500` training steps.

## Run on the cloud machine

Extract the bundle:

```bash
tar -xzf omnivoice-cloud-pack-YYYYMMDD-HHMMSS.tar.gz
cd omnivoice-cloud-pack-YYYYMMDD-HHMMSS
```

Install system basics if needed:

```bash
sudo apt-get update
sudo apt-get install -y git ffmpeg python3-venv
```

Run fine-tuning:

```bash
deploy/omnivoice-cloud/run_cuda_finetune.sh
```

Useful overrides:

```bash
GPU_IDS=0 NUM_GPUS=1 deploy/omnivoice-cloud/run_cuda_finetune.sh
```

```bash
OUTPUT_DIR=exp/omnivoice_finetune_cuda_1000 \
deploy/omnivoice-cloud/run_cuda_finetune.sh
```

To resume only training after tokenization is already done:

```bash
STAGE=1 STOP_STAGE=1 deploy/omnivoice-cloud/run_cuda_finetune.sh
```

## Outputs to copy back

After training, copy this directory back to the Mac:

```bash
external/OmniVoice/exp/omnivoice_finetune_cuda
```

The default config saves checkpoints every `100` steps and keeps the last `3`.

## Notes

The bundle regenerates OmniVoice JSONL manifests on the cloud machine so audio paths are valid after extraction. It does not depend on the absolute paths from the Mac.

If the GPU is small, lower these in `configs/train_config_finetune_cuda.json`:

- `batch_tokens`
- `max_batch_size`
- `max_sample_tokens`

If the GPU has 24 GB or more, the default config is a good starting point.
