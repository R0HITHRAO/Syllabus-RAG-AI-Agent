import os
import json
import re
from typing import List, Dict, Any, Optional
from core.config import (
    QUIZ_GENERATION_PROMPT,
    DESCRIPTIVE_QUIZ_PROMPT,
    DEFAULT_MODEL
)
from core.vector_store import AcademicVectorStore

class QuizGenerator:
    """
    Dynamic Assessment & Exam Generator for syllabus-grounded practice tests.
    Produces topic-specific MCQs and descriptive problems with auto-grading & citations.
    """

    def __init__(self, vector_store: AcademicVectorStore, model_name: str = DEFAULT_MODEL):
        self.vector_store = vector_store
        self.model_name = model_name

    def generate_mcq_quiz(
        self,
        topic: str = "General Syllabus",
        num_questions: int = 5,
        difficulty: str = "Medium",
        filter_source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate Multiple Choice Questions grounded in course material."""
        # 1. Retrieve context for the topic
        search_query = topic if topic and topic != "General Syllabus" else "fundamental concepts definitions algorithms theorems"
        chunks = self.vector_store.search(
            query=search_query,
            top_k=max(6, num_questions * 2),
            filter_source=filter_source
        )

        if not chunks:
            return []

        # Assemble context
        context_parts = []
        for ch in chunks[:8]:
            context_parts.append(f"[Doc: {ch['source']} | Page: {ch['page']}]\n{ch['text']}")
        context_str = "\n\n".join(context_parts)

        # 2. Call LLM with structured prompt
        prompt = QUIZ_GENERATION_PROMPT.format(
            num_questions=num_questions,
            context=context_str,
            difficulty=difficulty,
            topic=topic
        )

        raw_response = self._call_llm_json(prompt)
        parsed_quiz = self._clean_and_parse_json(raw_response)

        if not parsed_quiz:
            # Fallback algorithmic quiz builder
            parsed_quiz = self._generate_fallback_mcqs(chunks, num_questions, topic)

        return parsed_quiz

    def generate_descriptive_quiz(
        self,
        topic: str = "General Syllabus",
        num_questions: int = 3,
        filter_source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Generate descriptive practice questions with model answers and scoring rubrics."""
        search_query = topic if topic and topic != "General Syllabus" else "derivations architecture mechanisms protocols equations"
        chunks = self.vector_store.search(
            query=search_query,
            top_k=6,
            filter_source=filter_source
        )

        if not chunks:
            return []

        context_parts = [f"[Doc: {ch['source']} | Page: {ch['page']}]\n{ch['text']}" for ch in chunks[:6]]
        context_str = "\n\n".join(context_parts)

        prompt = DESCRIPTIVE_QUIZ_PROMPT.format(
            num_questions=num_questions,
            context=context_str,
            topic=topic
        )

        raw_response = self._call_llm_json(prompt)
        parsed = self._clean_and_parse_json(raw_response)

        if not parsed:
            parsed = self._generate_fallback_descriptive(chunks, num_questions, topic)

        return parsed

    def grade_mcq_submission(self, quiz: List[Dict[str, Any]], user_answers: Dict[int, str]) -> Dict[str, Any]:
        """
        Evaluate student MCQ answers.
        Returns score, percentage, and per-question feedback with textbook citations.
        """
        total = len(quiz)
        correct_count = 0
        feedback_list = []

        for q in quiz:
            q_id = q.get("id", 0)
            user_choice = user_answers.get(q_id, "").strip().upper()
            correct_choice = q.get("correct_option", "").strip().upper()
            
            # Extract letter if user submitted "A. Option"
            if len(user_choice) > 1 and user_choice[1] in [".", ")", " "]:
                user_choice = user_choice[0]
            if len(correct_choice) > 1 and correct_choice[1] in [".", ")", " "]:
                correct_choice = correct_choice[0]

            is_correct = (user_choice == correct_choice)
            if is_correct:
                correct_count += 1

            feedback_list.append({
                "id": q_id,
                "question": q.get("question", ""),
                "user_answer": user_answers.get(q_id, "Not Answered"),
                "correct_answer": correct_choice,
                "is_correct": is_correct,
                "explanation": q.get("explanation", ""),
                "source_doc": q.get("source_doc", "Syllabus"),
                "source_page": q.get("source_page", 1)
            })

        percentage = round((correct_count / total * 100), 1) if total > 0 else 0.0

        return {
            "total_questions": total,
            "correct_count": correct_count,
            "score_percentage": percentage,
            "grade": "A" if percentage >= 85 else "B" if percentage >= 70 else "C" if percentage >= 50 else "Needs Revision",
            "feedback": feedback_list
        }

    def _call_llm_json(self, prompt: str) -> str:
        """Execute LLM call expecting JSON response."""
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
            except Exception as e:
                print(f"[QuizGenerator] LLM JSON generation error: {e}")
        return ""

    def _clean_and_parse_json(self, text: str) -> Optional[List[Dict[str, Any]]]:
        """Safely parse JSON array even if enclosed in markdown code blocks."""
        if not text:
            return None
        # Remove code blocks if present
        cleaned = re.sub(r'^```json\s*', '', text, flags=re.MULTILINE)
        cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
        cleaned = cleaned.strip()

        # Find starting [ and ending ]
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

    def _generate_fallback_mcqs(self, chunks: List[Dict[str, Any]], num_questions: int, topic: str) -> List[Dict[str, Any]]:
        """Heuristic fallback MCQ generator when offline."""
        mcqs = []
        for idx, ch in enumerate(chunks[:num_questions], start=1):
            sentences = [s.strip() for s in ch["text"].split(". ") if len(s.strip()) > 30]
            main_sentence = sentences[0] if sentences else ch["text"][:100]
            
            mcqs.append({
                "id": idx,
                "question": f"According to {ch['source']} (Page {ch['page']}), which of the following is true regarding {topic or 'the syllabus'}?",
                "options": [
                    f"A. {main_sentence[:120]}.",
                    "B. The system halts immediately when external interrupts occur.",
                    "C. No memory management unit is required for virtual addressing.",
                    "D. None of the above."
                ],
                "correct_option": "A",
                "explanation": f"Stated explicitly on Page {ch['page']} of {ch['source']}: '{main_sentence[:140]}...'",
                "source_doc": ch["source"],
                "source_page": ch["page"]
            })
        return mcqs

    def _generate_fallback_descriptive(self, chunks: List[Dict[str, Any]], num_questions: int, topic: str) -> List[Dict[str, Any]]:
        """Heuristic fallback descriptive questions."""
        questions = []
        for idx, ch in enumerate(chunks[:num_questions], start=1):
            questions.append({
                "id": idx,
                "question": f"Explain the core mechanisms of {ch.get('section_header') or topic} as described in {ch['source']} (Page {ch['page']}).",
                "max_marks": 5,
                "model_answer": ch["text"][:300] + "...",
                "key_points": [
                    "Define key terminology accurately",
                    "Highlight architectural components",
                    "Explain trade-offs or formulas"
                ],
                "source_doc": ch["source"],
                "source_page": ch["page"]
            })
        return questions
