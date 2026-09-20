import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

/**
 * RAG Ingest Proxy Route
 *
 * Forwards PDF uploads to the Python FastAPI backend for proper ingestion:
 * - PyMuPDF text extraction (not TextDecoder)
 * - Parent-child semantic chunking
 * - Multi-provider embedding (Ollama / OpenAI / Gemini)
 * - LanceDB vector storage
 * - BM25 index construction
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;

    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Lütfen bir PDF dosyası seçin." },
        { status: 400 }
      );
    }

    if (file.size > 300 * 1024 * 1024) return NextResponse.json({ error: "PDF en fazla 300 MB olabilir." }, { status: 413 });
    // Forward to Python FastAPI backend
    try {
      const backendForm = new FormData();
      backendForm.append("file", file);
      if (title) backendForm.append("title", title);

      const backendRes = await fetch(`${BACKEND_URL}/api/pdfs`, {
        method: "POST",
        body: backendForm,
        signal: AbortSignal.timeout(600000),
      });

      if (backendRes.ok) {
        const courseMeta = await backendRes.json();
        return NextResponse.json({
          success: true,
          engine: "python-production-rag",
          course: courseMeta,
        });
      }

      const errorText = await backendRes.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `Backend PDF işleme hatası (${backendRes.status}): ${errorText}`,
        },
        { status: backendRes.status }
      );
    } catch (err: any) {
      // Backend not running
      return NextResponse.json(
        {
          success: false,
          error:
            "Python RAG backend çalışmıyor. PDF indeksleme için lütfen 'npm run dev:api' komutunu çalıştırın. " +
            "Backend, PDF dosyalarını PyMuPDF ile analiz eder, semantik parçalama yapar ve vektör veritabanına kaydeder.",
        },
        { status: 503 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `PDF İndeksleme Hatası: ${err.message}` },
      { status: 500 }
    );
  }
}
