import { AudioFrequencyData } from "@/types/tutor";
import { llmService } from "./llmService";

export type TTSEngine = "browser" | "openai" | "elevenlabs" | "custom";

export interface PresetVoice {
  id: string;
  name: string;
  lang?: string;
}

export const ELEVENLABS_VOICES: PresetVoice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Sakin & Berrak Kadın)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam (Derin & Tok Anlatıcı Erkek)" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni (Akademik & Dengeli Erkek)" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (Canlı & Vurgulu Kadın)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Doğal & Akıcı Kadın)" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (Genç & Dinamik Erkek)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold (Olgun & Güçlü Erkek)" },
];

export interface VoiceConfig {
  engine: TTSEngine;
  voiceId: string;
  speed: number;
  apiKey?: string;
  customEndpoint?: string;
  autoSpeak?: boolean;
}

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  engine: "browser",
  voiceId: "tr-TR-Standard",
  speed: 1.0,
  apiKey: "",
  customEndpoint: "",
  autoSpeak: false,
};

class AudioService {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private isSpeakingAudio = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeSourceNode: AudioBufferSourceNode | null = null;
  private activeAbortController: AbortController | null = null;
  private currentMetrics: AudioFrequencyData = {
    amplitude: 0,
    bass: 0,
    mid: 0,
    treble: 0,
  };
  private subscribers = new Set<(metrics: AudioFrequencyData) => void>();

  public getVoiceConfig(): VoiceConfig {
    if (typeof window === "undefined") return DEFAULT_VOICE_CONFIG;
    try {
      const saved = localStorage.getItem("ragteach_voice_config");
      const cfg: VoiceConfig = saved ? { ...DEFAULT_VOICE_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_VOICE_CONFIG };
      if (cfg.engine === "elevenlabs") {
        if (!cfg.voiceId || cfg.voiceId === "nova" || cfg.voiceId === "tr-TR-Standard" || cfg.voiceId.includes("-") || cfg.voiceId.length < 15) {
          cfg.voiceId = "21m00Tcm4TlvDq8ikWAM";
        }
      }
      if (!cfg.apiKey?.trim()) {
        const savedKeys = llmService.getSavedKeys();
        if (cfg.engine === "elevenlabs" && savedKeys["elevenlabs"]) {
          cfg.apiKey = savedKeys["elevenlabs"];
        } else if (cfg.engine === "openai" && savedKeys["openai"]) {
          cfg.apiKey = savedKeys["openai"];
        }
      }
      return cfg;
    } catch {
      return DEFAULT_VOICE_CONFIG;
    }
  }

  public setVoiceConfig(cfg: Partial<VoiceConfig>) {
    if (typeof window === "undefined") return;
    const current = this.getVoiceConfig();
    const updated = { ...current, ...cfg };
    localStorage.setItem("ragteach_voice_config", JSON.stringify(updated));
    if (updated.engine === "elevenlabs" && updated.apiKey?.trim()) {
      llmService.saveKey("elevenlabs", updated.apiKey.trim());
    }
  }

