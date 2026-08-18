import time
from typing import Dict, List, Any, Optional

class AnalyticsEngine:
    """
    Tracks and analyzes student study performance, exam readiness,
    topic mastery levels, and diagnostic weak spots.
    """
    def __init__(self, vector_store=None):
        self.vector_store = vector_store
        self.quiz_history: List[Dict[str, Any]] = [
            {
                "timestamp": int(time.time()) - 86400 * 2,
                "topic": "Operating Systems & Memory Management",
                "score_percentage": 80,
                "correct_count": 4,
                "total_questions": 5,
                "grade": "A"
            },
            {
                "timestamp": int(time.time()) - 86400 * 1,
                "topic": "Banker's Algorithm & Deadlock Avoidance",
                "score_percentage": 100,
                "correct_count": 5,
                "total_questions": 5,
                "grade": "A+"
            }
        ]

    def record_quiz_result(self, topic: str, score_pct: int, correct: int, total: int, grade: str):
        record = {
            "timestamp": int(time.time()),
            "topic": topic,
            "score_percentage": score_pct,
            "correct_count": correct,
            "total_questions": total,
            "grade": grade
        }
        self.quiz_history.insert(0, record)
        return record

    def get_readiness_summary(self) -> Dict[str, Any]:
        """
        Calculates exam readiness metrics, topic mastery, and weak spot diagnostics.
        """
        topic_scores: Dict[str, List[int]] = {
            "Memory Management & Virtual Paging": [85, 90],
            "Deadlock Avoidance & Banker's Algo": [100, 95],
            "CPU Scheduling (RR & SJF)": [65],
            "Storage & File Systems": [70]
        }

        # Aggregate dynamically from history
        for q in self.quiz_history:
            top = q.get("topic", "General")
            if top not in topic_scores:
                topic_scores[top] = []
            topic_scores[top].append(q.get("score_percentage", 75))

        topic_mastery = []
        weak_topics = []
        total_score_sum = 0
        total_topic_count = 0

        for topic_name, scores in topic_scores.items():
            avg_score = round(sum(scores) / len(scores))
            total_score_sum += avg_score
            total_topic_count += 1

            status = "mastered" if avg_score >= 85 else ("moderate" if avg_score >= 70 else "weak")
            mastery_item = {
                "topic": topic_name,
                "mastery_percentage": avg_score,
                "status": status,
                "attempts": len(scores)
            }
            topic_mastery.append(mastery_item)

            if avg_score < 75:
                weak_topics.append({
                    "topic": topic_name,
                    "score": avg_score,
                    "recommended_action": f"Review {topic_name} notes and practice 3 targeted problems."
                })

        overall_readiness = round(total_score_sum / max(1, total_topic_count))
        total_questions = sum(q.get("total_questions", 0) for q in self.quiz_history)
        total_correct = sum(q.get("correct_count", 0) for q in self.quiz_history)
        accuracy = round((total_correct / max(1, total_questions)) * 100)

        return {
            "readiness_score": overall_readiness,
            "readiness_tier": "Exam Ready 🎯" if overall_readiness >= 85 else ("On Track 📈" if overall_readiness >= 70 else "Needs Revision ⚠️"),
            "total_quizzes_taken": len(self.quiz_history),
            "total_questions_attempted": total_questions,
            "overall_accuracy": accuracy,
            "study_streak_days": 4,
            "topic_mastery": topic_mastery,
            "weak_topics": weak_topics,
            "recent_quizzes": self.quiz_history[:5]
        }
