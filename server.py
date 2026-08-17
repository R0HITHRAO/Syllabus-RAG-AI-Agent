import sys
import os
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from core.config import (
    UPLOAD_DIR,
    SAMPLE_DATA_DIR,
    DEFAULT_MODEL,
    DEFAULT_TOP_K,
    PERSONA_PROMPTS
)
from core.document_loader import DocumentLoader
from core.text_splitter import AcademicTextSplitter
from core.vector_store import AcademicVectorStore
from core.agent_engine import AIAgentEngine
from core.quiz_generator import QuizGenerator
from core.syllabus_analyzer import SyllabusAnalyzer

app = FastAPI(
    title="SyllabusRAG & ChatGPT AI Agent Platform",
    description="ChatGPT-Style Autonomous AI Agent & Grounded Exam Preparation Platform",
    version="2.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base Paths
PROJECT_ROOT = Path(__file__).resolve().parent
WEB_DIR = PROJECT_ROOT / "web"
WEB_DIR.mkdir(parents=True, exist_ok=True)
(WEB_DIR / "css").mkdir(parents=True, exist_ok=True)
(WEB_DIR / "js").mkdir(parents=True, exist_ok=True)

# Initialize Core Services
vector_store = AcademicVectorStore()
agent_engine = AIAgentEngine(vector_store)
quiz_gen = QuizGenerator(vector_store)
analyzer = SyllabusAnalyzer(vector_store)

# Preload sample data if empty
sample_file = SAMPLE_DATA_DIR / "operating_systems_sample.txt"
if len(vector_store.chunks) == 0 and sample_file.exists():
    pages = DocumentLoader.load_txt(sample_file)
    splitter = AcademicTextSplitter()
    chunks = splitter.split_documents(pages)
    vector_store.add_chunks(chunks)

# ---------------------------------------------------------
# Request Models
# ---------------------------------------------------------
class ChatRequest(BaseModel):
    query: str
    mode: str = "agent" # "agent" (ChatGPT-Style) or "strict" (Syllabus-Only)
    persona: str = "general" # "general", "professor", "socratic", "coding_mentor"
    top_k: int = DEFAULT_TOP_K
    filter_source: Optional[str] = None
    chat_history: Optional[List[Dict[str, str]]] = None

class QuizGenerateRequest(BaseModel):
    topic: str = "General Syllabus"
    num_questions: int = 5
    difficulty: str = "Medium"
    quiz_type: str = "MCQ"
    filter_source: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    quiz: List[Dict[str, Any]]
    user_answers: Dict[int, str]

class FlashcardRequest(BaseModel):
    topic: str = "Key Concepts"
    num_cards: int = 6
    filter_source: Optional[str] = None

class CheatSheetRequest(BaseModel):
    filter_source: Optional[str] = None

class ApiKeyRequest(BaseModel):
    api_key: str
    model_name: Optional[str] = None

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------
@app.get("/api/status")
async def get_system_status():
    docs = vector_store.get_all_documents()
    return {
        "status": "online",
        "total_documents": len(docs),
        "total_chunks": len(vector_store.chunks),
        "documents": docs,
        "has_api_key": bool(vector_store.api_key),
        "active_model": agent_engine.model_name
    }

@app.get("/api/agent/personas")
async def get_personas():
    return {
        "personas": [
            {"id": "general", "name": "🤖 ChatGPT All-Rounder", "description": "Versatile reasoning, writing, coding, and general knowledge."},
            {"id": "professor", "name": "🎓 Academic Professor", "description": "Rigorous conceptual depth and first-principles pedagogy."},
            {"id": "socratic", "name": "🧑‍🏫 Socratic Tutor", "description": "Guides you through thoughtful hints and intuitive questions."},
            {"id": "coding_mentor", "name": "💻 Code & Algorithm Mentor", "description": "Code implementations, Big-O complexity, and best practices."}
        ]
    }

@app.post("/api/config/key")
async def update_api_key(req: ApiKeyRequest):
    vector_store.set_api_key(req.api_key)
    if req.model_name:
        agent_engine.model_name = req.model_name
        quiz_gen.model_name = req.model_name
        analyzer.model_name = req.model_name
    return {"message": "API key and model updated successfully", "model": agent_engine.model_name}

@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    splitter = AcademicTextSplitter()
    total_added_chunks = 0
    saved_files = []

    for file in files:
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        pages = DocumentLoader.load_document(file_path)
        chunks = splitter.split_documents(pages)
        vector_store.add_chunks(chunks)
        total_added_chunks += len(chunks)
        saved_files.append(file.filename)

    return {
        "message": f"Successfully processed and indexed {len(saved_files)} file(s)",
        "files": saved_files,
        "chunks_indexed": total_added_chunks,
        "total_chunks": len(vector_store.chunks)
    }

@app.post("/api/sample/load")
async def load_sample_material():
    if not sample_file.exists():
        raise HTTPException(status_code=404, detail="Sample material file not found")
    pages = DocumentLoader.load_txt(sample_file)
    splitter = AcademicTextSplitter()
    chunks = splitter.split_documents(pages)
    vector_store.add_chunks(chunks)
    return {
        "message": "CS301 Operating Systems Sample Material loaded successfully",
        "chunks_added": len(chunks),
        "total_chunks": len(vector_store.chunks)
    }

@app.delete("/api/documents/{doc_name}")
async def delete_document(doc_name: str):
    vector_store.delete_document(doc_name)
    file_path = UPLOAD_DIR / doc_name
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass
    return {"message": f"Document '{doc_name}' removed from vector index."}

@app.post("/api/clear")
async def clear_all_data():
    vector_store.clear()
    return {"message": "All documents and vector indices cleared."}

@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    filter_val = None if req.filter_source in ["All Documents", "", None] else req.filter_source
    result = agent_engine.query(
        question=req.query,
        mode=req.mode,
        persona=req.persona,
        top_k=req.top_k,
        filter_source=filter_val,
        chat_history=req.chat_history
    )
    return result

@app.post("/api/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest):
    filter_val = None if req.filter_source in ["All Documents", "", None] else req.filter_source
    if req.quiz_type == "DESCRIPTIVE":
        data = quiz_gen.generate_descriptive_quiz(
            topic=req.topic,
            num_questions=req.num_questions,
            filter_source=filter_val
        )
    else:
        data = quiz_gen.generate_mcq_quiz(
            topic=req.topic,
            num_questions=req.num_questions,
            difficulty=req.difficulty,
            filter_source=filter_val
        )
    return {"quiz": data, "type": req.quiz_type, "topic": req.topic}

@app.post("/api/quiz/submit")
async def submit_quiz(req: QuizSubmitRequest):
    result = quiz_gen.grade_mcq_submission(req.quiz, req.user_answers)
    return result

@app.post("/api/flashcards")
async def generate_flashcards(req: FlashcardRequest):
    filter_val = None if req.filter_source in ["All Documents", "", None] else req.filter_source
    cards = analyzer.generate_flashcards(
        topic=req.topic,
        num_cards=req.num_cards,
        filter_source=filter_val
    )
    return {"flashcards": cards, "topic": req.topic}

@app.post("/api/cheatsheet")
async def generate_cheatsheet(req: CheatSheetRequest):
    filter_val = None if req.filter_source in ["All Documents", "", None] else req.filter_source
    content = analyzer.generate_cheat_sheet(filter_source=filter_val)
    return {"cheatsheet": content}

# ---------------------------------------------------------
# Static Website Mounting
# ---------------------------------------------------------
app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")

@app.get("/")
async def serve_index():
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(content={"message": "Web UI is ready."})

if __name__ == "__main__":
    import uvicorn
    print("[SERVER] Starting ChatGPT AI Agent & Syllabus RAG Web Server on http://localhost:8000 ...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
