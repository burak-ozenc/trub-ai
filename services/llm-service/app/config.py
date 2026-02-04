"""
Configuration settings for LLM service.
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Groq API Configuration
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = "openai/gpt-oss-120b"
    groq_temperature: float = 0.7
    groq_max_tokens: int = 2048

    # Service Configuration
    service_port: int = 8002
    service_host: str = "0.0.0.0"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields


# Global settings instance
settings = Settings()
