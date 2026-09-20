"use client";

import { useSyncExternalStore } from "react";
import {
  TutorState,
  InteractionMode,
  QualityLevel,
  KnowledgeNode,
  CitationSource,
  LessonInfo,
  BookCourse,
  TranscriptEntry,
  AudioFrequencyData,
} from "@/types/tutor";
import {
  INITIAL_LESSON,
} from "@/services/mockData";

type Listener = () => void;

export interface TutorStore {
  tutorState: TutorState;
  interactionMode: InteractionMode;
  quality: QualityLevel;
  lesson: LessonInfo;
  books: BookCourse[];
  activeBookId: string;
  knowledgeNodes: KnowledgeNode[];
  activeCitation: CitationSource | null;
  transcriptEntries: TranscriptEntry[];
  streamingText: string;
  audioMetrics: AudioFrequencyData;
  activeNodeId: string | null;
  showSettings: boolean;
  showLibrary: boolean;
  showSourceInspector: boolean;
  showIndexingModal: boolean;
  micActive: boolean;
  userSpeechRMS: number;
  sttLanguage: string;
}

const state: TutorStore = {
  tutorState: "idle",
  interactionMode: "text",
  quality: "high",
  lesson: INITIAL_LESSON,
  books: [],
  activeBookId: "",
  knowledgeNodes: [],
  activeCitation: null,
  transcriptEntries: [],
  streamingText: "",
  audioMetrics: { amplitude: 0, bass: 0, mid: 0, treble: 0 },
  activeNodeId: null,
  showSettings: false,
  showLibrary: false,
  showSourceInspector: false,
  showIndexingModal: false,
  micActive: false,
  userSpeechRMS: 0,
  sttLanguage: (typeof window !== 'undefined' && localStorage.getItem('ragteach_stt_language')) || 'tr-TR',
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function getTutorSnapshot(): TutorStore {
  return state;
}

export function subscribeTutor(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTutorStore<T>(selector: (s: TutorStore) => T): T {
  return useSyncExternalStore(
    subscribeTutor,
    () => selector(state),
    () => selector(state)
  );
}

export const tutorActions = {
  setTutorState(tutorState: TutorState) {
    state.tutorState = tutorState;
    emit();
  },

  setInteractionMode(mode: InteractionMode) {
    state.interactionMode = mode;
    emit();
  },

  setQuality(quality: QualityLevel) {
    state.quality = quality;
    emit();
  },

  setAudioMetrics(metrics: AudioFrequencyData) {
    state.audioMetrics = metrics;
    emit();
  },

  setUserSpeechRMS(rms: number) {
    state.userSpeechRMS = rms;
    emit();
  },

  setSttLanguage(lang: string) {
    state.sttLanguage = lang;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ragteach_stt_language', lang);
    }
    emit();
  },

  setMicActive(active: boolean) {
    state.micActive = active;
    emit();
  },

  setStreamingText(text: string) {
    state.streamingText = text;
    emit();
  },

  appendStreamingToken(token: string) {
    state.streamingText += token;
    emit();
  },

  commitStreamingToTranscript(role: "ai" | "user" = "ai", citationId?: string) {
    if (!state.streamingText.trim()) return;
    const newEntry: TranscriptEntry = {
      id: `trans-${crypto.randomUUID()}`,
      role,
      text: state.streamingText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sourceCitationId: citationId || state.activeCitation?.id,
    };
    state.transcriptEntries = [...state.transcriptEntries, newEntry];
    state.streamingText = "";
    emit();
  },

  addUserMessage(text: string) {
    const newEntry: TranscriptEntry = {
      id: `trans-${crypto.randomUUID()}`,
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    state.transcriptEntries = [...state.transcriptEntries, newEntry];
    emit();
  },

  setActiveCitation(citation: CitationSource | null) {
    state.activeCitation = citation;
    if (citation?.nodeId) {
      this.setActiveNode(citation.nodeId);
    }
    emit();
  },

  setActiveNode(nodeId: string | null) {
    state.activeNodeId = nodeId;
    state.knowledgeNodes = state.knowledgeNodes.map((node) => ({
      ...node,
      status: node.id === nodeId ? "active" : node.status === "active" ? "idle" : node.status,
    }));
    emit();
  },

  activateKnowledgePath(fromNodeId: string) {
    state.activeNodeId = fromNodeId;
    state.knowledgeNodes = state.knowledgeNodes.map((n) =>
      n.id === fromNodeId ? { ...n, status: "retrieved" } : n
    );
    emit();
  },

  setActiveBook(bookId: string) {
    state.activeBookId = bookId;
    state.activeCitation = null;
    state.transcriptEntries = [];
    state.streamingText = "";
    const found = state.books.find((b) => b.id === bookId);
    if (found) {
      state.lesson = {
        ...state.lesson,
        courseTitle: found.title.toUpperCase(),
        chapterTitle: found.topics[0] || "Foundational Theory",
      };
    }
    emit();
  },

  addBook(book: BookCourse) {
    state.books = [book, ...state.books.filter((b) => b.id !== book.id)];
    emit();
  },

  setBooks(books: BookCourse[]) {
    state.books = books;
    if (!books.some((book) => book.id === state.activeBookId)) state.activeBookId = books[0]?.id || "";
    emit();
  },

  clearConversation() {
    state.transcriptEntries = [];
    state.streamingText = "";
    state.activeCitation = null;
    state.tutorState = "idle";
    emit();
  },

  setKnowledgeNodes(nodes: KnowledgeNode[]) {
    state.knowledgeNodes = nodes;
    emit();
  },

  toggleLibrary(show?: boolean) {
    state.showLibrary = show !== undefined ? show : !state.showLibrary;
    if (state.showLibrary) {
      state.showSettings = false;
      state.showSourceInspector = false;
    }
    emit();
  },

  toggleSettings(show?: boolean) {
    state.showSettings = show !== undefined ? show : !state.showSettings;
    if (state.showSettings) {
      state.showLibrary = false;
      state.showSourceInspector = false;
    }
    emit();
  },

  toggleSourceInspector(show?: boolean) {
    state.showSourceInspector = show !== undefined ? show : !state.showSourceInspector;
    if (state.showSourceInspector) {
      state.showLibrary = false;
      state.showSettings = false;
    }
    emit();
  },

  toggleIndexingModal(show?: boolean) {
    state.showIndexingModal = show !== undefined ? show : !state.showIndexingModal;
    emit();
  },

  advanceConcept(conceptId: string) {
    state.lesson.concepts = state.lesson.concepts.map((c) => {
      if (c.id === conceptId) {
        return { ...c, completed: true, active: false };
      }
      return c;
    });
    const nextIdx = state.lesson.concepts.findIndex((c) => !c.completed);
    if (nextIdx !== -1) {
      state.lesson.concepts[nextIdx].active = true;
    }
    const completedCount = state.lesson.concepts.filter((c) => c.completed).length;
    state.lesson.progressPercent = Math.round((completedCount / state.lesson.concepts.length) * 100);
    emit();
  },
};

export type SessionState =
  | "idle"
  | "indexing"
  | "thinking"
  | "speaking"
  | "listening"
  | "paused"
  | "stopped";

export interface SessionLegacySnapshot {
  sessionState: SessionState | string;
  transcript: string;
  streaming: string;
  amplitude: number;
  showSettings: boolean;
  showLibrary: boolean;
  pages: number[];
  courseId: string | null;
  interactionMode: "text" | "voice" | "hybrid";
  micLive: boolean;
}

export function getSessionSnapshot(): SessionLegacySnapshot {
  return {
    sessionState: state.tutorState,
    transcript: state.transcriptEntries.map((e) => `${e.role === "ai" ? "Öğretmen" : "Sen"}: ${e.text}`).join("\n\n"),
    streaming: state.streamingText,
    amplitude: state.audioMetrics.amplitude,
    showSettings: state.showSettings,
    showLibrary: state.showLibrary,
    pages: state.activeCitation ? [state.activeCitation.pageNumber] : [],
    courseId: state.activeBookId,
    interactionMode: state.interactionMode,
    micLive: state.micActive,
  };
}

export function subscribeSession(listener: Listener) {
  return subscribeTutor(listener);
}

export function useSessionStore<T>(selector: (s: SessionLegacySnapshot) => T): T {
  return useSyncExternalStore(
    subscribeTutor,
    () => selector(getSessionSnapshot()),
    () => selector(getSessionSnapshot())
  );
}

export const sessionActions = {
  setState(sessionState: SessionState | string) {
    const s =
      sessionState === "indexing"
        ? "retrieving"
        : sessionState === "stopped"
        ? "idle"
        : (sessionState as TutorState);
    tutorActions.setTutorState(s);
  },
  appendToken(text: string) {
    tutorActions.appendStreamingToken(text);
  },
  commitMessage(text: string) {
    tutorActions.setStreamingText(text);
    tutorActions.commitStreamingToTranscript("ai");
  },
  appendUser(text: string) {
    tutorActions.addUserMessage(text);
  },
  setAmplitude(v: number) {
    tutorActions.setAudioMetrics({
      amplitude: v,
      bass: Math.min(1, v * 1.4),
      mid: Math.min(1, v * 1.2),
      treble: Math.min(1, v * 1.0),
    });
  },
  toggleSettings() {
    tutorActions.toggleSettings();
  },
  toggleLibrary() {
    tutorActions.toggleLibrary();
  },
  setPages(pages: number[]) {
    if (pages.length > 0 && state.activeCitation) {
      state.activeCitation = {
        ...state.activeCitation,
        pageNumber: pages[0],
      };
      emit();
    }
  },
  setCourseId(id: string | null) {
    if (id) tutorActions.setActiveBook(id);
  },
  setInteractionMode(mode: "text" | "voice" | "hybrid") {
    tutorActions.setInteractionMode(mode);
  },
  setMicLive(live: boolean) {
    tutorActions.setMicActive(live);
  },
  clearStream() {
    tutorActions.setStreamingText("");
  },
};
