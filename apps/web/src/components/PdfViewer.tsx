"use client";

import { useEffect, useRef, useState } from "react";

export function PdfViewer({ url, highlightPage }: { url: string; highlightPage?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (highlightPage && highlightPage > 0) setPage(highlightPage);
  }, [highlightPage]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument(url).promise;
        if (cancelled) return;
        setTotal(doc.numPages);
        const p = await doc.getPage(Math.min(page, doc.numPages));
        const viewport = p.getViewport({ scale: 1.15 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await p.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        setErr(String(e));
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [url, page]);

  return (
    <div>
      {err ? (
        <p style={{ color: "var(--danger)", padding: 12 }}>{err}</p>
      ) : (
        <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
      )}
      <div style={{ display: "flex", gap: 8, padding: 8, justifyContent: "center" }}>
        <button className="pill" onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ‹
        </button>
        <span style={{ color: "var(--muted)", alignSelf: "center" }}>
          {page} / {total || "?"}
        </span>
        <button className="pill" onClick={() => setPage((p) => (total ? Math.min(total, p + 1) : p + 1))}>
          ›
        </button>
      </div>
    </div>
  );
}
