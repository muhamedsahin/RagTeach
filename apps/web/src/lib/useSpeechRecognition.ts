"use client";
import { useCallback, useEffect, useRef } from "react";
import { tutorActions, getTutorSnapshot } from "./store";
import { tutorService } from "@/services/tutorService";

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; abort: () => void; onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number }; resultIndex: number }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
export function useSpeechRecognition() {
  const recognitionRef = useRef<Recognition | null>(null);
  const report = (text: string) => { tutorActions.setStreamingText(text); tutorActions.commitStreamingToTranscript("ai"); };
  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) { recognition.onend = null; recognition.onresult = null; recognition.onerror = null; recognition.abort(); }
    tutorActions.setMicActive(false);
    tutorActions.setUserSpeechRMS(0);
  }, []);
  const startListening = useCallback(async () => {
    if (recognitionRef.current) return;
    const speechWindow = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) { report("Bu tarayıcı sesli soru sormayı desteklemiyor. Sorunu yazarak gönderebilirsin."); return; }
    tutorService.interrupt();
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = getTutorSnapshot().sttLanguage || "tr-TR";
    recognitionRef.current = recognition;
    recognition.onresult = event => {
      const text = Array.from({ length: event.results.length - event.resultIndex }, (_, i) => event.results[event.resultIndex + i][0].transcript).join(" ").trim();
      stopListening();
      if (text) void tutorService.askQuestion(text);
    };
    recognition.onerror = event => {
      stopListening();
      if (event.error !== "aborted") report(event.error === "not-allowed" ? "Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verebilir veya yazarak devam edebilirsin." : "Ses algılanamadı. Mikrofonu kontrol edip yeniden dene.");
    };
    recognition.onend = () => { recognitionRef.current = null; tutorActions.setMicActive(false); };
    try { recognition.start(); tutorActions.setMicActive(true); }
    catch { stopListening(); report("Mikrofon başlatılamadı. Yeniden deneyebilirsin."); }
  }, [stopListening]);
  const setSttLanguage = useCallback((lang: string) => { tutorActions.setSttLanguage(lang); if (recognitionRef.current) recognitionRef.current.lang = lang; }, []);
  useEffect(() => stopListening, [stopListening]);
  return { startListening, stopListening, setSttLanguage };
}
