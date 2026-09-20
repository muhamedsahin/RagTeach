"use client";

import React from "react";
import { useTutorStore } from "@/lib/store";
import { TutorState } from "@/types/tutor";

const STATE_CONFIG: Record<
  TutorState,
  { label: string; dotColor: string; bgGlow: string; textDesc: string }
> = {
  idle: {
    label: "IDLE",
    dotColor: "bg-slate-400",
    bgGlow: "shadow-[0_0_12px_rgba(148,163,184,0.4)]",
    textDesc: "Awaiting inquiry",
  },
  listening: {
    label: "LISTENING",
    dotColor: "bg-teal-400 animate-pulse",
    bgGlow: "shadow-[0_0_16px_rgba(45,212,191,0.6)]",
    textDesc: "Microphone active",
  },
  thinking: {
    label: "THINKING",
    dotColor: "bg-violet-400 animate-ping",
    bgGlow: "shadow-[0_0_16px_rgba(168,85,247,0.6)]",
    textDesc: "Synthesizing logic",
  },
  retrieving: {
    label: "RETRIEVING",
    dotColor: "bg-cyan-400 animate-pulse",
    bgGlow: "shadow-[0_0_16px_rgba(34,211,238,0.7)]",
    textDesc: "Consulting textbook",
  },
  teaching: {
    label: "TEACHING",
    dotColor: "bg-sky-400",
    bgGlow: "shadow-[0_0_14px_rgba(56,189,248,0.5)]",
    textDesc: "Active lecture",
  },
  speaking: {
    label: "SPEAKING",
    dotColor: "bg-cyan-300 animate-pulse",
    bgGlow: "shadow-[0_0_20px_rgba(34,211,238,0.8)]",
    textDesc: "Vocalizing concept",
  },
  interrupted: {
    label: "INTERRUPTED",
    dotColor: "bg-rose-400",
    bgGlow: "shadow-[0_0_14px_rgba(244,63,94,0.6)]",
    textDesc: "Yielding to student",
  },
  paused: {
    label: "PAUSED",
    dotColor: "bg-amber-400",
    bgGlow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]",
    textDesc: "Session suspended",
  },
};

export function StatusIndicator() {
  const tutorState = useTutorStore((s) => s.tutorState);
  const config = STATE_CONFIG[tutorState] || STATE_CONFIG.idle;

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/10 backdrop-blur-md transition-all">
      <span className={`w-2 h-2 rounded-full ${config.dotColor} ${config.bgGlow}`} />
      <span className="text-[11px] font-mono tracking-widest uppercase text-slate-200 font-semibold">
        {config.label}
      </span>
      <span className="hidden sm:inline-block text-[10px] text-slate-400 border-l border-white/10 pl-2">
        {config.textDesc}
      </span>
    </div>
  );
}

