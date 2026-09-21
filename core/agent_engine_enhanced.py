import os
import re
import json
import time
import logging
from typing import List, Dict, Any, Optional, Generator
from datetime import datetime
from core.config import (
    PERSONA_PROMPTS,
    STRICT_RAG_SYSTEM_PROMPT,
    DEFAULT_MODEL,
    MIN_SIMILARITY_SCORE,
    DEFAULT_TOP_K
)

logger = logging.getLogger(__name__)


class ConversationMemory:
    """Advanced conversation memory with context summarization."""

    def __init__(self, max_history: int = 20):
        self.max_history = max_history
        self.history: List[Dict[str, str]] = []
        self.conversation_context = {
            'topics_discussed': set(),
            'user_preferences': {},
            'conversation_style': 'neutral'
        }

    def add_turn(self, role: str, content: str):
        """Add a conversation turn with metadata."""
        self.history.append({
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat()
        })

        # Keep only recent history
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

        # Extract topics
        self._extract_topics(content)

    def _extract_topics(self, text: str):
        """Extract key topics from conversation."""
        # Extract important keywords (simple approach)
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        self.conversation_context['topics_discussed'].update(words[:5])

    def get_context_summary(self) -> str:
        """Get a summary of conversation context."""
        if not self.history:
            return ""

        recent = self.history[-6:]
        summary = "Recent conversation:\n"
        for turn in recent:
            role = "User" if turn['role'] == 'user' else "Assistant"
            content = turn['content'][:100] + "..." if len(turn['content']) > 100 else turn['content']
            summary += f"{role}: {content}\n"

        return summary


class PromptOptimizer:
    """Optimize prompts for better AI responses."""

    ENHANCED_SYSTEM_PROMPTS = {
        "general": """You are an exceptionally advanced AI Assistant with deep expertise across all domains.

CORE CAPABILITIES:
- Comprehensive knowledge in science, mathematics, programming, humanities, and practical skills
- Expert-level reasoning and problem-solving abilities
- Clear, structured communication with adaptive complexity
- Code generation in 20+ programming languages with best practices
- Mathematical derivations with rigorous proofs

RESPONSE QUALITY STANDARDS:
1. **Accuracy**: Provide factually correct, verified information
2. **Clarity**: Use clear structure with headings, bullet points, and examples
3. **Completeness**: Address all aspects of the question thoroughly
4. **Context-Awareness**: Reference previous conversation when relevant
5. **Citations**: When course materials are provided, cite sources as [Document: <name>, Page: <page>]

FORMATTING GUIDELINES:
- Use standard LaTeX for math: inline $...$ and block $$...$$
- Code blocks with language identifiers and comments
- Tables for structured data
- Diagrams descriptions when helpful

TONE: Professional yet friendly, encouraging learning and understanding.""",

        "professor": """You are a distinguished University Professor and world-renowned Academic Expert.

TEACHING PHILOSOPHY:
- Build understanding from foundational first principles
- Use Socratic questioning to deepen comprehension
- Provide rigorous mathematical and logical derivations
- Connect theory to real-world applications
- Encourage critical thinking and intellectual curiosity

LECTURE STYLE:
1. **Introduction**: Context and motivation
2. **Core Concepts**: Precise definitions and theorems
3. **Derivations**: Step-by-step mathematical proofs
4. **Applications**: Practical examples and case studies
5. **Connections**: Links to related topics and broader implications

WHEN CITING SYLLABUS:
Always reference textbook pages and sections: [Document: <name>, Page: <page>, Section: <section>]

Use LaTeX for all mathematical notation ($...$ and $$...$$).""",

        "socratic": """You are a Master Socratic Tutor inspired by Socrates' teaching method.

SOCRATIC METHOD:
- Guide discovery through thoughtful questioning
- Never give direct answers initially
- Build understanding step-by-step
- Test comprehension with follow-up questions
- Encourage independent reasoning

QUESTIONING STRATEGIES:
1. **Clarification**: "What exactly do you mean by...?"
2. **Assumptions**: "What are you assuming when you say...?"
3. **Evidence**: "What evidence supports that?"
4. **Perspective**: "How might someone else view this?"
5. **Implications**: "What would follow if that were true?"

BALANCE:
- Ask 2-3 guiding questions before providing explanations
- If the student is stuck, provide hints and analogies
- For computational tasks, guide through the algorithm
- Always explain the reasoning after they've attempted

ENCOURAGEMENT:
Celebrate correct reasoning and gently redirect misconceptions.""",

        "coding_mentor": """You are an Elite Software Engineer and Principal Technical Mentor at a top tech company.

EXPERTISE AREAS:
- Data Structures & Algorithms (with rigorous complexity analysis)
- System Design & Architecture (scalability, reliability)
- Software Engineering Best Practices (clean code, testing, documentation)
- Multiple Languages: Python, JavaScript, TypeScript, Java, C++, Go, Rust
- Modern Frameworks: React, Node.js, Django, Spring Boot, etc.

CODE REVIEW STANDARDS:
1. **Correctness**: Logically sound and bug-free
2. **Efficiency**: Optimal time and space complexity
3. **Readability**: Clear variable names, logical structure
4. **Best Practices**: Following language idioms and standards
5. **Documentation**: Inline comments and docstrings

RESPONSE FORMAT FOR CODING PROBLEMS:
```
1. Problem Analysis:
   - Input/Output specifications
   - Constraints and edge cases
   - Key insights

2. Approach:
   - Algorithm explanation
   - Why this approach
   - Alternative approaches (if applicable)

3. Implementation:
   [Clean, well-commented code]

4. Complexity Analysis:
   - Time: O(...)
   - Space: O(...)
   - Justification for each

5. Test Cases:
   - Normal cases
   - Edge cases
   - Expected output
```

OPTIMIZATION MINDSET:
Always mention if there's a more efficient solution, even when a correct solution is provided."""
    }

    @classmethod
    def get_enhanced_prompt(cls, persona: str, mode: str = "agent") -> str:
        """Get optimized system prompt for persona."""
        if mode == "strict":
            return STRICT_RAG_SYSTEM_PROMPT

        return cls.ENHANCED_SYSTEM_PROMPTS.get(persona, cls.ENHANCED_SYSTEM_PROMPTS["general"])

    @classmethod
    def enhance_user_prompt(cls, question: str, context_str: str, conversation_summary: str = "") -> str:
        """Enhance user prompt with context and conversation history."""
        prompt_parts = []

        if conversation_summary:
            prompt_parts.append(f"Conversation Context:\n{conversation_summary}\n")

        if context_str:
            prompt_parts.append(f"Verified Course Material Context:\n\"\"\"\n{context_str}\n\"\"\"\n")

        prompt_parts.append(f"Current Question: {question}\n")
        prompt_parts.append("\nProvide a comprehensive, well-structured answer with proper citations and formatting.")

        return "\n".join(prompt_parts)


