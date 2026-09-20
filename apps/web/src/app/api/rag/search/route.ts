import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const { query, courseId, topK = 5, overview = false } = body;
  if (typeof overview !== "boolean" || typeof query !== "string" || !query.trim() || query.length > 12000 || typeof courseId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(courseId) || !Number.isInteger(topK) || topK < 1 || topK > 20) {
    return NextResponse.json({ error: "Geçerli bir soru ve belge seçin." }, { status: 400 });
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/rag/search`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query.trim(), course_id: courseId, top_k: topK, overview }), signal: AbortSignal.timeout(120000) });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "Kaynak araması tamamlanamadı." }, { status: res.status });
    return NextResponse.json({ engine: "hybrid-rag", hits: data.hits || [] });
  } catch {
    return NextResponse.json({ error: "Belge servisi yanıt vermedi. Bağlantıyı kontrol edip tekrar deneyin." }, { status: 503 });
  }
}

