"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTutorStore, tutorActions, getTutorSnapshot } from "@/lib/store";
import { QualityLevel } from "@/types/tutor";
import {
  llmService,
  PROVIDER_CONFIGS,
  LLMProviderId,
} from "@/services/llmService";
import { audioService, TTSEngine, ELEVENLABS_VOICES } from "@/services/audioService";
import { apiPost, apiGet } from "@/lib/api";
import {
  Settings,
  X,
  Cpu,
  Mic,
  Database,
  Monitor,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Sparkles,
  MousePointer,
  RefreshCw,
  Trash2,
  Volume2,
} from "lucide-react";

type SettingsTab = "models" | "keys" | "visuals" | "voice" | "rag";

export function SettingsModal() {
  const showSettings = useTutorStore((s) => s.showSettings);
  const quality = useTutorStore((s) => s.quality);
  const sttLanguage = useTutorStore((s) => s.sttLanguage);

  const [activeTab, setActiveTab] = useState<SettingsTab>("models");
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>("gemini");
  const [selectedModel, setSelectedModel] = useState("gemini-3.6-flash");
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});
  const [currentInputKey, setCurrentInputKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  // Voice & RAG settings
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>("browser");
  const [ttsVoiceId, setTtsVoiceId] = useState("nova");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsCustomEndpoint, setTtsCustomEndpoint] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [voiceTestMsg, setVoiceTestMsg] = useState("");
  const [voiceTestStatus, setVoiceTestStatus] = useState<"idle" | "success" | "error">("idle");
  const [speed, setSpeed] = useState(1.0);
  const [topK, setTopK] = useState(3);
  const [chunkSize, setChunkSize] = useState(512);

  // Load saved keys & current active provider on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const keys = llmService.getSavedKeys();
      setSavedKeys(keys);
      const active = llmService.getActiveProvider();
      setSelectedProvider(active);
      const model = llmService.getActiveModel(active);
      setSelectedModel(model);
      setCurrentInputKey(keys[active] || "");

      const vCfg = audioService.getVoiceConfig();
      setTtsEngine(vCfg.engine);
      setTtsVoiceId(vCfg.voiceId);
      setSpeed(vCfg.speed);
      setElevenLabsKey(keys["elevenlabs"] || "");
      setTtsApiKey(vCfg.apiKey || "");
      setTtsCustomEndpoint(vCfg.customEndpoint || "");
      setAutoSpeak(vCfg.autoSpeak ?? false);
    }
  }, [showSettings]);

  const handleEngineChange = (engine: TTSEngine) => {
    setTtsEngine(engine);
    let defaultVoice = "tr-TR-Standard";
    if (engine === "openai" || engine === "custom") defaultVoice = "nova";
    if (engine === "elevenlabs") defaultVoice = "21m00Tcm4TlvDq8ikWAM";
    setTtsVoiceId(defaultVoice);
    audioService.setVoiceConfig({ engine, voiceId: defaultVoice });
  };

  const handleVoiceIdChange = (vid: string) => {
    setTtsVoiceId(vid);
    audioService.setVoiceConfig({ voiceId: vid });
  };

  const handleSpeedChange = (spd: number) => {
    setSpeed(spd);
    audioService.setVoiceConfig({ speed: spd });
  };

  const handleAutoSpeakToggle = (val: boolean) => {
    setAutoSpeak(val);
    audioService.setVoiceConfig({ autoSpeak: val });
    if (val) {
      tutorActions.setInteractionMode("hybrid");
    } else if (getTutorSnapshot().interactionMode === "hybrid") {
      tutorActions.setInteractionMode("text");
    }
  };

  const handleSaveTTSKey = () => {
    audioService.setVoiceConfig({
      apiKey: ttsApiKey.trim(),
      customEndpoint: ttsCustomEndpoint.trim(),
    });
    if (ttsEngine === "elevenlabs" && ttsApiKey.trim()) {
      llmService.saveKey("elevenlabs", ttsApiKey.trim());
      setSavedKeys(llmService.getSavedKeys());
    }
    setVoiceTestMsg("TTS anahtarı kaydedildi.");
    setTimeout(() => setVoiceTestMsg(""), 3000);
  };

  const handleSaveElevenLabsKey = () => {
    if (!elevenLabsKey.trim()) return;
    llmService.saveKey("elevenlabs", elevenLabsKey.trim());
    setSavedKeys(llmService.getSavedKeys());
  };

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    setVoiceTestMsg("Ses üretiliyor ve test ediliyor...");
    setVoiceTestStatus("idle");
    try {
      const effectiveVoice = ttsVoiceId.trim() || (ttsEngine === "elevenlabs" ? "21m00Tcm4TlvDq8ikWAM" : "nova");
      const effectiveKey = (ttsApiKey || (ttsEngine === "elevenlabs" ? elevenLabsKey : "")).trim();
      const cfg = {
        engine: ttsEngine,
        voiceId: effectiveVoice,
        apiKey: effectiveKey,
        customEndpoint: ttsCustomEndpoint.trim(),
        speed,
      };
      audioService.setVoiceConfig(cfg);
      if (ttsEngine === "elevenlabs" && effectiveKey) {
        llmService.saveKey("elevenlabs", effectiveKey);
        setSavedKeys(llmService.getSavedKeys());
      }
      const result = await audioService.testTTS(cfg);
      setVoiceTestMsg(result.message);
      setVoiceTestStatus(result.success ? "success" : "error");
    } catch (err: any) {
      setVoiceTestMsg(err.message || "Ses testi başarısız oldu.");
      setVoiceTestStatus("error");
    } finally {
      setIsTestingVoice(false);
    }
  };

  if (!showSettings) return null;

  const currentConfig = PROVIDER_CONFIGS[selectedProvider];
  const hasKeySaved = !!savedKeys[selectedProvider];

  const handleProviderSelect = (providerId: LLMProviderId) => {
    setSelectedProvider(providerId);
    llmService.setActiveProvider(providerId);
    const model = llmService.getActiveModel(providerId);
    setSelectedModel(model);
    setCurrentInputKey(savedKeys[providerId] || "");
    setTestResult(null);
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    llmService.setActiveModel(selectedProvider, model);
  };

  const handleSaveKey = async () => {
    if (!currentInputKey.trim()) return;
    llmService.saveKey(selectedProvider, currentInputKey.trim());
    const updated = llmService.getSavedKeys();
    setSavedKeys(updated);

    // Sync with backend API if running
    try {
      await apiPost("/api/settings/keys", {
        ref: selectedProvider,
        api_key: currentInputKey.trim(),
      });
    } catch {
      /* Backend optional */
    }

    setTestResult({ success: true, message: `${currentConfig.name} anahtarı kaydedildi.` });
  };

  const handleRemoveKey = () => {
    llmService.removeKey(selectedProvider);
    setCurrentInputKey("");
    setSavedKeys(llmService.getSavedKeys());
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const keyToTest = currentInputKey.trim() || savedKeys[selectedProvider] || "";
      const result = await llmService.testConnection(selectedProvider, keyToTest);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: `Hata: ${e.message || String(e)}` });
    } finally {
      setIsTesting(false);
    }
  };

  const qualityLevels: QualityLevel[] = ["auto", "low", "medium", "high", "ultra"];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-midnight-950/85 backdrop-blur-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full max-w-4xl h-[90vh] rounded-3xl bg-slate-950/92 border border-white/10 shadow-[0_30px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-400 font-semibold">
                  RagTeach Architecture
                </span>
                <h2 className="text-xl font-serif font-medium text-white">
                  Yapay Zeka Modelleri & Sistem Ayarları
                </h2>
              </div>
            </div>

            <button
              onClick={() => tutorActions.toggleSettings(false)}
              className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-1 px-6 py-2 border-b border-white/5 bg-slate-950/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab("models")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono tracking-wider transition-all whitespace-nowrap ${
                activeTab === "models"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.2)] font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>YAPAY ZEKA MODELLERİ & API</span>
            </button>

            <button
              onClick={() => setActiveTab("visuals")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono tracking-wider transition-all whitespace-nowrap ${
                activeTab === "visuals"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>3D PERFORMANS & FARE İMLECİ</span>
            </button>

            <button
              onClick={() => setActiveTab("voice")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono tracking-wider transition-all whitespace-nowrap ${
                activeTab === "voice"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>SES & BARGE-IN</span>
            </button>

            <button
              onClick={() => setActiveTab("rag")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono tracking-wider transition-all whitespace-nowrap ${
                activeTab === "rag"
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>RAG & KİTAP İNDEKS</span>
            </button>
          </div>

          {/* Main Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === "models" && (
              <div className="space-y-6">
                {/* Offline vs Online Mode Quick Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-cyan-950/40 border border-cyan-400/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {currentConfig.isOnline ? (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-mono font-semibold">
                          <Wifi className="w-3 h-3 text-cyan-400" />
                          ONLINE BULUT MODU
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-semibold">
                          <WifiOff className="w-3 h-3 text-emerald-400" />
                          OFFLINE / YEREL MODEL
                        </span>
                      )}
                      <span className="text-xs font-mono text-slate-300 font-medium">
                        Aktif Sağlayıcı: <strong className="text-white">{currentConfig.name}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      API Key girerek Gemini, GPT-4o, DeepSeek, Grok, Kimi ve Claude gibi tüm online
                      modelleri kullanabilir ya da tamamen internetsiz Ollama moduna geçebilirsiniz.
                    </p>
                  </div>

                  <button
                    onClick={() => handleProviderSelect(currentConfig.isOnline ? "ollama" : "gemini")}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-mono text-cyan-300 transition-all shrink-0"
                  >
                    {currentConfig.isOnline ? "Offline Moduna Geç" : "Online Moduna Geç"}
                  </button>
                </div>

                {/* Model Providers Grid */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">
                    MODEL SAĞLAYICISINI SEÇİN
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {(Object.keys(PROVIDER_CONFIGS) as LLMProviderId[]).map((pid) => {
                      const cfg = PROVIDER_CONFIGS[pid];
                      const isSelected = selectedProvider === pid;
                      const hasKey = !!savedKeys[pid] || pid === "ollama";

                      return (
                        <button
                          key={pid}
                          onClick={() => handleProviderSelect(pid)}
                          className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between relative overflow-hidden ${
                            isSelected
                              ? "bg-cyan-500/15 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                              : "bg-slate-900/50 border-white/5 hover:border-white/15 hover:bg-slate-900/80"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-serif font-medium text-white">
                                {cfg.name}
                              </span>
                              {hasKey && (
                                <span
                                  className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]"
                                  title="API Key Hazır"
                                />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                              {cfg.description}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[9px] font-mono">
                            <span className={cfg.isOnline ? "text-cyan-400" : "text-emerald-400"}>
                              {cfg.isOnline ? "API Key" : "Yerel / Offline"}
                            </span>
                            <span className="text-slate-500">
                              {cfg.availableModels.length} model
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* API Key Configuration Card */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-sm font-serif font-medium text-white">
                          {currentConfig.name} API Key Yapılandırması
                        </h3>
                        {hasKeySaved && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-teal-500/20 text-teal-300 border border-teal-400/30">
                            <CheckCircle2 className="w-3 h-3" />
                            KAYITLI & AKTİF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Anahtarınız tarayıcınızda ve yerel güvenli depolamada saklanır.
                      </p>
                    </div>

                    {currentConfig.docsUrl && (
                      <a
                        href={currentConfig.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <span>API Key Al</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {currentConfig.id !== "ollama" ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative flex items-center">
                          <input
                            type={showSecretKey ? "text" : "password"}
                            value={currentInputKey}
                            onChange={(e) => setCurrentInputKey(e.target.value)}
                            placeholder={currentConfig.keyPlaceholder}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400 transition-all pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            className="absolute right-3 p-1 text-slate-400 hover:text-white transition-colors"
                          >
                            {showSecretKey ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <button
                          onClick={handleSaveKey}
                          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] shrink-0"
                        >
                          Anahtarı Kaydet
                        </button>

                        <button
                          onClick={handleTestConnection}
                          disabled={isTesting}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-mono text-slate-200 transition-all shrink-0"
                          title="Bağlantıyı Test Et"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                          <span>Test Et</span>
                        </button>

                        {hasKeySaved && (
                          <button
                            onClick={handleRemoveKey}
                            className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-400/20 transition-all"
                            title="Anahtarı Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Test Result Message */}
                      {testResult && (
                        <div
                          className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 border ${
                            testResult.success
                              ? "bg-teal-950/30 text-teal-300 border-teal-400/30"
                              : "bg-rose-950/30 text-rose-300 border-rose-400/30"
                          }`}
                        >
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-400/20 flex items-center justify-between">
                      <span className="text-xs font-mono text-emerald-200">
                        Ollama yerel olarak http://localhost:11434 üzerinden çalışır. İnternet ve API
                        Key gerekmez.
                      </span>
                      <button
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-xs font-mono transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                        <span>Ollama Testi</span>
                      </button>
                    </div>
                  )}

                  {/* Model Selection Dropdown */}
                  <div className="pt-2 border-t border-white/5">
                    <label className="block text-xs font-mono text-slate-400 mb-2">
                      KULLANILACAK {currentConfig.name.toUpperCase()} MODELİ
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentConfig.availableModels.map((m) => (
                        <button
                          key={m}
                          onClick={() => handleModelSelect(m)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono text-left transition-all flex items-center justify-between ${
                            selectedModel === m
                              ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                              : "bg-slate-950/50 text-slate-400 border border-white/5 hover:border-white/15 hover:text-slate-200"
                          }`}
                        >
                          <span>{m}</span>
                          {selectedModel === m && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "visuals" && (
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    WebGL 3D İşleme & GPU Performans Profili
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    Cihazınızın donanımına göre parçacık yoğunluğunu, gölgelendirici karmaşıklığını
                    ve kare hızını ayarlar.
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {qualityLevels.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => tutorActions.setQuality(lvl)}
                      className={`py-2.5 rounded-xl text-xs font-mono uppercase transition-all ${
                        quality === lvl
                          ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                          : "bg-slate-900 text-slate-400 border border-white/5 hover:border-white/20"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {/* Mouse Cursor Lag Solution Card */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <MousePointer className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-serif font-medium text-white">
                      Fare İmleci & Donanım Hızlandırma
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    İmleç takılmalarını önlemek için fare takip motoru saf GPU donanım hızlandırmalı
                    (144Hz zero-lag requestAnimationFrame) mimariye güncellenmiştir.
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-slate-300">
                      Gecikmesiz Donanım İmleci
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-400/30 text-[10px] font-mono font-semibold">
                      AKTİF (144Hz Zero-Lag)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "voice" && (
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    Mikrofon Konuşma Dili (STT)
                  </span>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    Sesli komutlarınızın hangi dilde algılanacağını seçin.
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      value={sttLanguage || 'tr-TR'}
                      onChange={(e) => {
                        const val = e.target.value;
                        tutorActions.setSttLanguage(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('ragteach_stt_language', val);
                        }
                      }}
                      className="flex-1 p-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-200 outline-none focus:border-cyan-400"
                    >
                      <option value="tr-TR">🇹🇷 Türkçe (tr-TR)</option>
                      <option value="en-US">🇬🇧 English (en-US)</option>
                      <option value="de-DE">🇩🇪 Deutsch (de-DE)</option>
                      <option value="fr-FR">🇫🇷 Français (fr-FR)</option>
                      <option value="ar-SA">🇦🇪 العربية (ar-SA)</option>
                    </select>
                    <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 shrink-0">
                      <Mic className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-300 font-semibold">{sttLanguage || 'tr-TR'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    Metinden Sese (TTS) & Sesli Etkileşim Motoru
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    Yapay zeka öğretmeninizin konuşma motorunu, tonunu ve hızını belirleyin. Hem
                    tamamen çevrimdışı sistem sesini hem de OpenAI / ElevenLabs gibi bulut ses
                    motorlarını kullanabilirsiniz.
                  </p>
                </div>

                {/* Auto Speak Toggle */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-white font-semibold">
                      Otomatik Sesli Okuma (Yapay Zekâ Yanıtlarını Seslendir)
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Açık olduğunda yapay zekâ öğretmen her yanıtı seçtiğiniz TTS motoruyla seslendirir.
                    </p>
                  </div>
                  <button
                    onClick={() => handleAutoSpeakToggle(!autoSpeak)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all ${
                      autoSpeak
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                        : "bg-slate-800 text-slate-400 border border-white/10"
                    }`}
                  >
                    {autoSpeak ? "AÇIK" : "KAPALI"}
                  </button>
                </div>

                {/* Voice Engine Selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
                    SES SENTEZİ MOTORU (OFFLINE / ONLINE)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <button
                      onClick={() => handleEngineChange("browser")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        ttsEngine === "browser"
                          ? "bg-emerald-500/15 border-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                          : "bg-slate-900/40 border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-serif font-medium text-white">Tarayıcı / Sistem</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-500/20 text-emerald-300">
                          OFFLINE
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Sıfır gecikme, ücretsiz sistem sesleri.
                      </p>
                    </button>

                    <button
                      onClick={() => handleEngineChange("openai")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        ttsEngine === "openai"
                          ? "bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                          : "bg-slate-900/40 border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-serif font-medium text-white">OpenAI TTS</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-500/20 text-cyan-300">
                          ONLINE
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        tts-1 stüdyo kalitesinde Nova, Alloy, Onyx sesleri.
                      </p>
                    </button>

                    <button
                      onClick={() => handleEngineChange("elevenlabs")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        ttsEngine === "elevenlabs"
                          ? "bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                          : "bg-slate-900/40 border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-serif font-medium text-white">ElevenLabs</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-500/20 text-cyan-300">
                          ONLINE
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Multilingual v2 insansı tonlama vurgusu.
                      </p>
                    </button>

                    <button
                      onClick={() => handleEngineChange("custom")}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        ttsEngine === "custom"
                          ? "bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                          : "bg-slate-900/40 border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-serif font-medium text-white">Özel TTS API</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-cyan-500/20 text-cyan-300">
                          CUSTOM
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Herhangi bir OpenAI-uyumlu veya harici TTS servisi.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Engine Specific Configuration */}
                <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 space-y-4">
                  {ttsEngine === "browser" && (
                    <div className="text-xs font-mono text-slate-300 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Yerel Web Speech API Aktif</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">
                        Cihazınızın yerel konuşma sentezleyicisi kullanılır. Türkçe ve İngilizce dillerini
                        tamamen internetsiz konuşabilir.
                      </p>
                    </div>
                  )}

                  {ttsEngine === "openai" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1.5">
                          OPENAI SES TONU
                        </label>
                        <select
                          value={ttsVoiceId}
                          onChange={(e) => handleVoiceIdChange(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-200 outline-none focus:border-cyan-400"
                        >
                          <option value="nova">nova (Doğal Akademik Kadın)</option>
                          <option value="alloy">alloy (Dengeli Nötr Profesör)</option>
                          <option value="echo">echo (Otoriter Erkek)</option>
                          <option value="onyx">onyx (Derin ve Tok Erkek Profesör)</option>
                          <option value="fable">fable (Akademik Vurgulu)</option>
                          <option value="shimmer">shimmer (Sıcak & Açık Ton)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono text-slate-400">
                          ÖZEL TTS API ANAHTARI (İsteğe bağlı)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={ttsApiKey}
                            onChange={(e) => setTtsApiKey(e.target.value)}
                            placeholder={savedKeys["openai"] ? "Genel OpenAI anahtarı tanımlı (farklı bir key için girin)" : "sk-..."}
                            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={handleSaveTTSKey}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-all"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {ttsEngine === "elevenlabs" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1.5">
                          ELEVENLABS SESİ
                        </label>
                        <select
                          value={
                            ELEVENLABS_VOICES.some(v => v.id === ttsVoiceId) ? ttsVoiceId : "custom"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== "custom") {
                              handleVoiceIdChange(val);
                            } else {
                              handleVoiceIdChange("");
                            }
                          }}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-200 outline-none focus:border-cyan-400"
                        >
                          {ELEVENLABS_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                          <option value="custom">Özel Voice ID (Kendi Ses Kimliğinizi Girin)</option>
                        </select>
                      </div>

                      {(!ELEVENLABS_VOICES.some(v => v.id === ttsVoiceId) || ttsVoiceId === "") && (
                        <div>
                          <label className="block text-xs font-mono text-slate-400 mb-1.5">
                            ÖZEL ELEVENLABS SES KİMLİĞİ (VOICE ID)
                          </label>
                          <input
                            type="text"
                            value={ttsVoiceId}
                            onChange={(e) => handleVoiceIdChange(e.target.value)}
                            placeholder="Örn: 21m00Tcm4TlvDq8ikWAM veya klon ses ID'niz"
                            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono text-slate-400">
                          ELEVENLABS API KEY
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={ttsApiKey || elevenLabsKey}
                            onChange={(e) => {
                              setTtsApiKey(e.target.value);
                              setElevenLabsKey(e.target.value);
                            }}
                            placeholder="xi-api-key veya sk-..."
                            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={handleSaveTTSKey}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-all"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {ttsEngine === "custom" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-mono text-slate-400 mb-1.5">
                          ÖZEL TTS API URL ENDPOINT
                        </label>
                        <input
                          type="url"
                          value={ttsCustomEndpoint}
                          onChange={(e) => setTtsCustomEndpoint(e.target.value)}
                          placeholder="http://localhost:8000/v1/audio/speech veya https://api.your-tts.com/v1/audio/speech"
                          className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-mono text-slate-400">
                          TTS API KEY (BEARER TOKEN)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={ttsApiKey}
                            onChange={(e) => setTtsApiKey(e.target.value)}
                            placeholder="sk-... veya API anahtarı (gerekirse)"
                            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={handleSaveTTSKey}
                            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-all"
                          >
                            Kaydet
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Speed slider */}
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1.5">
                      <span>Konuşma Hızı</span>
                      <span className="text-cyan-400 font-semibold">{speed}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.05"
                      value={speed}
                      onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* Voice Tester Button */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        onClick={handleTestVoice}
                        disabled={isTestingVoice}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-mono text-cyan-200 transition-all shadow-[0_0_15px_rgba(34,211,238,0.15)] shrink-0"
                      >
                        <Volume2 className={`w-4 h-4 ${isTestingVoice ? "animate-pulse" : ""}`} />
                        <span>{isTestingVoice ? "Ses Üretiliyor..." : "Seçili Sesi Test Et"}</span>
                      </button>

                      {voiceTestStatus === "success" && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-950/40 border border-teal-400/30 text-teal-300 text-xs font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span>{voiceTestMsg}</span>
                        </div>
                      )}
                      {voiceTestStatus === "error" && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-400/30 text-rose-300 text-xs font-mono">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{voiceTestMsg}</span>
                        </div>
                      )}
                      {voiceTestStatus === "idle" && voiceTestMsg && (
                        <span className="text-xs font-mono text-cyan-300 animate-fadeIn">
                          {voiceTestMsg}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-950/20 border border-teal-400/20 text-xs font-mono text-teal-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0 shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
                  <span>
                    Doğal Kesme (Barge-In) Eşiği: 0.045 RMS. Siz konuşmaya başladığınız anda yapay zeka
                    öğretmen anında susar ve sizi dinlemeye başlar.
                  </span>
                </div>
              </div>
            )}

            {activeTab === "rag" && (
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    RAG Vektör Getirme & Semantik Doğruluk
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    Yüklenen ders kitaplarından kaç adet pasajın taranacağını ve parçalama boyutunu
                    belirleyin.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                      <span>Alıntılanacak Pasaj Sayısı (Top-K)</span>
                      <span className="text-cyan-400">{topK} kaynak pasaj</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                      <span>Chunk Token Boyutu</span>
                      <span className="text-cyan-400">{chunkSize} tokens</span>
                    </div>
                    <input
                      type="range"
                      min="256"
                      max="1024"
                      step="64"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(parseInt(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
