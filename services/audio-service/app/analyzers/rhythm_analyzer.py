"""Rhythm and timing analyzer for trumpet performance"""
import librosa
import numpy as np
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import RhythmAnalysisResult


class RhythmAnalyzer(BaseAnalyzer):
    """Analyzer for rhythm and timing in trumpet performance"""

    def analyze(self, y: np.ndarray, sr: int) -> RhythmAnalysisResult:
        """
        Analyze rhythm and timing patterns

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            RhythmAnalysisResult with timing analysis
        """
        self.validate_input(y, sr)

        # Extract rhythm features
        tempo, beats = self._extract_tempo_and_beats(y, sr)
        beat_strength = self._calculate_beat_strength(y, sr)
        timing_consistency = self._analyze_timing_consistency(y, sr, beats)

        # Generate assessment and recommendations
        consistency_assessment, recommendations = self._assess_rhythm_quality(
            tempo, beat_strength, timing_consistency
        )

        return RhythmAnalysisResult(
            tempo=round(float(tempo), 2),
            consistency=consistency_assessment,
            recommendations=recommendations,
            beat_strength=round(float(beat_strength), 3),
            timing_deviation=round(float(timing_consistency), 3)
        )

    def _extract_tempo_and_beats(self, y: np.ndarray, sr: int) -> tuple[float, np.ndarray]:
        """Extract tempo and beat positions"""
        try:
            # Use onset detection for better rhythm analysis
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, beats = librosa.beat.beat_track(
                onset_envelope=onset_env,
                sr=sr,
                hop_length=512
            )

            return tempo, beats

        except Exception:
            # Fallback to simpler method
            try:
                tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
                return tempo, beats
            except Exception:
                return 120.0, np.array([])  # Default tempo, no beats

    def _calculate_beat_strength(self, y: np.ndarray, sr: int) -> float:
        """Calculate overall beat strength/clarity"""
        try:
            # Onset strength as measure of rhythmic clarity
            onset_env = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median)

            # Calculate mean onset strength
            beat_strength = np.mean(onset_env)

            # Normalize to 0-1 range (typical values are 0-10)
            normalized_strength = min(beat_strength / 10.0, 1.0)

            return normalized_strength

        except Exception:
            return 0.0

    def _analyze_timing_consistency(self, y: np.ndarray, sr: int, beats: np.ndarray) -> float:
        """Analyze timing consistency and deviation"""
        if len(beats) < 3:
            return 1.0  # Not enough beats to measure consistency

        try:
            # Convert beat frames to time
            beat_times = librosa.frames_to_time(beats, sr=sr, hop_length=512)

            # Calculate intervals between beats
            intervals = np.diff(beat_times)

            if len(intervals) < 2:
                return 1.0

            # Calculate coefficient of variation for timing consistency
            mean_interval = np.mean(intervals)
            std_interval = np.std(intervals)

            if mean_interval == 0:
                return 1.0

            # Coefficient of variation (lower = more consistent)
            cv = std_interval / mean_interval

            # Convert to timing deviation (0 = perfect, 1 = very inconsistent)
            timing_deviation = min(cv * 2.0, 1.0)  # Scale CV to 0-1

            return timing_deviation

        except Exception:
            return 0.5  # Medium consistency if calculation fails

    def _assess_rhythm_quality(self, tempo: float, beat_strength: float,
                                timing_deviation: float) -> tuple[str, str]:
        """Assess rhythm quality and generate recommendations"""

        # Assess tempo appropriateness
        if 40 <= tempo <= 200:
            tempo_assessment = "appropriate"
        elif tempo < 40:
            tempo_assessment = "too slow"
        else:
            tempo_assessment = "too fast"

        # Assess beat strength
        if beat_strength > 0.3:
            beat_assessment = "strong"
        elif beat_strength > 0.15:
            beat_assessment = "moderate"
        else:
            beat_assessment = "weak"

        # Assess timing consistency
        if timing_deviation < 0.2:
            timing_assessment = "excellent"
        elif timing_deviation < 0.4:
            timing_assessment = "good"
        elif timing_deviation < 0.6:
            timing_assessment = "fair"
        else:
            timing_assessment = "poor"

        # Generate overall consistency description
        if timing_assessment == "excellent" and beat_assessment == "strong":
            consistency = f"Excellent timing consistency at {tempo:.1f} BPM with strong rhythmic clarity"
        elif timing_assessment in ["good", "excellent"] and beat_assessment in ["moderate", "strong"]:
            consistency = f"Good rhythmic control at {tempo:.1f} BPM with {beat_assessment} beat definition"
        elif timing_assessment == "fair":
            consistency = f"Fair timing at {tempo:.1f} BPM - rhythm needs more consistency"
        else:
            consistency = f"Rhythm needs significant improvement - {timing_assessment} timing and {beat_assessment} beat clarity"

        # Generate recommendations
        recommendations = []

        if timing_deviation > 0.4:
            recommendations.append("Practice with a metronome to improve timing consistency")

        if beat_strength < 0.2:
            recommendations.append("Focus on clearer note attacks to strengthen rhythmic definition")

        if tempo_assessment == "too slow":
            recommendations.append("Consider practicing at a slightly faster tempo")
        elif tempo_assessment == "too fast":
            recommendations.append("Slow down and focus on accuracy before increasing speed")

        if timing_deviation > 0.6:
            recommendations.append("Start with simple rhythmic exercises and gradually increase complexity")

        if beat_strength > 0.3 and timing_deviation < 0.3:
            recommendations.append("Great rhythmic foundation! Try more complex rhythmic patterns")

        # Default recommendation if no specific issues
        if not recommendations:
            recommendations.append("Solid rhythmic performance - maintain this consistency")

        recommendations_text = ". ".join(recommendations) + "."

        return consistency, recommendations_text
