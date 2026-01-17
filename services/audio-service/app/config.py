"""Configuration settings for audio service"""
import os
from typing import Optional


class Settings:
    # File handling
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "data/recordings")
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "50000000"))  # 50MB

    # Audio processing
    AUDIO_SAMPLE_RATE: Optional[int] = None  # Let librosa decide
    TRUMPET_LOW_FREQ: float = 233.0
    TRUMPET_HIGH_FREQ: float = 2118.90

    # Breath analysis
    MIN_SILENCE_DURATION: float = 0.3
    SILENCE_THRESHOLD: float = 0.02

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Service configuration
    PORT: int = int(os.getenv("PORT", "8001"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    def __init__(self):
        # Ensure upload directory exists
        os.makedirs(self.UPLOAD_DIR, exist_ok=True)


settings = Settings()
