"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class SimplifiedFeedback(BaseModel):
    """Simplified, student-friendly feedback."""
    overall_status: str = Field(description="Overall performance status (e.g., 'Great!', 'Good progress!')")
    main_issue: Optional[str] = Field(None, description="Primary issue to focus on, if any")
    quick_tip: str = Field(description="Brief, actionable tip")
    next_step: str = Field(description="What to practice next")


class FeedbackRequest(BaseModel):
    """Request for generating LLM feedback."""
    technical_analysis: Dict[str, Any] = Field(description="Technical analysis results from audio service")
    user_question: Optional[str] = Field(None, description="Optional specific question from user")
    exercise_type: str = Field(description="Type of exercise: breathing, tone, rhythm, articulation, flexibility, expression")
    skill_level: str = Field(description="User skill level: beginner, intermediate, advanced")
    guidance: Optional[str] = Field(None, description="Optional practice guidance from user")


class LLMFeedbackResponse(BaseModel):
    """Complete LLM feedback response."""
    feedback: str = Field(description="Comprehensive feedback text")
    recommendations: List[str] = Field(description="List of specific recommendations")
    simplified: SimplifiedFeedback = Field(description="Simplified feedback for quick view")


class QuestionRequest(BaseModel):
    """Request for asking a question."""
    question: str = Field(description="User's question")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional context for the question")


class QuestionResponse(BaseModel):
    """Response to a user question."""
    answer: str = Field(description="Answer to the user's question")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(description="Service health status")
    version: str = Field(default="1.0.0", description="Service version")
