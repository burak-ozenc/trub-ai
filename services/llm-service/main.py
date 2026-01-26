"""
LLM Service - FastAPI application for generating trumpet feedback using Groq.
"""
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.models import (
    FeedbackRequest,
    LLMFeedbackResponse,
    QuestionRequest,
    QuestionResponse,
    HealthResponse
)
from app.core.exceptions import (
    GroqAPIException,
    FeedbackGenerationException,
    InvalidRequestException
)
from app.services.llm_service import llm_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="TRUB.AI LLM Service",
    description="LLM-powered feedback generation for trumpet practice",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint.
    """
    return HealthResponse(status="healthy", version="1.0.0")


@app.post("/api/feedback/generate", response_model=LLMFeedbackResponse)
async def generate_feedback(request: FeedbackRequest):
    """
    Generate comprehensive feedback from technical analysis.

    Args:
        request: Feedback request with technical analysis and metadata

    Returns:
        LLM-generated feedback with recommendations and simplified view

    Raises:
        HTTPException: If feedback generation fails
    """
    try:
        logger.info(f"Received feedback request for {request.exercise_type} exercise")

        # Validate request
        if not request.technical_analysis:
            raise InvalidRequestException("Technical analysis is required")

        if request.exercise_type not in ["breathing", "tone", "rhythm", "articulation", "flexibility", "expression"]:
            raise InvalidRequestException(f"Invalid exercise type: {request.exercise_type}")

        if request.skill_level not in ["beginner", "intermediate", "advanced"]:
            raise InvalidRequestException(f"Invalid skill level: {request.skill_level}")

        # Generate feedback
        response = await llm_service.generate_feedback(request)

        logger.info("Feedback generated successfully")
        return response

    except InvalidRequestException as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except (GroqAPIException, FeedbackGenerationException) as e:
        logger.error(f"Feedback generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate feedback: {str(e)}")

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/feedback/ask-question", response_model=QuestionResponse)
async def ask_question(request: QuestionRequest):
    """
    Answer a user question about trumpet technique.

    Args:
        request: Question request with question text and optional context

    Returns:
        Answer to the user's question

    Raises:
        HTTPException: If question answering fails
    """
    try:
        logger.info(f"Received question: {request.question[:50]}...")

        # Validate request
        if not request.question or len(request.question.strip()) == 0:
            raise InvalidRequestException("Question is required")

        # Answer question
        response = await llm_service.answer_question(request)

        logger.info("Question answered successfully")
        return response

    except InvalidRequestException as e:
        logger.error(f"Invalid request: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except GroqAPIException as e:
        logger.error(f"Question answering failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=True
    )
