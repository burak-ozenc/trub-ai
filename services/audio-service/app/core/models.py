"""Pydantic models for audio analysis"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class AnalysisType(str, Enum):
    """Types of audio analysis"""
    FULL = "full"
    BREATH = "breath"
    TONE = "tone"
    RHYTHM = "rhythm"
    EXPRESSION = "expression"
    FLEXIBILITY = "flexibility"


class AudioAnalysisRequest(BaseModel):
    """Request model for audio analysis"""
    analysis_type: AnalysisType = Field(
        default=AnalysisType.FULL,
        description="Type of analysis to perform"
    )


class BreathInterval(BaseModel):
    """Model for breath interval data"""
    start_time: float
    end_time: float
    duration: float


class BreathAnalysisResult(BaseModel):
    """Result model for breath control analysis"""
    breath_intervals: List[BreathInterval]
    average_breath_length: float
    breath_consistency: str
    recommendations: str
    breath_count: int


class ToneAnalysisResult(BaseModel):
    """Result model for tone quality analysis"""
    harmonic_ratio: float
    quality_score: str
    recommendations: str


class RhythmAnalysisResult(BaseModel):
    """Result model for rhythm/timing analysis"""
    tempo: float
    consistency: str
    recommendations: str
    beat_strength: float
    timing_deviation: float


class ExpressionAnalysisResult(BaseModel):
    """Result model for expression analysis"""
    dynamic_range: float
    expression_level: str
    recommendations: str


class FlexibilityAnalysisResult(BaseModel):
    """Result model for flexibility analysis"""
    transition_smoothness: float
    flexibility_level: str
    recommendations: str


class TrumpetDetectionResult(BaseModel):
    """Result model for trumpet detection"""
    is_trumpet: bool
    confidence_score: float
    detection_features: dict
    warning_message: Optional[str] = None
    recommendations: List[str]


class AudioAnalysisResult(BaseModel):
    """Complete audio analysis result"""
    breath_control: Optional[BreathAnalysisResult] = None
    tone_quality: Optional[ToneAnalysisResult] = None
    rhythm_timing: Optional[RhythmAnalysisResult] = None
    expression: Optional[ExpressionAnalysisResult] = None
    flexibility: Optional[FlexibilityAnalysisResult] = None


class AudioAnalysisResponse(BaseModel):
    """API response model for audio analysis"""
    status: str
    trumpet_detection: TrumpetDetectionResult
    analysis: Optional[AudioAnalysisResult] = None
    message: Optional[str] = None
