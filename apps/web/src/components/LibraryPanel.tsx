"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, pdfUrl } from "@/lib/api";
import { sessionActions, useSessionStore } from "@/lib/store";
import { PdfViewer } from "@/components/PdfViewer";

type Course = {
  id: string;
  title: string;
  filename: string;
  page_count: number;
  chunk_count: number;
  topics: string[];
};

export function LibraryPanel({ onStartLecture }: { onStartLecture: (topic?: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const courseId = useSessionStore((s) => s.courseId);
  const pages = useSessionStore((s) => s.pages);
  const active = courses.find((c) => c.id === courseId) || courses[0];

  const refresh = async () => {
    const list = await apiGet<Course[]>("/api/courses");
    setCourses(list);
    if (!courseId && list[0]) sessionActions.setCourseId(list[0].id);
  };

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const meta = await apiPost<Course>("/api/pdfs", fd);
      await refresh();
      sessionActions.setCourseId(meta.id);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>Kütüphane</h2>
      <section>
        <label>PDF yükle</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => onUpload(e.target.files?.[0] || null)}
          disabled={busy}
        />
        {busy && <p style={{ color: "var(--accent)" }}>İndeksleniyor…</p>}
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </section>

      <section>
        <label>Dersler</label>
        <select
          value={courseId || ""}
          onChange={(e) => sessionActions.setCourseId(e.target.value || null)}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.page_count} sayfa / {c.chunk_count} chunk)
            </option>
          ))}
        </select>
      </section>

      {active && (
        <>
          <section>
            <label>Konular</label>
            <div className="topic-list">
              {active.topics.slice(0, 12).map((t) => (
                <button key={t} className="topic" onClick={() => onStartLecture(t)}>
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label>
              PDF {pages.length ? `· bağlam sayfaları: ${pages.join(", ")}` : ""}
            </label>
            <div className="pdf-frame">
              <PdfViewer url={pdfUrl(active.id)} highlightPage={pages[0]} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
