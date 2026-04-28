from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


class TranscriptTurn(BaseModel):
    speaker: Literal["assistant", "caller"]
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ExtractedDetails(BaseModel):
    caller_name: str | None = None
    company: str | None = None
    subject: str | None = None
    urgency: str | None = None
    callback_number: str | None = None

    def missing(self) -> list[str]:
        missing_fields: list[str] = []
        for key, value in self.model_dump().items():
            if not value:
                missing_fields.append(key)
        return missing_fields


class CallSession(BaseModel):
    call_sid: str
    from_number: str | None = None
    to_number: str | None = None
    stream_sid: str | None = None
    status: Literal["active", "completed"] = "active"
    transcript: list[TranscriptTurn] = Field(default_factory=list)
    details: ExtractedDetails = Field(default_factory=ExtractedDetails)
    summary: str | None = None
    user_action: Literal["allow", "block", "callback"] | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LlmDecision(BaseModel):
    assistant_reply: str
    should_end: bool = False
    summary: str | None = None
    details: ExtractedDetails = Field(default_factory=ExtractedDetails)
