from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from app.models import CallSession


class CallRepository:
    def __init__(self, uri: str, db_name: str, collection_name: str) -> None:
        self._memory: dict[str, dict[str, Any]] = {}
        self._collection = None
        if uri:
            client = AsyncIOMotorClient(uri)
            self._collection = client[db_name][collection_name]

    async def upsert(self, session: CallSession) -> None:
        payload = session.model_dump(mode="json")
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        if self._collection is None:
            self._memory[session.call_sid] = payload
            return
        await self._collection.update_one(
            {"call_sid": session.call_sid},
            {"$set": payload},
            upsert=True,
        )

    async def get(self, call_sid: str) -> dict[str, Any] | None:
        if self._collection is None:
            return self._memory.get(call_sid)
        return await self._collection.find_one({"call_sid": call_sid}, {"_id": 0})

    async def list_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        if self._collection is None:
            sessions = list(self._memory.values())
            sessions.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
            return sessions[:limit]
        cursor = self._collection.find({}, {"_id": 0}).sort("updated_at", -1).limit(limit)
        return [item async for item in cursor]
