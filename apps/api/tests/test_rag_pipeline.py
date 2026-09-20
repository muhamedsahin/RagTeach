"""Regression tests use an isolated database and never touch the user's library."""
import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_sandbox = tempfile.TemporaryDirectory(prefix="ragteach-test-")
os.environ["DATA_DIR"] = _sandbox.name
os.environ["ENABLE_RERANKING"] = "false"

import fitz
from fastapi.testclient import TestClient
from app.main import app
from app.rag.service import ProductionRagService, rag_service
from app.rag.embedder import generate_fallback_embedding, TARGET_DIM


def pdf_bytes(blank=False):
    doc = fitz.open()
    for index in range(8):
        page = doc.new_page()
        if not blank:
            topic = "Photosynthesis chlorophyll sunlight plants" if index % 2 == 0 else "Gravity planets orbit mass physics"
            text = (topic + " is explained with observations, examples and detailed scientific analysis. ") * 16
            page.insert_textbox(fitz.Rect(40, 40, 550, 790), text, fontsize=11)
    result = doc.tobytes()
    doc.close()
    return result


class TestRagPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with patch.object(rag_service, "_resolve_embedder", side_effect=ConnectionError("offline test")):
            response = cls.client.post("/api/pdfs", files={"file": ("biology.pdf", pdf_bytes(), "application/pdf")}, data={"title": "My biology notes"})
        assert response.status_code == 200, response.text
        cls.course = response.json()

    def test_upload_title_and_real_metadata(self):
        self.assertEqual(self.course["title"], "My biology notes")
        self.assertEqual(self.course["page_count"], 8)
        self.assertGreater(self.course["chunk_count"], 0)
        self.assertEqual(self.course["embedding_space"], "lexical")
        self.assertIn(self.course["id"], [c["id"] for c in self.client.get("/api/courses").json()])

    def test_offline_search_and_parent_citations(self):
        response = self.client.post("/api/rag/search", json={"query": "photosynthesis chlorophyll", "course_id": self.course["id"], "top_k": 5})
        self.assertEqual(response.status_code, 200, response.text)
        hits = response.json()["hits"]
        self.assertTrue(hits)
        self.assertIn("Photosynthesis", hits[0]["text"])
        self.assertGreaterEqual(hits[0]["page"], 1)
        self.assertEqual(len({h["text"] for h in hits}), len(hits))

    def test_restart_restores_vectors_and_search(self):
        restarted = ProductionRagService()
        hits = asyncio.run(restarted.search("gravity orbit mass", self.course["id"], 5))
        self.assertTrue(hits)
        self.assertIn("Gravity", hits[0].text)
        self.assertEqual(len(restarted._child_vectors[self.course["id"]][0]), TARGET_DIM)

    def test_vector_column_is_searchable(self):
        vector = generate_fallback_embedding("photosynthesis chlorophyll")
        results = rag_service._child_table.search(vector).limit(2).to_list()
        self.assertEqual(len(results), 2)

    def test_unrelated_question_has_no_fake_sources(self):
        hits = asyncio.run(rag_service.search("unicorn cryptocurrency blockchain", self.course["id"], 5))
        self.assertEqual(hits, [])

    def test_missing_course_and_bad_queries(self):
        for payload in [{"query": " "}, {"query": "hello", "top_k": 0}, {"query": "hello", "top_k": 30}, {"query": "hello", "course_id": "x' OR 1=1"}]:
            self.assertEqual(self.client.post("/api/rag/search", json=payload).status_code, 422)
        self.assertEqual(self.client.post("/api/rag/search", json={"query": "hello", "course_id": "missing"}).status_code, 404)

    def test_blank_or_invalid_pdf_is_not_published(self):
        before = len(rag_service.list_courses())
        response = self.client.post("/api/pdfs", files={"file": ("blank.pdf", pdf_bytes(blank=True), "application/pdf")})
        self.assertEqual(response.status_code, 422, response.text)
        self.assertEqual(len(rag_service.list_courses()), before)
        self.assertEqual(self.client.post("/api/pdfs", files={"file": ("bad.txt", b"hello")}).status_code, 400)

    def test_overview_samples_real_source_pages(self):
        response = self.client.post("/api/rag/search", json={"query": "Belgeyi ozetle", "course_id": self.course["id"], "top_k": 3, "overview": True})
        self.assertEqual(response.status_code, 200)
        hits = response.json()["hits"]
        self.assertEqual(len(hits), 3)
        self.assertLess(hits[0]["page"], hits[-1]["page"])
        self.assertTrue(all(h["text"] for h in hits))

    def test_legacy_384_dimension_library_remains_searchable(self):
        import pyarrow as pa
        from app.core.models import CourseMeta
        cid = "legacy-test"
        records = {"id": ["legacy-1"], "course_id": [cid], "page": [7],
                   "text": ["Legacy astronomy nebula telescope observations"],
                   "vector": pa.array([[0.1] * 384], type=pa.list_(pa.float32(), 384))}
        if "chunks" not in rag_service._db.table_names():
            rag_service._db.create_table("chunks", pa.Table.from_pydict(records))
        courses = rag_service.list_courses()
        rag_service._save_courses(courses + [CourseMeta(id=cid, title="Legacy", filename="missing.pdf", page_count=7, chunk_count=1)])
        try:
            restarted = ProductionRagService()
            hits = asyncio.run(restarted.search("astronomy nebula", cid, 3))
            self.assertEqual(hits[0].page, 7)
            self.assertIn("telescope", hits[0].text)
            self.assertFalse(next(c for c in restarted.list_courses() if c.id == cid).pdf_available)
            self.assertTrue(asyncio.run(restarted.search("summarize", cid, 3, overview=True)))
        finally:
            rag_service._save_courses(courses)

    def test_original_pdf_can_be_opened(self):
        response = self.client.get(f"/api/pdfs/{self.course['id']}/file")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_changed_embedding_model_uses_lexical_only(self):
        courses = rag_service.list_courses()
        original = courses[0].embedding_space
        courses[0].embedding_space = "OtherProvider:other-model"
        rag_service._save_courses(courses)
        try:
            with patch.object(rag_service, "_resolve_embedder", side_effect=ConnectionError("offline")):
                self.assertTrue(asyncio.run(rag_service.search("photosynthesis", self.course["id"], 3)))
        finally:
            courses[0].embedding_space = original
            rag_service._save_courses(courses)


if __name__ == "__main__":
    unittest.main()
