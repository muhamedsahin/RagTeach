"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { X, BookOpen, ExternalLink, Bookmark, Sparkles, CheckCircle2 } from "lucide-react";

export function SourceInspector() {
  const showSourceInspector = useTutorStore((s) => s.showSourceInspector);
  const activeCitation = useTutorStore((s) => s.activeCitation);

  if (!showSourceInspector || !activeCitation) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: "spring", stiffness: 350, damping: 32 }}
        className="fixed top-20 right-4 sm:right-8 bottom-28 z-30 w-full max-w-md pointer-events-auto"
      >
        <div className="flex flex-col h-full rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-2xl shadow-[0_24px_50px_rgba(0,0,0,0.7)] overflow-hidden">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
                <Bookmark className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-mono tracking-widest uppercase text-slate-200 font-semibold">
                Grounded Source Material
              </span>
            </div>
            <button
              onClick={() => tutorActions.toggleSourceInspector(false)}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Source Document Card */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Book Title & Page Pill */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-400">
                  PRIMARY TEXTBOOK
                </span>
                <h3 className="text-base font-serif font-medium text-white leading-snug mt-0.5">
                  {activeCitation.bookTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{activeCitation.author}</p>
              </div>

              <div className="flex flex-col items-end">
                <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-white/10 text-[11px] font-mono text-cyan-300 font-semibold">
                  PAGE {activeCitation.pageNumber}
                </span>
                <span className="text-[9px] font-mono text-slate-500 mt-1">
                  CHAPTER {activeCitation.chapterNumber}
                </span>
              </div>
            </div>

            {/* Relevance Score Telemetry */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-mono text-slate-300">Semantic Relevance</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-300">
                <span>{(activeCitation.relevanceScore * 100).toFixed(1)}%</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              </div>
            </div>

            {/* Retrieval Reason */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-400/20">
              <span className="block text-[9px] font-mono tracking-wider uppercase text-cyan-400/90 font-semibold mb-1">
                RETRIEVED BECAUSE:
              </span>
              <p className="text-xs font-mono text-cyan-100/90 leading-relaxed">
                {activeCitation.retrievalReason}
              </p>
            </div>

            {/* Section & Verbatim Passage */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-semibold">
                {activeCitation.section}
              </span>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 relative">
                <div className="absolute top-2 right-2 text-2xl font-serif text-white/5 select-none">
                  “
                </div>
                <blockquote className="text-xs sm:text-sm font-serif text-slate-200 leading-relaxed italic">
                  {activeCitation.excerpt}
                </blockquote>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => tutorActions.toggleLibrary(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono text-slate-200 transition-all"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open in Library</span>
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

