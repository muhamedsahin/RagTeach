# RagTeach 🎓🧠

**Hibrit (offline GPU / online API) sesli RAG öğretmen sistemi.**

RagTeach, yüklediğin PDF ders kitaplarını gerçek sayfa kaynaklarıyla indeksleyen ve sana
**sesli** ya da **yazılı** ders anlatan, sorularını yalnızca kendi belgelerine dayanarak
cevaplayan bir yapay zekâ öğretmen platformudur. Tamamen yerel (offline / GPU) çalışabildiği
gibi, istersen her kanalı (LLM, konuşma tanıma, seslendirme, embedding) ayrı ayrı bulut
sağlayıcılarına bağlayabilirsin.

> Kitabını yükle → öğretmene sor → kaynağını gör → dinle. Hepsi kendi bilgisayarında çalışır.

---

## ⚡ Hızlı Başlangıç (TL;DR)

**Windows (PowerShell):**

```powershell
npm install                                                # 1) ön yüz bağımlılıkları
cd apps/api
python -m venv .venv                                       # 2) arka uç sanal ortamı
.\.venv\Scripts\activate
pip install -r requirements.txt                            # 3) arka uç bağımlılıkları
ollama pull qwen2.5:14b-instruct-q4_K_M                    # 4) yerel LLM
ollama pull nomic-embed-text                               # 5) yerel embedding modeli
```

**macOS / Linux:** adımlar aynıdır, yalnızca etkinleştirme komutu `source .venv/bin/activate` olur.

Sonra iki terminal aç: `start-api.bat` (RAG API) ve `start-web.bat` (Web arayüzü) →
<http://localhost:3000> adresinden öğrenmeye başla.

Detaylı kurulum ve kullanım için aşağıdaki bölümlere göz atabilirsin.

---

## İçindekiler

