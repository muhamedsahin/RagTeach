"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { StatusIndicator } from "./StatusIndicator";
import { InteractionMode } from "@/types/tutor";
import { BookOpen, Settings, FileText, Sparkles } from "lucide-react";

export function TopNavigation() {
  const interactionMode = useTutorStore((s) => s.interactionMode);
  const showLibrary = useTutorStore((s) => s.showLibrary);
  const showSettings = useTutorStore((s) => s.showSettings);
  const showSourceInspector = useTutorStore((s) => s.showSourceInspector);

  const modes: { id: InteractionMode; label: string }[] = [
    { id: "text", label: "TEXT" },
    { id: "voice", label: "VOICE" },
    { id: "hybrid", label: "HYBRID" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 py-4 sm:px-8 flex items-center justify-between pointer-events-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-4 pointer-events-auto">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-serif font-medium tracking-tight text-white">
              RagTeach
            </span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-400/20">
              v2.0
            </span>
          </div>
          <span className="text-[9px] tracking-[0.24em] font-mono uppercase text-cyan-400/90 font-medium">
            Hybrid Voice Tutor
          </span>
        </div>

        {/* Live AI Status Pill */}
        <div className="hidden md:block ml-2">
          <StatusIndicator />
        </div>
      </div>

      {/* Floating Center Navigation Bar */}
      <nav className="pointer-events-auto flex items-center p-1.5 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {modes.map((mode) => {
          const isActive = interactionMode === mode.id && !showLibrary && !showSettings;
          return (
            <button
              key={mode.id}
              onClick={() => {
                tutorActions.setInteractionMode(mode.id);
                if (showLibrary) tutorActions.toggleLibrary(false);
                if (showSettings) tutorActions.toggleSettings(false);
              }}
              className={`relative px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all ${
                isActive
                  ? "text-cyan-300 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavTab"
                  className="absolute inset-0 rounded-full bg-cyan-500/15 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.25)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{mode.label}</span>
            </button>
          );
        })}

        <div className="w-[1px] h-4 bg-white/10 mx-1" />

        {/* Library Button */}
        <button
          onClick={() => tutorActions.toggleLibrary()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all ${
            showLibrary
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(34,211,238,0.25)] font-semibold"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="Digital Library"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">LIBRARY</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => tutorActions.toggleSettings()}
          className={`p-1.5 rounded-full transition-all ${
            showSettings
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </nav>

      {/* Right Quick Controls */}
      <div className="pointer-events-auto flex items-center gap-2.5">
        {/* Source Inspector Toggle */}
        <button
          onClick={() => tutorActions.toggleSourceInspector()}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all backdrop-blur-xl ${
            showSourceInspector
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
              : "bg-slate-900/60 text-slate-300 border border-white/10 hover:border-cyan-400/30 hover:bg-slate-800/60"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline font-medium">SOURCE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        </button>
      </div>
    </header>
  );
}

