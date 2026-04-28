from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "dev"
    app_public_base_url: str = "http://localhost:8000"

    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    app_mode: Literal["generic", "dialer"] = "generic"
    llm_strategy: Literal["local_first", "local_only", "cloud_only"] = "local_first"
    local_llm_enabled: bool = True
    local_llm_model_name: str = "tiny-mini"
    local_llm_backend: Literal["openai_compatible", "ollama"] = "openai_compatible"
    local_llm_api_url: str = ""
    local_llm_timeout_seconds: float = 12.0
    local_llm_confidence_threshold: float = 0.72

    deepgram_api_key: str = ""
    voice_sidecar_url: str = ""

    mongodb_uri: str = ""
    mongodb_db: str = "call_assistant"
    mongodb_collection: str = "calls"

    push_webhook_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
