import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, model, baseUrl: customUrl } = await req.json();

    if (provider === "ollama") {
      try {
        let res: Response | null = null;
        try {
          res = await fetch("http://127.0.0.1:11434/api/tags", {
            signal: AbortSignal.timeout(4000),
          });
        } catch {
          res = await fetch("http://localhost:11434/api/tags", {
            signal: AbortSignal.timeout(4000),
          });
        }

        if (res.ok) {
          const json = await res.json();
          const names: string[] = (json.models || []).map((m: { name: string }) => m.name);
          const models = names.join(", ");
          if (model && !names.some(name => name === model || name === `${model}:latest`)) {
            return NextResponse.json({ success: false, message: `Ollama bağlı, ancak seçilen ${model} modeli yüklü değil. Mevcut modeller: ${models || "yok"}` });
          }
          return NextResponse.json({
            success: true,
            message: `Ollama yerel servisi aktif! Mevcut modeller: ${models || "model listesi boş"}`,
          });
        }
        return NextResponse.json({
          success: false,
          message: `Ollama HTTP ${res.status} yanıtı verdi.`,
        });
      } catch {
        return NextResponse.json({
          success: false,
          message:
            "Ollama (127.0.0.1:11434) servisine bağlanılamadı. Lütfen Ollama uygulamasının açık olduğundan emin olun.",
        });
      }
    }

    if (!apiKey && provider !== "custom") {
      return NextResponse.json({
        success: false,
        message: "Lütfen bir API anahtarı girin.",
      });
    }

    // ElevenLabs API Key Test
    if (provider === "elevenlabs") {
      try {
        const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, "");
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          headers: {
            "xi-api-key": cleanKey,
          },
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          const tier = data.subscription?.tier || "Standart";
          const count = data.subscription?.character_count ?? 0;
          const limit = data.subscription?.character_limit ?? 0;
          return NextResponse.json({
            success: true,
            message: `ElevenLabs API anahtarı doğrulandı! Paket: ${tier} (Kullanım: ${count.toLocaleString()} / ${limit.toLocaleString()} karakter)`,
          });
        }
        const msg = data.detail?.message || data.message || `HTTP ${res.status}`;
        return NextResponse.json({
          success: false,
          message: `ElevenLabs Hatası: ${msg}`,
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: `ElevenLabs bağlantı hatası: ${e.message}`,
        });
      }
    }

    // Google Gemini Test with automatic modern model fallback
    if (provider === "gemini") {
      try {
        const candidateModels = [model || "gemini-3.6-flash"];
        let lastError = "";

        for (const m of candidateModels) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "ping" }] }],
                generationConfig: { maxOutputTokens: 2 },
              }),
              signal: AbortSignal.timeout(8000),
            });
            const data = await res.json();
            if (res.ok) {
              return NextResponse.json({
                success: true,
                message: `Google Gemini (${m}) API anahtarı doğrulandı ve aktif!`,
              });
            }

            lastError = data.error?.message || "Geçersiz API Anahtarı";
            if (
              lastError.toLowerCase().includes("api_key_invalid") ||
              lastError.toLowerCase().includes("api key not valid")
            ) {
              break;
            }
          } catch (e: any) {
            lastError = e.message;
          }
        }

        return NextResponse.json({
          success: false,
          message: `Gemini Hatası: ${lastError}`,
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: `Gemini bağlantı hatası: ${e.message}`,
        });
      }
    }

    // Anthropic Claude Test
    if (provider === "anthropic") {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model || "claude-3-5-haiku-20241022",
            max_tokens: 2,
            messages: [{ role: "user", content: "ping" }],
          }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: "Anthropic Claude API anahtarı doğrulandı ve aktif!",
          });
        }
        return NextResponse.json({
          success: false,
          message: `Claude Hatası: ${data.error?.message || "Geçersiz Anahtar"}`,
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: `Claude bağlantı hatası: ${e.message}`,
        });
      }
    }

    // OpenAI-compatible Providers: DeepSeek, OpenAI, Grok, Kimi, OpenRouter, Custom
    let baseUrl = "https://api.openai.com/v1";
    let testModel = "gpt-4o-mini";

    if (provider === "deepseek") {
      baseUrl = "https://api.deepseek.com";
      testModel = "deepseek-chat";
    } else if (provider === "grok") {
      baseUrl = "https://api.x.ai/v1";
      testModel = "grok-2-latest";
    } else if (provider === "kimi") {
      baseUrl = "https://api.moonshot.cn/v1";
      testModel = "moonshot-v1-8k";
    } else if (provider === "openrouter") {
      baseUrl = "https://openrouter.ai/api/v1";
      testModel = "meta-llama/llama-3.3-70b-instruct";
    } else if (provider === "custom" && customUrl) {
      baseUrl = customUrl;
      testModel = model || "default";
    }

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || testModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 2,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      if (res.ok) {
        return NextResponse.json({
          success: true,
          message: `${provider.toUpperCase()} API anahtarı başarıyla doğrulandı ve çalışıyor!`,
        });
      }

      // Check specific error message (e.g. Insufficient Balance)
      const rawError = data.error?.message || (data.error ? JSON.stringify(data.error) : `HTTP ${res.status}`);
      let userFriendlyMsg = `${provider.toUpperCase()} Yanıtı: ${rawError}`;

      if (rawError.toLowerCase().includes("insufficient balance")) {
        userFriendlyMsg = `DeepSeek API Anahtarı geçerli ANCAK hesap bakiyesi yetersiz (Insufficient Balance). Lütfen platform.deepseek.com adresinden bakiye yükleyin veya Google Gemini gibi ücretsiz modelleri kullanın.`;
      }

      return NextResponse.json({
        success: false,
        message: userFriendlyMsg,
      });
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        message: `${provider.toUpperCase()} bağlantı hatası: ${e.message}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: `Sunucu Hatası: ${err.message}`,
    });
  }
}

