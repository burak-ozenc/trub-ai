"""Note transition flexibility analyzer for trumpet performance"""
import librosa
import numpy as np
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import FlexibilityAnalysisResult


class FlexibilityAnalyzer(BaseAnalyzer):
    """Analyzer for note transition flexibility in trumpet performance"""

    def analyze(self, y: np.ndarray, sr: int) -> FlexibilityAnalysisResult:
        """
        Analyze flexibility in note transitions

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            FlexibilityAnalysisResult with flexibility metrics
        """
        self.validate_input(y, sr)

        # Measure transition smoothness
        transition_smoothness = self._calculate_transition_smoothness(y, sr)

        # Assess flexibility level
        flexibility_level, recommendations = self._assess_flexibility(transition_smoothness)

        return FlexibilityAnalysisResult(
            transition_smoothness=round(float(transition_smoothness), 3),
            flexibility_level=flexibility_level,
            recommendations=recommendations
        )

    def _calculate_transition_smoothness(self, y: np.ndarray, sr: int) -> float:
        """Calculate smoothness of note transitions"""
        # Extract pitch using piptrack
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr, threshold=0.1)

        # Get pitch changes
        pitch_values = []
        for t in range(pitches.shape[1]):
            index = magnitudes[:, t].argmax()
            pitch = pitches[index, t]
            if pitch > 0:
                pitch_values.append(pitch)

        if len(pitch_values) < 2:
            return 0.0

        # Calculate average pitch change smoothness
        pitch_changes = np.abs(np.diff(pitch_values))
        avg_pitch_change = np.mean(pitch_changes)

        # Normalize to 0-1 scale (lower change = smoother)
        # Typical smooth transitions: 5-15 Hz changes
        # Rough transitions: >20 Hz changes
        if avg_pitch_change < 5:
            smoothness = 1.0
        elif avg_pitch_change < 20:
            smoothness = 1.0 - ((avg_pitch_change - 5) / 15)
        else:
            smoothness = max(0.0, 1.0 - (avg_pitch_change / 50))

        return smoothness

    def _assess_flexibility(self, smoothness: float) -> tuple[str, str]:
        """Assess flexibility level and generate recommendations"""

        if smoothness > 0.7:
            level = "Excellent smoothness in note transitions"
            recommendations = "Outstanding flexibility! Your note transitions are very smooth. Continue practicing scales and arpeggios to maintain this level."
        elif smoothness > 0.4:
            level = "Good flexibility with room for improvement"
            recommendations = "Good note transitions overall. Practice lip slurs and slow scales focusing on smooth connections between notes."
        else:
            level = "Needs improvement in note transitions"
            recommendations = "Work on smoother note changes. Practice long tones, lip slurs, and slow scales. Focus on maintaining steady air flow during transitions."

        return level, recommendations
