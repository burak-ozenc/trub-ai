"""Breath control analyzer for trumpet performance"""
import librosa
import numpy as np
from typing import List
from app.analyzers.base_analyzer import BaseAnalyzer
from app.core.models import BreathAnalysisResult, BreathInterval
from app.config import settings


class BreathControlAnalyzer(BaseAnalyzer):
    """Analyzer for breath control in trumpet performance"""

    def __init__(self):
        super().__init__()
        self.min_silence_duration = settings.MIN_SILENCE_DURATION
        self.silence_threshold = settings.SILENCE_THRESHOLD

    def analyze(self, y: np.ndarray, sr: int) -> BreathAnalysisResult:
        """
        Analyze breathing patterns in trumpet performance
        """
        self.validate_input(y, sr)

        # Calculate RMS energy
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]

        # Detect breath intervals (silences)
        breath_intervals = self._detect_breath_intervals(rms, sr)

        # Analyze breath patterns
        breath_analysis = self._analyze_breath_patterns(breath_intervals)

        return BreathAnalysisResult(
            breath_intervals=breath_intervals,
            average_breath_length=breath_analysis['avg_length'],
            breath_consistency=breath_analysis['consistency'],
            recommendations=breath_analysis['recommendations'],
            breath_count=len(breath_intervals)
        )

    def _detect_breath_intervals(self, rms: np.ndarray, sr: int) -> List[BreathInterval]:
        """Detect breath intervals based on RMS energy drops"""
        frame_to_time = lambda frame: librosa.frames_to_time(frame, sr=sr, hop_length=512)

        # Find silent regions (below threshold)
        silent_frames = rms < self.silence_threshold

        # Find start and end of silent regions
        breath_intervals = []
        in_silence = False
        silence_start = 0

        for i, is_silent in enumerate(silent_frames):
            if is_silent and not in_silence:
                # Start of silence
                silence_start = i
                in_silence = True
            elif not is_silent and in_silence:
                # End of silence
                silence_duration = frame_to_time(i) - frame_to_time(silence_start)

                if silence_duration >= self.min_silence_duration:
                    breath_intervals.append(BreathInterval(
                        start_time=frame_to_time(silence_start),
                        end_time=frame_to_time(i),
                        duration=silence_duration
                    ))
                in_silence = False

        return breath_intervals

    def _analyze_breath_patterns(self, breath_intervals: List[BreathInterval]) -> dict:
        """Analyze breath patterns for consistency and recommendations"""
        if not breath_intervals:
            return {
                'avg_length': 0.0,
                'consistency': 'No clear breath patterns detected',
                'recommendations': 'Try taking clearer breaths between phrases'
            }

        durations = [interval.duration for interval in breath_intervals]
        avg_length = np.mean(durations)
        std_dev = np.std(durations)

        # Determine consistency
        consistency_ratio = std_dev / avg_length if avg_length > 0 else 1

        if consistency_ratio < 0.3:
            consistency = "Excellent - very consistent breathing"
            recommendations = "Great breath control! Maintain this consistency."
        elif consistency_ratio < 0.5:
            consistency = "Good - fairly consistent breathing"
            recommendations = "Good breathing pattern. Try to make breath intervals more uniform."
        else:
            consistency = "Needs improvement - irregular breathing"
            recommendations = "Work on taking more consistent breaths. Practice breathing exercises daily."

        # Additional recommendations based on breath frequency and duration
        if len(breath_intervals) < 2:
            recommendations += " Consider taking more frequent breaths for longer phrases."
        elif avg_length < 0.5:
            recommendations += " Your breaths are quite short - try taking deeper breaths."
        elif avg_length > 3.0:
            recommendations += " Very long breath intervals detected - this is excellent for sustained playing."

        return {
            'avg_length': round(avg_length, 2),
            'consistency': consistency,
            'recommendations': recommendations
        }
