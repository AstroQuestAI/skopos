FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV LLM_BACKEND=openai_compatible
ENV LLM_UPSTREAM_URL=
ENV LLM_MODEL=tiny-mini

WORKDIR /llm-sidecar

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY llm_sidecar/requirements.txt /llm-sidecar/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /llm-sidecar/requirements.txt

COPY llm_sidecar/app.py /llm-sidecar/app.py

EXPOSE 8095

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8095"]
