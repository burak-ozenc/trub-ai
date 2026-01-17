"""Custom exceptions for audio service"""


class AudioProcessingError(Exception):
    """Exception raised for errors in audio processing"""
    pass


class AnalysisError(Exception):
    """Exception raised for errors in audio analysis"""
    pass


class TrumpetDetectionError(Exception):
    """Exception raised when trumpet is not detected in audio"""
    pass
