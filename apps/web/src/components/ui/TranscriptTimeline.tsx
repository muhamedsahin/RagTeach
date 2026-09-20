"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { Sparkles, User, BookOpen, Volume2 } from "lucide-react";
import { MOCK_CITATIONS } from "@/services/mockData";

export function TranscriptTimeline() {
  const transcriptEntries = useTutorStore((s) => s.transcriptEntries);
  const streamingText = useTutorStore((s) => s.streamingText);
  const tutorState = useTutorStore((s) => s.tutorState);
  const interactionMode = useTutorStore((s) => s.interactionMode);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming tokens
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptEntries, streamingText]);

  // In pure voice mode, transcript is rendered as a minimal cinematic subtitle overlay
  if (interactionMode === "voice") {
    if (!streamingText && transcriptEntries.length === 0) return null;
    const lastEntry = transcriptEntries[transcriptEntries.length - 1];

    return (
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block px-5 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-2xl shadow-2xl"
        >
          <p className="text-sm sm:text-base font-serif text-slate-100 leading-relaxed">
            {streamingText || lastEntry?.text}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <aside className="absolute right-4 sm:right-8 top-20 bottom-32 z-20 w-full max-w-sm sm:max-w-md pointer-events-none flex flex-col justify-end">
      <div className="pointer-events-auto flex flex-col max-h-full rounded-2xl bg-slate-950/70 border border-white/10 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-slate-300 font-semibold">
              Live Transcript & Dialogue
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {transcriptEntries.length} exchanges
          </span>
        </div>

        {/* Scrollable Timeline Stream */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {transcriptEntries.map((entry) => {
              const isAi = entry.role === "ai";
              const citation = entry.sourceCitationId
                ? MOCK_CITATIONS.find((c) => c.id === entry.sourceCitationId)
                : null;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`relative pl-4 border-l ${
                    isAi
                      ? "border-cyan-500/40"
                      : "border-slate-500/40"
                  }`}
                >
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${
                      isAi
                        ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                        : "bg-slate-400"
                    }`}
                  />

                  {/* Speaker Label & Timestamp */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {isAi ? (
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                      ) : (
                        <User className="w-3 h-3 text-slate-400" />
                      )}
                      <span
                        className={`text-[10px] font-mono tracking-wider uppercase font-semibold ${
                          isAi ? "text-cyan-300" : "text-slate-300"
                        }`}
                      >
                        {isAi ? "AI Professor" : "You (Student)"}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      {entry.timestamp}
                    </span>
                  </div>

                  {/* Message Content */}
                  <p
                    className={`text-xs sm:text-sm leading-relaxed ${
                      isAi
                        ? "font-serif text-slate-100 font-normal"
                        : "font-sans text-slate-300"
                    }`}
                  >
                    {entry.text}
                  </p>

                  {/* Grounded Citation Badge */}
                  {citation && (
                    <button
                      onClick={() => {
                        tutorActions.setActiveCitation(citation);
                        tutorActions.toggleSourceInspector(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/20 hover:border-cyan-400/40 text-[10px] font-mono text-cyan-300 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{citation.bookTitle.split("&")[0]} · P.{citation.pageNumber}</span>
                    </button>
                  )}
                </motion.div>
              );
            })}

            {/* Live Streaming Speech Bubble */}
            {streamingText && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative pl-4 border-l border-cyan-400"
              >
                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
                <div className="flex items-center gap-1.5 mb-1">
                  <Volume2 className="w-3 h-3 text-cyan-300 animate-pulse" />
                  <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-300 font-semibold">
                    AI Speaking...
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-serif text-cyan-50 leading-relaxed">
                  {streamingText}
                  <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-1 animate-pulse" />
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}

