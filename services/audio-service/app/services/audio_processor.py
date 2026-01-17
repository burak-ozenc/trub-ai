"""Main service for orchestrating audio analysis"""
from typing import Dict, Any
from app.utils.audio_utils import AudioPreprocessor
from app.analyzers.breath_analyzer import BreathControlAnalyzer
from app.analyzers.tone_analyzer import ToneAnalyzer
from app.analyzers.rhythm_analyzer import RhythmAnalyzer
from app.analyzers.expression_analyzer import ExpressionAnalyzer
from app.analyzers.flexibility_analyzer import FlexibilityAnalyzer
from app.analyzers.trumpet_detector import TrumpetDetector
from app.core.models import AudioAnalysisResult, AnalysisType, TrumpetDetectionResult
from app.core.exceptions import AudioProcessingError, AnalysisError


class AudioProcessorService:
    """Main service for orchestrating audio analysis"""

    def __init__(self):
        self.preprocessor = AudioPreprocessor()
        self.trumpet_detector = TrumpetDetector()
        self.breath_analyzer = BreathControlAnalyzer()
        self.tone_analyzer = ToneAnalyzer()
        self.rhythm_analyzer = RhythmAnalyzer()
        self.expression_analyzer = ExpressionAnalyzer()
        self.flexibility_analyzer = FlexibilityAnalyzer()

    def analyze_audio(self, file_path: str, analysis_type: AnalysisType = AnalysisType.FULL) -> tuple[
        AudioAnalysisResult, TrumpetDetectionResult]:
        """
        Main method to analyze audio file with trumpet detection

        Args:
            file_path: Path to audio file
            analysis_type: Type of analysis to perform

        Returns:
            Tuple of (AudioAnalysisResult, TrumpetDetectionResult)
        """
        try:
            # Load and preprocess audio
            y, sr = self.preprocessor.load_and_preprocess(file_path)

            # Step 1: Detect if this is actually a trumpet
            trumpet_detection = self.trumpet_detector.analyze(y, sr)

            # Initialize result
            result = AudioAnalysisResult()

            # Only proceed with detailed analysis if trumpet is detected with sufficient confidence
            if trumpet_detection.is_trumpet:
                # Perform requested analysis
                if analysis_type in [AnalysisType.FULL, AnalysisType.BREATH]:
                    result.breath_control = self.breath_analyzer.analyze(y, sr)

                if analysis_type in [AnalysisType.FULL, AnalysisType.TONE]:
                    result.tone_quality = self.tone_analyzer.analyze(y, sr)

                if analysis_type in [AnalysisType.FULL, AnalysisType.RHYTHM]:
                    result.rhythm_timing = self.rhythm_analyzer.analyze(y, sr)

                if analysis_type in [AnalysisType.FULL, AnalysisType.EXPRESSION]:
                    result.expression = self.expression_analyzer.analyze(y, sr)

                if analysis_type in [AnalysisType.FULL, AnalysisType.FLEXIBILITY]:
                    result.flexibility = self.flexibility_analyzer.analyze(y, sr)

            return result, trumpet_detection

        except AudioProcessingError:
            raise
        except Exception as e:
            raise AnalysisError(f"Failed to analyze audio: {str(e)}")

    def extract_technical_data(self, analysis_result: AudioAnalysisResult) -> Dict[str, Any]:
        """
        Extract technical data from analysis result for processing

        Args:
            analysis_result: Result from audio analysis

        Returns:
            Dictionary with technical analysis data
        """
        technical_data = {}

        if analysis_result.breath_control:
            technical_data["breath_analysis"] = {
                "average_breath_length": analysis_result.breath_control.average_breath_length,
                "breath_consistency": analysis_result.breath_control.breath_consistency,
                "breath_count": analysis_result.breath_control.breath_count,
                "intervals": len(analysis_result.breath_control.breath_intervals)
            }

        if analysis_result.tone_quality:
            technical_data["tone_analysis"] = {
                "harmonic_ratio": analysis_result.tone_quality.harmonic_ratio,
                "quality_assessment": analysis_result.tone_quality.quality_score,
                "recommendations": analysis_result.tone_quality.recommendations
            }

        if analysis_result.rhythm_timing:
            technical_data["rhythm_timing"] = {
                "tempo": analysis_result.rhythm_timing.tempo,
                "consistency": analysis_result.rhythm_timing.consistency,
                "beat_strength": analysis_result.rhythm_timing.beat_strength,
                "timing_deviation": analysis_result.rhythm_timing.timing_deviation,
                "recommendations": analysis_result.rhythm_timing.recommendations
            }

        if analysis_result.expression:
            technical_data["expression"] = {
                "dynamic_range": analysis_result.expression.dynamic_range,
                "expression_level": analysis_result.expression.expression_level,
                "recommendations": analysis_result.expression.recommendations
            }

        if analysis_result.flexibility:
            technical_data["flexibility"] = {
                "transition_smoothness": analysis_result.flexibility.transition_smoothness,
                "flexibility_level": analysis_result.flexibility.flexibility_level,
                "recommendations": analysis_result.flexibility.recommendations
            }

        return technical_data
