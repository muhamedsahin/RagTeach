"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { Sparkles, Check, Database, Network, BookOpen, Layers } from "lucide-react";

const STAGES = [
  { label: "Extracting pages & academic document layout...", icon: Layers },
  { label: "Building semantic vector embeddings...", icon: Database },
  { label: "Synthesizing 3D knowledge constellation graph...", icon: Network },
  { label: "Connecting relational graph & ready to lecture.", icon: BookOpen },
];

export function IndexingModal() {
  const showIndexingModal = useTutorStore((s) => s.showIndexingModal);
  const [currentStep, setCurrentStep] = useState(0);
  const [percent, setPercent] = useState(15);

  useEffect(() => {
    if (!showIndexingModal) {
      setCurrentStep(0);
      setPercent(15);
      return;
    }

    const t1 = setTimeout(() => {
      setCurrentStep(1);
      setPercent(45);
    }, 900);

    const t2 = setTimeout(() => {
      setCurrentStep(2);
      setPercent(75);
    }, 1800);

    const t3 = setTimeout(() => {
      setCurrentStep(3);
      setPercent(100);
    }, 2700);

    const t4 = setTimeout(() => {
      tutorActions.toggleIndexingModal(false);
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [showIndexingModal]);

  if (!showIndexingModal) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-950/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-slate-950/90 border border-cyan-400/30 shadow-[0_25px_60px_rgba(0,0,0,0.8)] relative overflow-hidden"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-cyan-400 font-semibold">
                Autonomous RAG Ingestion
              </span>
              <h2 className="text-xl font-serif font-medium text-white">
                Indexing Knowledge Space
              </h2>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>Ingestion Pipeline</span>
              <span className="text-cyan-400 font-semibold">{percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                initial={{ width: "10%" }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>

          {/* Stages Checklist */}
          <div className="space-y-3 mb-6">
            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              const Icon = stage.icon;

              return (
                <div
                  key={stage.label}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? "bg-cyan-950/30 border-cyan-400/30 text-cyan-200"
                      : isPast
                      ? "bg-slate-900/40 border-white/5 text-slate-400"
                      : "bg-transparent border-transparent text-slate-600"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      isPast
                        ? "bg-teal-500/20 text-teal-400 border border-teal-400/30"
                        : isCurrent
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 animate-pulse"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-mono">{stage.label}</span>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <span className="text-[11px] font-mono text-slate-500">
              Please wait while the neural professor incorporates this academic reference.
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

