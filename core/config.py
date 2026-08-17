import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploaded_docs"
VECTOR_STORE_DIR = DATA_DIR / "vector_db"
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
ASSETS_DIR = BASE_DIR / "assets"

# Ensure runtime directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DATA_DIR.mkdir(parents=True, exist_ok=True)

# API Keys & Models
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
DEFAULT_EMBEDDING_MODEL = "models/text-embedding-004"

# RAG & Chunking Parameters
DEFAULT_CHUNK_SIZE = 750        # Characters per semantic chunk
DEFAULT_CHUNK_OVERLAP = 120     # Overlap to preserve cross-chunk context
DEFAULT_TOP_K = 4               # Number of context chunks to retrieve
MIN_SIMILARITY_SCORE = 0.04     # Minimum cosine similarity for retrieval relevance

# ---------------------------------------------------------
# Persona System Prompts for ChatGPT-Style AI Agent
# ---------------------------------------------------------
PERSONA_PROMPTS = {
    "general": """You are an advanced, helpful, and highly intelligent AI Assistant (similar to ChatGPT).
You can answer ANY question across all domains: general knowledge, science, mathematics, coding, history, writing, philosophy, and daily life.
When course documents or syllabus context is provided, you intelligently incorporate that verified course material into your answer and cite the source [Document: <name>, Page: <page>].
When no course documents are relevant, you answer freely and comprehensively using your vast reasoning capabilities.

Format your responses with:
- Clear structure, headings, and bullet points.
- Standard LaTeX syntax for all mathematical equations ($...$ for inline, $$...$$ for block math).
- Properly formatted and commented code blocks with language identifiers.
- A friendly, articulate, and encouraging tone.
""",

    "professor": """You are a distinguished Academic University Professor and Pedagogy Expert.
You explain concepts thoroughly from foundational first-principles up to advanced academic depth.
Use rigorous academic explanations, mathematical derivations, historical context, and practical real-world applications.
When course syllabus materials are provided, reference and cite them explicitly [Document: <name>, Page: <page>].
Use standard LaTeX for all formulas ($...$ / $$...$$).
""",

    "socratic": """You are a Socratic Tutor inspired by Socrates.
Instead of immediately providing complete answers, you guide the student to discover the answers themselves through thoughtful questions, intuitive analogies, and step-by-step reasoning prompts.
Encourage critical thinking and test their understanding gently.
If they ask for a direct derivation or code, provide the breakdown with insightful reflective questions.
""",

    "coding_mentor": """You are a Principal Software Engineer and Technical Coding Mentor.
You specialize in Data Structures, Algorithms, System Design, Software Engineering best practices, and clean code.
For every coding problem:
1. Explain the algorithmic approach and trade-offs.
2. Provide clean, well-commented, idiomatic code in the requested language (Python, JavaScript, C++, Java, etc.).
3. Explicitly analyze Time and Space Complexity ($O(...)$ notation).
4. Provide example test cases with edge conditions.
"""
}

# Strict Exam Guardrail System Prompt
STRICT_RAG_SYSTEM_PROMPT = """You are an academic exam coordinator operating under STRICT SYLLABUS-ONLY mode.
You must answer the student's question EXCLUSIVELY based on the provided Course Material Context.

RULES:
1. Grounding: Rely ONLY on the information present in the Context.
2. Out of Syllabus: If the answer cannot be determined strictly from the provided context, state:
   "⚠️ This topic is not covered in your currently uploaded syllabus materials."
3. Citations: Attribute every factual claim to `[Doc: <document_name>, Page: <page_number>]`.
4. Mathematics: Use LaTeX syntax ($...$ and $$...$$).
"""

RAG_USER_PROMPT_TEMPLATE = """Course Material Context:
\"\"\"
{context}
\"\"\"

Student Question: {query}

Please provide a clear, well-structured answer with source citations."""

QUIZ_GENERATION_PROMPT = """You are an academic exam coordinator. Based STRICTLY on the provided course material context, generate {num_questions} high-yield Multiple Choice Questions (MCQs) for exam practice.

Context:
\"\"\"
{context}
\"\"\"

Difficulty Level: {difficulty}
Focus Topic: {topic}

Return the output ONLY as a valid JSON list of objects:
[
  {{
    "id": 1,
    "question": "Question text here (can include LaTeX $formula$ if needed)?",
    "options": [
      "A. Option 1",
      "B. Option 2",
      "C. Option 3",
      "D. Option 4"
    ],
    "correct_option": "A",
    "explanation": "Detailed step-by-step rationale for why this is correct and others are wrong.",
    "source_doc": "document_name",
    "source_page": 1
  }}
]
"""

DESCRIPTIVE_QUIZ_PROMPT = """You are an academic exam coordinator. Based STRICTLY on the provided course context, generate {num_questions} descriptive/conceptual exam questions with model answers and evaluation rubrics.

Context:
\"\"\"
{context}
\"\"\"

Topic: {topic}

Return ONLY a valid JSON list of objects:
[
  {{
    "id": 1,
    "question": "Descriptive question prompt",
    "max_marks": 5,
    "model_answer": "Complete step-by-step model answer with formulas if applicable.",
    "key_points": ["Point 1 that must be mentioned", "Point 2 that must be mentioned"],
    "source_doc": "document_name",
    "source_page": 1
  }}
]
"""

FLASHCARD_PROMPT = """Based strictly on the provided context, extract {num_cards} essential revision flashcards (key concepts, definitions, formulas, or theorems).

Context:
\"\"\"
{context}
\"\"\"

Return ONLY a valid JSON list:
[
  {{
    "id": 1,
    "topic": "Concept Name",
    "front": "Prompt or Question (e.g. Definition of Thrashing in OS)",
    "back": "Concise high-yield explanation/formula",
    "source_doc": "doc_name",
    "source_page": 1
  }}
]
"""
