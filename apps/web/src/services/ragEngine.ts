import { KnowledgeNode } from "@/types/tutor";

/**
 * RAG Engine — Lightweight Client-Side Utilities
 *
 * This module only handles 3D Knowledge Constellation node generation.
 * All actual RAG operations (PDF ingestion, embedding, search) are handled
 * by the Python FastAPI backend via ragService.ts.
 *
 * The previous fake hash-based vectorizer and localStorage-based chunk store
 * have been removed in favor of the production backend pipeline.
 */

/**
 * Generates dynamic 3D Knowledge Graph Nodes for WebGL visualization
 * from backend-provided course metadata.
 */
export function generate3DConstellationNodes(
  courseId: string,
  bookTitle: string,
  topics: string[],
  pageCount: number = 100,
): KnowledgeNode[] {
  const nodes: KnowledgeNode[] = [];

  // Central Core Node
  nodes.push({
    id: `node-${courseId}-core`,
    label: bookTitle.slice(0, 24),
    chapter: "Core Reference",
    page: 1,
    position: [0, 0.4, 0],
    status: "active",
    relevanceScore: 1.0,
    category: "chapter",
  });

  // Create topic-based orbital nodes (max 8)
  const topicSlice = topics.slice(0, 8);
  const radius = 2.4;

  topicSlice.forEach((topic, idx) => {
    const phi = Math.acos(-1 + (2 * idx) / Math.max(1, topicSlice.length));
    const theta = Math.sqrt(topicSlice.length * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    const cleanLabel = topic.replace(/^\d+[\.\)]\s*/, "").slice(0, 20);

    nodes.push({
      id: `node-${courseId}-topic-${idx}`,
      label: cleanLabel,
      chapter: topic,
      page: Math.round((pageCount / topicSlice.length) * (idx + 1)),
      position: [
        Number(x.toFixed(2)),
        Number(y.toFixed(2)),
        Number(z.toFixed(2)),
      ],
      status: idx === 0 ? "retrieved" : "idle",
      relevanceScore: 0.9 - idx * 0.04,
      category: idx % 3 === 0 ? "chapter" : idx % 3 === 1 ? "concept" : "algorithm",
    });
  });

  return nodes;
}
