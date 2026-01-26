"""
LLM service for generating trumpet technique feedback using Groq API.
"""
import logging
from typing import Tuple, List, Optional
from app.config import settings
from app.core.models import (
    FeedbackRequest,
    LLMFeedbackResponse,
    SimplifiedFeedback,
    QuestionRequest,
    QuestionResponse
)
from app.core.exceptions import GroqAPIException, FeedbackGenerationException
from app.utils.prompts import get_feedback_prompt, get_question_prompt
from app.services.feedback_simplifier import FeedbackSimplifier

logger = logging.getLogger(__name__)


class LLMService:
    """
    Service for generating LLM-powered feedback using Groq API.
    Uses lazy initialization to avoid startup failures.
    """

    def __init__(self):
        """Initialize the LLM service (lazy initialization for Groq client)."""
        self.client: Optional[any] = None
        self.model = settings.groq_model
        self.temperature = settings.groq_temperature
        self.max_tokens = settings.groq_max_tokens
        self.feedback_simplifier = FeedbackSimplifier()
        self._initialization_error: Optional[str] = None

        logger.info("LLM service created (Groq client will be initialized on first use)")

    def _ensure_client(self):
        """Lazy initialization of Groq client."""
        if self.client is not None:
            return

        if self._initialization_error is not None:
            raise GroqAPIException(self._initialization_error)

        try:
            # Validate API key
            if not settings.groq_api_key or settings.groq_api_key == "":
                error_msg = (
                    "GROQ_API_KEY is not set. Please set it in the .env file or environment variables. "
                    "Get your API key at: https://console.groq.com/"
                )
                logger.error(error_msg)
                self._initialization_error = error_msg
                raise GroqAPIException(error_msg)

            # Import Groq here (lazy import)
            from groq import Groq

            # Initialize Groq client with explicit configuration
            self.client = Groq(
                api_key=settings.groq_api_key,
                timeout=60.0,
                max_retries=2
            )
            logger.info(f"Groq client initialized successfully with model: {self.model}")

        except ImportError as e:
            error_msg = f"Failed to import Groq SDK: {e}. Make sure groq package is installed."
            logger.error(error_msg)
            self._initialization_error = error_msg
            raise GroqAPIException(error_msg)
        except Exception as e:
            error_msg = f"Failed to initialize Groq client: {e} (type: {type(e).__name__})"
            logger.error(error_msg)
            self._initialization_error = error_msg
            raise GroqAPIException(error_msg)

    async def generate_feedback(self, request: FeedbackRequest) -> LLMFeedbackResponse:
        """
        Generate comprehensive feedback from technical analysis.

        Args:
            request: Feedback request with technical analysis and metadata

        Returns:
            LLMFeedbackResponse with feedback, recommendations, and simplified feedback

        Raises:
            FeedbackGenerationException: If feedback generation fails
        """
        try:
            # Ensure Groq client is initialized
            self._ensure_client()

            # Generate prompt
            prompt = get_feedback_prompt(
                technical_analysis=request.technical_analysis,
                exercise_type=request.exercise_type,
                skill_level=request.skill_level,
                user_question=request.user_question,
                guidance=request.guidance
            )

            logger.info(f"Generating feedback for {request.skill_level} {request.exercise_type} exercise")

            # Call Groq API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert trumpet instructor providing personalized, constructive feedback to students."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            # Extract response text
            response_text = response.choices[0].message.content

            # Parse feedback and recommendations
            feedback, recommendations = self._parse_response(response_text)

            # Generate simplified feedback
            simplified = self.feedback_simplifier.simplify(
                technical_analysis=request.technical_analysis,
                exercise_type=request.exercise_type,
                skill_level=request.skill_level
            )

            logger.info("Feedback generated successfully")

            return LLMFeedbackResponse(
                feedback=feedback,
                recommendations=recommendations,
                simplified=simplified
            )

        except GroqAPIException:
            raise
        except Exception as e:
            logger.error(f"Failed to generate feedback: {e}")
            raise FeedbackGenerationException(f"Failed to generate feedback: {e}")

    async def answer_question(self, request: QuestionRequest) -> QuestionResponse:
        """
        Answer a user question about trumpet technique.

        Args:
            request: Question request with question text and optional context

        Returns:
            QuestionResponse with answer

        Raises:
            GroqAPIException: If API call fails
        """
        try:
            # Ensure Groq client is initialized
            self._ensure_client()

            # Generate prompt
            prompt = get_question_prompt(
                question=request.question,
                context=request.context
            )

            logger.info(f"Answering question: {request.question[:50]}...")

            # Call Groq API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert trumpet instructor answering student questions clearly and helpfully."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )

            # Extract answer
            answer = response.choices[0].message.content.strip()

            logger.info("Question answered successfully")

            return QuestionResponse(answer=answer)

        except Exception as e:
            logger.error(f"Failed to answer question: {e}")
            raise GroqAPIException(f"Failed to answer question: {e}")

    def _parse_response(self, response_text: str) -> Tuple[str, List[str]]:
        """
        Parse LLM response into feedback and recommendations.

        Args:
            response_text: Raw response from LLM

        Returns:
            Tuple of (feedback, recommendations)
        """
        try:
            # Split by RECOMMENDATIONS section
            if "RECOMMENDATIONS:" in response_text:
                parts = response_text.split("RECOMMENDATIONS:")
                feedback = parts[0].replace("FEEDBACK:", "").strip()
                recommendations_text = parts[1].strip()

                # Parse recommendations (each line starting with -)
                recommendations = [
                    line.strip("- ").strip()
                    for line in recommendations_text.split("\n")
                    if line.strip().startswith("-")
                ]
            else:
                # No recommendations section, treat entire response as feedback
                feedback = response_text.replace("FEEDBACK:", "").strip()
                recommendations = []

            # Ensure we have at least some recommendations
            if not recommendations:
                recommendations = ["Continue practicing consistently", "Focus on the fundamentals"]

            return feedback, recommendations

        except Exception as e:
            logger.warning(f"Failed to parse response, using full text: {e}")
            return response_text, ["Continue practicing", "Focus on fundamentals"]


# Global service instance (lazy initialization - created on import but Groq client initialized on first use)
_llm_service_instance: Optional[LLMService] = None


def get_llm_service() -> LLMService:
    """Get or create the global LLM service instance."""
    global _llm_service_instance
    if _llm_service_instance is None:
        _llm_service_instance = LLMService()
    return _llm_service_instance


# For backward compatibility
llm_service = get_llm_service()
