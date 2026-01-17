"""Expression and dynamics analyzer for trumpet performance"""
import librosa
import numpy as np
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import ExpressionAnalysisResult


class ExpressionAnalyzer(BaseAnalyzer):
    """Analyzer for musical expression and dynamics in trumpet performance"""

    def analyze(self, y: np.ndarray, sr: int) -> ExpressionAnalysisResult:
        """
        Analyze musical expression and dynamic range

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            ExpressionAnalysisResult with expression metrics
        """
        self.validate_input(y, sr)

        # Calculate dynamic range
        dynamic_range = self._calculate_dynamic_range(y, sr)

        # Assess expression level
        expression_level, recommendations = self._assess_expression(dynamic_range)

        return ExpressionAnalysisResult(
            dynamic_range=round(float(dynamic_range), 3),
            expression_level=expression_level,
            recommendations=recommendations
        )

    def _calculate_dynamic_range(self, y: np.ndarray, sr: int) -> float:
        """Calculate dynamic range of the performance"""
        # Get RMS energy over time
        S, phase = librosa.magphase(librosa.stft(y))
        rms = librosa.feature.rms(S=S)

        # Calculate dynamic range as difference between max and min
        max_rms = np.max(rms)
        min_rms = np.min(rms)
        dynamic_range = max_rms - min_rms

        return dynamic_range

    def _assess_expression(self, dynamic_range: float) -> tuple[str, str]:
        """Assess expression level and generate recommendations"""

        if dynamic_range > 0.05:
            level = "Great dynamic range and expressiveness"
            recommendations = "Excellent use of dynamics! Continue exploring different dynamic levels and phrase shaping."
        elif dynamic_range > 0.02:
            level = "Good expression with moderate dynamics"
            recommendations = "Good dynamic variation. Try incorporating more contrast between loud and soft passages."
        else:
            level = "Limited dynamics - needs more variation"
            recommendations = "Work on incorporating more dynamic variation. Practice playing the same phrase at different volume levels and experiment with crescendos and diminuendos."

        return level, recommendations
