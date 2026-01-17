"""
TRUB.AI v2 - Audio Service
FastAPI microservice for audio processing and analysis
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import tempfile
import shutil
from datetime import datetime
from typing import Optional

from app.config import settings
from app.services.audio_processor import AudioProcessorService
from app.core.models import (
    AnalysisType,
    AudioAnalysisResponse,
    AudioAnalysisRequest
)
from app.core.exceptions import AudioProcessingError, AnalysisError

# Initialize FastAPI app
app = FastAPI(
    title="TRUB.AI Audio Service",
    description="Microservice for trumpet audio analysis",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize audio processor service
audio_processor = AudioProcessorService()


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "TRUB.AI Audio Service",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyze": "/api/analyze",
            "info": "/api/info"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "audio-service",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.LOG_LEVEL
    }


@app.post("/api/analyze")
async def analyze_audio(
    file: UploadFile = File(...),
    analysis_type: Optional[str] = Form("full")
):
    """
    Analyze uploaded audio file for trumpet performance

    Args:
        file: Audio file (WAV, MP3, FLAC, OGG)
        analysis_type: Type of analysis (full, breath, tone, rhythm, expression, flexibility)

    Returns:
        AudioAnalysisResponse with trumpet detection and analysis results
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith('audio/'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an audio file."
        )

    # Validate file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE / 1_000_000}MB."
        )

    # Parse analysis type
    try:
        analysis_type_enum = AnalysisType(analysis_type.lower())
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid analysis type. Must be one of: {', '.join([t.value for t in AnalysisType])}"
        )

    # Create temporary file to process
    temp_file_path = None
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_file_path = temp_file.name

        # Process audio
        analysis_result, trumpet_detection = audio_processor.analyze_audio(
            temp_file_path,
            analysis_type_enum
        )

        # Prepare response
        if trumpet_detection.is_trumpet:
            return AudioAnalysisResponse(
                status="success",
                trumpet_detection=trumpet_detection,
                analysis=analysis_result,
                message="Audio analyzed successfully"
            )
        else:
            return AudioAnalysisResponse(
                status="warning",
                trumpet_detection=trumpet_detection,
                analysis=None,
                message=trumpet_detection.warning_message or "Trumpet not detected in audio"
            )

    except AudioProcessingError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Audio processing error: {str(e)}"
        )
    except AnalysisError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


@app.get("/api/info")
async def service_info():
    """Get audio service information"""
    return {
        "service": "TRUB.AI Audio Service",
        "version": "2.0.0",
        "capabilities": [
            "Trumpet detection using acoustic analysis",
            "Breath control analysis",
            "Tone quality analysis",
            "Rhythm and timing analysis",
            "Musical expression analysis",
            "Note transition flexibility analysis"
        ],
        "supported_formats": [
            "WAV",
            "MP3",
            "FLAC",
            "OGG"
        ],
        "analysis_types": [t.value for t in AnalysisType],
        "libraries": {
            "librosa": "Latest",
            "numpy": "Latest",
            "scipy": "Latest",
            "noisereduce": "Latest"
        },
        "trumpet_detection": {
            "method": "Rule-based acoustic feature analysis",
            "features_analyzed": [
                "Harmonic content",
                "Spectral characteristics",
                "Pitch analysis",
                "Attack characteristics",
                "Musical content discrimination"
            ]
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level=settings.LOG_LEVEL.lower()
    )
