FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIPER_MODEL_PATH=/models/en_US-lessac-medium.onnx
ENV PIPER_SAMPLE_RATE=22050
ENV WHISPER_MODEL=tiny.en

WORKDIR /sidecar

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY sidecar/requirements.txt /sidecar/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /sidecar/requirements.txt

COPY sidecar/app.py /sidecar/app.py
COPY sidecar/download_piper_model.sh /sidecar/download_piper_model.sh
RUN chmod +x /sidecar/download_piper_model.sh

EXPOSE 8090

CMD ["/bin/sh", "-c", "/sidecar/download_piper_model.sh && uvicorn app:app --host 0.0.0.0 --port 8090"]
