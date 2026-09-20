import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  if (!/^(health|courses|pdfs\/[a-zA-Z0-9_-]+\/file)$/.test(endpoint)) return NextResponse.json({ error: "Adres bulunamadı." }, { status: 404 });
  try {
    const response = await fetch(`${BACKEND_URL}/api/${endpoint}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Belge servisine ulaşılamıyor. RAG sunucusunu başlatıp yeniden deneyin." }, { status: 503 });
  }
}
