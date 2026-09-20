from __future__ import annotations

import asyncio
import base64
import re
from typing import Any, Callable, Awaitable

from app.core.models import SessionState
from app.core.settings_store import store
from app.providers.router import router
from app.rag.service import rag_service
from app.services.intent import classify_intent


SendFn = Callable[[dict[str, Any]], Awaitable[None]]


TEACHER_SYSTEM = """Sen RagTeach platformunda çalışan bir üniversite öğretmenisin.
Öğrenciye ders kitabındaki içeriğe dayanarak detaylı, sabırlı ve yapılandırılmış anlatım yaparsın.
Kurallar:
- Türkçe konuş (aksi istenmedikçe).
- Kitap bağlamındaki bilgilere sadık kal; bilmiyorsan spekülasyon yapma.
- Anlatırken kısa paragraflar kullan; gerektiğinde örnek ver.
- Öğrenci lafını böldüğünde nazikçe durup soruya cevap ver, sonra devam etmeyi teklif et.
- Mümkünse sayfa referansı ver (ör. "kitabın 12. sayfasında...").
"""


class SessionOrchestrator:
    def __init__(self, send: SendFn) -> None:
        self.send = send
        self.state: SessionState = "idle"
        self._speak_task: asyncio.Task | None = None
        self._cancel_speak = asyncio.Event()
        self._history: list[dict[str, str]] = []
        self._last_lecture_prompt: str | None = None
        self._audio_buffer = bytearray()

    async def set_state(self, state: SessionState) -> None:
        self.state = state
        await self.send({"type": "state", "payload": {"state": state}})

    def _sentence_buffer(self) -> list[str]:
        return []

    async def handle_event(self, event: dict[str, Any]) -> None:
        etype = event.get("type")
        payload = event.get("payload") or {}

        if etype == "ping":
            await self.send({"type": "pong", "payload": {}})
            return

        if etype == "start_lecture":
            topic = payload.get("topic") or "genel giriş"
            course_id = payload.get("course_id")
            await self.start_lecture(topic, course_id)
            return

        if etype == "text_message":
            text = (payload.get("text") or "").strip()
            if text:
                await self.handle_user_text(text)
            return

        if etype == "interrupt":
            await self.interrupt()
            return

        if etype == "pause":
            await self.pause()
            return

        if etype == "stop":
            await self.stop()
            return

        if etype == "continue":
            await self.continue_lecture()
            return

        if etype == "audio_chunk":
            b64 = payload.get("data")
            if b64:
                self._audio_buffer.extend(base64.b64decode(b64))
            return

        if etype == "audio_end":
            await self.handle_audio_utterance()
            return

        if etype == "warmup":
            status = await router.warmup()
            await self.send({"type": "warmup_status", "payload": status})
            return

    async def interrupt(self, *, notify: bool = True) -> None:
        self._cancel_speak.set()
        if self._speak_task and not self._speak_task.done():
            self._speak_task.cancel()
            try:
                await self._speak_task
            except (asyncio.CancelledError, Exception):
                pass
        if notify:
            await self.send({"type": "interrupt", "payload": {"ok": True}})
            await self.set_state("listening")

    async def pause(self) -> None:
        await self.interrupt()
        await self.set_state("paused")

    async def stop(self) -> None:
        await self.interrupt()
        self._history.clear()
        await self.set_state("stopped")

    async def shutdown(self) -> None:
        """Silent cleanup when the WebSocket is already closed."""
        await self.interrupt(notify=False)
        self._history.clear()
        self.state = "stopped"

    async def continue_lecture(self) -> None:
        if self._last_lecture_prompt:
            await self.start_lecture(self._last_lecture_prompt.split("Konu:", 1)[-1].strip())
        else:
            await self.start_lecture("kaldığın yerden devam et")

    async def start_lecture(self, topic: str, course_id: str | None = None) -> None:
        await self.interrupt()
        self._cancel_speak.clear()
        app = store.load_settings()
        await router.maybe_unload_local_llm()

        await self.set_state("thinking")
        hits = await rag_service.search(topic, course_id=course_id or app.rag.course_id)
        context = rag_service.build_context(hits)
        pages = sorted({h.page for h in hits})
        await self.send(
            {
                "type": "rag_context",
                "payload": {
                    "pages": pages,
                    "hits": [h.model_dump() for h in hits[:4]],
                },
            }
        )

        prompt = (
            f"Konu: {topic}\n\n"
            f"Kitap bağlamı:\n{context or '(bağlam yok — genel pedagojik anlatım yap)'}\n\n"
            "Bu konuyu ders anlatır gibi detaylı açıkla. Giriş, ana fikirler, örnek, kısa özet."
        )
        self._last_lecture_prompt = prompt
        messages = [
            {
                "role": "system",
                "content": TEACHER_SYSTEM
                + f"\nPersona: {app.persona.role}. Stil: {app.persona.style}.",
            },
            *self._history[-8:],
            {"role": "user", "content": prompt},
        ]
        self._speak_task = asyncio.create_task(self._stream_reply(messages, speak=True))

    async def handle_user_text(self, text: str) -> None:
        intent = classify_intent(text)
        await self.send({"type": "transcript", "payload": {"role": "user", "text": text, "intent": intent}})

        if intent == "stop":
            await self.stop()
            return
        if intent == "pause":
            await self.pause()
            return
        if intent == "continue":
            await self.continue_lecture()
            return
        if intent == "repeat" and self._last_lecture_prompt:
            await self.start_lecture(self._last_lecture_prompt.split("Konu:", 1)[-1].strip())
            return

        await self.interrupt()
        self._cancel_speak.clear()
        app = store.load_settings()
        await self.set_state("thinking")
        hits = await rag_service.search(text, course_id=app.rag.course_id)
        context = rag_service.build_context(hits)
        await self.send(
            {
                "type": "rag_context",
                "payload": {
                    "pages": sorted({h.page for h in hits}),
                    "hits": [h.model_dump() for h in hits[:4]],
                },
            }
        )

        self._history.append({"role": "user", "content": text})
        messages = [
            {
                "role": "system",
                "content": TEACHER_SYSTEM
                + f"\nPersona: {app.persona.role}. Stil: {app.persona.style}.",
            },
            *self._history[-10:],
            {
                "role": "user",
                "content": f"Öğrenci sorusu/konuşması: {text}\n\nKitap bağlamı:\n{context or '(yok)'}",
            },
        ]
        mode = app.interaction_mode
        speak = mode in ("voice", "hybrid")
        self._speak_task = asyncio.create_task(self._stream_reply(messages, speak=speak))

    async def handle_audio_utterance(self) -> None:
        if not self._audio_buffer:
            return
        audio = bytes(self._audio_buffer)
        self._audio_buffer.clear()

        # barge-in while speaking
        if self.state == "speaking":
            await self.interrupt()

        await self.set_state("listening")
        stt, model = router.resolve_stt()
        try:
            text = await stt.transcribe(audio, model=model, language="tr")
        finally:
            await router.release_stt_vram()

        if not text:
            await self.send({"type": "transcript", "payload": {"role": "user", "text": "", "intent": "unknown"}})
            return
        await self.handle_user_text(text)

    async def _stream_reply(self, messages: list[dict[str, str]], speak: bool) -> None:
        llm, model = router.resolve_llm()
        full = []
        buffer = ""
        try:
            await self.set_state("speaking" if speak else "thinking")
            async for token in llm.stream_chat(messages, model=model):
                if self._cancel_speak.is_set():
                    break
                full.append(token)
                await self.send({"type": "token", "payload": {"text": token}})
                buffer += token
                # flush sentence-ish chunks to TTS
                if speak and re.search(r"[.!?…]\s|\n", buffer):
                    chunk, buffer = _split_flush(buffer)
                    if chunk.strip():
                        await self._speak_text(chunk.strip())
            if speak and buffer.strip() and not self._cancel_speak.is_set():
                await self._speak_text(buffer.strip())

            reply = "".join(full).strip()
            if reply:
                self._history.append({"role": "assistant", "content": reply})
                await self.send({"type": "message_done", "payload": {"text": reply}})
            await self.set_state("idle" if not self._cancel_speak.is_set() else "listening")
        except asyncio.CancelledError:
            await self.set_state("listening")
            raise
        except Exception as exc:
            await self.send({"type": "error", "payload": {"message": str(exc)}})
            await self.set_state("idle")

    async def _speak_text(self, text: str) -> None:
        if self._cancel_speak.is_set():
            return
        tts, voice = router.resolve_tts()
        app = store.load_settings()
        try:
            async for audio in tts.synthesize(text, voice=voice, model=app.tts.model):
                if self._cancel_speak.is_set():
                    break
                b64 = base64.b64encode(audio).decode()
                await self.send(
                    {
                        "type": "audio",
                        "payload": {
                            "data": b64,
                            "format": "audio",
                            "text": text,
                        },
                    }
                )
        finally:
            await router.release_tts_vram()


def _split_flush(buffer: str) -> tuple[str, str]:
    m = list(re.finditer(r"[.!?…]\s|\n", buffer))
    if not m:
        return "", buffer
    last = m[-1].end()
    return buffer[:last], buffer[last:]
