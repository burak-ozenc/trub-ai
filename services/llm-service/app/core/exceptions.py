"""
Custom exceptions for LLM service.
"""


class LLMServiceException(Exception):
    """Base exception for LLM service."""
    pass


class GroqAPIException(LLMServiceException):
    """Exception for Groq API errors."""
    pass


class FeedbackGenerationException(LLMServiceException):
    """Exception for feedback generation errors."""
    pass


class InvalidRequestException(LLMServiceException):
    """Exception for invalid request data."""
    pass
