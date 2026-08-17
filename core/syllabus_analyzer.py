import os
import json
import re
from typing import List, Dict, Any, Optional
from core.config import FLASHCARD_PROMPT, DEFAULT_MODEL
from core.vector_store import AcademicVectorStore

class SyllabusAnalyzer:
    """
    Analyzes course documents to generate syllabus summaries, high-yield cheat sheets,
    and interactive revision flashcards.
    """

    def __init__(self, vector_store: AcademicVectorStore, model_name: str = DEFAULT_MODEL):
        self.vector_store = vector_store
        self.model_name = model_name

    def generate_flashcards(
        self,
        topic: str = "Key Concepts",
        num_cards: int = 6,
        filter_source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate interactive study flashcards from course materials."""
        query = topic if topic and topic != "Key Concepts" else "definitions theorems laws formulas key principles"
        chunks = self.vector_store.search(
            query=query,
            top_k=max(8, num_cards * 2),
            filter_source=filter_source,
            min_similarity=0.01
        )

        # Fallback to all chunks if topic search is sparse
        if not chunks:
            chunks = self.vector_store.chunks[:max(8, num_cards * 2)]

        if not chunks:
            return []

        context_parts = [f"[Doc: {ch['source']} | Page: {ch['page']}]\n{ch['text']}" for ch in chunks[:8]]
        context_str = "\n\n".join(context_parts)

        prompt = FLASHCARD_PROMPT.format(num_cards=num_cards, context=context_str)
        raw_response = self._call_llm_json(prompt)
        cards = self._clean_and_parse_json(raw_response)

        if not cards:
            cards = self._fallback_flashcards(chunks, num_cards)

        return cards

    def generate_cheat_sheet(self, filter_source: Optional[str] = None) -> str:
        """Generate a high-yield markdown revision cheat-sheet."""
        docs = self.vector_store.get_all_documents()
        if not docs:
            return "No course materials uploaded yet. Ingest documents in the Document Hub to generate revision sheets."

        chunks = self.vector_store.search(
            query="summary key concepts formula overview core rules",
            top_k=10,
            filter_source=filter_source,
            min_similarity=0.01
        )

        if not chunks:
            chunks = self.vector_store.chunks[:10]

        if not chunks:
            return "Unable to find key concepts for this document."

        context_parts = [f"[Doc: {ch['source']} | Page: {ch['page']}]\n{ch['text']}" for ch in chunks[:8]]
        context_str = "\n\n".join(context_parts)

        prompt = f"""You are an expert academic tutor. Create a high-yield Exam Revision Cheat-Sheet based STRICTLY on this course context.

Context:
\"\"\"
{context_str}
\"\"\"

Requirements:
- Organize by Topic/Module
- Highlight key definitions, formulas (in LaTeX $...$), and critical rules
- Include exact page citations `[Doc: ..., Page: ...]` for every section
- Keep it concise, high-impact, and easy to memorize for exams."""

        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name=self.model_name)
                res = model.generate_content(prompt)
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                print(f"[SyllabusAnalyzer] Cheat-sheet generation notice: {e}")

        # Fallback cheat sheet
        sections = []
        for ch in chunks[:6]:
            sec_title = ch.get("section_header") or f"{ch['source']} - Page {ch['page']}"
            sections.append(f"### 📌 {sec_title}\n\n{ch['text'][:300]}...\n\n*Citation: [Doc: {ch['source']}, Page: {ch['page']}]*")
        return "\n\n---\n\n".join(sections)

    def _call_llm_json(self, prompt: str) -> str:
        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(
                    model_name=self.model_name,
                    generation_config={"response_mime_type": "application/json"}
                )
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text.strip()
            except Exception:
                pass
        return ""

    def _clean_and_parse_json(self, text: str) -> Optional[List[Dict[str, Any]]]:
        if not text:
            return None
        cleaned = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE).strip()
        start = cleaned.find('[')
        end = cleaned.rfind(']')
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]
        try:
            data = json.loads(cleaned)
            if isinstance(data, list):
                return data
        except Exception:
            pass
        return None

    def _fallback_flashcards(self, chunks: List[Dict[str, Any]], num_cards: int) -> List[Dict[str, Any]]:
        cards = []
        # Extract individual concept sentences across all chunks
        all_concepts = []
        for ch in chunks:
            sentences = [s.strip() for s in ch["text"].split("\n") if len(s.strip()) > 30 and not s.startswith("#")]
            for s in sentences:
                all_concepts.append({"concept": s, "source": ch["source"], "page": ch["page"], "header": ch.get("section_header")})

        if not all_concepts:
            all_concepts = [{"concept": ch["text"][:120], "source": ch["source"], "page": ch["page"], "header": ch.get("section_header")} for ch in chunks]

        for idx in range(num_cards):
            item = all_concepts[idx % len(all_concepts)]
            cards.append({
                "id": idx + 1,
                "topic": item.get("header") or f"Concept #{idx + 1}",
                "front": f"What is the key principle of {item.get('header') or 'this syllabus topic'} (Page {item['page']})?",
                "back": f"{item['concept']}.\n\n(Source: {item['source']}, Page {item['page']})",
                "source_doc": item["source"],
                "source_page": item["page"]
            })
        return cards
