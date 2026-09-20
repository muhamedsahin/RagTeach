"use client";

import React from "react";
import { useTutorStore, tutorActions } from "@/lib/store";
import { tutorService } from "@/services/tutorService";
import { Check, Compass } from "lucide-react";

export function LessonHeader() {
  const lesson = useTutorStore((s) => s.lesson);
  const tutorState = useTutorStore((s) => s.tutorState);

  return (
    <div className="absolute top-20 left-4 sm:left-8 z-20 max-w-md pointer-events-none">
      {/* Course & Chapter Metadata */}
      <div className="pointer-events-auto flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-400 font-semibold">
            {lesson.courseCode} · {lesson.courseTitle}
          </span>
          <span className="text-white/20 text-xs">/</span>
          <span className="text-[10px] font-mono tracking-wider text-slate-400">
            CHAPTER {String(lesson.chapterNumber).padStart(2, "0")}
          </span>
        </div>

        {/* Large Cinematic Title */}
        <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-white/95 leading-tight">
          {lesson.chapterTitle}
        </h1>

        {/* Current Lesson Subtitle */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 mt-0.5">
          <span className="text-cyan-400">
            Lesson {String(lesson.lessonIndex).padStart(2, "0")} / {String(lesson.totalLessons).padStart(2, "0")}
          </span>
          <span className="text-white/30">―</span>
          <span className="text-slate-200">{lesson.topicTitle}</span>
        </div>

        {/* Concept Constellation Progress Path */}
        <div className="mt-3.5 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-cyan-400" />
              CONCEPT TRAJECTORY
            </span>
            <span className="text-cyan-400 font-semibold">{lesson.progressPercent}% MASTERY</span>
          </div>

          <div className="flex items-center gap-2">
            {lesson.concepts.map((concept, idx) => {
              const isCompleted = concept.completed;
              const isActive = concept.active;

              return (
                <div key={concept.id} className="flex-1 flex items-center group relative">
                  <button
                    onClick={() => {
                      tutorActions.advanceConcept(concept.id);
                      tutorService.startLecture(concept.title);
                    }}
                    className={`w-full h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isCompleted
                        ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                        : isActive
                        ? "bg-sky-400/80 animate-pulse ring-1 ring-cyan-300"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                    title={`${concept.title}: ${concept.summary}`}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap px-2 py-1 rounded bg-slate-900/90 text-[9px] font-mono text-slate-200 border border-white/10 z-30">
                    {concept.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

