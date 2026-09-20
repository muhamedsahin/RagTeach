import { ILLMService, LLMRequest, LLMResponse } from "@/types/services";

export type LLMProviderId =
  | "ollama"
  | "gemini"
  | "openai"
  | "deepseek"
  | "grok"
  | "kimi"
  | "anthropic"
  | "openrouter"
  | "custom";

export interface ProviderConfig {
  id: LLMProviderId;
  name: string;
  description: string;
  isOnline: boolean;
  defaultModel: string;
  availableModels: string[];
  baseUrl?: string;
  keyPlaceholder: string;
  docsUrl: string;
}

export const PROVIDER_CONFIGS: Record<LLMProviderId, ProviderConfig> = {
  ollama: {
    id: "ollama",
    name: "Local Ollama",
    description: "Tamamen çevrimdışı, yerel GPU/CPU üzerinde çalışan modeller.",
    isOnline: false,
    defaultModel: "qwen2.5:14b-instruct-q4_K_M",
    availableModels: [
      "qwen2.5:14b-instruct-q4_K_M",
      "qwen2.5:7b",
      "llama3.3:70b",
      "deepseek-r1:14b",
      "deepseek-r1:8b",
      "mistral:7b",
    ],
    baseUrl: "http://localhost:11434",
    keyPlaceholder: "Yerel modellerde API Key gerekmez",
    docsUrl: "https://ollama.com",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Google'ın yeni nesil yüksek hızlı ve multimodal amiral gemisi modelleri.",
    isOnline: true,
    defaultModel: "gemini-3.6-flash",
    availableModels: [
      "gemini-3.6-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-pro",
    ],
    keyPlaceholder: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    id: "openai",
    name: "OpenAI GPT",
    description: "Endüstri standardı GPT-4o ve akıl yürütme modelleri.",
    isOnline: true,
    defaultModel: "gpt-4o",
    availableModels: ["gpt-4o", "gpt-4o-mini", "o3-mini", "gpt-4-turbo"],
    baseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek AI",
    description: "Matematik, kodlama ve akademik analizde üstün uygun maliyetli modeller.",
    isOnline: true,
    defaultModel: "deepseek-chat",
    availableModels: ["deepseek-chat", "deepseek-reasoner"],
    baseUrl: "https://api.deepseek.com",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  grok: {
    id: "grok",
    name: "xAI Grok",
    description: "Elon Musk ve xAI tarafından geliştirilen yüksek zeka Grok modelleri.",
    isOnline: true,
    defaultModel: "grok-2-latest",
    availableModels: ["grok-2-latest", "grok-beta"],
    baseUrl: "https://api.x.ai/v1",
    keyPlaceholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
  kimi: {
    id: "kimi",
    name: "Moonshot Kimi",
    description: "Geniş bağlam pencereli (long-context) akademik araştırma modelleri.",
    isOnline: true,
    defaultModel: "moonshot-v1-32k",
    availableModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    baseUrl: "https://api.moonshot.cn/v1",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Gelişmiş akademik muhakeme ve pedagojik ders anlatımında uzman Claude.",
    isOnline: true,
    defaultModel: "claude-3-5-sonnet-20241022",
    availableModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/",
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter (Universal)",
    description: "Tek API Key ile yüzlerce yapay zeka modeline (Meta, Qwen, Mistral) erişim.",
    isOnline: true,
    defaultModel: "meta-llama/llama-3.3-70b-instruct",
    availableModels: [
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-r1",
      "google/gemini-2.0-flash-exp:free",
      "anthropic/claude-3.5-sonnet",
      "mistralai/mistral-large-2407",
    ],
    baseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
  },
  custom: {
    id: "custom",
    name: "Custom / Proxy (OpenAI Uyumlu)",
    description: "Kendi yerel vLLM, LM Studio veya özel API proxy sunucunuz.",
    isOnline: true,
    defaultModel: "default",
    availableModels: ["default"],
    baseUrl: "http://localhost:8000/v1",
    keyPlaceholder: "İsteğe bağlı token",
    docsUrl: "",
  },
};

export class MultiProviderLLMService implements ILLMService {
  private activeAbortController: AbortController | null = null;

  public getSavedKeys(): Record<string, string> {
    if (typeof window === "undefined") return {};
    try {
      const data = localStorage.getItem("ragteach_api_keys");
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public saveKey(providerId: string, key: string) {
    if (typeof window === "undefined") return;
    const keys = this.getSavedKeys();
    keys[providerId] = key.trim();
    localStorage.setItem("ragteach_api_keys", JSON.stringify(keys));
  }

  public removeKey(providerId: string) {
    if (typeof window === "undefined") return;
    const keys = this.getSavedKeys();
    delete keys[providerId];
    localStorage.setItem("ragteach_api_keys", JSON.stringify(keys));
  }

  public getActiveProvider(): LLMProviderId {
    if (typeof window === "undefined") return "ollama";
    const id = localStorage.getItem("ragteach_active_provider") as LLMProviderId;
    return id && Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, id) ? id : "ollama";
  }

  public setActiveProvider(id: LLMProviderId) {
    if (typeof window === "undefined") return;
    localStorage.setItem("ragteach_active_provider", id);
  }

  public getActiveModel(providerId: LLMProviderId): string {
    if (typeof window === "undefined") return PROVIDER_CONFIGS[providerId].defaultModel;
    const saved = localStorage.getItem(`ragteach_model_${providerId}`);
    return saved || PROVIDER_CONFIGS[providerId].defaultModel;
  }

  public setActiveModel(providerId: LLMProviderId, model: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(`ragteach_model_${providerId}`, model);
  }

  public isOnlineMode(): boolean {
    const active = this.getActiveProvider();
    return active !== "ollama";
  }

  public interrupt() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Tests connection to the provider using the user's API key
   */
  public async testConnection(providerId: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const isKnownLLM = Object.prototype.hasOwnProperty.call(PROVIDER_CONFIGS, providerId);
      const model = isKnownLLM ? this.getActiveModel(providerId as LLMProviderId) : undefined;
      const res = await fetch("/api/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          apiKey,
          model,
          baseUrl: providerId === "custom" ? localStorage.getItem("ragteach_custom_url") : undefined,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        message: `Test isteği başarısız oldu: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Main generation engine routing through server-side /api/chat proxy to bypass CORS
   */
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    this.interrupt();
    this.activeAbortController = new AbortController();
    const signal = this.activeAbortController.signal;

    const providerId = this.getActiveProvider();
    const model = this.getActiveModel(providerId);
    const keys = this.getSavedKeys();
    const apiKey = keys[providerId] || "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          model,
          apiKey,
          messages: [{ role: "user", content: request.prompt }],
          context: request.context,
          baseUrl: providerId === "custom" ? localStorage.getItem("ragteach_custom_url") : undefined,
        }),
        signal,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        return {
          text: "",
          tokensUsed: 0,
          error: data.error || `HTTP ${res.status} Hatası`,
          provider: providerId,
        };
      }

      const generatedText = data.text || "";

      // Stream tokens to callback for visual typing feel
      if (request.streamCallback && generatedText) {
        const words = generatedText.split(" ");
        for (let i = 0; i < words.length; i++) {
          if (signal.aborted) break;
          request.streamCallback((i > 0 ? " " : "") + words[i]);
        }
      }

      return {
        text: generatedText,
        tokensUsed: Math.max(1, Math.ceil(generatedText.length / 4)),
        provider: providerId,
      };
    } catch (err: any) {
      if (signal.aborted) {
        return { text: "", tokensUsed: 0 };
      }
      return {
        text: "",
        tokensUsed: 0,
        error: `Model bağlantı hatası: ${err.message || String(err)}`,
        provider: providerId,
      };
    }
  }
}

export const llmService = new MultiProviderLLMService();

