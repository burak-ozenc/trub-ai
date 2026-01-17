"""Tone quality analyzer for trumpet performance"""
import librosa
import numpy as np
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import ToneAnalysisResult


class ToneAnalyzer(BaseAnalyzer):
    """Analyzer for tone quality in trumpet performance"""

    def analyze(self, y: np.ndarray, sr: int) -> ToneAnalysisResult:
        """Analyze tone quality based on harmonic content"""
        self.validate_input(y, sr)

        # Separate harmonic and percussive components
        harmonic, percussive = librosa.effects.hpss(y)

        # Calculate harmonic ratio
        harmonic_energy = np.mean(np.abs(harmonic))
        percussive_energy = np.mean(np.abs(percussive))
        total_energy = harmonic_energy + percussive_energy

        harmonic_ratio = harmonic_energy / total_energy if total_energy > 0 else 0

        # Determine quality assessment
        quality_score, recommendations = self._assess_tone_quality(harmonic_ratio)

        return ToneAnalysisResult(
            harmonic_ratio=round(harmonic_ratio, 3),
            quality_score=quality_score,
            recommendations=recommendations
        )

    def _assess_tone_quality(self, harmonic_ratio: float) -> tuple[str, str]:
        """Assess tone quality based on harmonic ratio"""
        if harmonic_ratio > 0.7:
            return (
                "Excellent harmonic richness and clarity",
                "Outstanding tone quality! Your embouchure and breath support are working well together."
            )
        elif harmonic_ratio > 0.5:
            return (
                "Good, but could use more harmonic clarity",
                "Good tone foundation. Focus on consistent air flow and proper embouchure formation for richer harmonics."
            )
        else:
            return (
                "Needs improvement - focus on richer tone",
                "Work on developing a more resonant tone. Practice long tones with steady air flow and proper embouchure."
            )
