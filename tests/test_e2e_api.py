"""End-to-end API test suite for SyllabusAI.

Boots the FastAPI app on an ephemeral port and exercises every critical
endpoint path. Exits non-zero on any failure, so it can be wired into CI.

Usage:
    python tests/test_e2e_api.py
"""
import json
import sys
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import uvicorn  # noqa: E402
from server import app  # noqa: E402

PORT = 8125
BASE = f"http://127.0.0.1:{PORT}"


def _post(path: str, payload: dict, timeout: int = 60) -> dict:
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def _get(path: str, timeout: int = 30) -> dict:
    return json.loads(urllib.request.urlopen(BASE + path, timeout=timeout).read())


def run_checks() -> list:
    checks = []

    # 1. System status
    s = _get("/api/status")
    checks.append(("system status", s["total_documents"] >= 0 and s["total_chunks"] >= 0))

    # 2. Quiz generation returns options (list or dict) for every question
    q = _post("/api/quiz/generate", {
        "topic": "Memory Management", "num_questions": 2,
        "difficulty": "Easy", "quiz_type": "MCQ",
    })
    quiz = q["quiz"]
    opts_ok = all(isinstance(x.get("options"), (list, dict)) and x["options"] for x in quiz)
    checks.append(("quiz generation", len(quiz) > 0 and opts_ok))

    # 3. Grading: submitting the correct letters must score 100%
    answers = {str(item["id"]): str(item.get("correct_option", "A")).strip().upper()[:1]
               for item in quiz}
    g = _post("/api/quiz/submit", {"quiz": quiz, "user_answers": answers})
    checks.append(("quiz grading scores 100%", g["score_percentage"] == 100.0
                   and g["correct_count"] == len(quiz)))

    # 3b. Grading: definitely-wrong letters must score 0%
    def wrong_letter(letter: str) -> str:
        return chr(ord(letter) + 1) if letter.upper() != "D" else "A"
    wrong = {k: wrong_letter(v) for k, v in answers.items()}
    g_wrong = _post("/api/quiz/submit", {"quiz": quiz, "user_answers": wrong})
    checks.append(("quiz grading rejects wrong answers", g_wrong["correct_count"] == 0))

    # 4. Flashcards carry the fields the UI renders
    f = _post("/api/flashcards", {"topic": "Core Concepts", "num_cards": 3})
    shape_ok = all(all(k in c for k in ("front", "back", "source_doc")) for c in f["flashcards"])
    checks.append(("flashcards shape", len(f["flashcards"]) > 0 and shape_ok))

    # 5. Agent chat returns a substantive answer
    c = _post("/api/chat", {"query": "Explain thrashing in operating systems", "mode": "agent"})
    checks.append(("agent chat", len(c["answer"]) > 50))

    # 6. Analytics overview exposes readiness + streak
    a = _get("/api/analytics/overview")
    checks.append(("analytics overview", "readiness_score" in a and "study_streak_days" in a))

    # 7. Knowledge graph has nodes
    gr = _get("/api/graph/data")
    checks.append(("knowledge graph", len(gr["nodes"]) > 0))

    # 8. Static index is served
    html = urllib.request.urlopen(BASE + "/", timeout=10).read().decode("utf-8", "ignore")
    checks.append(("index served", "<!doctype html" in html.lower()))

    return checks


def main() -> int:
    cfg = uvicorn.Config(app, host="127.0.0.1", port=PORT, log_level="error")
    srv = uvicorn.Server(cfg)
    threading.Thread(target=srv.run, daemon=True).start()
    time.sleep(3)

    print()
    all_pass = True
    try:
        for name, ok in run_checks():
            print(("PASS" if ok else "FAIL"), "-", name)
            all_pass = all_pass and ok
    except (urllib.error.URLError, ConnectionError) as exc:
        print("FAIL - server unreachable:", exc)
        return 1
    print()
    print("E2E TEST:", "ALL PASSED" if all_pass else "FAILURES DETECTED")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
