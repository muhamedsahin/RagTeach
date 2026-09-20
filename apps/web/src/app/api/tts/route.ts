import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, provider, voice, apiKey, endpoint, model } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Metin boş olamaz." }, { status: 400 });
    }

    // 1. ElevenLabs TTS
    if (provider === "elevenlabs") {
      if (!apiKey || !apiKey.trim()) {
        return NextResponse.json(
          { error: "ElevenLabs API anahtarı eksik. Lütfen ayarlardan ElevenLabs API anahtarınızı girin." },
          { status: 400 }
        );
      }

      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, "");
      // Sanitize voice ID: must be a valid ElevenLabs ID, not OpenAI voice name like 'nova' or browser voice
      const isValidVoice = voice && typeof voice === "string" && /^[a-zA-Z0-9]{15,30}$/.test(voice.trim());
      const voiceId = isValidVoice ? voice.trim() : "21m00Tcm4TlvDq8ikWAM"; // Default Rachel

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": cleanKey,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text: text.slice(0, 4500),
            model_id: model || "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail =
            parsed.detail?.message ||
            (typeof parsed.detail === "string" ? parsed.detail : null) ||
            parsed.message ||
            errText;
        } catch {}
        return NextResponse.json(
          { error: `ElevenLabs TTS Hatası (${res.status}): ${detail}` },
          { status: res.status }
        );
      }

      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
        },
      });
    }

    // 2. OpenAI TTS
    if (provider === "openai") {
      if (!apiKey || !apiKey.trim()) {
        return NextResponse.json(
          { error: "OpenAI API anahtarı eksik. Lütfen ayarlardan API anahtarınızı girin." },
          { status: 400 }
        );
      }

      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, "");
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "tts-1",
          input: text.slice(0, 4096),
          voice: voice || "nova",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        let detail = errText;
        try {
          const parsed = JSON.parse(errText);
          detail = parsed.error?.message || parsed.message || errText;
        } catch {}
        return NextResponse.json(
          { error: `OpenAI TTS Hatası (${res.status}): ${detail}` },
          { status: res.status }
        );
      }

      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
        },
      });
    }

    // 3. Custom / Any OpenAI-compatible TTS Service
    if (provider === "custom") {
      const targetUrl = endpoint?.trim();
      if (!targetUrl) {
        return NextResponse.json(
          { error: "Özel TTS API URL adresi girilmedi. Lütfen geçerli bir URL girin." },
          { status: 400 }
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey && apiKey.trim()) {
        const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, "");
        headers["Authorization"] = `Bearer ${cleanKey}`;
      }

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: model || "tts-1",
          input: text,
          voice: voice || "nova",
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          { error: `Özel TTS Servis Hatası (${res.status}): ${errText}` },
          { status: res.status }
        );
      }

      const audioBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("Content-Type") || "audio/mpeg";
      return new NextResponse(audioBuffer, {
        headers: {
          "Content-Type": contentType,
        },
      });
    }

    if (provider === "browser") {
      return NextResponse.json({ success: true, message: "Tarayıcı sesi aktif" });
    }

    return NextResponse.json(
      { error: `Bilinmeyen ses sağlayıcısı: ${provider}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

