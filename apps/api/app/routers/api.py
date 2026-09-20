from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.models import AppSettings, CourseMeta
from app.core.settings_store import store
from app.providers.router import router
from app.rag.service import rag_service

api_router = APIRouter()


class KeyBody(BaseModel):
    ref: str
    api_key: str


class SearchBody(BaseModel):
    overview: bool = False
    query: str = Field(min_length=1, max_length=12000, pattern=r"\S")
    course_id: str | None = Field(default=None, pattern=r"^[a-zA-Z0-9_-]+$")
    top_k: int | None = Field(default=None, ge=1, le=20)


@api_router.get("/health")
async def health():
    return {"ok": True, "app": settings.app_name}


@api_router.get("/settings", response_model=AppSettings)
async def get_settings():
    return store.load_settings()


@api_router.put("/settings", response_model=AppSettings)
async def put_settings(body: AppSettings):
    return store.save_settings(body)


@api_router.get("/settings/keys")
async def list_keys():
    return {"refs": store.list_key_refs()}


@api_router.post("/settings/keys")
async def set_key(body: KeyBody):
    store.set_key(body.ref, body.api_key)
    return {"ok": True, "ref": body.ref}


@api_router.delete("/settings/keys/{ref}")
async def delete_key(ref: str):
    ok = store.delete_key(ref)
    if not ok:
        raise HTTPException(404, "Key ref not found")
    return {"ok": True}


@api_router.get("/providers")
async def providers_catalog():
    return {
        "llm": {
            "offline": [{"provider": "ollama", "models": ["qwen2.5:14b-instruct-q4_K_M", "llama3.1:8b"]}],
            "online": [
                {"provider": "openai", "models": ["gpt-4o", "gpt-4o-mini"]},
                {"provider": "gemini", "models": ["gemini-2.0-flash", "gemini-1.5-pro"]},
                {"provider": "anthropic", "models": ["claude-3-5-sonnet-latest"]},
                {"provider": "xai", "models": ["grok-2-latest"]},
                {"provider": "openrouter", "models": ["openrouter/auto"]},
                {"provider": "groq", "models": ["llama-3.3-70b-versatile"]},
            ],
        },
        "stt": {
            "offline": [{"provider": "faster-whisper", "models": ["medium", "large-v3", "small"]}],
            "online": [
                {"provider": "openai", "models": ["whisper-1"]},
                {"provider": "deepgram", "models": ["nova-2"]},
            ],
        },
        "tts": {
            "offline": [
                {"provider": "kokoro", "voices": ["af_heart", "am_adam"]},
                {"provider": "piper", "voices": ["tr_TR-dfki-medium"]},
            ],
            "online": [
                {"provider": "edge-tts", "voices": ["tr-TR-EmelNeural", "tr-TR-AhmetNeural"]},
                {"provider": "openai", "voices": ["nova", "alloy", "shimmer"]},
                {"provider": "elevenlabs", "voices": ["21m00Tcm4TlvDq8ikWAM"]},
            ],
        },
    }


@api_router.get("/courses", response_model=list[CourseMeta])
async def list_courses():
    return rag_service.list_courses()


@api_router.get("/courses/{course_id}/topics")
async def course_topics(course_id: str):
    for c in rag_service.list_courses():
        if c.id == course_id:
            return {"course_id": course_id, "topics": c.topics, "title": c.title}
    raise HTTPException(404, "Course not found")


@api_router.post("/pdfs", response_model=CourseMeta)
async def upload_pdf(file: UploadFile = File(...), title: str | None = Form(None)):
    filename = Path((file.filename or "").replace("\\", "/")).name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Yalnızca PDF belgeleri destekleniyor.")
    dest = settings.pdf_dir / f"{uuid.uuid4().hex}_{filename}"
    try:
        size = 0
        with dest.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > 300 * 1024 * 1024:
                    raise HTTPException(413, "PDF en fazla 300 MB olabilir.")
                out.write(chunk)
        if not size:
            raise HTTPException(400, "PDF dosyası boş.")
        meta = await rag_service.ingest_pdf(dest, title=(title or Path(filename).stem).strip())
        return meta
    except HTTPException:
        dest.unlink(missing_ok=True)
        raise
    except ValueError as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Belge işlenemedi: {exc}") from exc
    finally:
        await file.close()


@api_router.get("/pdfs/{course_id}/file")
async def get_pdf_file(course_id: str):
    from fastapi.responses import FileResponse

    for c in rag_service.list_courses():
        if c.id == course_id:
            path = (settings.pdf_dir / c.filename).resolve()
            if not path.is_relative_to(settings.pdf_dir.resolve()) or not path.is_file():
                raise HTTPException(404, "PDF file missing")
            return FileResponse(path, media_type="application/pdf", filename=c.filename)
    raise HTTPException(404, "Course not found")


@api_router.post("/rag/search")
async def rag_search(body: SearchBody):
    if body.course_id and not any(c.id == body.course_id for c in rag_service.list_courses()):
        raise HTTPException(404, "Belge bulunamadı.")
    hits = await rag_service.search(body.query, body.course_id, body.top_k, overview=body.overview)
    return {"hits": [h.model_dump() for h in hits]}


@api_router.post("/warmup")
async def warmup():
    from app.services.vram import warmup_pipeline

    return await warmup_pipeline()


@api_router.post("/vram/release")
async def release_vram():
    from app.services.vram import release_ephemeral_vram

    return await release_ephemeral_vram()
