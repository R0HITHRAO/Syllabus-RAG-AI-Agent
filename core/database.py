import sqlite3
import json
import time
from pathlib import Path
from typing import List, Dict, Any

DB_PATH = Path(__file__).resolve().parent.parent / "syllabus.db"

class DatabaseManager:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            # Table for quiz attempts
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS quiz_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic TEXT NOT NULL,
                    score_percentage INTEGER NOT NULL,
                    correct_count INTEGER NOT NULL,
                    total_questions INTEGER NOT NULL,
                    grade TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            ''')
            conn.commit()

    def record_quiz_attempt(self, topic: str, score_pct: int, correct: int, total: int, grade: str) -> Dict[str, Any]:
        timestamp = int(time.time())
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO quiz_attempts (topic, score_percentage, correct_count, total_questions, grade, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (topic, score_pct, correct, total, grade, timestamp))
            conn.commit()
            return {
                "id": cursor.lastrowid,
                "topic": topic,
                "score_percentage": score_pct,
                "correct_count": correct,
                "total_questions": total,
                "grade": grade,
                "timestamp": timestamp
            }

    def get_all_quiz_attempts(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM quiz_attempts ORDER BY timestamp DESC')
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
