# 🎓 SyllabusRAG & ChatGPT AI Agent Platform

A full-stack, syllabus-grounded academic AI tutor and dynamic exam assessment web application built with **FastAPI**, **Vanilla Web UI (HTML5 / CSS3 / ES6 JS / KaTeX)**, **ChromaDB / Vector Search**, and **Google Gemini API**.

----

## 🌟 Key Features

| Web Module | Description |
| :--- | :--- |
| **🤖 ChatGPT AI Agent Chat** | Interactive web chat with dual-mode reasoning (`🤖 AI Agent Mode` vs `🎓 Strict Exam Mode`), KaTeX LaTeX mathematical equation rendering ($\text{EMAT} = \epsilon + M + M(1-\alpha)$), code generation, and verifiable textbook citation cards. |
| **🎭 4 Assistant Personas** | Switch between *ChatGPT All-Rounder*, *Academic Professor*, *Socratic Tutor*, and *Code & Algorithm Mentor*. |
| **🛡️ Zero-Hallucination Guardrail** | In Strict Exam Mode, explicitly alerts students when a query is outside the course syllabus. |
| **📝 Exam & Quiz Arena** | Dynamic test generator (topic & difficulty configurable), interactive test taking with custom radio options, real-time auto-grading scorecard, and step-by-step rationales citing textbook pages. |
| **📚 Document Hub** | Drag-and-drop file uploader (PDF, PPTX, DOCX, TXT), real-time chunk & page indexing counters, document manager with delete actions. |
| **🗂️ 3D Study Flashcards** | 3D perspective flip cards for active recall and one-click consolidated chapter cheat-sheet compiler with markdown download. |

---

## 📁 Project Directory Structure

```
C:\projects\pro1\
├── server.py                     # FastAPI web server hosting API and static site
├── requirements.txt              # Python dependencies
├── .env.example                  # Gemini API Key configuration template
├── README.md                     # Documentation
├── web/                          # Modern Web Application Frontend
│   ├── index.html                # Semantic HTML5 Single-Page Web Application
│   ├── css/
│   │   └── style.css             # Vanilla CSS design system & responsive styling
│   └── js/
│       └── app.js                # Frontend state, API client, KaTeX math renderer
├── core/                         # Core AI Agent & algorithmic modules
│   ├── __init__.py
│   ├── agent_engine.py           # ChatGPT-style autonomous agent & dual-mode reasoning
│   ├── config.py                 # System prompts, paths, model configurations
│   ├── document_loader.py        # PDF, PPTX, DOCX, TXT multi-format parser
│   ├── text_splitter.py          # Academic recursive chunking
│   ├── vector_store.py           # Persistent vector index & cosine similarity search
│   ├── quiz_generator.py         # Dynamic MCQs, descriptive tests, & auto-grading
│   └── syllabus_analyzer.py      # Revision flashcards & cheat-sheet generator
├── sample_data/                  # Preloaded academic course materials
│   └── operating_systems_sample.txt # CS301 Operating Systems sample (Memory, Deadlocks)
└── data/                         # Persistent database directories
    ├── uploaded_docs/            # Uploaded course materials
    └── vector_db/                # Persistent vector database index
```

---

## 🚀 Running the Web Application

```powershell
cd C:\projects\pro1
python server.py
```

Then open your browser to:
👉 **`http://localhost:8000`**
