"""
Feedback simplification service for student-friendly feedback.
"""
from typing import Dict, Any, Optional
from app.core.models import SimplifiedFeedback


class FeedbackSimplifier:
    """
    Simplifies technical analysis into student-friendly feedback.
    """

    def __init__(self):
        """Initialize the feedback simplifier."""
        self.status_thresholds = {
            "excellent": 0.9,
            "great": 0.8,
            "good": 0.7,
            "fair": 0.6,
            "needs_work": 0.0
        }

    def simplify(
        self,
        technical_analysis: Dict[str, Any],
        exercise_type: str,
        skill_level: str
    ) -> SimplifiedFeedback:
        """
        Generate simplified feedback from technical analysis.

        Args:
            technical_analysis: Raw analysis results
            exercise_type: Type of exercise
            skill_level: User's skill level

        Returns:
            SimplifiedFeedback object
        """

        # Calculate overall score based on exercise type
        overall_score = self._calculate_overall_score(technical_analysis, exercise_type)

        # Determine overall status
        overall_status = self._get_status_message(overall_score, skill_level)

        # Identify main issue
        main_issue = self._identify_main_issue(technical_analysis, exercise_type)

        # Generate quick tip
        quick_tip = self._generate_quick_tip(technical_analysis, exercise_type, overall_score)

        # Generate next step
        next_step = self._generate_next_step(overall_score, exercise_type, skill_level)

        return SimplifiedFeedback(
            overall_status=overall_status,
            main_issue=main_issue,
            quick_tip=quick_tip,
            next_step=next_step
        )

    def _calculate_overall_score(self, analysis: Dict[str, Any], exercise_type: str) -> float:
        """Calculate overall performance score based on exercise type."""

        if exercise_type == "breathing":
            breath_metrics = analysis.get("breath_analysis", {})
            return breath_metrics.get("breath_control_score", 0.5)

        elif exercise_type == "tone":
            tone_metrics = analysis.get("tone_quality", {})
            return tone_metrics.get("overall_score", 0.5)

        elif exercise_type == "rhythm":
            rhythm_metrics = analysis.get("rhythm_analysis", {})
            timing = rhythm_metrics.get("timing_accuracy", 0.5)
            consistency = rhythm_metrics.get("tempo_consistency", 0.5)
            return (timing + consistency) / 2

        elif exercise_type == "articulation":
            tone_metrics = analysis.get("tone_quality", {})
            pitch_metrics = analysis.get("pitch_stability", {})
            return (tone_metrics.get("consistency", 0.5) + pitch_metrics.get("overall_stability", 0.5)) / 2

        elif exercise_type == "flexibility":
            pitch_metrics = analysis.get("pitch_stability", {})
            return pitch_metrics.get("overall_stability", 0.5)

        elif exercise_type == "expression":
            expression_metrics = analysis.get("expression_analysis", {})
            return expression_metrics.get("overall_score", 0.5)

        # Default fallback
        return 0.5

    def _get_status_message(self, score: float, skill_level: str) -> str:
        """Get status message based on score and skill level."""

        # Adjust thresholds based on skill level
        if skill_level == "beginner":
            adjustment = -0.1  # More lenient for beginners
        elif skill_level == "advanced":
            adjustment = 0.1  # More strict for advanced
        else:
            adjustment = 0.0

        adjusted_score = score + adjustment

        if adjusted_score >= self.status_thresholds["excellent"]:
            return "Excellent! 🎺"
        elif adjusted_score >= self.status_thresholds["great"]:
            return "Great work! 👍"
        elif adjusted_score >= self.status_thresholds["good"]:
            return "Good progress! 📈"
        elif adjusted_score >= self.status_thresholds["fair"]:
            return "Keep practicing! 💪"
        else:
            return "Let's work on the basics 🎯"

    def _identify_main_issue(self, analysis: Dict[str, Any], exercise_type: str) -> Optional[str]:
        """Identify the main issue to focus on."""

        if exercise_type == "breathing":
            breath_metrics = analysis.get("breath_analysis", {})
            score = breath_metrics.get("breath_control_score", 0.5)
            if score < 0.6:
                return "Breath support needs more consistency"

        elif exercise_type == "tone":
            tone_metrics = analysis.get("tone_quality", {})
            consistency = tone_metrics.get("consistency", 0.5)
            if consistency < 0.6:
                return "Tone quality varies too much - work on consistency"

        elif exercise_type == "rhythm":
            rhythm_metrics = analysis.get("rhythm_analysis", {})
            timing = rhythm_metrics.get("timing_accuracy", 0.5)
            if timing < 0.6:
                return "Timing accuracy needs improvement"

        elif exercise_type == "flexibility":
            pitch_metrics = analysis.get("pitch_stability", {})
            stability = pitch_metrics.get("overall_stability", 0.5)
            if stability < 0.6:
                return "Note transitions need more smoothness"

        return None

    def _generate_quick_tip(self, analysis: Dict[str, Any], exercise_type: str, score: float) -> str:
        """Generate a quick, actionable tip."""

        if score >= 0.8:
            tips = {
                "breathing": "Try increasing breath duration gradually",
                "tone": "Experiment with different dynamics",
                "rhythm": "Challenge yourself with faster tempos",
                "articulation": "Practice different articulation patterns",
                "flexibility": "Work on wider interval jumps",
                "expression": "Add more dynamic contrast"
            }
        elif score >= 0.6:
            tips = {
                "breathing": "Focus on steady, controlled exhales",
                "tone": "Keep embouchure consistent throughout",
                "rhythm": "Use a metronome for better timing",
                "articulation": "Practice tonguing separately",
                "flexibility": "Start with smaller intervals",
                "expression": "Plan your dynamic changes in advance"
            }
        else:
            tips = {
                "breathing": "Take fuller breaths before playing",
                "tone": "Check your embouchure formation",
                "rhythm": "Slow down and focus on accuracy first",
                "articulation": "Ensure proper tongue placement",
                "flexibility": "Practice long tones first",
                "expression": "Master the notes before adding expression"
            }

        return tips.get(exercise_type, "Keep practicing consistently")

    def _generate_next_step(self, score: float, exercise_type: str, skill_level: str) -> str:
        """Generate next step recommendation."""

        if score >= 0.85:
            if skill_level == "beginner":
                return "Try an intermediate-level exercise"
            else:
                return "You're ready for more challenging material"
        elif score >= 0.7:
            return f"Continue practicing {exercise_type} exercises at this level"
        else:
            return f"Focus on mastering the basics of {exercise_type}"
