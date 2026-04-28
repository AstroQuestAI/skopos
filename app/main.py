from fastapi import FastAPI

from app.routes.calls import router as calls_router

app = FastAPI(title="AI Call Screener", version="0.1.0")
app.include_router(calls_router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
