import time
from typing import Dict, List, Any, Optional
from core.database import DatabaseManager
from datetime import datetime, timedelta

class AnalyticsEngine:
    """
    Tracks and analyzes student study performance, exam readiness,
    topic mastery levels, and diagnostic weak spots.
    """
    def __init__(self, vector_store=None):
        self.vector_store = vector_store
        self.db = DatabaseManager()

    def record_quiz_result(self, topic: str, score_pct: int, correct: int, total: int, grade: str):
        return self.db.record_quiz_attempt(topic, score_pct, correct, total, grade)

    def get_readiness_summary(self) -> Dict[str, Any]:
        """
        Calculates exam readiness metrics, topic mastery, and weak spot diagnostics.
        """
        quiz_history = self.db.get_all_quiz_attempts()
        topic_scores: Dict[str, List[int]] = {}

        # Aggregate dynamically from history
        for q in quiz_history:
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

        overall_readiness = round(total_score_sum / max(1, total_topic_count)) if total_topic_count > 0 else 0
        total_questions = sum(q.get("total_questions", 0) for q in quiz_history)
        total_correct = sum(q.get("correct_count", 0) for q in quiz_history)
        accuracy = round((total_correct / max(1, total_questions)) * 100) if total_questions > 0 else 0

        # Calculate actual study streak from quiz history timestamps
        study_streak_days = self._calculate_study_streak(quiz_history)

        return {
            "readiness_score": overall_readiness,
            "readiness_tier": "Exam Ready 🎯" if overall_readiness >= 85 else ("On Track 📈" if overall_readiness >= 70 else "Needs Revision ⚠️") if total_topic_count > 0 else "No Data Yet",
            "total_quizzes_taken": len(quiz_history),
            "total_questions_attempted": total_questions,
            "overall_accuracy": accuracy,
            "study_streak_days": study_streak_days,
            "topic_mastery": topic_mastery,
            "weak_topics": weak_topics,
            "recent_quizzes": quiz_history[:5]
        }

    def _calculate_study_streak(self, quiz_history: List[Dict]) -> int:
        """
        Calculate consecutive days of quiz activity.
        Returns the number of consecutive days (including today) with quiz attempts.
        """
        if not quiz_history:
            return 0

        # Get unique days with quiz activity
        activity_days = set()
        now = datetime.now()
        today = now.date()

        for q in quiz_history:
            timestamp = q.get("timestamp", 0)
            if timestamp:
                try:
                    activity_date = datetime.fromtimestamp(timestamp).date()
                    activity_days.add(activity_date)
                except (ValueError, OSError):
                    continue

        if not activity_days:
            return 0

        # Calculate streak (consecutive days including today or yesterday)
        streak = 0
        current_date = today

        # Check if there's activity today or yesterday to start streak
        if today in activity_days:
            streak = 1
            current_date = today - timedelta(days=1)
        elif (today - timedelta(days=1)) in activity_days:
            streak = 1
            current_date = today - timedelta(days=2)
        else:
            return 0

        # Count consecutive days backward
        while current_date in activity_days:
            streak += 1
            current_date = current_date - timedelta(days=1)

        return streak
