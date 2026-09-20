export type ProviderMode = "offline" | "online";
export type InteractionMode = "text" | "voice" | "hybrid";

export type SessionState =
  | "idle"
  | "indexing"
  | "thinking"
  | "speaking"
  | "listening"
  | "paused"
  | "stopped";

export interface ChannelConfig {
  mode: ProviderMode;
  provider: string;
  model: string;
  voice?: string | null;
  api_key_ref?: string | null;
  fallback_to_offline?: boolean;
}

export interface AppSettings {
  llm: ChannelConfig;
  stt: ChannelConfig;
  tts: ChannelConfig;
  embedding: ChannelConfig;
  persona: { role: string; style: string; language: string };
  rag: { top_k: number; course_id?: string | null; chunk_size: number; chunk_overlap: number };
  interaction_mode: InteractionMode;
  unload_local_llm_when_online: boolean;
}

export interface CourseMeta {
  id: string;
  title: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  topics: string[];
}

export interface WsEvent {
  type: string;
  payload?: Record<string, unknown>;
}
