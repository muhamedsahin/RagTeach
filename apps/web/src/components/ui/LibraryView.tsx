"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions } from "@/lib/store";
import { tutorService } from "@/services/tutorService";
import { BookCourse } from "@/types/tutor";
import { BookOpen, Upload, X, Check, ArrowRight, Layers, Clock, FileText } from "lucide-react";
import { ragService } from "@/services/ragService";

export function LibraryView() {
  const showLibrary = useTutorStore((s) => s.showLibrary);
  const books = useTutorStore((s) => s.books);
  const activeBookId = useTutorStore((s) => s.activeBookId);

  const [selectedBook, setSelectedBook] = useState<BookCourse | null>(
    books.find((b) => b.id === activeBookId) || books[0] || null
  );

  if (!showLibrary) return null;

  const handleSelectBook = (book: BookCourse) => {
    tutorActions.setActiveBook(book.id);
    setSelectedBook(book);
    tutorActions.toggleLibrary(false);
    tutorService.startLecture(book.topics[0]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    tutorActions.toggleIndexingModal(true);
    try {
      const newBook = await ragService.indexPdf(file);
      tutorActions.addBook(newBook);
      setSelectedBook(newBook);
      tutorActions.setActiveBook(newBook.id);
    } catch {
      tutorActions.toggleIndexingModal(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8 bg-midnight-950/85 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full max-w-5xl h-[88vh] rounded-3xl bg-slate-950/85 border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-400 font-semibold">
                  Knowledge Repository
                </span>
                <h2 className="text-xl font-serif font-medium text-white">Digital Library</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Upload Button */}
              <label className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-xs font-mono text-cyan-300 transition-all cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => tutorActions.toggleLibrary(false)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Books Grid */}
            <div className="lg:col-span-7 p-6 overflow-y-auto border-r border-white/5 space-y-4">
              {books.length === 0 ? (
                /* Empty state required by prompt */
                <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
                  <div className="p-4 rounded-3xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-serif font-medium text-white">
                    YOUR KNOWLEDGE SPACE IS EMPTY
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6 leading-relaxed">
                    Upload your first university textbook or research paper to build your personal
                    AI professor classroom.
                  </p>
                  <label className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-slate-950 font-mono text-xs font-semibold cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.4)]">
                    <Upload className="w-4 h-4" />
                    <span>Upload Textbook PDF</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-slate-400 font-semibold">
                    AVAILABLE TEXTBOOKS ({books.length})
                  </span>

                  {books.map((book) => {
                    const isSelected = selectedBook?.id === book.id;
                    const isActive = activeBookId === book.id;

                    return (
                      <div
                        key={book.id}
                        onClick={() => setSelectedBook(book)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? "bg-slate-900/80 border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.15)]"
                            : "bg-slate-900/40 border-white/5 hover:border-white/15 hover:bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                                  CURRENT LECTURE
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400">
                                {book.edition}
                              </span>
                            </div>
                            <h3 className="text-base font-serif font-medium text-white leading-snug">
                              {book.title}
                            </h3>
                            <p className="text-xs text-slate-400">{book.author}</p>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="flex items-center gap-1.5 text-[10px] font-mono text-teal-400 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                              Indexed
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {book.pageCount} pages
                            </span>
                          </div>
                        </div>

                        {/* Footer Badges */}
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-[10px] font-mono text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-cyan-400" />
                            {book.conceptCount} concepts
                          </span>
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3 h-3" />
                            {book.lastStudied}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Book Detail & Topics Panel */}
            <div className="lg:col-span-5 p-6 overflow-y-auto bg-slate-950/40 flex flex-col justify-between">
              {selectedBook ? (
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-semibold">
                      COURSE SYLLABUS & TOPICS
                    </span>
                    <h3 className="text-lg font-serif font-medium text-white mt-1">
                      {selectedBook.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedBook.author}</p>
                  </div>

                  {/* Chapters List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-slate-500">
                      LECTURE TOPICS ({selectedBook.topics.length})
                    </span>
                    <div className="space-y-1.5">
                      {selectedBook.topics.map((topic, idx) => (
                        <button
                          key={topic}
                          onClick={() => {
                            tutorActions.setActiveBook(selectedBook.id);
                            tutorActions.toggleLibrary(false);
                            tutorService.startLecture(topic);
                          }}
                          className="w-full text-left p-3 rounded-xl bg-slate-900/60 hover:bg-cyan-950/30 border border-white/5 hover:border-cyan-400/30 text-xs font-mono text-slate-300 hover:text-cyan-200 transition-all flex items-center justify-between group"
                        >
                          <span className="truncate pr-2">
                            {String(idx + 1).padStart(2, "0")}. {topic}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-transform group-hover:translate-x-0.5 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-mono text-slate-500">
                  Select a book to inspect syllabus
                </div>
              )}

              {/* Start Studying Action */}
              {selectedBook && (
                <div className="pt-6 border-t border-white/5">
                  <button
                    onClick={() => handleSelectBook(selectedBook)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_25px_rgba(34,211,238,0.4)]"
                  >
                    <span>Enter Lecture with this Textbook</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

