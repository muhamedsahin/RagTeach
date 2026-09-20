"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { tutorService } from "@/services/tutorService";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { Mic, MicOff, Pause, Play, Hand, Send, BookOpen, Volume2 } from "lucide-react";

export function VoiceController() {
  const [inputText, setInputText] = useState("");
  const tutorState = useTutorStore((s) => s.tutorState);
  const micActive = useTutorStore((s) => s.micActive);
  const userSpeechRMS = useTutorStore((s) => s.userSpeechRMS);
  const audioMetrics = useTutorStore((s) => s.audioMetrics);

  const { startListening, stopListening } = useSpeechRecognition();

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    tutorService.askQuestion(text);
  };

  const handleToggleMic = () => {
    if (micActive) {
      stopListening();
    } else {
      startListening();
      if (tutorState === "speaking" || tutorState === "teaching") {
        tutorService.interrupt();
      }
    }
  };

  const handleInterrupt = () => {
    tutorService.interrupt();
  };

  const handlePauseResume = () => {
    if (tutorState === "paused") {
      tutorService.resume();
    } else {
      tutorService.pause();
    }
  };

  const isAiSpeaking = tutorState === "speaking";
  const isListening = tutorState === "listening" || micActive;
  const isThinking = tutorState === "thinking" || tutorState === "retrieving";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-3">
        {/* State Banner / Interrupt Guidance */}
        <AnimatePresence>
          {isAiSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 backdrop-blur-xl shadow-[0_0_25px_rgba(34,211,238,0.25)] text-xs font-mono text-cyan-200"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>AI is speaking · Speak into mic or click Interrupt to barge in</span>
            </motion.div>
          )}

          {isListening && !isAiSpeaking && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-teal-950/80 border border-teal-400/40 backdrop-blur-xl shadow-[0_0_25px_rgba(45,212,191,0.25)] text-xs font-mono text-teal-200"
            >
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>Listening to your question...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unified Floating Controller Dock */}
        <div className="w-full flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-full bg-slate-950/80 border border-white/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)]">
          {/* Main Reactive Mic Orb Button */}
          <div className="relative flex items-center justify-center">
            {/* Animated Audio Reaction Rings */}
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full border border-teal-400/60"
                animate={{
                  scale: [1, 1.25 + userSpeechRMS * 1.5, 1],
                  opacity: [0.8, 0.2, 0.8],
                }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {isAiSpeaking && (
              <motion.div
                className="absolute inset-0 rounded-full border border-cyan-400/60"
                animate={{
                  scale: [1, 1.2 + audioMetrics.amplitude * 0.8, 1],
                  opacity: [0.9, 0.3, 0.9],
                }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <button
              onClick={handleToggleMic}
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                micActive
                  ? "bg-teal-500 text-slate-950 shadow-[0_0_25px_rgba(45,212,191,0.6)]"
                  : isAiSpeaking
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:bg-cyan-500/30"
                  : "bg-slate-900 text-slate-300 border border-white/10 hover:border-cyan-400/40 hover:text-white"
              }`}
              title={micActive ? "Mute Microphone" : "Activate Microphone"}
            >
              {micActive ? (
                <Mic className="w-5 h-5 animate-pulse" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Text Question Input */}
          <div className="flex-1 flex items-center bg-white/[0.03] border border-white/5 rounded-full px-3.5 py-1.5 focus-within:border-cyan-400/40 focus-within:bg-white/[0.05] transition-all">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              placeholder="Ask a question or speak freely..."
              className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none"
            />
            {inputText.trim() && (
              <button
                onClick={handleSendText}
                className="p-1 rounded-full text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Instant Interrupt Barge-in */}
            <button
              onClick={handleInterrupt}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-mono transition-all ${
                isAiSpeaking
                  ? "bg-rose-500/20 text-rose-300 border border-rose-400/50 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse"
                  : "bg-slate-900/60 text-slate-400 border border-white/5 hover:text-slate-200 hover:bg-white/5"
              }`}
              title="Interrupt AI Teacher"
            >
              <Hand className="w-3.5 h-3.5" />
              <span className="hidden md:inline font-semibold">INTERRUPT</span>
            </button>

            {/* Pause / Resume */}
            <button
              onClick={handlePauseResume}
              className="p-2 rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
              title={tutorState === "paused" ? "Resume" : "Pause"}
            >
              {tutorState === "paused" ? (
                <Play className="w-4 h-4 text-cyan-400" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            {/* Start Lecture / Next Concept */}
            <button
              onClick={() => tutorService.startLecture()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-mono bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-400/30 transition-all cursor-pointer font-semibold shadow-[0_0_15px_rgba(34,211,238,0.2)]"
              title="Start Lecture"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TEACH</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

