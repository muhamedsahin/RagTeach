"use client";

import { useCallback, useEffect, useRef } from "react";
import { sessionActions } from "@/lib/store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000/ws/session";

type Handler = (event: { type: string; payload?: Record<string, unknown> }) => void;

export function useSessionSocket(onEvent?: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueue = useRef<Blob[]>([]);
  const playing = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);

  const playNext = useCallback(async () => {
    if (playing.current) return;
    const next = audioQueue.current.shift();
    if (!next) {
      sessionActions.setAmplitude(0);
      return;
    }
    playing.current = true;
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const buf = await next.arrayBuffer();
      const decoded = await audioCtx.current.decodeAudioData(buf.slice(0));
      const source = audioCtx.current.createBufferSource();
      const analyser = audioCtx.current.createAnalyser();
      analyser.fftSize = 256;
      source.buffer = decoded;
      source.connect(analyser);
      analyser.connect(audioCtx.current.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        sessionActions.setAmplitude(Math.min(1, Math.sqrt(sum / data.length) * 4));
        raf = requestAnimationFrame(tick);
      };
      tick();
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
      cancelAnimationFrame(raf);
    } catch {
      // ignore decode errors for non-wav streams; still try HTMLAudioElement
      try {
        const url = URL.createObjectURL(next);
        const audio = new Audio(url);
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
        });
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
    } finally {
      playing.current = false;
      playNext();
    }
  }, []);

  const stopAudio = useCallback(() => {
    audioQueue.current = [];
    playing.current = false;
    sessionActions.setAmplitude(0);
    if (audioCtx.current) {
      audioCtx.current.close().catch(() => undefined);
      audioCtx.current = null;
    }
  }, []);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        const type = event.type as string;
        const payload = (event.payload || {}) as Record<string, unknown>;

        if (type === "state") {
          sessionActions.setState(payload.state as never);
        }
        if (type === "token") {
          sessionActions.appendToken(String(payload.text || ""));
        }
        if (type === "message_done") {
          sessionActions.commitMessage(String(payload.text || ""));
        }
        if (type === "transcript" && payload.role === "user" && payload.text) {
          sessionActions.appendUser(String(payload.text));
        }
        if (type === "rag_context" && Array.isArray(payload.pages)) {
          sessionActions.setPages(payload.pages as number[]);
        }
        if (type === "audio" && payload.data) {
          const bin = atob(String(payload.data));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          audioQueue.current.push(new Blob([bytes]));
          playNext();
        }
        if (type === "interrupt") {
          stopAudio();
        }
        onEvent?.(event);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      stopAudio();
    };
  }, [onEvent, playNext, stopAudio]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type, payload }));
  }, []);

  return { send, stopAudio, wsRef };
}
