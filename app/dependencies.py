from functools import lru_cache

from app.config import get_settings
from app.services.orchestrator import SessionOrchestrator
from app.services.providers.deepgram_provider import DeepgramProvider
from app.services.providers.llm_provider import LlmProvider, LocalFirstLlmProvider, OnDeviceLlmAdapter
from app.services.providers.mongo_repo import CallRepository
from app.services.providers.notifier import PushNotifier
from app.services.providers.tts_provider import ElevenLabsProvider


@lru_cache
def get_repo() -> CallRepository:
    settings = get_settings()
    return CallRepository(
        uri=settings.mongodb_uri,
        db_name=settings.mongodb_db,
        collection_name=settings.mongodb_collection,
    )


@lru_cache
def get_llm() -> LocalFirstLlmProvider:
    settings = get_settings()
    cloud_provider = LlmProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        app_mode=settings.app_mode,
    )
    on_device_adapter = None
    if settings.local_llm_enabled:
        on_device_adapter = OnDeviceLlmAdapter(
            model_name=settings.local_llm_model_name,
            api_url=settings.local_llm_api_url,
            backend=settings.local_llm_backend,
            timeout_seconds=settings.local_llm_timeout_seconds,
        )
    strategy = settings.llm_strategy
    if not settings.local_llm_enabled and strategy != "cloud_only":
        strategy = "cloud_only"
    return LocalFirstLlmProvider(
        cloud_provider=cloud_provider,
        on_device_adapter=on_device_adapter,
        app_mode=settings.app_mode,
        strategy=strategy,
        local_confidence_threshold=settings.local_llm_confidence_threshold,
    )


@lru_cache
def get_notifier() -> PushNotifier:
    settings = get_settings()
    return PushNotifier(webhook_url=settings.push_webhook_url)


@lru_cache
def get_orchestrator() -> SessionOrchestrator:
    return SessionOrchestrator(repo=get_repo(), llm=get_llm(), notifier=get_notifier())


@lru_cache
def get_stt() -> DeepgramProvider:
    settings = get_settings()
    return DeepgramProvider(
        api_key=settings.deepgram_api_key,
        sidecar_url=settings.voice_sidecar_url,
    )


@lru_cache
def get_tts() -> ElevenLabsProvider:
    settings = get_settings()
    return ElevenLabsProvider(
        sidecar_url=settings.voice_sidecar_url,
    )