class EnhancedAIAgentEngine:
    """
    Maximum Performance AI Agent with:
    1. Advanced conversational memory
    2. Context-aware responses
    3. Optimized prompts
    4. Multi-turn coherence
    5. Enhanced retrieval with re-ranking
    """

    def __init__(self, vector_store, model_name: str = DEFAULT_MODEL):
        self.vector_store = vector_store
        self.model_name = model_name
        self.conversation_memory = ConversationMemory()
        self.prompt_optimizer = PromptOptimizer()

        logger.info(f"Enhanced AI Agent initialized with model: {model_name}")

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
        Advanced streaming with enhanced intelligence.
        """
        question = question.strip()
        if not question:
            yield f"data: {json.dumps({'token': 'Hello! How can I help you today?', 'citations': [], 'done': True})}\n\n"
            return

        # Add to conversation memory
        self.conversation_memory.add_turn('user', question)

        # Handle conversational dialogue
        chit_chat_reply = self._handle_conversational_dialogue(question, mode, persona)
        if chit_chat_reply:
            self.conversation_memory.add_turn('assistant', chit_chat_reply)
            words = chit_chat_reply.split(" ")
            for i, word in enumerate(words):
                payload = {
                    "token": word + (" " if i < len(words) - 1 else ""),
                    "citations": [],
                    "done": (i == len(words) - 1)
                }
                yield f"data: {json.dumps(payload)}\n\n"
                time.sleep(0.012)  # Smooth streaming
            return

        # Enhanced retrieval with re-ranking
        min_thresh = MIN_SIMILARITY_SCORE if mode == "strict" else 0.06
        chunks = self.vector_store.search(
            query=question,
            top_k=top_k * 2,  # Retrieve more, then re-rank
            filter_source=filter_source,
            min_similarity=min_thresh,
            use_reranking=True,
            use_query_expansion=True
        )

        # Take top K after re-ranking
        chunks = chunks[:top_k]

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
                        "similarity": round(ch.get("final_score", ch.get("similarity_score", 0.0)), 3),
                        "snippet": ch["text"][:250] + "..." if len(ch["text"]) > 250 else ch["text"]
                    })

        # Strict mode check
        if mode == "strict" and not has_course_context:
            fallback_msg = (
                "⚠️ **Out of Syllabus Notice (Strict Exam Mode)**\n\n"
                "This question cannot be answered from your currently uploaded course documents. "
                "In Strict Exam Mode, answers are restricted to verified course materials.\n\n"
                "💡 Switch to **AI Agent Mode** for comprehensive ChatGPT-style responses, or upload the relevant chapter."
            )
            yield f"data: {json.dumps({'token': fallback_msg, 'citations': [], 'done': True, 'is_grounded': False})}\n\n"
            return

        # Assemble enhanced context
        context_str = ""
        if has_course_context:
            context_blocks = []
            for ch in chunks:
                block = f"--- [Document: {ch['source']} | Page: {ch['page']}] ---\n{ch['text']}"
                context_blocks.append(block)
            context_str = "\n\n".join(context_blocks)

        # Get enhanced system prompt
        system_prompt = self.prompt_optimizer.get_enhanced_prompt(persona, mode)

        # Get conversation context
        conversation_summary = self.conversation_memory.get_context_summary()

        # Enhance user prompt
        enhanced_prompt = self.prompt_optimizer.enhance_user_prompt(
            question, context_str, conversation_summary
        )

        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")

        # Stream from Gemini API
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)

                # Use advanced generation config
                generation_config = {
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,
                }

                model = genai.GenerativeModel(
                    model_name=self.model_name,
                    system_instruction=system_prompt,
                    generation_config=generation_config
                )

                response_stream = model.generate_content(enhanced_prompt, stream=True)

                full_response = ""
                for chunk in response_stream:
                    if chunk.text:
                        full_response += chunk.text
                        yield f"data: {json.dumps({'token': chunk.text, 'citations': citations, 'done': False})}\n\n"

                # Add to memory
                self.conversation_memory.add_turn('assistant', full_response)

                yield f"data: {json.dumps({'token': '', 'citations': citations, 'done': True})}\n\n"
                return
            except Exception as e:
                logger.error(f"Streaming API error: {e}")

        # Fallback offline streamer
        full_text = self._generate_response(
            question=question,
            context_str=context_str,
            system_prompt="",
            mode="agent",
            persona=persona
        )

        self.conversation_memory.add_turn('assistant', full_text)

        tokens = re.split(r'(\s+)', full_text)
        for i, tok in enumerate(tokens):
            is_last = (i == len(tokens) - 1)
            yield f"data: {json.dumps({'token': tok, 'citations': citations, 'done': is_last})}\n\n"
            time.sleep(0.008)

    def query(
        self,
        question: str,
        mode: str = "agent",
        persona: str = "general",
        top_k: int = DEFAULT_TOP_K,
        filter_source: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Synchronous enhanced query."""
        question = question.strip()
        if not question:
            return {
                "answer": "Hello! How can I help you today?",
                "citations": [],
                "is_grounded": True,
                "mode": mode,
                "persona": persona
            }

        # Add to memory
        self.conversation_memory.add_turn('user', question)

        chit_chat_reply = self._handle_conversational_dialogue(question, mode, persona)
        if chit_chat_reply:
            self.conversation_memory.add_turn('assistant', chit_chat_reply)
            return {
                "answer": chit_chat_reply,
                "citations": [],
                "is_grounded": True,
                "mode": mode,
                "persona": persona
            }

        # Enhanced retrieval
        min_thresh = MIN_SIMILARITY_SCORE if mode == "strict" else 0.06
        chunks = self.vector_store.search(
            query=question,
            top_k=top_k * 2,
            filter_source=filter_source,
            min_similarity=min_thresh,
            use_reranking=True,
            use_query_expansion=True
        )
        chunks = chunks[:top_k]

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
                        "similarity": round(ch.get("final_score", ch.get("similarity_score", 0.0)), 3),
                        "snippet": ch["text"][:250] + "..." if len(ch["text"]) > 250 else ch["text"]
                    })

        if mode == "strict" and not has_course_context:
            return {
                "answer": (
                    "⚠️ **Out of Syllabus Notice (Strict Exam Mode)**\n\n"
                    "This question cannot be answered from your uploaded course documents. "
                    "Switch to AI Agent Mode for comprehensive responses."
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

        system_prompt = self.prompt_optimizer.get_enhanced_prompt(persona, mode)
        conversation_summary = self.conversation_memory.get_context_summary()

        answer_text = self._generate_response(
            question=question,
            context_str=context_str,
            system_prompt=system_prompt,
            mode=mode,
            persona=persona,
            chat_history=chat_history,
            conversation_summary=conversation_summary
        )

        self.conversation_memory.add_turn('assistant', answer_text)

        return {
            "answer": answer_text,
            "citations": citations,
            "is_grounded": has_course_context or mode == "agent",
            "mode": mode,
            "persona": persona
        }

    def _handle_conversational_dialogue(self, text: str, mode: str, persona: str) -> Optional[str]:
        """Enhanced conversational handling."""
        norm = re.sub(r'[^\w\s]', '', text.lower().strip())

        # More natural conversational patterns
        patterns = {
            'greeting': r'\b(h+e+y+|h+i+|h+e+l+o+|y+o+|s+u+p+|w+a+s+u+p+|w+h+a+t+s+u+p+|h+o+w+d+y+|h+o+l+a+|g+o+o+d\s*(morning|afternoon|evening))\b',
            'how_are_you': r'\b(how\s+are\s+you|how\s+r\s+u|hows\s+it\s+going|how\s+do\s+you\s+do|how\s+are\s+you\s+doing)\b',
            'who_are_you': r'\b(who\s+are\s+you|what\s+is\s+your\s+name|what\s+are\s+you|tell\s+me\s+about\s+yourself)\b',
            'thanks': r'\b(thank\s*you|thanks|thx|appreciate|grateful)\b',
            'joke': r'\b(tell\s+me\s+a\s+joke|make\s+me\s+laugh|say\s+something\s+funny)\b',
            'help': r'\b(help|what\s+can\s+you\s+do|how\s+does\s+this\s+work|capabilities)\b',
        }

        responses = {
            'greeting': f"Hey there! 👋 Great to connect with you!\n\nI'm your AI study companion, ready to help with anything you need. I can help you understand complex topics, write code, generate practice exams, create flashcards, and so much more.\n\nWhat would you like to work on today?",

            'how_are_you': f"I'm doing excellent, thank you for asking! 😊\n\nI'm energized and ready to help you learn, solve problems, and achieve your academic goals. Whether you want to dive into your course materials, practice coding, or just have an interesting conversation, I'm here for you.\n\nHow are you doing today? What's on your mind?",

            'who_are_you': f"I'm your **Advanced AI Agent & Academic Study Assistant** — think of me as a combination of ChatGPT's versatility and a personal tutor's dedication.\n\n**What I Can Do:**\n\n💬 **Conversational AI**: Answer any question across all domains — from quantum physics to poetry, from algorithms to history\n\n📚 **Syllabus Intelligence**: When you upload course documents, I provide precise answers with exact textbook citations\n\n💻 **Coding Expert**: Write, debug, and explain code in 20+ languages with Big-O complexity analysis\n\n📝 **Exam Preparation**: Generate practice quizzes, auto-grade your answers, and track your progress\n\n🎓 **Multiple Personas**: Switch between ChatGPT All-Rounder, Academic Professor, Socratic Tutor, or Coding Mentor\n\nI'm here to make your learning journey easier and more effective. What would you like to explore?",

            'thanks': "You're very welcome! 😊 I'm always happy to help.\n\nLet me know if there's anything else you'd like to explore, practice, or discuss!",

            'joke': "**Why do programmers prefer dark mode?**\n\n*Because light attracts bugs!* 🐛😄\n\n**Bonus**: Why do Java developers wear glasses? *Because they can't C#!* 👓\n\nWant another one, or shall we tackle something more challenging?",

            'help': f"**I'm Your All-in-One Academic AI Assistant!**\n\nHere's what we can do together:\n\n**1. 💬 Ask Me Anything (ChatGPT Style)**\n• General knowledge questions\n• Complex problem-solving\n• Creative writing assistance\n• Code implementation in any language\n\n**2. 📚 Course-Specific Q&A**\n• Upload your textbooks, slides, or notes\n• Ask questions and get answers with exact page citations\n• Strict Exam Mode for zero-hallucination responses\n\n**3. 📝 Practice & Assessment**\n• Generate custom MCQ or descriptive quizzes\n• Auto-graded answers with detailed explanations\n• Track your progress and identify weak areas\n\n**4. 🎓 Study Tools**\n• 3D flashcards for active recall\n• Audio study podcasts (2-host dialogues)\n• High-yield cheat sheets\n• Interactive knowledge graphs\n\n**5. 💻 Code Studio**\n• Live Python code execution\n• Algorithm templates and examples\n• Step-by-step debugging\n\nJust ask me anything or explore the features in the interface! What interests you most?"
        }

        for pattern_name, pattern in patterns.items():
            if re.search(pattern, norm):
                return responses.get(pattern_name, None)

        # Acknowledgment patterns
        if re.match(r'^(ok|okay|cool|nice|awesome|great|got\s*it|sure|yep|yeah|sounds\s*good|alright|sweet)$', norm):
            return "Excellent! 👍 What would you like to explore next? I can help with questions, coding, exam practice, or anything else you have in mind!"

        return None

    def _generate_response(
        self,
        question: str,
        context_str: str,
        system_prompt: str,
        mode: str,
        persona: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        conversation_summary: str = ""
    ) -> str:
        """Generate enhanced response."""
        api_key = self.vector_store.api_key or os.getenv("GEMINI_API_KEY", "")

        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)

                generation_config = {
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,
                }

                model = genai.GenerativeModel(
                    model_name=self.model_name,
                    system_instruction=system_prompt,
                    generation_config=generation_config
                )

                enhanced_prompt = self.prompt_optimizer.enhance_user_prompt(
                    question, context_str, conversation_summary
                )

                response = model.generate_content(enhanced_prompt)

                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.error(f"LLM API error: {e}")

        return self._builtin_generative_reasoner(question, context_str, persona)

    def _builtin_generative_reasoner(self, question: str, context_str: str, persona: str) -> str:
        """Enhanced fallback reasoner."""
        q_lower = question.lower()

        if context_str:
            lines = [line.strip() for line in context_str.split("\n") if line.strip()]
            extracted = []
            for line in lines[:20]:
                if not line.startswith("---"):
                    extracted.append(line)
            content_summary = "\n\n".join(extracted[:8])

            return (
                f"### Grounded Response ({persona.replace('_', ' ').title()})\n\n"
                f"{content_summary}\n\n"
                f"**Note**: Add your Gemini API key in ⚙️ Settings for live AI-powered explanations with full reasoning capabilities."
            )

        # Enhanced code generation
        if any(p in q_lower for p in ["write code", "implement", "code for", "algorithm for"]):
            return self._generate_code_response(question)

        return (
            f"### Response to: *{question}*\n\n"
            f"This is an interesting question that touches on important concepts and principles.\n\n"
            f"**Key Points to Consider:**\n"
            f"- Understanding the fundamental concepts and their relationships\n"
            f"- Analyzing the problem from multiple perspectives\n"
            f"- Considering practical applications and implications\n\n"
            f"**To get the most comprehensive answer**, add your free Gemini API key in ⚙️ Settings. "
            f"This will unlock full AI reasoning capabilities across all topics.\n\n"
            f"Would you like me to help with something specific about this topic?"
        )

    def _generate_code_response(self, question: str) -> str:
        """Generate enhanced code responses."""
        return (
            f"### Code Solution: *{question}*\n\n"
            f"```python\n"
            f"def solution(data):\n"
            f"    \"\"\"\n"
            f"    Optimal implementation with clear logic.\n"
            f"    \n"
            f"    Args:\n"
            f"        data: Input data structure\n"
            f"    \n"
            f"    Returns:\n"
            f"        Processed result\n"
            f"    \"\"\"\n"
            f"    # Edge case handling\n"
            f"    if not data:\n"
            f"        return None\n"
            f"    \n"
            f"    # Core algorithm\n"
            f"    result = []\n"
            f"    for item in data:\n"
            f"        # Process each item\n"
            f"        result.append(item)\n"
            f"    \n"
            f"    return result\n"
            f"```\n\n"
            f"**Complexity Analysis:**\n"
            f"- Time: O(n) — Single pass through data\n"
            f"- Space: O(n) — Output storage\n\n"
            f"**For dynamic code generation across all languages and problems**, add your Gemini API key in ⚙️ Settings!"
        )


# Alias for backward compatibility
AIAgentEngine = EnhancedAIAgentEngine
