"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sessionActions, useSessionStore } from "@/lib/store";
import { useSessionSocket } from "@/lib/useSessionSocket";
import { useMicCapture } from "@/lib/useMicCapture";
import { SettingsPanel } from "@/components/SettingsPanel";
import { LibraryPanel } from "@/components/LibraryPanel";

export function ClassroomApp() {
  const sessionState = useSessionStore((s) => s.sessionState);
  const transcript = useSessionStore((s) => s.transcript);
  const streaming = useSessionStore((s) => s.streaming);
  const showSettings = useSessionStore((s) => s.showSettings);
  const showLibrary = useSessionStore((s) => s.showLibrary);
  const interactionMode = useSessionStore((s) => s.interactionMode);
  const micLive = useSessionStore((s) => s.micLive);
  const courseId = useSessionStore((s) => s.courseId);

  const [text, setText] = useState("");
  const { send, stopAudio } = useSessionSocket();
  const mic = useMicCapture(send);

  useEffect(() => {
    send("warmup");
  }, [send]);

  useEffect(() => {
    if (interactionMode === "voice" || interactionMode === "hybrid") {
      mic.start().catch(() => undefined);
    } else {
      mic.stop();
    }
  }, [interactionMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSend = () => {
    const value = text.trim();
    if (!value) return;
    sessionActions.appendUser(value);
    send("text_message", { text: value });
    setText("");
  };

  const onLecture = (topic?: string) => {
    send("start_lecture", {
      topic: topic || "dersin giriş konusu",
      course_id: courseId,
    });
  };

  return (
    <div className="hud">
      <div className="brand">
        <span>Hybrid Voice Tutor</span>
        RagTeach
      </div>

      <div className="status-chip">
        Durum: <strong>{sessionState}</strong>
      </div>

      <div className="top-actions">
        <button
          className={`pill ${interactionMode === "text" ? "active" : ""}`}
          onClick={() => sessionActions.setInteractionMode("text")}
        >
          Text
        </button>
        <button
          className={`pill ${interactionMode === "voice" ? "active" : ""}`}
          onClick={() => sessionActions.setInteractionMode("voice")}
        >
          Ses
        </button>
        <button
          className={`pill ${interactionMode === "hybrid" ? "active" : ""}`}
          onClick={() => sessionActions.setInteractionMode("hybrid")}
        >
          Hibrit
        </button>
        <button className="pill" onClick={() => sessionActions.toggleLibrary()}>
          Kütüphane
        </button>
        <button className="pill" onClick={() => sessionActions.toggleSettings()}>
          Ayarlar
        </button>
      </div>

      <div className="hero-copy">
        <h1>Karşında bir öğretmen varmış gibi dinle, istediğinde lafını böl.</h1>
        <p>
          PDF ders kitabını yükle, konuyu seç, anlatılsın. Mikrofonla soru sor; sistem
          durur, cevaplar, devam eder.
        </p>
      </div>

      <AnimatePresence>
        {showLibrary && (
          <motion.div
            className="panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
          >
            <LibraryPanel onStartLecture={onLecture} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="panel"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
          >
            <SettingsPanel />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="dock">
        <div className="transcript">
          {(transcript || "Ders başladığında konuşma burada görünecek.") +
            (streaming ? `\n\nÖğretmen: ${streaming}` : "")}
        </div>
        <div className="controls">
          <button
            className={`mic ${micLive ? "live" : ""} ${sessionState === "speaking" ? "speaking" : ""}`}
            onClick={() => (micLive ? mic.stop() : mic.start())}
            title="Mikrofon"
          >
            ●
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
            placeholder="Yazarak sor… veya mikrofonla konuş"
          />
          <button className="pill" onClick={onSend}>
            Gönder
          </button>
          <button className="pill" onClick={() => onLecture()}>
            Anlat
          </button>
          <button
            className="pill"
            onClick={() => {
              stopAudio();
              send("interrupt");
            }}
          >
            Böl
          </button>
          <button className="pill" onClick={() => send("pause")}>
            Duraklat
          </button>
          <button className="pill" onClick={() => send("stop")}>
            Bitir
          </button>
        </div>
      </div>
    </div>
  );
}
