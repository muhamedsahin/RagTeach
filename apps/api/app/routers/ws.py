from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.services.orchestrator import SessionOrchestrator

ws_router = APIRouter()
log = logging.getLogger("ragteach.ws")


@ws_router.websocket("/session")
async def session_ws(websocket: WebSocket):
    await websocket.accept()

    async def send(event: dict):
        if websocket.client_state != WebSocketState.CONNECTED:
            return
        try:
            await websocket.send_text(json.dumps(event, ensure_ascii=False))
        except Exception:
            # Client already gone — ignore
            return

    orch = SessionOrchestrator(send)
    try:
        await orch.set_state("idle")
        await send({"type": "ready", "payload": {"message": "RagTeach session ready"}})

        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                await send({"type": "error", "payload": {"message": "Invalid JSON"}})
                continue
            await orch.handle_event(event)
    except WebSocketDisconnect:
        log.info("session disconnected")
    finally:
        await orch.shutdown()
