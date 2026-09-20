export type TutorState =
  | "idle"
  | "listening"
  | "thinking"
  | "retrieving"
  | "teaching"
  | "speaking"
  | "interrupted"
  | "paused";

export type InteractionMode = "text" | "voice" | "hybrid";

export type QualityLevel = "auto" | "low" | "medium" | "high" | "ultra";

export interface KnowledgeNode {
  id: string;
  label: string;
  chapter: string;
  page: number;
  position: [number, number, number];
  status: "idle" | "active" | "retrieved" | "completed";
  relevanceScore?: number;
  category: "chapter" | "concept" | "algorithm" | "reference";
}

export interface CitationSource {
  id: string;
  bookTitle: string;
  author: string;
  chapterNumber: number;
  chapterTitle: string;
  pageNumber: number;
  section: string;
  excerpt: string;
  retrievalReason: string;
  relevanceScore: number;
  pdfUrl?: string;
  nodeId?: string;
}

export interface LessonConcept {
  id: string;
  title: string;
  completed: boolean;
  active: boolean;
  summary: string;
}

export interface LessonInfo {
  courseTitle: string;
  courseCode: string;
  chapterNumber: number;
  chapterTitle: string;
  lessonIndex: number;
  totalLessons: number;
  topicTitle: string;
  progressPercent: number;
  concepts: LessonConcept[];
}

export interface BookCourse {
  id: string;
  title: string;
  author: string;
  edition: string;
  pageCount: number;
  chunkCount: number;
  conceptCount: number;
  indexed: boolean;
  lastStudied: string;
  coverGradient: [string, string];
  topics: string[];
  pdfUrl?: string;
}

export interface TranscriptEntry {
  id: string;
  role: "ai" | "user" | "system";
  text: string;
  timestamp: string;
  sourceCitationId?: string;
  isStreaming?: boolean;
}

export interface AudioFrequencyData {
  amplitude: number;
  bass: number;
  mid: number;
  treble: number;
  rawArray?: Uint8Array;
}

