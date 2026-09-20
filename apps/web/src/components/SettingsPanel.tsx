"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api";

type Channel = {
  mode: "offline" | "online";
  provider: string;
  model: string;
  voice?: string | null;
  api_key_ref?: string | null;
  fallback_to_offline?: boolean;
};

type Settings = {
  llm: Channel;
  stt: Channel;
  tts: Channel;
  embedding: Channel;
  persona: { role: string; style: string; language: string };
  rag: { top_k: number; course_id?: string | null; chunk_size: number; chunk_overlap: number };
  interaction_mode: "text" | "voice" | "hybrid";
  unload_local_llm_when_online: boolean;
};

const emptyChannel = (provider: string, model: string): Channel => ({
  mode: "offline",
  provider,
  model,
  fallback_to_offline: true,
});

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [keyRef, setKeyRef] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiGet<Settings>("/api/settings").then(setSettings).catch((e) => setMsg(String(e)));
    apiGet<{ refs: string[] }>("/api/settings/keys").then((r) => setRefs(r.refs)).catch(() => undefined);
  }, []);

  if (!settings) {
    return <p>Ayarlar yükleniyor…</p>;
  }

  const save = async () => {
    const saved = await apiPut<Settings>("/api/settings", settings);
    setSettings(saved);
    setMsg("Kaydedildi");
  };

  const saveKey = async () => {
    await apiPost("/api/settings/keys", { ref: keyRef, api_key: apiKey });
    setApiKey("");
    const r = await apiGet<{ refs: string[] }>("/api/settings/keys");
    setRefs(r.refs);
    setMsg(`API key kaydedildi: ${keyRef}`);
  };

  const channelEditor = (label: string, key: "llm" | "stt" | "tts") => {
    const ch = settings[key];
    return (
      <section>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)" }}>{label}</h3>
        <div className="row">
          <div>
            <label>Mode</label>
            <select
              value={ch.mode}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  [key]: { ...ch, mode: e.target.value as "offline" | "online" },
                })
              }
            >
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label>Provider</label>
            <input
              value={ch.provider}
              onChange={(e) => setSettings({ ...settings, [key]: { ...ch, provider: e.target.value } })}
            />
          </div>
        </div>
        <label>Model</label>
        <input
          value={ch.model}
          onChange={(e) => setSettings({ ...settings, [key]: { ...ch, model: e.target.value } })}
        />
        {key === "tts" && (
          <>
            <label>Voice</label>
            <input
              value={ch.voice || ""}
              onChange={(e) => setSettings({ ...settings, [key]: { ...ch, voice: e.target.value } })}
            />
          </>
        )}
        <label>API key ref</label>
        <input
          value={ch.api_key_ref || ""}
          onChange={(e) =>
            setSettings({ ...settings, [key]: { ...ch, api_key_ref: e.target.value || null } })
          }
          placeholder="örn. openai, gemini, grok"
        />
      </section>
    );
  };

  return (
    <div>
      <h2>Ayarlar</h2>
      {msg && <p style={{ color: "var(--accent)" }}>{msg}</p>}

      {channelEditor("LLM Ajan", "llm")}
      {channelEditor("Speech → Text", "stt")}
      {channelEditor("Text → Speech", "tts")}

      <section>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)" }}>Persona</h3>
        <label>Rol</label>
        <input
          value={settings.persona.role}
          onChange={(e) =>
            setSettings({ ...settings, persona: { ...settings.persona, role: e.target.value } })
          }
        />
        <label>Stil</label>
        <textarea
          rows={3}
          value={settings.persona.style}
          onChange={(e) =>
            setSettings({ ...settings, persona: { ...settings.persona, style: e.target.value } })
          }
        />
        <label>
          <input
            type="checkbox"
            checked={settings.unload_local_llm_when_online}
            onChange={(e) =>
              setSettings({ ...settings, unload_local_llm_when_online: e.target.checked })
            }
          />{" "}
          Online LLM kullanırken yerel Ollama VRAM boşalt
        </label>
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)" }}>API Key Kaydet</h3>
        <label>Ref adı</label>
        <select value={keyRef} onChange={(e) => setKeyRef(e.target.value)}>
          {["openai", "gemini", "anthropic", "xai", "openrouter", "groq", "deepgram", "elevenlabs"].map(
            (r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ),
          )}
        </select>
        <label>Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
        <button className="pill" onClick={saveKey}>
          Key kaydet
        </button>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Kayıtlı: {refs.length ? refs.join(", ") : "yok"}
        </p>
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <button className="pill active" onClick={save}>
          Ayarları kaydet
        </button>
        <button
          className="pill"
          onClick={() =>
            setSettings({
              ...settings,
              llm: emptyChannel("ollama", "qwen2.5:14b-instruct-q4_K_M"),
              stt: emptyChannel("faster-whisper", "medium"),
              tts: { ...emptyChannel("kokoro", "kokoro"), voice: "af_heart" },
            })
          }
        >
          Offline varsayılan
        </button>
      </div>
    </div>
  );
}
