import { TutorState, CitationSource, BookCourse, LessonInfo } from "./tutor";

export interface LLMRequest {
  prompt: string;
  context?: string;
  courseId?: string;
  streamCallback?: (token: string) => void;
}

export interface LLMResponse {
  text: string;
  tokensUsed: number;
  error?: string;
  provider?: string;
}

export interface ILLMService {
  generate(request: LLMRequest): Promise<LLMResponse>;
  interrupt(): void;
}

export interface RAGQuery {
  overview?: boolean;
  query: string;
  courseId: string;
  topK?: number;
  similarityThreshold?: number;
}

export interface IRAGService {
  retrieve(query: RAGQuery): Promise<CitationSource[]>;
  indexPdf(file: File, onProgress?: (stage: string, percent: number) => void): Promise<BookCourse>;
}

export interface ISpeechRecognitionService {
  startListening(
    onSpeechChunk: (rms: number) => void,
    onSpeechEnd: (transcription: string) => void,
    onBargeIn?: () => void
  ): Promise<void>;
  stopListening(): void;
  isListening(): boolean;
}

export interface ITTSService {
  speak(
    text: string,
    onAudioFrame?: (amplitude: number, bass: number, mid: number, treble: number) => void,
    onEnd?: () => void
  ): Promise<void>;
  stop(): void;
  isPlaying(): boolean;
}

export interface ILessonService {
  getCurrentLesson(): LessonInfo;
  startTopic(topic: string, courseId: string): Promise<void>;
  nextConcept(): Promise<void>;
}

