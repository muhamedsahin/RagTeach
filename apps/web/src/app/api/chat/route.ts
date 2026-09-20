import { NextRequest, NextResponse } from "next/server";

interface ChatPayload {
  provider: string;
  model: string;
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  context?: string;
  baseUrl?: string;
  stream?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatPayload = await req.json();
    const { provider, model, apiKey, messages, context, baseUrl: customUrl } = body;

    if (!provider || !["ollama", "gemini", "openai", "deepseek", "grok", "kimi", "anthropic", "openrouter", "custom"].includes(provider) || !Array.isArray(messages) || !messages.length || messages.some(m => typeof m.content !== "string" || !["user", "assistant", "system"].includes(m.role))) {
      return NextResponse.json({ error: "Geçersiz sohbet isteği." }, { status: 400 });
    }
    if (provider === "custom" && !customUrl) return NextResponse.json({ error: "Özel sunucu adresini ayarlara ekleyin." }, { status: 400 });
    const systemPrompt = `Sen RagTeach sisteminde görev yapan dünya çapında elit bir üniversite profesörü ve yapay zeka öğretmenisin.
Öğrencinin sorduğu soruları sabırla, adım adım, akademik derinlikle ve pedagojik olarak anlaşılır biçimde açıkla.
Eğer [Grounded Textbook Context] (Ders Kitabı Bağlamı) verilmişse, açıklamalarını kesinlikle bu kitaba dayandır ve ilgili yerlerde sayfa veya bölüm numaralarını (örneğin "[Bölüm 2, Sayfa 45]") belirterek kaynak göster.
Öğrenci Türkçe konuştuğunda mutlaka akıcı, doğal ve zengin bir Türkçe ile yanıt ver. Öğrencinin konuştuğu dili her zaman koru.`;

    const formattedMessages = [...messages];
    if (formattedMessages.length > 0 && context) {
      const lastMsg = formattedMessages[formattedMessages.length - 1];
      if (lastMsg.role === "user") {
        lastMsg.content = `[Grounded Textbook Context]:\n${context}\n\n[Student Question]:\n${lastMsg.content}`;
      }
    }

