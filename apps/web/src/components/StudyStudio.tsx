"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, FileText, FolderOpen, Layers3, LoaderCircle, MessageSquare, Mic, Plus, Search, Settings2, ShieldCheck, Sparkles, Square, Upload, X, Zap } from "lucide-react";
import { tutorActions, useTutorStore, getTutorSnapshot } from "@/lib/store";
import { ragService } from "@/services/ragService";
import { tutorService } from "@/services/tutorService";
import { llmService, LLMProviderId, PROVIDER_CONFIGS } from "@/services/llmService";
import { audioService, TTSEngine, ELEVENLABS_VOICES } from "@/services/audioService";
import { AnswerContent } from "@/components/AnswerContent";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand-lockup ${small ? "small" : ""}`}><span className="brand-icon"><Layers3 size={21} strokeWidth={1.8}/></span>{!small && <span>ragteach<span className="brand-period">.</span></span>}</div>;
}

function KnowledgeArt() {
  return <div className="knowledge-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="art-cross cross-one">+</div><div className="art-cross cross-two">+</div><div className="art-dot"/><div className="floating-note note-back"><div/><div/><div/></div><div className="floating-note note-front"><BookOpen size={32} strokeWidth={1.2}/><span>KNOWLEDGE</span><div/><div/><div/><span className="note-index">01 — ∞</span></div><div className="art-badge"><Sparkles size={17}/></div><span className="art-caption">BİLGİDEN ANLAYIŞA</span></div>;
}

function Preferences({ onClose }: { onClose: () => void }) {
  const vCfg = audioService.getVoiceConfig();
  const [provider, setProvider] = useState<LLMProviderId>(llmService.getActiveProvider());
  const [model, setModel] = useState(llmService.getActiveModel(provider));
  const [key, setKey] = useState(llmService.getSavedKeys()[provider] || "");
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem("ragteach_custom_url") || "http://localhost:1234/v1");
  const [topK, setTopK] = useState(localStorage.getItem("ragteach_top_k") || "5");

  // TTS Settings
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>(vCfg.engine || "browser");
  const [ttsKey, setTtsKey] = useState(vCfg.apiKey || llmService.getSavedKeys()["elevenlabs"] || "");
  const [ttsVoice, setTtsVoice] = useState(vCfg.voiceId || "21m00Tcm4TlvDq8ikWAM");
  const [ttsEndpoint, setTtsEndpoint] = useState(vCfg.customEndpoint || "");
  const [autoSpeak, setAutoSpeak] = useState(vCfg.autoSpeak ?? (getTutorSnapshot().interactionMode !== "text"));
  const [testingVoice, setTestingVoice] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  const save = () => {
    llmService.setActiveProvider(provider);
    llmService.setActiveModel(provider, model.trim());
    if (key.trim()) llmService.saveKey(provider, key); else llmService.removeKey(provider);
    localStorage.setItem("ragteach_custom_url", baseUrl.trim());
    localStorage.setItem("ragteach_top_k", topK);

    // Save Voice Config
    audioService.setVoiceConfig({
      engine: ttsEngine,
      voiceId: ttsVoice.trim(),
      apiKey: ttsKey.trim(),
      customEndpoint: ttsEndpoint.trim(),
      autoSpeak: autoSpeak,
    });

    if (ttsEngine === "elevenlabs" && ttsKey.trim()) {
      llmService.saveKey("elevenlabs", ttsKey.trim());
    }

    if (autoSpeak) {
      tutorActions.setInteractionMode("hybrid");
    } else if (getTutorSnapshot().interactionMode === "hybrid") {
      tutorActions.setInteractionMode("text");
    }

    setMessage("Ayarların kaydedildi.");
  };

  const testVoice = async () => {
    setTestingVoice(true);
    setVoiceFeedback(null);
    try {
      const cfg = {
        engine: ttsEngine,
        voiceId: ttsVoice.trim() || (ttsEngine === "elevenlabs" ? "21m00Tcm4TlvDq8ikWAM" : "nova"),
        apiKey: ttsKey.trim(),
        customEndpoint: ttsEndpoint.trim(),
      };
      audioService.setVoiceConfig(cfg);
      if (ttsEngine === "elevenlabs" && ttsKey.trim()) {
        llmService.saveKey("elevenlabs", ttsKey.trim());
      }
      const result = await audioService.testTTS(cfg);
      setVoiceFeedback(result);
    } catch (err: any) {
      setVoiceFeedback({ success: false, message: `Ses testi hatası: ${err.message || String(err)}` });
    } finally {
      setTestingVoice(false);
    }
  };

  return <dialog ref={dialog} className="settings-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-heading"><div><span className="eyebrow">SANA ÖZEL</span><h2>Çalışma alanı ayarları</h2></div><button className="icon-button" onClick={onClose} aria-label="Ayarları kapat"><X size={20}/></button></div>
    <p className="muted">Öğrenme deneyimini kullanmak istediğin model ve ses hizmetleriyle tamamla.</p>

    <label>Yapay zekâ sağlayıcısı<select value={provider} onChange={e => { const p = e.target.value as LLMProviderId; setProvider(p); setModel(llmService.getActiveModel(p)); setKey(llmService.getSavedKeys()[p] || ""); setMessage(""); }}>{Object.values(PROVIDER_CONFIGS).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Model adı<input value={model} onChange={e => setModel(e.target.value)} list="model-options"/><datalist id="model-options">{PROVIDER_CONFIGS[provider].availableModels.map(m => <option key={m} value={m}/>)}</datalist></label>
    {provider !== "ollama" && <label>API anahtarı<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={PROVIDER_CONFIGS[provider].keyPlaceholder}/><small>Bu cihazın tarayıcısında saklanır.</small></label>}
    {provider === "custom" && <label>Sunucu adresi<input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}/></label>}
    <label>Yanıtta kullanılacak kaynak sayısı <span className="accent">{topK}</span><input type="range" min="1" max="10" value={topK} onChange={e => setTopK(e.target.value)}/></label>

    {/* Text-to-Speech (TTS) Configuration Section */}
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid #36302b" }}>
      <div style={{ marginBottom: 12 }}>
        <strong style={{ display: "block", fontSize: 13, color: "#f2f0eb" }}>Sesli Okuma (Text-to-Speech)</strong>
        <small style={{ color: "#96969b", fontSize: 9 }}>Yanıtların otomatik seslendirilmesi ve TTS API anahtarı</small>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", margin: "14px 0", fontSize: 11, color: "#ded6cf" }}>
        <input
          type="checkbox"
          checked={autoSpeak}
          onChange={e => setAutoSpeak(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--accent)", margin: 0 }}
        />
        <span>Otomatik sesli okuma (Yapay zekâ yanıtları otomatik seslendirilsin)</span>
      </label>

      <label>
        Ses motoru / TTS Servisi
        <select
          value={ttsEngine}
          onChange={e => {
            const eng = e.target.value as TTSEngine;
            setTtsEngine(eng);
            if (eng === "browser") setTtsVoice("tr-TR-Standard");
            else if (eng === "openai") setTtsVoice("nova");
            else if (eng === "elevenlabs") setTtsVoice("21m00Tcm4TlvDq8ikWAM");
          }}
        >
          <option value="browser">Tarayıcı Sesi (Ücretsiz / Çevrimdışı Sistem Sesi)</option>
          <option value="openai">OpenAI TTS (tts-1 / Stüdyo Kalitesi)</option>
          <option value="elevenlabs">ElevenLabs TTS (Multilingual v2)</option>
          <option value="custom">Özel / Herhangi bir OpenAI-uyumlu TTS API</option>
        </select>
      </label>

      {ttsEngine !== "browser" && (
        <label>
          Text-to-Speech (TTS) API Anahtarı
          <input
            type="password"
            autoComplete="off"
            value={ttsKey}
            onChange={e => setTtsKey(e.target.value)}
            placeholder={ttsEngine === "elevenlabs" ? "xi-api-key veya sk-..." : "sk-..."}
          />
          <small>
            {ttsEngine === "openai" && "OpenAI TTS için API key (sk-...). Boş bırakılırsa genel OpenAI anahtarı kullanılır."}
            {ttsEngine === "elevenlabs" && "ElevenLabs hesabınızdan alınan API Key."}
            {ttsEngine === "custom" && "Özel veya harici TTS servisinizin yetkilendirme anahtarı."}
          </small>
        </label>
      )}

      {ttsEngine === "custom" && (
        <label>
          Özel TTS API URL Endpoint
          <input
            type="url"
            value={ttsEndpoint}
            onChange={e => setTtsEndpoint(e.target.value)}
            placeholder="http://localhost:8000/v1/audio/speech veya https://api.your-tts.com/v1/audio/speech"
          />
          <small>Herhangi bir OpenAI-uyumlu ses API servisinin tam adresi.</small>
        </label>
      )}

      {ttsEngine === "openai" && (
        <label>
          OpenAI Ses Karakteri
          <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)}>
            <option value="nova">nova (Doğal Akademik Kadın)</option>
            <option value="alloy">alloy (Dengeli Profesör)</option>
            <option value="echo">echo (Otoriter Erkek)</option>
            <option value="onyx">onyx (Derin ve Tok Erkek Profesör)</option>
            <option value="fable">fable (Akademik Vurgulu)</option>
            <option value="shimmer">shimmer (Sıcak & Açık Ton)</option>
          </select>
        </label>
      )}

      {ttsEngine === "elevenlabs" && (
        <>
          <label>
            ElevenLabs Ses Karakteri
            <select
              value={ELEVENLABS_VOICES.some(v => v.id === ttsVoice) ? ttsVoice : "custom"}
              onChange={e => {
                const val = e.target.value;
                if (val !== "custom") {
                  setTtsVoice(val);
                } else {
                  setTtsVoice("");
                }
              }}
            >
              {ELEVENLABS_VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              <option value="custom">Özel Voice ID (Kendi Ses Kimliğinizi Girin)</option>
            </select>
          </label>

          {(!ELEVENLABS_VOICES.some(v => v.id === ttsVoice) || ttsVoice === "") && (
            <label>
              Özel ElevenLabs Ses Kimliği (Voice ID)
              <input
                value={ttsVoice}
                onChange={e => setTtsVoice(e.target.value)}
                placeholder="Örn: 21m00Tcm4TlvDq8ikWAM veya klon ses ID'niz"
              />
            </label>
          )}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="secondary-button"
            disabled={testingVoice}
            onClick={testVoice}
            style={{ fontSize: 10, padding: "7px 12px" }}
          >
            {testingVoice ? <LoaderCircle className="spin" size={13}/> : <Zap size={13}/>} Sesi test et
          </button>
        </div>

        {voiceFeedback && (
          <div
            style={{
              padding: "7px 10px",
              borderRadius: 6,
              fontSize: 10,
              lineHeight: 1.4,
              background: voiceFeedback.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${voiceFeedback.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              color: voiceFeedback.success ? "#6ee7b7" : "#fca5a5",
            }}
          >
            {voiceFeedback.message}
          </div>
        )}
      </div>
    </div>

    <div className="settings-note" style={{ marginTop: 18 }}><ShieldCheck size={19}/><span>Belgelerin yerel RAG sunucusunda saklanır. Bulut modeli veya ses servisi seçersen ilgili veriler güvenle işlenir.</span></div>
    {message && <p role="status" className="settings-feedback">{message}</p>}
    <div className="dialog-actions"><button className="secondary-button" disabled={testing || !model.trim()} onClick={async () => { save(); setTesting(true); try { const result = await llmService.testConnection(provider, key); setMessage(result.message); } finally { setTesting(false); } }}>{testing ? <LoaderCircle className="spin" size={16}/> : <Zap size={16}/>} LLM Bağlantısını test et</button><button className="primary-button" disabled={!model.trim()} onClick={save}><Check size={17}/> Kaydet</button></div>
  </dialog>;
}

export default function StudyStudio() {
  const books = useTutorStore(s => s.books);
  const activeId = useTutorStore(s => s.activeBookId);
  const entries = useTutorStore(s => s.transcriptEntries);
  const tutorState = useTutorStore(s => s.tutorState);
  const citation = useTutorStore(s => s.activeCitation);
  const micActive = useTutorStore(s => s.micActive);
  const mode = useTutorStore(s => s.interactionMode);
  const book = books.find(b => b.id === activeId);
  const [view, setView] = useState<"studio" | "library">("studio");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"loading" | "online" | "offline">("loading");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [providerLabel, setProviderLabel] = useState("Yerel model");
  const [mobileNav, setMobileNav] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const { startListening, stopListening } = useSpeechRecognition();
  const busy = tutorState === "thinking" || tutorState === "retrieving";
  const refresh = useCallback(async () => {
    setStatus("loading");
    try { tutorActions.setBooks(await ragService.listBooks()); setStatus("online"); setError(""); }
    catch (e) { setStatus("offline"); setError(e instanceof Error ? e.message : "Bağlantı kurulamadı."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setProviderLabel(PROVIDER_CONFIGS[llmService.getActiveProvider()].name); }, [settingsOpen]);
  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [entries, busy]);
  useEffect(() => () => tutorService.interrupt(), []);
  async function upload(file?: File) {
    if (!file || uploading) return;
    setUploading(true); setError(""); setUploadMessage("Belgen hazırlanıyor…");
    try {
      const newBook = await ragService.indexPdf(file, stage => setUploadMessage(stage));
      tutorService.interrupt(); tutorActions.addBook(newBook); tutorActions.setActiveBook(newBook.id);
      setStatus("online"); setView("studio");
    } catch (e) { setError(e instanceof Error ? e.message : "Belge yüklenemedi."); }
    finally { setUploading(false); if (input.current) input.current.value = ""; }
  }
  function ask(text: string, overview = false) { if (busy || !text.trim()) return; setView("studio"); setQuery(""); void tutorService.askQuestion(text, overview); }
  function selectBook(id: string) { tutorService.interrupt(); stopListening(); tutorActions.setActiveBook(id); setView("studio"); setMobileNav(false); }
  const filtered = books.filter(b => b.title.toLocaleLowerCase("tr").includes(filter.toLocaleLowerCase("tr")));
  return <div className="studio-shell" onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes("Files")) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files[0]); }}>
    <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PDF dosyası seç" onChange={e => void upload(e.target.files?.[0])}/>
    {dragging && <div className="drop-overlay"><Upload size={42}/><h2>Bilgiyi buraya bırak.</h2><p>PDF belgeni çalışma alanına ekle.</p></div>}
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
      <Brand/>
      <div className="workspace-switch"><span className="workspace-avatar">K</span><div>Kişisel alanım<small>Öğrenmek için bir alan</small></div><ChevronDown size={15}/></div>
      <span className="nav-label">ÇALIŞMA ALANI</span>
      <nav aria-label="Ana menü"><button className={view === "studio" ? "nav-item selected" : "nav-item"} onClick={() => { setView("studio"); setMobileNav(false); }}><Sparkles size={18}/> Öğrenme stüdyosu<span className="nav-dot"/></button><button className={view === "library" ? "nav-item selected" : "nav-item"} onClick={() => { setView("library"); setMobileNav(false); }}><FolderOpen size={18}/> Kütüphanem<span className="nav-count">{books.length}</span></button><button className="nav-item" onClick={() => { tutorService.interrupt(); tutorActions.clearConversation(); setView("studio"); setMobileNav(false); }}><MessageSquare size={18}/> Yeni sohbet<Plus size={15}/></button></nav>
      <div className="sidebar-section-heading"><span className="nav-label">BELGELERİM</span><button className="icon-button" aria-label="Belge ekle" disabled={uploading} onClick={() => input.current?.click()}><Plus size={15}/></button></div>
      <div className="sidebar-documents">{books.length ? books.map(b => <button key={b.id} className={`sidebar-document ${activeId === b.id ? "active" : ""}`} onClick={() => selectBook(b.id)}><FileText size={16}/><span>{b.title}</span></button>) : <p className="sidebar-empty">Büyük fikirler, küçük bir<br/>yüklemeyle başlar.</p>}</div>
      <button className="sidebar-upload" onClick={() => input.current?.click()} disabled={uploading}><Plus size={17}/> Belge ekle</button>
      <div className="sidebar-bottom"><div className="local-card"><span className="local-icon"><ShieldCheck size={20}/></span><strong>Senin belgelerin.<br/>Senin öğrenme alanın.</strong><p>Kaynağı belli yanıtlarla<br/>merakının peşinden git.</p><span className="local-caption">BELGE ODAKLI ÖĞRENME <ArrowUpRight size={13}/></span></div><button className="nav-item" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/> Ayarlar</button><div className="profile-row"><span className="profile-avatar">S</span><div>Senin çalışma alanın<small>Kişisel hesap</small></div><span className="profile-badge">LOCAL</span></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Menüyü kapat" onClick={() => setMobileNav(false)}/>}
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Menüyü aç"><Layers3 size={22}/></button><span>Çalışma alanım</span><ChevronRight size={13}/><strong>{view === "studio" ? "Öğrenme stüdyosu" : "Kütüphanem"}</strong></div><div className="topbar-actions"><button className={`connection ${status}`} onClick={() => void refresh()} title="Bağlantıyı yenile"><span/>{status === "online" ? "RAG bağlı" : status === "loading" ? "Bağlanıyor" : "Bağlantı yok"}</button><span className="topbar-divider"/><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Model ayarları"><Settings2 size={17}/></button><span className="profile-avatar compact">S</span></div></header>
      <main className="studio-main">
        <div className="page-heading"><div><div className="eyebrow"><span/> KİŞİSEL ÖĞRENME STÜDYON</div><h1>{view === "studio" ? "Merak ettiğin yerden başla." : "Bilginin bir araya geldiği yer."}</h1><p>{view === "studio" ? "Belgelerinle konuş. Bağlantıları keşfet. Gerçekten öğren." : "Tüm kaynakların, bir sonraki büyük fikrin için hazır."}</p></div><button className="primary-button" onClick={() => input.current?.click()} disabled={uploading}>{uploading ? <LoaderCircle className="spin" size={17}/> : <Plus size={18}/>} {uploading ? "Hazırlanıyor" : "PDF yükle"}</button></div>
        {error && <div className="notice" role="alert"><CircleHelp size={18}/><span>{error}</span><button onClick={() => void refresh()}>Yeniden dene</button><button className="icon-button" onClick={() => setError("")} aria-label="Bildirimi kapat"><X size={16}/></button></div>}
        {uploading && <div className="upload-progress" role="status"><LoaderCircle className="spin" size={18}/><span>{uploadMessage}<small>Büyük belgelerde bu işlem birkaç dakika sürebilir.</small></span><div className="indeterminate-progress"/></div>}
        {view === "studio" ? <>
          {!entries.length && <section className="welcome-card"><div className="welcome-copy"><span className="hero-tag"><Sparkles size={13}/> YAPAY ZEKÂ DESTEKLİ ÖĞRENME</span><h2>Bir belge.<br/><span>Sonsuz keşif.</span></h2><p>Ders notlarını, kitaplarını ve araştırmalarını<br className="desktop-break"/> sana özel bir öğrenme deneyimine dönüştür.</p><button className="hero-button" onClick={() => book ? void tutorService.startLecture() : input.current?.click()} disabled={uploading}>{book ? "Öğrenmeye başla" : "İlk belgeni yükle"}<ArrowUpRight size={18}/></button><div className="hero-footnote"><CheckCheck size={14}/> Kaynaklara dayalı yanıtlar <span>·</span> Senin hızında</div></div><KnowledgeArt/></section>}
          <div className="learning-grid"><section className="conversation-card"><div className="panel-heading"><div className="panel-title"><span className="assistant-icon"><Sparkles size={17}/></span><div><h3>Öğrenme asistanın</h3><small><span className="tiny-dot"/>{busy ? tutorState === "retrieving" ? "Kaynaklar inceleniyor…" : "Yanıt hazırlanıyor…" : "Birlikte keşfetmeye hazır"}</small></div></div><button className="model-chip" onClick={() => setSettingsOpen(true)}>{providerLabel}<ChevronDown size={12}/></button></div>
            <div className={`conversation-body ${entries.length ? "has-messages" : ""}`}>
              {entries.length ? <><div className="conversation-start">BELGELERİNE DAYALI BİR SOHBET</div>{entries.map(entry => <article key={entry.id} className={`message ${entry.role}`}><span className="message-avatar">{entry.role === "user" ? "S" : <Sparkles size={16}/>}</span><div><div className="message-meta">{entry.role === "user" ? "Sen" : "RagTeach"}<time>{entry.timestamp}</time></div>{entry.role === "user" ? <p>{entry.text}</p> : <AnswerContent text={entry.text}/>}{entry.sourceCitationId && citation?.id === entry.sourceCitationId && citation.pdfUrl && <a className="citation-chip" href={citation.pdfUrl} target="_blank" rel="noreferrer"><FileText size={12}/> Sayfa {citation.pageNumber}<ArrowUpRight size={12}/></a>}</div></article>)}{busy && <div className="thinking-indicator" role="status"><span/><span/><span/>{tutorState === "retrieving" ? "Belgendeki ilgili bölümleri buluyorum" : "Kaynaklardan yanıtını hazırlıyorum"}</div>}<div ref={conversationEnd}/></> : <div className="chat-empty"><div className="empty-spark"><Sparkles size={25} strokeWidth={1.3}/></div><h3>Bugün neyi keşfedelim?</h3><p>{book ? `${book.title} hakkında bir soru sor veya aşağıdan başla.` : "Bir belge yükle, gerisini merakına bırak.\nHer yanıt, kendi kaynaklarından."}</p><div className="prompt-grid"><button onClick={() => book ? ask("Belgenin ana konusunu ve temel kavramlarını özetle.", true) : input.current?.click()}><BookOpen size={16}/><span>Konuyu özetle</span><ArrowUpRight size={14}/></button><button onClick={() => book ? ask("Belgedeki temel kavramları günlük hayattan örneklerle açıkla.", true) : input.current?.click()}><Zap size={16}/><span>Örneklerle anlat</span><ArrowUpRight size={14}/></button><button onClick={() => book ? ask("Belgenin temel konuları hakkında cevaplarını hemen vermeden üç çalışma sorusu hazırla.", true) : input.current?.click()}><MessageSquare size={16}/><span>Kendimi test edeyim</span><ArrowUpRight size={14}/></button></div></div>}
            </div>
            <form className="composer" onSubmit={e => { e.preventDefault(); ask(query); }}><textarea aria-label="Belgen hakkında soru sor" value={query} maxLength={12000} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(query); } }} placeholder={book ? "Belgen hakkında bir şey sor…" : "Ne öğrenmek istersin? Önce bir belge ekle…"} rows={2}/><div className="composer-bottom"><button type="button" className="composer-attach" onClick={() => input.current?.click()} disabled={uploading} aria-label="PDF ekle"><Plus size={18}/></button><span className="composer-context">{book ? <><FileText size={12}/>{book.title}</> : "Kaynaklarını ekle, sohbeti başlat"}</span><button type="button" className={`icon-button mic-button ${micActive ? "recording" : ""}`} onClick={() => { if (micActive) stopListening(); else { tutorActions.setInteractionMode("hybrid"); void startListening(); } }} aria-label={micActive ? "Mikrofonu kapat" : "Sesli soru sor"}><Mic size={18}/></button>{busy || tutorState === "speaking" ? <button type="button" className="send-button" onClick={() => tutorService.interrupt()} aria-label="Yanıtı durdur"><Square size={15}/></button> : <button className="send-button" disabled={!query.trim() || !book} aria-label="Soruyu gönder"><ArrowRight size={20}/></button>}</div></form><div className="composer-hint"><ShieldCheck size={12}/> Yanıtları kaynaklarıyla birlikte değerlendir.<button onClick={() => { const next = mode === "text" ? "hybrid" : "text"; if (mode !== "text") stopListening(); tutorActions.setInteractionMode(next); audioService.setVoiceConfig({ autoSpeak: next !== "text" }); }}><AudioLines size={12}/>{mode === "text" ? "Sesli yanıt kapalı" : "Sesli yanıt açık"}</button></div>
          </section>
          <aside className="context-column"><section className="sources-card"><div className="section-title"><h3>Çalışma kaynakların</h3><span>{books.length.toString().padStart(2, "0")}</span></div>{book ? <><button className="active-source" onClick={() => setView("library")}><span className="document-icon"><FileText size={21}/></span><div><strong>{book.title}</strong><small>{book.pageCount} sayfa · {book.chunkCount} pasaj</small></div><Check size={15}/></button>{book.pdfUrl ? <a className="source-open" href={book.pdfUrl} target="_blank" rel="noreferrer">Belgeyi görüntüle<ArrowUpRight size={14}/></a> : <p className="missing-pdf">Arama kaydı mevcut, orijinal PDF bulunamadı. Sayfaları açmak için belgeyi yeniden yükle.</p>}</> : <div className="source-empty"><div className="document-stack"><FileText size={25}/></div><strong>Bilgiyle doldur.</strong><p>PDF belgelerini ekle ve<br/>öğrenmeye ilk adımı at.</p></div>}<button className="upload-dropzone" disabled={uploading} onClick={() => input.current?.click()}><Upload size={18}/><span>{uploading ? "Belgen hazırlanıyor…" : "PDF dosyanı buraya bırak"}</span><small>veya dosya seç · en fazla 300 MB</small></button></section>
          {citation ? <section className="citation-card"><span className="eyebrow"><FileText size={13}/> YANITIN KAYNAĞI</span><h3>{citation.chapterTitle || "İlgili kaynak pasaj"}</h3><p>{citation.excerpt}</p>{citation.pdfUrl ? <a href={citation.pdfUrl} target="_blank" rel="noreferrer">Sayfa {citation.pageNumber}<ArrowUpRight size={15}/></a> : <p className="missing-pdf">Sayfa {citation.pageNumber} · Orijinal PDF bulunamadı.</p>}</section> : <section className="how-card"><span className="eyebrow">KÜÇÜK ADIMLAR, BÜYÜK FİKİRLER</span><h3>Öğrenmenin yeni yolu.</h3>{[["01", "Kaynağını ekle", "PDF’lerini tek yerde topla."], ["02", "Merak ettiğini sor", "Yazarak veya konuşarak keşfet."], ["03", "Bağlantıları kur", "Kaynaklarıyla birlikte anla."]].map(([n, title, detail]) => <div className="how-step" key={n}><span>{n}</span><div><strong>{title}</strong><p>{detail}</p></div></div>)}</section>}
          </aside></div>
        </> : <section className="library-section"><div className="library-toolbar"><div><h2>Belge kütüphanen <span>{books.length}</span></h2><p>Bir belge seç ve kaldığın yerden keşfetmeye devam et.</p></div><label className="library-search"><Search size={17}/><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Belgelerde ara…" aria-label="Belgelerde ara"/></label></div><div className="book-grid">{filtered.map((b, i) => <button className="book-card" key={b.id} onClick={() => selectBook(b.id)}><div className={`book-cover cover-${i % 3}`}><span>RAGTEACH / KÜTÜPHANE</span><BookOpen size={39} strokeWidth={1}/><h3>{b.title}</h3><span>PDF DOCUMENT <ArrowUpRight size={16}/></span></div><div className="book-card-info"><strong>{b.title}</strong><p>{b.pageCount} sayfa <span>·</span> {b.chunkCount} pasaj</p><span className="book-ready"><Check size={12}/> {b.indexed ? "Çalışmaya hazır" : "Yeniden yükleme gerekli"}</span></div></button>)}<button className="library-add" onClick={() => input.current?.click()} disabled={uploading}><Plus size={28}/><strong>Yeni bir keşif ekle</strong><span>PDF yüklemek için tıkla</span></button></div>{filter && !filtered.length && <p className="no-results">Bu aramayla eşleşen belge bulunamadı.</p>}</section>}
        <footer className="studio-footer"><span>MERAK ET. KEŞFET. ÖĞREN.</span><span>RagTeach <span className="accent">✳</span> Bilgiyi sana yakınlaştırır.</span></footer>
      </main>
    </div>
    {settingsOpen && <Preferences onClose={() => setSettingsOpen(false)}/>}
  </div>;
}