  public getContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      const AudioContextClass =
        window.AudioContext ||
        // @ts-expect-error webkitAudioContext fallback
        window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => undefined);
    }
    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode {
    const ctx = this.getContext();
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      const binCount = this.analyser.frequencyBinCount;
      this.freqData = new Uint8Array(binCount);
      this.timeData = new Uint8Array(binCount);
    }
    return this.analyser;
  }

  public subscribe(callback: (metrics: AudioFrequencyData) => void): () => void {
    this.subscribers.add(callback);
    if (!this.animationFrameId) {
      this.startLoop();
    }
    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        this.stopLoop();
      }
    };
  }

  public getMetrics(): AudioFrequencyData {
    return this.currentMetrics;
  }

  private startLoop() {
    const tick = () => {
      if (this.analyser && this.freqData && this.timeData) {
        this.analyser.getByteFrequencyData(this.freqData as any);
        this.analyser.getByteTimeDomainData(this.timeData as any);

        const binCount = this.analyser.frequencyBinCount;
        const bassEnd = Math.floor(binCount * 0.15);
        const midEnd = Math.floor(binCount * 0.55);

        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;
        let totalSum = 0;

        for (let i = 0; i < binCount; i++) {
          const val = this.freqData[i] / 255;
          totalSum += val;
          if (i < bassEnd) bassSum += val;
          else if (i < midEnd) midSum += val;
          else trebleSum += val;
        }

        const avgAmp = totalSum / binCount;
        const bassAvg = bassSum / Math.max(1, bassEnd);
        const midAvg = midSum / Math.max(1, midEnd - bassEnd);
        const trebleAvg = trebleSum / Math.max(1, binCount - midEnd);

        this.currentMetrics = {
          amplitude: Math.min(1, avgAmp * 1.5),
          bass: Math.min(1, bassAvg * 1.8),
          mid: Math.min(1, midAvg * 1.6),
          treble: Math.min(1, trebleAvg * 2.0),
          rawArray: this.freqData,
        };
      } else {
        // Decay smoothly if no audio playing
        this.currentMetrics = {
          amplitude: this.currentMetrics.amplitude * 0.88,
          bass: this.currentMetrics.bass * 0.88,
          mid: this.currentMetrics.mid * 0.88,
          treble: this.currentMetrics.treble * 0.88,
        };
      }

      for (const cb of this.subscribers) {
        cb(this.currentMetrics);
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Universal speech generator supporting both Offline (Web Speech) and Online (OpenAI / ElevenLabs)
   */
  public simulateVoiceSpeech(
    text: string,
    onWord?: (word: string, index: number) => void,
    onComplete?: () => void
  ): { cancel: () => void } {
    this.stopSpeaking();
    this.isSpeakingAudio = true;
    this.activeAbortController = new AbortController();

    const voiceConfig = this.getVoiceConfig();
    const savedKeys = llmService.getSavedKeys();
    const explicitKey = voiceConfig.apiKey?.trim();
    const apiKey = (
      explicitKey ||
      (voiceConfig.engine === "openai" ? savedKeys["openai"] : "") ||
      (voiceConfig.engine === "elevenlabs" ? savedKeys["elevenlabs"] : "") ||
      ""
    ).replace(/^Bearer\s+/i, "");

    const isOnlineTTS =
      (voiceConfig.engine === "openai" && !!apiKey) ||
      (voiceConfig.engine === "elevenlabs" && !!apiKey) ||
      (voiceConfig.engine === "custom" && (!!voiceConfig.customEndpoint || !!apiKey));

    if (isOnlineTTS) {
      this.playOnlineTTS(text, voiceConfig, apiKey, onWord, onComplete);
    } else {
      this.playBrowserTTS(text, voiceConfig, onWord, onComplete);
    }

    const cancel = () => {
      this.stopSpeaking();
    };

    return { cancel };
  }

  /**
   * Test TTS configuration directly and play back audio sample with user-facing diagnostic result
   */
  public async testTTS(
    configOverride?: Partial<VoiceConfig>,
    sampleText = "Merhaba! RagTeach ses sentezi başarıyla çalışıyor."
  ): Promise<{ success: boolean; message: string }> {
    const base = this.getVoiceConfig();
    const cfg: VoiceConfig = { ...base, ...(configOverride || {}) };
    const savedKeys = llmService.getSavedKeys();
    const apiKey = (
      cfg.apiKey?.trim() ||
      (cfg.engine === "elevenlabs" ? savedKeys["elevenlabs"] : "") ||
      (cfg.engine === "openai" ? savedKeys["openai"] : "") ||
      ""
    ).replace(/^Bearer\s+/i, "");

    if (cfg.engine === "elevenlabs" && !apiKey) {
      return {
        success: false,
        message: "ElevenLabs API anahtarı boş. Lütfen ayarlar kısmına geçerli bir ElevenLabs API Key girin.",
      };
    }

    if (cfg.engine === "openai" && !apiKey) {
      return {
        success: false,
        message: "OpenAI API anahtarı boş. Lütfen ayarlar kısmına geçerli bir API Key girin.",
      };
    }

    if (cfg.engine === "custom" && !cfg.customEndpoint?.trim()) {
      return {
        success: false,
        message: "Özel TTS API URL adresi girilmedi.",
      };
    }

    if (cfg.engine === "browser") {
      return new Promise((resolve) => {
        this.stopSpeaking();
        this.playBrowserTTS(sampleText, cfg, undefined, () => {
          resolve({
            success: true,
            message: "Tarayıcı yerel sesi (çevrimdışı) başarıyla test edildi.",
          });
        });
      });
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleText,
          provider: cfg.engine,
          voice: cfg.voiceId,
          apiKey,
          endpoint: cfg.customEndpoint,
        }),
      });

      if (!res.ok) {
        let errDetail = `HTTP ${res.status}`;
        try {
          const json = await res.json();
          if (json.error) errDetail = json.error;
        } catch {
          const raw = await res.text().catch(() => "");
          if (raw) errDetail = raw;
        }
        return { success: false, message: errDetail };
      }

      const audioBufferData = await res.arrayBuffer();
      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      const decodedBuffer = await ctx.decodeAudioData(audioBufferData);
      this.stopSpeaking();
      this.isSpeakingAudio = true;

      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.playbackRate.value = cfg.speed || 1.0;

      const analyser = this.getAnalyser();
      source.connect(analyser);
      analyser.connect(ctx.destination);

      this.activeSourceNode = source;
      source.onended = () => {
        this.stopSpeaking();
      };

      source.start(0);

      const providerLabel =
        cfg.engine === "elevenlabs"
          ? "ElevenLabs"
          : cfg.engine === "openai"
          ? "OpenAI"
          : "Özel TTS";

      return {
        success: true,
        message: `${providerLabel} ses sentezi başarıyla bağlandı ve ses çalınıyor!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `TTS İsteği Başarısız: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Online Cloud TTS: OpenAI TTS, ElevenLabs or Custom TTS via /api/tts
   */
  private async playOnlineTTS(
    text: string,
    config: VoiceConfig,
    apiKey?: string,
    onWord?: (word: string, index: number) => void,
    onComplete?: () => void
  ) {
    const signal = this.activeAbortController?.signal;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          provider: config.engine,
          voice: config.voiceId,
          apiKey,
          endpoint: config.customEndpoint,
        }),
        signal,
      });

      if (!res.ok) {
        let errDetail = `TTS HTTP ${res.status}`;
        try {
          const json = await res.json();
          if (json.error) errDetail = json.error;
        } catch {}
        throw new Error(errDetail);
      }

      const audioBufferData = await res.arrayBuffer();
      if (!this.isSpeakingAudio || signal?.aborted) return;

      const ctx = this.getContext();
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      const analyser = this.getAnalyser();
      const decodedBuffer = await ctx.decodeAudioData(audioBufferData);

      if (!this.isSpeakingAudio || signal?.aborted) return;

      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.playbackRate.value = config.speed || 1.0;

      source.connect(analyser);
      analyser.connect(ctx.destination);

      this.activeSourceNode = source;

      // Word timing estimation based on duration
      const words = text.split(" ");
      const wordInterval = (decodedBuffer.duration * 1000) / Math.max(1, words.length);
      let wordIdx = 0;

      const wordTimer = setInterval(() => {
        if (!this.isSpeakingAudio || signal?.aborted) {
          clearInterval(wordTimer);
          return;
        }
        if (wordIdx < words.length) {
          onWord?.(words[wordIdx], wordIdx);
          wordIdx++;
        } else {
          clearInterval(wordTimer);
        }
      }, wordInterval);

      source.onended = () => {
        clearInterval(wordTimer);
        if (signal?.aborted) return;
        this.stopSpeaking();
        onComplete?.();
      };

      source.start(0);
    } catch (err: any) {
      if (signal?.aborted) return;
      console.warn("Online TTS başarısız, yerel tarayıcı sesine geçiliyor:", err.message);
      this.playBrowserTTS(text, config, onWord, onComplete);
    }
  }

  /**
   * Offline Local Speech: Web Speech API + procedural harmonic synthesizer
   */
  private playBrowserTTS(
    text: string,
    config: VoiceConfig,
    onWord?: (word: string, index: number) => void,
    onComplete?: () => void
  ) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      this.stopSpeaking();
      onComplete?.();
      return;
    }
    const signal = this.activeAbortController?.signal;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "tr-TR";
    utterance.rate = config.speed || 1;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("tr"));
    if (voice) utterance.voice = voice;
    this.activeUtterance = utterance;
    let wordIndex = 0;
    utterance.onboundary = event => {
      if (!signal?.aborted && event.name === "word") onWord?.(text.slice(event.charIndex).split(/\s/)[0], wordIndex++);
    };
    const finish = () => {
      if (signal?.aborted) return;
      this.stopSpeaking();
      onComplete?.();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    this.isSpeakingAudio = false;

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    if (this.activeSourceNode) {
      this.activeSourceNode.onended = null;
      try {
        this.activeSourceNode.stop();
        this.activeSourceNode.disconnect();
      } catch {
        /* noop */
      }
      this.activeSourceNode = null;
    }

    if (this.activeUtterance) { this.activeUtterance.onend = null; this.activeUtterance.onerror = null; }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    }

    this.activeUtterance = null;
    this.currentMetrics = { amplitude: 0, bass: 0, mid: 0, treble: 0 };
  }
}

export const audioService = new AudioService();