- [Hızlı Başlangıç (TL;DR)](#-hızlı-başlangıç-tldr)
- [Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [Sistem Mimarisi](#-sistem-mimarisi)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Gereksinimler](#-gereksinimler)
- [Kurulum](#-kurulum)
- [Çalıştırma](#-çalıştırma)
- [Nasıl Kullanılır? (Adım Adım)](#-nasıl-kullanılır-adım-adım)
- [Ayarlar Rehberi (Offline / Online)](#-ayarlar-rehberi-offline--online)
- [Sağlayıcı (Provider) Tablosu](#-sağlayıcı-provider-tablosu)
- [API ve WebSocket Referansı](#-api-ve-websocket-referansı)
- [RAG Hattı Nasıl Çalışır?](#-rag-hattı-nasıl-çalışır)
- [Proje Yapısı](#-proje-yapısı)
- [Ortam Değişkenleri](#-ortam-değişkenleri)
- [Doğrulama ve Testler](#-doğrulama-ve-testler)
- [Sorun Giderme](#-sorun-giderme)
- [Gizlilik ve Veri Güvenliği](#-gizlilik-ve-veri-güvenliği)
- [Yol Haritası / Katkı](#-yol-haritası--katkı)
- [Geliştirici](#-geliştirici)
- [Lisans](#-lisans)

---

## ✨ Öne Çıkan Özellikler

| Özellik | Açıklama |
| --- | --- |
| 📄 **PDF yükleme** | Tek dosya için en fazla **300 MB** PDF. PyMuPDF ile sayfa sayfa metin ve içindekiler tablosu (TOC) çıkarımı. |
| 🧩 **Parent-Child chunking** | Küçük "child" parçalar arama için, büyük "parent" parçalar LLM bağlamı için kullanılır → daha isabetli sonuç, daha zengin cevap. |
| 🔍 **Hibrit arama** | BM25 (Türkçe kök bulma destekli) + yoğun vektör araması + **RRF** füzyonu + **FlashRank** yeniden sıralama + **MMR** çeşitlilik filtresi. |
| 📚 **Gerçek kaynak gösterimi** | Her cevap için bölüm başlığı, kısım, **sayfa numarası** ve alaka skoru gösterilir; tıklayınca PDF görüntüleyicide açılır. |
| 🎙️ **Sesli ders** | Sorunu mikrofonla sor (STT), öğretmen sesli anlatsın (TTS). Offline: `faster-whisper` + Kokoro/Piper. Online: Deepgram/OpenAI/Edge-TTS/ElevenLabs. |
| ✋ **Lafı bölme (barge-in)** | Öğretmen konuşurken sözünü kesebilir, duraklatabilir, durdurabilir ve "devam et" diyebilirsin. |
| 🔀 **Kanal bağımsız offline/online** | LLM, STT, TTS ve embedding kanallarının her birini ayrı ayrı `offline` ya da `online` seçebilirsin. |
| 🔐 **Şifreli API anahtarları** | Anahtarlar ref adı ile kaydedilir ve **Fernet** ile şifrelenerek yerel `data/settings/keys.json` dosyasında saklanır. |
| 🗂️ **Belge kütüphanesi** | Aranabilir kütüphane, kapak görünümü, belge özeti ve otomatik çalışma soruları. |
| 🎮 **3D öğrenme stüdyosu** | Three.js / React Three Fiber ile sese tepki veren bilgi küresi, kamera hareketi ve ambiyans efektleri. |
| 🧠 **VRAM dostu** | RTX 3070 (8 GB) hedefiyle: LLM bellekte tutulur; STT/TTS her kullanımdan sonra CUDA cache'ini boşaltır. |
| 🇹🇷 **Türkçe öncelikli** | Türkçe arayüz, Türkçe öğretmen personası, Türkçe kök bulma/durak kelime işleme ve `tr-TR` sesleri. |
| 🔄 **Geriye dönük uyumluluk** | Eski 384 boyutlu `chunks` tablosundaki belgeler yeniden yüklenmeden sözcük tabanlı aramayla kullanılabilir. |

---

## 🏗️ Sistem Mimarisi

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        TARAYICI (Kullanıcı)                          │
│   3D Stüdyo · Ders Metni · Kaynak İnceleyici · PDF Görüntüleyici     │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │ HTTP (REST)                      │ WebSocket
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Next.js 15 Web Uygulaması (:3000)                   │
│  · Sayfa & bileşenler  · /api/* proxy rotaları  · lib/api.ts istemci │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │                                  │
                ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 FastAPI RAG Backend (:8000, /docs)                   │
│  Router'lar : /api/*  ·  /ws/session                                 │
│  Servisler  : SessionOrchestrator (akış, niyet, kesme, TTS bölme)    │
│  Sağlayıcı  : ProviderRouter (LLM · STT · TTS · Embedding)           │
│  RAG        : PyMuPDF → SemanticChunker → Embedder → HybridSearch    │
└───┬───────────────┬────────────────┬─────────────────┬───────────────┘
    │               │                │                 │
    ▼               ▼                ▼                 ▼
┌────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────────────┐
│ Ollama │   │  LanceDB   │   │ faster-     │   │  Online API'ler  │
│ (LLM + │   │ child +    │   │ whisper /   │   │ OpenAI, Gemini,  │
│ embed) │   │ parent     │   │ Kokoro /    │   │ Anthropic, Grok, │
│        │   │ tabloları  │   │ Piper /     │   │ Groq, Deepgram,  │
│        │   │            │   │ Edge-TTS    │   │ ElevenLabs ...   │
└────────┘   └────────────┘   └─────────────┘   └──────────────────┘
  yerel GPU/CPU             yerel GPU                 bulut
```

**Bir soru sorulduğunda veri akışı:**

```text
Soru (yazılı veya sesli)
  → (sesli ise) STT ile Türkçe metne çevrilir
  → Niyet sınıflandırma (soru / duraklat / dur / devam / tekrar)
  → Hibrit arama: BM25 + Vektör + RRF + Yeniden sıralama + MMR
  → Parent chunk genişletme (daha geniş bağlam)
  → LLM'e kaynak etiketli bağlam gönderilir
  → Token token akış (WebSocket) → cümle cümle TTS ile seslendirme
```

---

## 🧰 Teknoloji Yığını

**Ön yüz (`apps/web`)**

- Next.js 15 (App Router) + React 19 + TypeScript 5
- Tailwind CSS 4 + PostCSS + Autoprefixer
- Three.js / `@react-three/fiber` / `@react-three/drei` (3D stüdyo)
- Framer Motion (animasyonlar), Lucide React (ikonlar)
- `pdfjs-dist` (tarayıcı içi PDF sayfa görüntüleme)

**Arka uç (`apps/api`)**

- FastAPI + Uvicorn + Pydantic v2 / pydantic-settings
- PyMuPDF (`fitz`) — PDF metin ve içindekiler (TOC) çıkarımı
- LanceDB + PyArrow — vektör ve parça depolama
- `rank-bm25` + `snowballstemmer` — sözcük tabanlı arama ve Türkçe kök bulma
- `flashrank` — cross-encoder yeniden sıralama (isteğe bağlı, varsayılan kapalı)
- `faster-whisper` + `torch` — yerel konuşma tanıma
- `edge-tts` (ücretsiz online TTS) / Kokoro / Piper (yerel TTS)
- `cryptography` (Fernet) — API anahtarı şifreleme
- OpenAI / Google Gemini / Anthropic SDK'ları — isteğe bağlı bulut kanalları

**Çalışma zamanı / altyapı**

- Ollama — yerel LLM ve embedding sunucusu
- Anaconda Python 3.11 sanal ortamı (`.venv`)
- npm workspaces (monorepo: `apps/web`, `packages/shared`)

---

## 📋 Gereksinimler

### Zorunlu

| Bileşen | Sürüm / Not |
| --- | --- |
| **Node.js** | 20 veya üzeri (npm dahil) |
| **Python** | 3.11 veya üzeri (Anaconda önerilir) |
| **Ollama** | [ollama.com](https://ollama.com) — yerel LLM + embedding için |
| **Disk alanı** | Modeller için ~15 GB, `data/` klasörü için ek alan |

### Önerilen

| Bileşen | Neden? |
| --- | --- |
| **NVIDIA GPU (RTX 3070 / 8 GB)** | `faster-whisper` ve yerel LLM hızı için. CPU'da da çalışır, ama yavaştır. |
| **CUDA + güncel GPU sürücüsü** | `torch` ve `faster-whisper` GPU hızlandırması için. |
| **16 GB+ RAM** | Büyük PDF'lerin indekslenmesi sırasında rahatlık sağlar. |
| **FFmpeg (opsiyonel)** | Bazı ses formatlarının dönüştürülmesi için faydalıdır. |

> 💡 **GPU'suz kullanım:** Sistem tamamen çalışır. `Ollama` CPU modunda daha yavaş yanıt verir,
> `faster-whisper` CPU'ya düşer. Bu durumda online kanalları (LLM/STT) kullanmak daha akıcı
> bir deneyim verir.

---

## 🛠️ Kurulum

Bu bölümdeki tüm komutlar reponun kök klasöründe (`RagTeach/`) çalıştırılır.

### 1) Depoyu indir

```bash
git clone https://github.com/muhamedsahin/bus.git
cd bus
```

### 2) Ön yüz bağımlılıklarını kur

```bash
npm install
```

> npm workspaces kullanıldığı için tek komut `apps/web` ve `packages/shared` paketlerini kurar.

### 3) Arka uç (Python) sanal ortamı

**Windows (Anaconda ile — önerilen):**

```powershell
cd apps/api
C:\ProgramData\anaconda3\python.exe -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

**Windows (standart Python ile):**

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

**macOS / Linux:**

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> `torch` ve `faster-whisper` indirmesi uzun sürebilir. GPU kullanacaksan CUDA uyumlu `torch`
> kurulumu için <https://pytorch.org/get-started/locally/> adresindeki komutu kullanabilirsin.

### 4) Ollama'yı kur ve modelleri indir

```bash
# Ollama'yı kurduktan sonra (servis otomatik ayakta olur: http://127.0.0.1:11434)
ollama pull qwen2.5:14b-instruct-q4_K_M   # yerel LLM (~9 GB)
ollama pull nomic-embed-text              # yerel embedding modeli (~275 MB)
```

Kontrol:

```bash
ollama list
```

> Daha hafif bir yerel model istersen `qwen2.5:7b` veya `llama3.1:8b` indirip Ayarlar
> panelinden model adını değiştirebilirsin.

### 5) İsteğe bağlı: doğal offline TTS (Kokoro)

```bash
pip install kokoro misaki soundfile
```

Kurulmazsa sistem otomatik olarak **Edge-TTS**'e (online, ücretsiz) düşer; hiçbir ek ayar
gerekmez. Ayrıntı: `apps/api/requirements-optional.txt`.

### 6) Ortam dosyası (isteğe bağlı)

`apps/web/.env.local` dosyası varsayılan olarak şu adresleri kullanır:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws/session
```

API'yi farklı bir port/adreste çalıştıracaksan bu iki satırı güncelle.

---

## ▶️ Çalıştırma

İki servis birlikte çalışır: **RAG API (8000)** ve **Web arayüzü (3000)**.

### Kolay yol (Windows — hazır `.bat` dosyaları)

1. `start-api.bat` → sanal ortamı hazırlar (yoksa kurar) ve API'yi 8000 portunda başlatır.
2. `start-web.bat` → Next.js geliştirme sunucusunu başlatır.
3. Tarayıcıda aç: **<http://localhost:3000>**

### Manuel yol (tüm işletim sistemleri)

**Terminal 1 — API:**

```bash
cd apps/api
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Web:**

```bash
npm run dev:web
```

### Faydalı npm betikleri

| Komut | Ne yapar? |
| --- | --- |
| `npm run dev:web` | Next.js geliştirme sunucusu (3000) |
| `npm run dev:api` | Uvicorn ile API'yi `.venv` üzerinden çalıştırır (8000) |
| `npm run build:web` | Üretim derlemesi (tip kontrolü + Next build) |
| `npm install:api` | `apps/api` bağımlılıklarını `.venv` içine kurar |

### Çalıştığını doğrula

| Adres | Beklenen sonuç |
| --- | --- |
| <http://127.0.0.1:8000/api/health> | `{"ok": true, "app": "RagTeach"}` |
| <http://127.0.0.1:8000/docs> | Swagger UI (tüm uç noktalar) |
| <http://127.0.0.1:11434> | Ollama ayakta (404 dönse de servis çalışıyor demektir) |
| <http://localhost:3000> | RagTeach öğrenme stüdyosu |

> 🔎 Arayüzde API'ye ulaşılamazsa "Belge servisine ulaşılamıyor" uyarısı görünür. Bu durumda
> önce API terminalini kontrol et ve 8000 portunun boş olduğundan emin ol.

---

## 🚀 Nasıl Kullanılır? (Adım Adım)

### 1. Belge (PDF) yükle

1. Tarayıcıda <http://localhost:3000> adresini aç.
2. Sağ taraftaki **"Çalışma kaynakların"** kartından **"PDF dosyanı buraya bırak"** alanına tıkla
   (ya da dosyayı sürükle-bırak).
3. Tek dosya sınırı **300 MB**'tır; yalnızca `.pdf` kabul edilir. Boş veya bozuk PDF reddedilir.
4. Yükleme sırasında **"Belgen hazırlanıyor…"** durumu görünür. Bu adımda:

   - PDF sayfa sayfa okunur, içindekiler (TOC) başlıkları çıkarılır,
   - metin `child` (≈300 kelime/karakter, 50 örtüşme) ve `parent` (≈1200, 100 örtüşme) parçalara bölünür,
   - her parça için embedding üretilip **LanceDB**'ye (`data/lancedb/`) yazılır,
   - BM25 indeksi bellekte kurulur.

5. İşlem bitince belge, kütüphaneye **sayfa sayısı** ve **pasaj sayısı** ile eklenir.

> 📄 **Taranmış (görüntü) PDF'ler:** Metin katmanı olmayan PDF'lerden içerik çıkmaz. Bu dosyaları
> önce bir OCR aracıyla metne dönüştürüp yüklemelisin.

### 2. Kütüphaneden belge seç

- Üstteki **Belge kütüphanen** bölümünde aranan metinle **canlı arama** yapabilirsin (`Belgelerde ara…`).
- Kart üzerinde belge "**Çalışmaya hazır**" ise arama yapılabilir. "Yeniden yükleme gerekli"
  yazıyorsa (örn. orijinal PDF diskten silinmiş) belgeyi tekrar yükleyerek sayfaları açabilirsin.
- **Yeni bir keşif ekle** kartı ile hızlıca yeni PDF yükleyebilirsin.

### 3. Sorunu sor (yazılı veya sesli)

- Alt kısımdaki soru alanına yazıp gönder; ya da **mikrofon** düğmesiyle sorunu sesli sor.
- Sesli soru için **tarayıcı konuşma tanıma** izni verilmelidir (`Chrome`/`Edge` önerilir).
- Öğretmen cevabı **token token** akar. Cevap yalnızca yüklediğin belgelerdeki pasajlara dayanır;
  kitapta yoksa uydurmaz.
- Cevap altında **kaynak atıfları** listelenir: bölüm başlığı, kısım, **sayfa numarası** ve alaka skoru.
- Kaynağa tıkladığında **PDF görüntüleyici** ilgili sayfada açılır (`data/pdfs/` içindeki orijinal dosya).

### 4. Sesli dersi yönet

| Kontrol | Ne yapar? |
| --- | --- |
| 🔊 **Sesli yanıt açık/kapalı** | Öğretmenin cevabını TTS ile seslendirir. Kapalıyken sadece yazı akar. |
| ✋ **Kes (interrupt)** | Öğretmen konuşurken anında susar, senin sorunu dinlemeye geçer (barge-in). |
| ⏸️ **Duraklat** | Anlatımı duraklatır, durumu `paused` olur. |
| ⏹️ **Dur** | Oturumu durdurur. |
| ▶️ **Devam et** | Duraklatılan anlatıma kaldığı yerden devam eder. |
| 🔁 **Tekrar et** | Son anlatılan kısmı yeniden anlatır. |

Bu komutları klavyeden yazabileceğin gibi (örn. "dur", "devam et", "tekrar et") mikrofonla da
söyleyebilirsin; sistem niyeti otomatik sınıflandırır.

### 5. Çalışma araçlarından faydalan

- **Belge özeti:** Seçili kitabın genel özetini üretir.
- **Çalışma soruları:** Belgeden anlamayı ölçen sorular çıkarır.
- **Kaynak inceleyici:** Cevabın dayandığı pasajları ve sayfaları ayrıntılı gösterir.
- **Konu seçimi:** `GET /api/courses/{course_id}/topics` ile belgeden çıkarılan konu listesi
  anlatım başlangıcı olarak kullanılabilir.

### 6. Verimli kullanım ipuçları

- 📌 Aynı anda tek bir ders kitabı üzerinde çalışmak (kütüphanede belge seçili) daha isabetli
  cevaplar üretir; birden fazla belge varken soruyu belge adıyla birlikte sor.
- 📌 Soruları somut tut: "3. bölümdeki enzim aktivitesini özetle" gibi ifadeler daha iyi kaynak bulur.
- 📌 Cevap yüzeysel geldiyse **Ayarlar → RAG kaynak sayısı (top_k)** değerini artır (önerilen: 6–10).
- 📌 Uzun PDF'lerde ilk yükleme birkaç dakika sürebilir. İndeksleme sırasında başka bir soru
  göndermek bekleme yaratabilir.
- 📌 GPU belleği yetmiyorsa online LLM kanalına geç ve
  **"Online LLM kullanırken yerel Ollama VRAM boşalt"** seçeneğini işaretli bırak.

---

## ⚙️ Ayarlar Rehberi (Offline / Online)

Arayüzdeki **Ayarlar** (dişli ikonu) panelinden tüm kanallar yönetilir. Her kanal bağımsızdır:
örn. LLM'i online, STT'yi offline yapabilirsin.

| Kanal | Amaç | Offline seçenekler | Online seçenekler |
| --- | --- | --- | --- |
| **LLM** | Ders anlatımı ve cevap üretimi | `ollama` (`qwen2.5:14b-instruct-q4_K_M`, `llama3.1:8b`, ...) | `openai`, `gemini`, `anthropic`, `xai/grok`, `openrouter`, `groq`, `deepseek`, `kimi/moonshot` |
| **STT** | Konuşmayı metne çevirme | `faster-whisper` (`small`, `medium`, `large-v3`) | `openai` (`whisper-1`), `deepgram` (`nova-2`) |
| **TTS** | Metni sese çevirme | `kokoro`, `piper` (`tr_TR-dfki-medium`) | `edge-tts` (`tr-TR-EmelNeural`, `tr-TR-AhmetNeural`), `openai` (`nova`, `alloy`, `shimmer`), `elevenlabs` |
| **Embedding** | Belge parçalarını vektöre çevirme | `ollama` (`nomic-embed-text`, 768 boyut) | — (yerel indeks bütünlüğü için offline tutulur) |

### API anahtarı kaydetme

1. Ayarlar → **API Key Kaydet** bölümüne git.
2. **Ref adı** seç (örn. `openai`, `gemini`, `anthropic`, `xai`, `openrouter`, `groq`, `deepgram`, `elevenlabs`).
3. Anahtarı gir ve **Key kaydet**'e bas.
4. İlgili kanalın **API key ref** alanına aynı ref adını yaz.

Anahtarlar **Fernet** ile şifrelenip `data/settings/keys.json` içinde tutulur; arayüz anahtarı
geri göstermez, yalnızca ref listesini gösterir. `data/settings/settings.json` ise kanal
ayarlarını saklar.

### Sağlayıcı seçimi ve otomatik yedekleme

- Her kanalda **Mode** (`offline` / `online`) ve **Provider** alanı vardır.
- `fallback_to_offline` açıkken (varsayılan) anahtar eksikse veya sağlayıcı hata verirse sistem
  otomatik olarak yerel Ollama / `faster-whisper` / Kokoro'ya döner. Bu sayede internet
  kesildiğinde ders akışı bozulmaz.
- **Edge-TTS ücretsizdir**, anahtar gerektirmez; offline TTS kurulu değilse online tarafta
  doğal bir yedek olarak çalışır.
- Online LLM seçildiğinde ilgili kaynak pasajları **o sağlayıcıya gönderilir** (bkz. Gizlilik).

---

## 📡 Sağlayıcı (Provider) Tablosu

`GET /api/providers` uç noktası arayüzün gördüğü katalogu döner:

| Kanal | Mod | Sağlayıcı | Örnek modeller / sesler |
| --- | --- | --- | --- |
| LLM | offline | `ollama` | `qwen2.5:14b-instruct-q4_K_M`, `llama3.1:8b` |
| LLM | online | `openai` | `gpt-4o`, `gpt-4o-mini` |
| LLM | online | `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro` |
| LLM | online | `anthropic` | `claude-3-5-sonnet-latest` |
| LLM | online | `xai` (grok) | `grok-2-latest` |
| LLM | online | `openrouter` | `openrouter/auto` |
| LLM | online | `groq` | `llama-3.3-70b-versatile` |
| STT | offline | `faster-whisper` | `medium`, `large-v3`, `small` |
| STT | online | `openai` | `whisper-1` |
| STT | online | `deepgram` | `nova-2` |
| TTS | offline | `kokoro` | `af_heart`, `am_adam` |
| TTS | offline | `piper` | `tr_TR-dfki-medium` |
| TTS | online | `edge-tts` | `tr-TR-EmelNeural`, `tr-TR-AhmetNeural` |
| TTS | online | `openai` | `nova`, `alloy`, `shimmer` |
| TTS | online | `elevenlabs` | ses kimliği (voice id) |
| Embedding | offline | `ollama` | `nomic-embed-text` (768 boyut) |

---

## 🔌 API ve WebSocket Referansı

Tüm REST uç noktaları `http://127.0.0.1:8000` üzerinde `/api` ön ekiyle yayınlanır.
Etkileşimli dokümantasyon: <http://127.0.0.1:8000/docs>

### REST uç noktaları

| Metot | Yol | Açıklama |
| --- | --- | --- |
| `GET` | `/api/health` | Servis sağlık kontrolü: `{"ok": true, "app": "RagTeach"}` |
| `GET` | `/api/settings` | Aktif kanal/persona/RAG ayarlarını döner |
| `PUT` | `/api/settings` | Ayarları kaydeder (LLM/STT/TTS/embedding, persona, RAG) |
| `GET` | `/api/settings/keys` | Kayıtlı API anahtarı **ref** adlarını listeler (anahtar değerlerini değil) |
| `POST` | `/api/settings/keys` | `{ "ref": "openai", "api_key": "sk-..." }` → anahtarı şifreleyip kaydeder |
| `DELETE` | `/api/settings/keys/{ref}` | Anahtarı siler (yoksa `404`) |
| `GET` | `/api/providers` | Kullanılabilir sağlayıcı/model/ses kataloğu |
| `GET` | `/api/courses` | Kütüphanedeki belgeler: id, başlık, dosya, sayfa/pasaj sayısı, konular |
| `GET` | `/api/courses/{course_id}/topics` | Belgeden çıkarılan konu başlıkları |
| `POST` | `/api/pdfs` | `multipart/form-data` ile PDF yükleme (`file`, opsiyonel `title`) → `CourseMeta` |
| `GET` | `/api/pdfs/{course_id}/file` | Orijinal PDF dosyasını akıtır (`application/pdf`) |
| `POST` | `/api/rag/search` | Belge içinde arama: `{ query, course_id?, top_k?, overview? }` → `hits[]` |
| `POST` | `/api/warmup` | Modelleri ısıtır ve durum döner (`llm: ready`, `stt/tts: lazy`) |
| `POST` | `/api/vram/release` | STT/TTS için ayrılan CUDA belleğini boşaltır |

**Örnek — arama isteği:**

```bash
curl -X POST http://127.0.0.1:8000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "hücre zarının görevleri", "course_id": "abc123", "top_k": 6}'
```

**Örnek — PDF yükleme:**

```bash
curl -X POST http://127.0.0.1:8000/api/pdfs \
  -F "file=@C:\kitaplar\biyoloji.pdf" \
  -F "title=Biyoloji 12"
```

### WebSocket oturumu — `/ws/session`

Bağlanınca sunucu `ready` olayı gönderir ve durum (`state`) olayları akmaya başlar.

**İstemciden gönderilebilen olaylar (`type`):**

| `type` | `payload` | Açıklama |
| --- | --- | --- |
| `start_lecture` | `{ topic, course_id }` | Belirtilen konuda ders anlatımını başlatır |
| `text_message` | `{ text }` | Yazılı soru/istek gönderir |
| `audio_chunk` | `{ data }` (base64) | Ses parçası gönderir (STT için biriktirilir) |
| `audio_end` | `{}` | Ses kaydını bitirir, transkripsiyon başlatır |
| `interrupt` | `{}` | Konuşmayı keser (barge-in) |
| `pause` / `stop` / `continue` | `{}` | Anlatımı duraklatır / durdurur / sürdürür |
| `warmup` | `{}` | Model ısıtma durumunu ister |
| `ping` | `{}` | Bağlantı canlılık kontrolü |

**Sunucudan gelen olaylar (`type`):**

| `type` | İçerik |
| --- | --- |
| `ready` | Oturum hazır mesajı |
| `state` | `idle`, `indexing`, `thinking`, `speaking`, `listening`, `paused`, `stopped` |
| `token` | LLM'den gelen token (canlı yazı akışı) |
| `message_done` | Tamamlanan asistan mesajı |
| `transcript` | Kullanıcı sesinin metne çevrilmiş hali + algılanan niyet |
| `audio` | TTS ses parçası (base64) + metni |
| `warmup_status` | Model ısıtma durumu |
| `error` | Hata mesajı |

**Minimal örnek (tarayıcı konsolu):**

```javascript
const ws = new WebSocket("ws://127.0.0.1:8000/ws/session");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({ type: "text_message", payload: { text: "Merhaba, konuyu özetler misin?" } }));
```

---

## 🧠 RAG Hattı Nasıl Çalışır?

### 1) Metin çıkarma (PyMuPDF)

Her sayfa düz metne çevrilir, içindekiler tablosu (TOC) varsa gerçek bölüm/kısım başlıkları
metinle eşleştirilir. Sayfa numaraları korunur; böylece cevaba "Sayfa 42" atfı eklenebilir.

### 2) Anlamsal parçalama (SemanticChunker)

- **Child parçalar:** ~300 birim, 50 örtüşme → arama indeksine yazılır.
- **Parent parçalar:** ~1200 birim, 100 örtüşme → LLM'e verilecek bağlamı taşır.
- Her parça şu üst verilerle zenginleştirilir: kitap başlığı, bölüm numarası/başlığı, kısım,
  sayfa numarası, parça tipi (teori / örnek / alıştırma / formül / tanım / özet) ve `parent_id`.

### 3) Gömme (Embedding)

Varsayılan olarak Ollama üzerinden `nomic-embed-text` kullanılır ve tüm vektörler **768 boyuta**
normalize edilir. Ollama'ya ulaşılamadığında deterministik (hash tabanlı) bir yedek gömme
üretilir; bu durumda arama kalitesi düşer ama sistem çalışmaya devam eder.

### 4) Depolama (LanceDB)

`data/lancedb/` altında iki tablo tutulur: `child_chunks` (aranan vektörler) ve `parent_chunks`
(bağlam). Bu klasörü silerek kütüphaneyi sıfırlayabilirsin (indeks yeniden oluşturulur).

### 5) Hibrit arama

```text
Sorgu
 ├─ BM25 (Türkçe kök bulma + durak kelimeler)      → sıralama A
 ├─ Yoğun vektör araması (LanceDB, ön filtreleme)  → sıralama B
 ├─ RRF (Reciprocal Rank Fusion, k=60)             → A ∪ B birleşimi
 ├─ FlashRank yeniden sıralama (ENABLE_RERANKING=true) → daha isabetli sıra
 └─ MMR (λ=0.7) çeşitlilik filtresi                → tekrarlayan parçalar elenir
```

Not: BM25 ve vektör sıralamaları **yalnızca aynı gömme modeliyle** üretilmişse karşılaştırılır.
Gömme modeli erişilemezse arama sözcük tabanlı moda düşer ve bu, semantik eş anlamlı aramayla
eşdeğer değildir. Yerel semantik arama için `nomic-embed-text` modelini yükle ve belgeyi
yeniden indeksle.

### 6) Bağlam oluşturma ve cevap üretimi

Seçilen child parçaların **parent** karşılıkları getirilir ve kaynak etiketiyle birlikte
(`[Kaynak 1: Bölüm: ... | Sayfa: 42 | Alaka: 0.83]`) LLM'e verilir. Öğretmen personası
Türkçe, sabırlı ve yapılandırılmış anlatım ile sayfa referansı vermeye teşvik edilir.
Yanıt token token akar; sesli modda cümle sonlarında TTS'e gönderilir.

### 7) VRAM stratejisi

- Ollama LLM bellekte tutulur (`keep`).
- `faster-whisper` ve Kokoro **geçici** kullanılır; her kullanımdan sonra CUDA cache boşaltılır.
- `POST /api/vram/release` ile elle de boşaltabilirsin.

---

## 📁 Proje Yapısı

```text
RagTeach/
├─ apps/
│  ├─ api/                        # FastAPI RAG backend
│  │  ├─ app/
│  │  │  ├─ main.py               # Uygulama girişi, CORS, router kayıtları
│  │  │  ├─ core/
│  │  │  │  ├─ config.py          # Ayarlar, veri klasörleri, Ollama adresi
│  │  │  │  ├─ models.py          # Pydantic modelleri (kanallar, persona, hit, kurs)
│  │  │  │  └─ settings_store.py  # settings.json + Fernet şifreli keys.json
│  │  │  ├─ routers/
│  │  │  │  ├─ api.py             # REST uç noktaları (settings, pdfs, rag/search, vram)
│  │  │  │  └─ ws.py              # /ws/session WebSocket oturumu
│  │  │  ├─ providers/
│  │  │  │  ├─ router.py          # Kanalları çözer, yedekleme mantığı
│  │  │  │  ├─ ollama_provider.py # Yerel LLM + embedding
│  │  │  │  ├─ cloud_llm.py       # Gemini, Anthropic
│  │  │  │  ├─ openai_compat.py   # OpenAI, OpenRouter, Groq, xAI, DeepSeek, Moonshot
│  │  │  │  ├─ stt.py             # faster-whisper, OpenAI, Deepgram
│  │  │  │  └─ tts.py             # Kokoro, Piper, Edge-TTS, OpenAI, ElevenLabs
│  │  │  ├─ rag/
│  │  │  │  ├─ service.py         # PDF içe alma, arama, bağlam kurma
│  │  │  │  ├─ chunker.py         # Parent-child parçalama, TOC başlıkları
│  │  │  │  ├─ embedder.py        # Çok sağlayıcılı gömme + 768 boyut normalizasyonu
│  │  │  │  ├─ hybrid_search.py   # BM25 + vektör + RRF + rerank + MMR
│  │  │  │  └─ turkish_nlp.py     # Türkçe normalizasyon, kök bulma
│  │  │  └─ services/
│  │  │     ├─ orchestrator.py    # Oturum akışı, niyet, kesme, TTS bölme
│  │  │     ├─ intent.py          # Niyet sınıflandırma
│  │  │     └─ vram.py            # GPU bellek ısıtma/boşaltma
│  │  ├─ tests/test_rag_pipeline.py  # 11 regresyon testi
│  │  └─ requirements.txt / requirements-optional.txt / run.bat
│  └─ web/                        # Next.js öğrenme stüdyosu
│     ├─ src/app/                 # Sayfa, layout, /api/* proxy rotaları
│     ├─ src/components/          # Stüdyo, kütüphane, PDF görüntüleyici, 3D sahne
│     ├─ src/lib/                 # API istemcisi, store, mikrofon/konsuş/soket hook'ları
│     └─ src/services/            # RAG, LLM, TTS ve tutor servisleri
├─ packages/shared/               # Paylaşılan TypeScript tipleri
├─ data/                          # Çalışma zamanı verisi (git'e girmez)
│  ├─ pdfs/                       # Yüklenen orijinal PDF'ler
│  ├─ lancedb/                    # child_chunks + parent_chunks tabloları
│  └─ settings/                   # settings.json, keys.json (şifreli), courses.json
├─ start-api.bat                  # Windows: API'yi başlatır
├─ start-web.bat                  # Windows: Web arayüzünü başlatır
├─ package.json                   # npm workspaces + betikler
└─ README.md / LICENSE
```

> 🧹 **Sıfırdan başlamak için:** API'yi kapat, `data/lancedb/` ve `data/pdfs/` içeriğini sil,
> `data/settings/courses.json` dosyasını boşalt (`[]`). Sonraki yüklemede indeks yeniden kurulur.

---

## 🔧 Ortam Değişkenleri

### Ön yüz — `apps/web/.env.local`

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | REST API adresi |
| `NEXT_PUBLIC_WS_URL` | `ws://127.0.0.1:8000/ws/session` | WebSocket oturum adresi |

### Arka uç — ortam / `app/core/config.py`

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `APP_NAME` | `RagTeach` | Uygulama adı |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama sunucu adresi |
| `DEFAULT_LLM_MODEL` | `qwen2.5:14b-instruct-q4_K_M` | Varsayılan yerel LLM |
| `DEFAULT_EMBED_MODEL` | `nomic-embed-text` | Varsayılan gömme modeli |
| `WHISPER_MODEL` | `medium` | Yerel konuşma tanıma modeli |
| `WHISPER_DEVICE` | `cuda` | `cuda` veya `cpu` |
| `ENABLE_RERANKING` | `false` | FlashRank yeniden sıralamayı açar (ilk sorguda model indirebilir) |
| `DATA_DIR` | `<repo>/data` | Veri klasörü |
| `SECRETS_PASSPHRASE` | `ragteach-local-dev-change-me` | API anahtarlarını şifreleyen parola |

> 🔐 **Önemli:** `SECRETS_PASSPHRASE` değerini değiştirirsen daha önce kaydedilmiş API
> anahtarları çözülemez; anahtarları yeniden kaydetmen gerekir.

---

## ✅ Doğrulama ve Testler

Çalıştırmadan önce değişikliklerini iki komutla doğrulayabilirsin:

```powershell
# 1) Ön yüz tip kontrolü + üretim derlemesi
npm run build:web

# 2) Arka uç regresyon testleri (11 test)
cd apps/api
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Regresyon testi kapsamı:

- PDF yükleme, başlık aktarımı ve gerçek üst veri (sayfa/bölüm) çıkarımı
- Offline arama ve parent/pasaj kaynak atıfları
- Sunucu yeniden başladıktan sonra vektörlerin ve aramanın geri yüklenmesi
- Vektör kolonunun aranabilir olması
- Alakasız sorularda uydurma kaynak üretilmemesi
- Eksik belge ve geçersiz sorgu hataları
- Boş/geçersiz PDF'in yayımlanmaması
- Genel bakış (`overview`) modunda gerçek sayfa örneklemesi
- Eski 384 boyutlu kütüphanenin aranabilir kalması
- Orijinal PDF'in açılabilmesi
- Gömme modeli değiştiğinde sözcük tabanlı moda düşülmesi

> 🧪 Testler geçici bir veritabanı klasöründe çalışır; mevcut kütüphanene dokunmaz.

---

## 🩺 Sorun Giderme

| Belirti | Olası neden | Çözüm |
| --- | --- | --- |
| "Belge servisine ulaşılamıyor" uyarısı | API çalışmıyor veya port farklı | `start-api.bat` ile API'yi başlat; `http://127.0.0.1:8000/api/health` kontrol et |
| `ollama` bağlantı hatası | Ollama servisi kapalı | Ollama uygulamasını başlat; `ollama list` çalıştığını doğrula |
| Yerel model indirilemedi | Model adı yanlış | `ollama pull qwen2.5:14b-instruct-q4_K_M` komutunu tekrar çalıştır |
| Cevaplar genel/alakasız | Gömme modeli eksik veya indeks eski | `nomic-embed-text` indir, belgeyi yeniden yükle |
| Cevap gelmiyor ama kaynak var | LLM yavaş (CPU) | Online LLM kanalına geç veya daha küçük bir yerel model seç |
| Sesli soru algılanmıyor | Mikrofon izni yok | Tarayıcıda mikrofon iznini ver, Chrome/Edge kullan |
| Seslendirme yok | TTS sağlayıcısı kurulu değil | TTS'i `edge-tts` yap (ücretsiz) veya Kokoro'yu kur |
| `CUDA out of memory` | VRAM doldu | Model boyutunu küçült, `POST /api/vram/release` çağır, "VRAM boşalt" seçeneğini aç |
| İlk sorguda uzun bekleme | FlashRank modeli indiriliyor | `ENABLE_RERANKING=false` bırak veya ilk indirmeyi bekle |
| Taranmış PDF'den içerik gelmiyor | Metin katmanı yok | PDF'i OCR'dan geçirip yeniden yükle |
| Sayfalar açılmıyor, "Yeniden yükleme gerekli" | Orijinal PDF diskten silinmiş | Belgeyi yeniden yükle (metin indeksi korunur) |
| Port 3000/8000 meşgul | Başka uygulama kullanıyor | İşlemi kapat veya farklı port + `.env.local` güncelle |

---

## 🔐 Gizlilik ve Veri Güvenliği

- **Offline mod:** Hiçbir veri bilgisayarından çıkmaz. LLM, embedding, STT, TTS hepsi yerel çalışır.
- **Online mod:** Yalnızca seçtiğin sağlayıcıya gerekli veri gider:
  - LLM online iken **sorun ve ilgili kaynak pasajlar** sağlayıcıya iletilir.
  - STT online iken **ses kaydın** sağlayıcıya iletilir.
  - TTS online iken **seslendirilecek metin** sağlayıcıya iletilir.
- API anahtarları düz metin olarak saklanmaz; `Fernet` anahtarı ile şifrelenir.
- `data/settings/keys.json`, `data/settings/settings.json`, `data/pdfs/*` ve `data/lancedb/*`
  `.gitignore` ile hariç tutulur; yanlışlıkla commit edilmez.
- Bu projeyi herkese açık bir sunucuda yayına almadan önce `SECRETS_PASSPHRASE` değerini
  değiştir ve CORS listesini kendi alan adınla sınırla (`app/core/config.py`).

---

## 🗺️ Yol Haritası / Katkı

Planlanan geliştirmeler:

- [ ] OCR entegrasyonu ile taranmış PDF desteği
- [ ] Belge koleksiyonları ve ders/program bazlı gruplama
- [ ] Anki/PDF çıktı olarak çalışma kartları
- [ ] Çok dilli içerik desteği (İngilizce ders kitapları)
- [ ] Sınav modu ve otomatik değerlendirme

Katkı sağlamak istersen:

1. Depoyu fork'la ve yeni bir dal aç (`feature/yeni-ozellik`).
2. Kod biçimini ve mevcut yapıyı koru.
3. Değişikliğini `npm run build:web` ve `python -m unittest discover -s tests -v` ile doğrula.
4. Açıklayıcı bir pull request gönder.

---

## 👨‍💻 Geliştirici

Bu proje **Bursa Teknik Üniversitesi Bilgisayar Mühendisliği 1. Sınıf Öğrencisi
Muhammed Fatih Şahin** tarafından yapay zeka destekli olarak geliştirilmiştir.

Geri bildirim, hata bildirimi ve öneriler için GitHub üzerinden issue açabilirsin.

---

## 📄 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. **İsteyen herkes** projeyi özgürce kullanabilir,
kopyalayabilir, değiştirebilir, birleştirebilir, yayınlayabilir, dağıtabilir, alt lisanslayabilir
ve/veya satabilir — tek koşul telif hakkı bildirimini ve lisans metnini korumaktır.

Ayrıntılar için [`LICENSE`](./LICENSE) dosyasına bakın.

```text
MIT License

Copyright (c) 2026 Muhammed Fatih Şahin (RagTeach)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software ... (tam metin LICENSE dosyasındadır)
```

> ⚠️ Yazılım "olduğu gibi" sunulur; eğitim amaçlı bir projedir ve ders içeriklerinin
> doğruluğundan yalnızca kaynak belgeler sorumludur.

---

<div align="center">

**RagTeach** — *Merak et. Keşfet. Öğren.*

Bursa Teknik Üniversitesi · Bilgisayar Mühendisliği

</div>

#   R a g T e a c h  
 