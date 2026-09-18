import re
import json
import os
from typing import Dict, List, Any, Optional


class KnowledgeGraphGenerator:
    """
    Constructs an interactive force-directed concept mind-map and knowledge graph
    dynamically from the user's uploaded documents.
    - With API key: Uses Gemini to intelligently extract concepts and relationships.
    - Without API key: Uses TF-IDF heuristic keyword extraction as a fallback.
    """

    def __init__(self, vector_store=None):
        self.vector_store = vector_store

    def build_graph(self, filter_source: Optional[str] = None) -> Dict[str, Any]:
        """
        Builds graph topology (nodes and links) from available vector store chunks.
        """
        nodes: List[Dict] = []
        links: List[Dict] = []
        node_ids: set = set()

        def add_node(nid: str, label: str, group: str, size: int = 18,
                     chapter: str = "Core", desc: str = "", formula: str = ""):
            if nid not in node_ids:
                nodes.append({
                    "id": nid,
                    "label": label,
                    "group": group,
                    "size": size,
                    "chapter": chapter,
                    "description": desc,
                    "formula": formula
                })
                node_ids.add(nid)

        def add_link(source: str, target: str, relationship: str = "related_to",
                     strength: float = 1.0):
            if source in node_ids and target in node_ids:
                links.append({
                    "source": source,
                    "target": target,
                    "relationship": relationship,
                    "strength": strength
                })

        # Root node
        add_node("root", "Course Syllabus", "root", size=32, chapter="Overview",
                 desc="Root curriculum domain")

        # No documents uploaded
        if not self.vector_store or len(self.vector_store.chunks) == 0:
            add_node("upload_hint", "Upload Documents to Begin", "chapter", size=22,
                     chapter="Getting Started",
                     desc="Upload your PDFs, notes, or textbooks in the Document Hub to populate this map.")
            add_link("root", "upload_hint", "needs", 1.0)
            return {
                "nodes": nodes,
                "links": links,
                "stats": {
                    "total_nodes": len(nodes),
                    "total_links": len(links),
                    "chapters_count": 0
                }
            }

        # Optionally filter by source document
        all_chunks = self.vector_store.chunks
        if filter_source:
            all_chunks = [c for c in all_chunks if c.get("source") == filter_source]

        # Group chunks by source document
        source_chunks: Dict[str, List[Dict]] = {}
        for chunk in all_chunks:
            src = chunk.get("source", "Unknown")
            source_chunks.setdefault(src, []).append(chunk)

        # Get API key
        api_key = (self.vector_store.api_key if self.vector_store else None) or \
                  os.getenv("GEMINI_API_KEY", "")

        # Create one chapter node per document
        chapter_ids: Dict[str, str] = {}
        for idx, (src, src_chunks) in enumerate(source_chunks.items()):
            ch_id = f"ch_{idx}"
            chapter_ids[src] = ch_id
            short_name = src if len(src) <= 30 else src[:27] + "..."
            add_node(ch_id, short_name, "chapter", size=26,
                     chapter=f"Document {idx + 1}",
                     desc=f"Source: {src} — {len(src_chunks)} sections indexed.")
            add_link("root", ch_id, "contains", 1.0)

        # Extract concepts using Gemini or TF-IDF
        if api_key:
            self._extract_with_gemini(api_key, source_chunks, chapter_ids,
                                      add_node, add_link, node_ids)
        else:
            self._extract_tfidf(source_chunks, chapter_ids, add_node, add_link, node_ids)

        return {
            "nodes": nodes,
            "links": links,
            "stats": {
                "total_nodes": len(nodes),
                "total_links": len(links),
                "chapters_count": len(source_chunks)
            }
        }

    # ─────────────────────────────────────────────────────────────────
    # Gemini-powered concept extraction
    # ─────────────────────────────────────────────────────────────────
    def _extract_with_gemini(self, api_key: str, source_chunks: Dict,
                              chapter_ids: Dict, add_node, add_link, node_ids: set):
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
        except Exception as e:
            print(f"[KnowledgeGraph] Gemini init failed: {e}")
            self._extract_tfidf(source_chunks, chapter_ids, add_node, add_link, node_ids)
            return

        for src, chunks in source_chunks.items():
            ch_id = chapter_ids.get(src)
            if not ch_id:
                continue

            sample_text = "\n\n".join(c.get("text", "")[:500] for c in chunks[:4])
            prompt = (
                "You are analyzing an academic document. Extract up to 8 key academic "
                "concepts, terms, or algorithms from the text below.\n"
                "For each, provide:\n"
                "1. label: short name (max 4 words)\n"
                "2. description: one sentence\n"
                "3. relationship: how it relates to the parent document "
                "(e.g. 'defines', 'explains', 'introduces', 'derives')\n\n"
                f"Text:\n{sample_text}\n\n"
                'Return a JSON array: [{"label": "...", "description": "...", "relationship": "..."}, ...]'
            )

            try:
                response = model.generate_content(prompt)
                raw = response.text.strip()
                raw = re.sub(r'^```json\s*', '', raw, flags=re.MULTILINE)
                raw = re.sub(r'^```\s*', '', raw, flags=re.MULTILINE)
                start = raw.find('[')
                end = raw.rfind(']')
                if start != -1 and end != -1:
                    raw = raw[start:end + 1]
                concepts = json.loads(raw)
                if isinstance(concepts, list):
                    for i, concept in enumerate(concepts[:8]):
                        label = concept.get("label", "").strip()
                        if not label or len(label) < 3:
                            continue
                        nid = f"gem_{re.sub(r'[^a-z0-9]+', '_', label.lower()[:30])}_{i}"
                        add_node(nid, label, "concept", size=18, chapter=src,
                                 desc=concept.get("description", ""))
                        add_link(ch_id, nid, concept.get("relationship", "related_to"), 0.85)
            except Exception:
                # Graceful per-document fallback
                self._extract_tfidf_for_source(src, chunks, ch_id, add_node, add_link, node_ids)

    # ─────────────────────────────────────────────────────────────────
    # TF-IDF fallback extraction
    # ─────────────────────────────────────────────────────────────────
    def _extract_tfidf(self, source_chunks: Dict, chapter_ids: Dict,
                        add_node, add_link, node_ids: set):
        for src, chunks in source_chunks.items():
            ch_id = chapter_ids.get(src)
            if not ch_id:
                continue
            self._extract_tfidf_for_source(src, chunks, ch_id, add_node, add_link, node_ids)

    def _extract_tfidf_for_source(self, src: str, chunks: List[Dict], ch_id: str,
                                   add_node, add_link, node_ids: set):
        all_text = " ".join(c.get("text", "") for c in chunks[:12])

        # Multi-word capitalized noun phrases (e.g. "Page Table", "Neural Network")
        candidates = re.findall(
            r'\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b',
            all_text
        )
        # Long standalone terms (likely technical)
        standalone = re.findall(r'\b([A-Za-z]{7,})\b', all_text)

        freq: Dict[str, int] = {}
        for term in candidates + standalone:
            term = term.strip()
            if len(term) < 5 or term.lower() in _STOP_WORDS:
                continue
            freq[term] = freq.get(term, 0) + 1

        sorted_terms = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        seen: set = set()
        count = 0
        for term, f in sorted_terms:
            if count >= 8:
                break
            key = term.lower()[:30]
            if key in seen:
                continue
            seen.add(key)
            nid = f"kw_{re.sub(r'[^a-z0-9]+', '_', key)}_{count}"
            group = "concept" if f >= 3 else "dynamic"
            size = min(22, 14 + min(f, 8))
            add_node(nid, term, group, size=size, chapter=src,
                     desc=f"Key term from {src} (appears {f}× across sections)")
            add_link(ch_id, nid, "mentions", round(min(1.0, 0.5 + f * 0.05), 2))
            count += 1


# ─────────────────────────────────────────────────────────────────────
# Common English stop words
# ─────────────────────────────────────────────────────────────────────
_STOP_WORDS = {
    "the", "and", "for", "are", "but", "not", "you", "all", "any",
    "can", "had", "her", "was", "one", "our", "out", "day", "get",
    "has", "him", "his", "how", "its", "let", "may", "new", "now",
    "old", "see", "two", "way", "who", "boy", "did", "this", "that",
    "with", "from", "they", "have", "more", "been", "also", "into",
    "than", "then", "when", "where", "which", "while", "there", "these",
    "their", "would", "could", "should", "what", "each", "such", "over",
    "both", "does", "make", "after", "very", "just", "other", "used",
    "because", "through", "however", "system", "section", "example",
    "following", "different", "important", "above", "below", "between",
    "chapter", "process", "number", "figure", "table", "therefore",
    "according", "using", "based", "given", "must", "within", "called",
    "since", "only", "same", "provide", "include", "defined", "refer",
    "value", "values", "order", "result", "results", "during", "before",
    "total", "occurs", "thus", "first", "second", "third", "lecture",
    "student", "students", "course", "courses", "notes", "document",
    "page", "pages", "text", "texts", "content", "data", "information"
}