    // 1. Local Ollama (IPv4 127.0.0.1 to avoid Windows IPv6 localhost hang)
    if (provider === "ollama") {
      try {
        let ollamaRes: Response | null = null;
        try {
          ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: model || "qwen2.5:14b-instruct-q4_K_M",
              messages: [
                { role: "system", content: systemPrompt },
                ...formattedMessages,
              ],
              stream: false,
            }),
            signal: AbortSignal.any([req.signal, AbortSignal.timeout(180000)]),
          });
        } catch {
          // Fallback to localhost
          ollamaRes = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: model || "qwen2.5:14b-instruct-q4_K_M",
              messages: [
                { role: "system", content: systemPrompt },
                ...formattedMessages,
              ],
              stream: false,
            }),
            signal: AbortSignal.any([req.signal, AbortSignal.timeout(180000)]),
          });
        }

        if (!ollamaRes.ok) {
          const errText = await ollamaRes.text();
          if (ollamaRes.status === 404) {
            return NextResponse.json(
              {
                error: `Ollama Hatası (404): '${model}' modeli yerel makinenizde bulunamadı. Lütfen terminalden 'ollama pull ${model}' komutunu çalıştırın.`,
              },
              { status: 404 }
            );
          }
          return NextResponse.json(
            { error: `Ollama Hatası (${ollamaRes.status}): ${errText}` },
            { status: 500 }
          );
        }

        const ollamaJson = await ollamaRes.json();
        const responseText = ollamaJson.message?.content || "";
        return NextResponse.json({ text: responseText, provider: "ollama" });
      } catch (err: any) {
        return NextResponse.json(
          {
            error:
              "Ollama servisine (127.0.0.1:11434) bağlanılamadı. Lütfen 'ollama run qwen2.5:14b-instruct-q4_K_M' veya 'ollama serve' komutunun çalıştığından emin olun.",
          },
          { status: 503 }
        );
      }
    }

    // 2. Online Providers require API key
    if (!apiKey && provider !== "custom") {
      return NextResponse.json(
        {
          error: `${provider.toUpperCase()} API anahtarı girilmedi. Lütfen Ayarlar > Modeller & API sekmesinden geçerli bir API Key girin.`,
        },
        { status: 400 }
      );
    }

    // 3. Google Gemini REST API with auto-fallback for deprecated model names
    if (provider === "gemini") {
      const primary = model || "gemini-3.6-flash";
      const candidateModels = [primary];
      let lastData: any = null;

      const contents = formattedMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

      for (const geminiModel of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents,
            }),
            signal: AbortSignal.any([req.signal, AbortSignal.timeout(120000)]),
          });

          lastData = await res.json();
          if (res.ok) {
            const text = lastData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            return NextResponse.json({ text, provider: "gemini", model: geminiModel });
          }

          const errMsg = lastData.error?.message || "";
          // If model is deprecated or not available, try next candidate
          if (
            errMsg.includes("no longer available") ||
            errMsg.includes("not found") ||
            errMsg.includes("deprecated")
          ) {
            continue;
          }
          break;
        } catch {
          continue;
        }
      }

      return NextResponse.json(
        { error: `Google Gemini Hatası: ${lastData?.error?.message || "Model yanıt vermedi"}` },
        { status: 500 }
      );
    }

    // 4. Anthropic Claude
    if (provider === "anthropic") {
      const claudeModel = model || "claude-3-5-sonnet-20241022";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey || "",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 2048,
          system: systemPrompt,
          messages: formattedMessages.filter((m) => m.role !== "system"),
        }),
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(120000)]),
      });

      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: `Anthropic Claude Hatası: ${data.error?.message || JSON.stringify(data)}` },
          { status: res.status }
        );
      }

      const text = data.content?.[0]?.text || "";
      return NextResponse.json({ text, provider: "anthropic" });
    }

    // 5. OpenAI-compatible Providers (DeepSeek, OpenAI, Grok, Kimi, OpenRouter, Custom)
    let baseUrl = "https://api.openai.com/v1";
    let targetModel = model || "gpt-4o";

    if (provider === "deepseek") {
      baseUrl = "https://api.deepseek.com";
      targetModel = model || "deepseek-chat";
    } else if (provider === "grok") {
      baseUrl = "https://api.x.ai/v1";
      targetModel = model || "grok-2-latest";
    } else if (provider === "kimi") {
      baseUrl = "https://api.moonshot.cn/v1";
      targetModel = model || "moonshot-v1-32k";
    } else if (provider === "openrouter") {
      baseUrl = "https://openrouter.ai/api/v1";
      targetModel = model || "meta-llama/llama-3.3-70b-instruct";
    } else if (provider === "custom" && customUrl) {
      baseUrl = customUrl;
      targetModel = model || "default";
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "system", content: systemPrompt }, ...formattedMessages],
      }),
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(180000)]),
    });

    const data = await res.json();
    if (!res.ok) {
      const rawError = data.error?.message || (data.error ? JSON.stringify(data.error) : `HTTP ${res.status}`);
      let userFriendlyError = `${provider.toUpperCase()} Hatası: ${rawError}`;

      if (rawError.toLowerCase().includes("insufficient balance")) {
        userFriendlyError = `DeepSeek Hatası: Yetersiz Bakiye (Insufficient Balance). DeepSeek hesabınızda kredi bulunmuyor. Lütfen platform.deepseek.com adresinden bakiye yükleyin veya Ayarlar'dan Google Gemini gibi farklı bir model seçin.`;
      } else if (rawError.toLowerCase().includes("invalid api key") || rawError.toLowerCase().includes("authentication")) {
        userFriendlyError = `${provider.toUpperCase()} Hatası: Geçersiz API Anahtarı. Lütfen anahtarınızı kontrol edin.`;
      }

      return NextResponse.json({ error: userFriendlyError }, { status: res.status });
    }

    const text = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ text, provider });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Bağlantı Hatası: ${err.message || String(err)}` },
      { status: 500 }
    );
  }
}


