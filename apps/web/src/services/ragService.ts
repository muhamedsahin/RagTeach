import { getTutorSnapshot } from "@/lib/store";
import { BookCourse, CitationSource } from "@/types/tutor";
import { IRAGService, RAGQuery } from "@/types/services";

interface Course { id: string; title: string; page_count: number; chunk_count: number; topics: string[]; pdf_available?: boolean; }
export function toBook(course: Course): BookCourse {
  return { id: course.id, title: course.title.replace(/_/g, " "), author: "Kişisel kütüphane", edition: "PDF belge",
    pageCount: course.page_count, chunkCount: course.chunk_count, conceptCount: course.topics.length,
    indexed: course.chunk_count > 0, lastStudied: course.chunk_count > 0 ? "Çalışmaya hazır" : "Yeniden yükleme gerekli", coverGradient: ["#c77b50", "#332821"], topics: course.topics,
    pdfUrl: course.pdf_available === false ? undefined : `/api/backend/pdfs/${encodeURIComponent(course.id)}/file` };
}
class RAGService implements IRAGService {
  async listBooks(): Promise<BookCourse[]> {
    const res = await fetch("/api/backend/courses", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kütüphaneye bağlanılamadı.");
    return data.map(toBook);
  }
  async retrieve(query: RAGQuery): Promise<CitationSource[]> {
    const res = await fetch("/api/rag/search", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...query, topK: query.topK || Number(localStorage.getItem("ragteach_top_k")) || 5 }) });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || "Kaynak araması başarısız oldu.");
    return (data.hits || []).map((hit: { text: string; page: number; score: number; chapter_title: string; section: string; course_id: string }, i: number) => ({
      id: `cite-${Date.now()}-${i}`, bookTitle: hit.chapter_title || "Kaynak belge", author: "Kütüphaneniz",
      chapterNumber: 1, chapterTitle: hit.chapter_title || "", pageNumber: hit.page, section: hit.section || "",
      excerpt: hit.text, retrievalReason: "Belgenizden getirilen kaynak pasaj", relevanceScore: hit.score,
      pdfUrl: getTutorSnapshot().books.find(b => b.id === hit.course_id)?.pdfUrl ? `/api/backend/pdfs/${encodeURIComponent(hit.course_id)}/file#page=${hit.page}` : undefined,
    }));
  }
  async indexPdf(file: File, onProgress?: (stage: string, percent: number) => void): Promise<BookCourse> {
    if (!file.name.toLowerCase().endsWith(".pdf")) throw new Error("Lütfen PDF biçiminde bir belge seçin.");
    if (file.size > 300 * 1024 * 1024) throw new Error("PDF dosyası en fazla 300 MB olabilir.");
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " "));
    onProgress?.("Belge yükleniyor ve aramaya hazırlanıyor…", 20);
    const res = await fetch("/api/rag/ingest", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok || !data.course?.id) throw new Error(data.error || "Belge işlenemedi. Lütfen tekrar deneyin.");
    onProgress?.("Belgeniz hazır.", 100);
    return toBook(data.course);
  }
}
export const ragService = new RAGService();

