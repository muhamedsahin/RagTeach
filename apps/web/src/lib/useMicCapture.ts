"use client";

import { useCallback, useEffect, useRef } from "react";
import { sessionActions } from "@/lib/store";

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function useMicCapture(send: (type: string, payload?: Record<string, unknown>) => void) {
  const mediaRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recording = useRef(false);
  const chunks = useRef<Float32Array[]>([]);
  const speaking = useRef(false);
  const silenceMs = useRef(0);

  const stop = useCallback(() => {
    recording.current = false;
    sessionActions.setMicLive(false);
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
  }, []);

  const flushUtterance = useCallback(() => {
    if (!chunks.current.length) return;
    const total = chunks.current.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunks.current) {
      merged.set(c, off);
      off += c.length;
    }
    chunks.current = [];
    const sr = ctxRef.current?.sampleRate || 16000;
    const wav = encodeWav(merged, sr);
    const bytes = new Uint8Array(wav);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    // barge-in first
    send("interrupt");
    send("audio_chunk", { data: b64 });
    send("audio_end");
  }, [send]);

  const start = useCallback(async () => {
    if (recording.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRef.current = stream;
    const ctx = new AudioContext({ sampleRate: 16000 });
    ctxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    recording.current = true;
    sessionActions.setMicLive(true);

    const loop = () => {
      if (!recording.current) return;
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const isSpeech = rms > 0.02;

      if (isSpeech) {
        speaking.current = true;
        silenceMs.current = 0;
        chunks.current.push(new Float32Array(data));
      } else if (speaking.current) {
        silenceMs.current += (analyser.fftSize / ctx.sampleRate) * 1000;
        chunks.current.push(new Float32Array(data));
        if (silenceMs.current > 700) {
          speaking.current = false;
          silenceMs.current = 0;
          flushUtterance();
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }, [flushUtterance]);

  useEffect(() => () => stop(), [stop]);

  return { start, stop };
}
