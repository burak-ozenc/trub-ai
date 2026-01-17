"""Base analyzer class for all audio analyzers"""
from abc import ABC, abstractmethod
import numpy as np
from typing import Any


class BaseAnalyzer(ABC):
    """Base class for all audio analyzers"""

    def __init__(self):
        self.name = self.__class__.__name__

    @abstractmethod
    def analyze(self, y: np.ndarray, sr: int) -> Any:
        """
        Perform analysis on audio data

        Args:
            y: Audio time series
            sr: Sample rate

        Returns:
            Analysis result object
        """
        pass

    def validate_input(self, y: np.ndarray, sr: int) -> None:
        """Validate input audio data"""
        if y is None or len(y) == 0:
            raise ValueError("Audio data is empty")
        if sr <= 0:
            raise ValueError("Sample rate must be positive")
        if not isinstance(y, np.ndarray):
            raise TypeError("Audio data must be numpy array")
