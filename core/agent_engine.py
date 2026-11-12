import os
import re
import json
import time
from typing import List, Dict, Any, Optional, Generator
from core.config import (
    PERSONA_PROMPTS,
    STRICT_RAG_SYSTEM_PROMPT,
    DEFAULT_MODEL,
    MIN_SIMILARITY_SCORE,
    DEFAULT_TOP_K
)
from core.vector_store import AcademicVectorStore

class AIAgentEngine:
    """
    ChatGPT-Style Autonomous AI Agent with Real-Time Streaming & Hybrid Reasoning:
    1. Agent Mode (ChatGPT-style): Answers any general, coding, math, conversational, or academic query freely,
       intelligently incorporating and citing course documents when relevant.
    2. Strict Mode: Strictly constrains answers to uploaded syllabus materials.
    """

    def __init__(self, vector_store: AcademicVectorStore, model_name: str = DEFAULT_MODEL):
        self.vector_store = vector_store
        self.model_name = model_name

    @staticmethod
    def _prepare_chat_history(chat_history: Optional[List[Dict[str, str]]]) -> List[Dict[str, Any]]:
        """Normalize recent turns for Gemini's alternating user/model history."""
        normalized: List[Dict[str, Any]] = []
        for message in (chat_history or [])[-12:]:
            content = str(message.get("content", "")).strip()
            if not content:
                continue
            role = "user" if message.get("role") == "user" else "model"
            if role == "model" and not normalized:
                continue
            if normalized and normalized[-1]["role"] == role:
                normalized[-1]["parts"][0] += "\n" + content[-6000:]
            else:
                normalized.append({"role": role, "parts": [content[-6000:]]})

        if normalized and normalized[-1]["role"] == "user":
            normalized.pop()
        return normalized

    def query_stream(
        self,
        question: str,
        mode: str = "agent",
        persona: str = "general",
        top_k: int = DEFAULT_TOP_K,
        filter_source: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Generator[str, None, None]:
        """
        Yields Server-Sent Events (SSE) JSON payloads for real-time word-by-word streaming.
        Format: data: {"token": "...", "citations": [...], "done": bool}\n\n
        """
        question = question.strip()
        if not question:
            yield f"data: {json.dumps({'token': 'Hello! How can I assist you today? Feel free to ask me anything or chat!', 'citations': [], 'done': True})}\n\n"
            return

        # 1. Check for quick chit-chat
        chit_chat_reply = self._handle_conversational_dialogue(question, mode, persona)
        if chit_chat_reply:
            words = chit_chat_reply.split(" ")
            for i, word in enumerate(words):
                payload = {
                    "token": word + (" " if i < len(words) - 1 else ""),
                    "citations": [],
                    "done": (i == len(words) - 1)
                }
                yield f"data: {json.dumps(payload)}\n\n"
                time.sleep(0.015) # Smooth typewriter pacing
            return

        # 2. Hybrid Search in Vector Store
        min_thresh = MIN_SIMILARITY_SCORE if mode == "strict" else 0.08
        chunks = self.vector_store.search(
            query=question,
            top_k=top_k,
            filter_source=filter_source,
            min_similarity=min_thresh
        )

        has_course_context = bool(chunks)
        citations = []

        if has_course_context:
            seen_cits = set()
            for idx, ch in enumerate(chunks, start=1):
                cit_key = (ch["source"], ch["page"])
                if cit_key not in seen_cits:
                    seen_cits.add(cit_key)
                    citations.append({
                        "id": idx,
                        "source": ch["source"],
                        "page": ch["page"],
                        "section": ch.get("section_header", "General Topic"),
                        "similarity": round(ch.get("similarity_score", 0.0), 3),
                        "snippet": ch["text"][:220] + "..." if len(ch["text"]) > 220 else ch["text"]
                    })

        # 3. Strict Mode Check
        if mode == "strict" and not has_course_context:
            fallback_msg = (
                "⚠️ **Out of Syllabus Notice (Strict Exam Mode)**\n\n"
                "The question you asked cannot be answered strictly from your currently uploaded course documents. "
                "In **Strict Exam Mode**, answers are restricted exclusively to your verified course materials to prevent hallucinations.\n\n"
                "💡 *Switch to **🤖 AI Agent Mode** in the top toolbar to ask any question freely like ChatGPT, or upload the missing chapter in the Document Hub.*"
            )
            yield f"data: {json.dumps({'token': fallback_msg, 'citations': [], 'done': True, 'is_grounded': False})}\n\n"
            return

        # 4. Assemble Context & System Prompt
        context_str = ""
        if has_course_context:
            context_blocks = []
            for ch in chunks:
                block = f"--- [Document: {ch['source']} | Page: {ch['page']}] ---\n{ch['text']}"
                context_blocks.append(block)
            context_str = "\n\n".join(context_blocks)

        system_prompt = STRICT_RAG_SYSTEM_PROMPT if mode == "strict" else PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["general"])
        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")

        # 5. Live Gemini API Streaming if Key Available
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name=self.model_name, system_instruction=system_prompt)

                full_prompt = ""
                if context_str:
                    full_prompt += f"Verified Course Material Context:\n\"\"\"\n{context_str}\n\"\"\"\n\n"
                full_prompt += f"User Question: {question}\n\nPlease provide a natural, comprehensive, well-structured answer with LaTeX ($...$) and code if applicable."

                history = self._prepare_chat_history(chat_history)
                if history:
                    chat = model.start_chat(history=history)
                    response_stream = chat.send_message(full_prompt, stream=True)
                else:
                    response_stream = model.generate_content(full_prompt, stream=True)
                for chunk in response_stream:
                    if chunk.text:
                        yield f"data: {json.dumps({'token': chunk.text, 'citations': citations, 'done': False})}\n\n"

                yield f"data: {json.dumps({'token': '', 'citations': citations, 'done': True})}\n\n"
                return
            except Exception as e:
                print(f"[AgentEngine] Streaming API notice: {e}")
                yield f"data: {json.dumps({'token': '\n\n> ⚠️ Live Gemini response failed. Check your API key, model availability, and quota.', 'citations': citations, 'done': True, 'error': True})}\n\n"
                return

        # 6. Offline retrieval-only response when no Gemini API key is configured.
        full_text = self._generate_response(
            question=question,
            context_str=context_str,
            system_prompt=system_prompt,
            mode=mode,
            persona=persona,
            chat_history=chat_history
        )
        tokens = re.split(r'(\s+)', full_text)
        for i, tok in enumerate(tokens):
            is_last = (i == len(tokens) - 1)
            yield f"data: {json.dumps({'token': tok, 'citations': citations, 'done': is_last})}\n\n"
            time.sleep(0.01)

    def query(
        self,
        question: str,
        mode: str = "agent",
        persona: str = "general",
        top_k: int = DEFAULT_TOP_K,
        filter_source: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Synchronous RAG query endpoint."""
        question = question.strip()
        if not question:
            return {
                "answer": "Hello! How can I assist you today?",
                "citations": [],
                "is_grounded": True,
                "mode": mode,
                "persona": persona
            }

        chit_chat_reply = self._handle_conversational_dialogue(question, mode, persona)
        if chit_chat_reply:
            return {
                "answer": chit_chat_reply,
                "citations": [],
                "is_grounded": True,
                "mode": mode,
                "persona": persona
            }

        min_thresh = MIN_SIMILARITY_SCORE if mode == "strict" else 0.08
        chunks = self.vector_store.search(
            query=question,
            top_k=top_k,
            filter_source=filter_source,
            min_similarity=min_thresh
        )

        has_course_context = bool(chunks)
        citations = []

        if has_course_context:
            seen_cits = set()
            for idx, ch in enumerate(chunks, start=1):
                cit_key = (ch["source"], ch["page"])
                if cit_key not in seen_cits:
                    seen_cits.add(cit_key)
                    citations.append({
                        "id": idx,
                        "source": ch["source"],
                        "page": ch["page"],
                        "section": ch.get("section_header", "General Topic"),
                        "similarity": round(ch.get("similarity_score", 0.0), 3),
                        "snippet": ch["text"][:220] + "..." if len(ch["text"]) > 220 else ch["text"]
                    })

        if mode == "strict" and not has_course_context:
            return {
                "answer": (
                    "⚠️ **Out of Syllabus Notice (Strict Exam Mode)**\n\n"
                    "The question you asked cannot be answered strictly from your currently uploaded course documents. "
                    "In **Strict Exam Mode**, answers are restricted exclusively to your verified course materials to prevent hallucinations.\n\n"
                    "💡 *Switch to **🤖 AI Agent Mode** in the top toolbar to ask any question freely like ChatGPT, or upload the missing chapter in the Document Hub.*"
                ),
                "citations": [],
                "is_grounded": False,
                "mode": mode,
                "persona": persona
            }

        context_str = ""
        if has_course_context:
            context_blocks = [f"--- [Document: {ch['source']} | Page: {ch['page']}] ---\n{ch['text']}" for ch in chunks]
            context_str = "\n\n".join(context_blocks)

        system_prompt = STRICT_RAG_SYSTEM_PROMPT if mode == "strict" else PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["general"])
        
        answer_text = self._generate_response(
            question=question,
            context_str=context_str,
            system_prompt=system_prompt,
            mode=mode,
            persona=persona,
            chat_history=chat_history
        )

        return {
            "answer": answer_text,
            "citations": citations,
            "is_grounded": has_course_context or mode == "agent",
            "mode": mode,
            "persona": persona
        }

    def _handle_conversational_dialogue(self, text: str, mode: str, persona: str) -> Optional[str]:
        norm = re.sub(r'[^\w\s]', '', text.lower().strip())
        
        if re.search(r'\b(how\s+are\s+you|how\s+are\s+u|how\s+r\s+u|hows\s+it\s+going|how\s+do\s+you\s+do|how\s+are\s+you\s+doing|how\s+is\s+your\s+day)\b', norm):
            return (
                "I'm doing great, thank you for asking! 😊\n\n"
                "I'm here and ready to help you with anything—whether you want to chat, brainstorm ideas, write code, solve math problems, or study your course materials.\n\n"
                "How are you doing today? What's on your mind?"
            )

        if re.search(r'\b(h+e+y+|h+i+|h+e+l+o+|y+o+|s+u+p+|w+a+s+u+p+|w+h+a+t+s+u+p+|w+h+a+t+s+\s*u+p+|h+o+w+d+y+|h+o+l+a+|a+y+y+)\b', norm) or re.search(r'\bgood\s*(morning|afternoon|evening|day)\b', norm):
            docs = self.vector_store.get_all_documents()
            doc_note = f" (I also have **{len(docs)} course document(s)** indexed if you'd like to study)" if docs else ""
            return (
                f"Hey there! 👋 Great to hear from you!\n\n"
                f"How's everything going? I'm ready to help you with anything you need—from everyday questions and coding to diving into your syllabus topics{doc_note}.\n\n"
                "What would you like to work on or chat about?"
            )

        if re.search(r'\b(who\s+are\s+you|what\s+is\s+your\s+name|what\s+are\s+you|tell\s+me\s+about\s+yourself|introduce\s+yourself)\b', norm):
            return (
                "I am your **Autonomous AI Agent & Study Assistant** (built with ChatGPT-style versatility).\n\n"
                "Here is what I can do for you:\n"
                "- 💬 **Answer Any Question**: General knowledge, coding, mathematics, science, writing, and everyday advice.\n"
                "- 📚 **Syllabus & Course Intelligence**: When you upload course documents, I automatically cite verified textbook pages.\n"
                "- 💻 **Coding & Algorithms**: Clean code implementations in Python, JS, C++, with Big-O time and space complexity.\n"
                "- 📝 **Practice Exams & Quizzes**: Generate customized tests and auto-grade your answers with detailed rationales.\n\n"
                "Feel free to ask me anything!"
            )

        if re.search(r'\b(thank\s*you|thanks|thx|appreciate\s+it|thank\s+you\s+so\s+much)\b', norm):
            return "You're very welcome! 😊 Always glad to help. Let me know whenever you have another question or need a hand with something!"

        if re.search(r'\b(tell\s+me\s+a\s+joke|make\s+me\s+laugh|say\s+something\s+funny|joke)\b', norm):
            jokes = [
                "**Why do programmers prefer dark mode?**\n*Because light attracts bugs!* 🐛😄",
                "**There are 10 types of people in the world:**\n*Those who understand binary, and those who don't!* 😄"
            ]
            return f"{jokes[0]}\n\nLet me know if you want another one or want to tackle a problem!"

        if re.match(r'^(ok|okay|cool|nice|awesome|great|got\s*it|sure|yep|yeah|sounds\s*good|alright|sweet)$', norm):
            return "Awesome! 👍 What would you like to explore next? Feel free to ask a question, request code, or test your syllabus knowledge in the Exam Arena!"

        if re.match(r'^(help|help\s+me|what\s+can\s+you\s+do|how\s+does\s+this\s+work)$', norm):
            return (
                "Here are some great ways we can work together:\n\n"
                "1. **💬 Ask Anything (ChatGPT Style)**: Ask general knowledge, coding questions (*\"Write a binary search in Python\"*), or math derivations.\n"
                "2. **📚 Course Q&A**: Inquire about your uploaded syllabus (*\"Explain the EMAT formula\"*) to get exact textbook page citations.\n"
                "3. **📝 Exam Arena**: Generate auto-graded MCQs or descriptive practice problems.\n"
                "4. **⚡ Revision Flashcards**: Review 3D flip study flashcards for quick active recall.\n\n"
                "What would you like to do first?"
            )

        return None

    def _generate_response(
        self,
        question: str,
        context_str: str,
        system_prompt: str,
        mode: str,
        persona: str,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")

        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name=self.model_name, system_instruction=system_prompt)

                full_prompt = ""
                if context_str:
                    full_prompt += f"Verified Course Material Context:\n\"\"\"\n{context_str}\n\"\"\"\n\n"
                full_prompt += f"User Question: {question}\n\nPlease provide a natural, comprehensive, well-structured answer with LaTeX ($...$) and code if applicable."

                history_contents = self._prepare_chat_history(chat_history)

                if history_contents:
                    chat = model.start_chat(history=history_contents)
                    response = chat.send_message(full_prompt)
                else:
                    response = model.generate_content(full_prompt)

                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                print(f"[AIAgentEngine] LLM API Call: {e}")
                if context_str:
                    return (
                        "### Live AI response unavailable\n\n"
                        "Gemini did not complete this request. Check the API key, selected model, and quota. "
                        "The retrieved course excerpts are shown below as a fallback; they have not been rewritten by the model.\n\n"
                        + self._builtin_generative_reasoner(context_str)
                    )
                return (
                    "### Live AI response unavailable\n\n"
                    "Gemini did not complete this request. Check the API key, selected model, and quota, then try again."
                )

        return self._builtin_generative_reasoner(context_str)

    def _builtin_generative_reasoner(self, context_str: str) -> str:
        # 1. Course Context Question
        if context_str:
            lines = [line.strip() for line in context_str.split("\n") if line.strip()]
            extracted = []
            for line in lines[:15]:
                if not line.startswith("---"):
                    extracted.append(line)
            content_summary = "\n\n".join(extracted[:6])

            return (
                "### Retrieved Course Excerpts (Offline)\n\n"
                f"{content_summary}\n\n"
                "> These excerpts are shown as-is, not synthesized by an AI model. Check the Gemini key, selected model, and quota in Settings for AI-generated explanations."
            )

        return (
            "### Connect Gemini to chat\n\n"
            "Live AI responses are not configured. Add a Gemini API key in **Settings** to enable tutoring, coding help, and multi-turn conversations. "
            "Document search, quizzes, flashcards, and the other local study tools remain available."
        )
