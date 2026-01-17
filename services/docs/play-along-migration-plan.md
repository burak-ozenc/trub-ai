# Play-Along Feature Migration Plan

## Overview

The Play-Along feature allows users to practice trumpet with backing tracks while the system analyzes their performance in real-time, providing feedback on pitch accuracy, rhythm accuracy, and overall performance.

---

## 1. Feature Components (from Legacy Code)

### 1.1 Database Models
- **Song Model** (`legacy/trub-ai-backend/app/database/models.py`)
  - Song metadata (title, composer, artist, genre)
  - MIDI files for 3 difficulty levels (beginner, intermediate, advanced)
  - Sheet music PDFs for 3 difficulty levels
  - Backing track audio files (WAV)
  - Musical properties (tempo, key, time signature, duration)

- **PlayAlongSession Model**
  - User ID and Song ID references
  - Difficulty level selection
  - Performance metrics: pitch_accuracy, rhythm_accuracy, total_score (0-100 scale)
  - Session state: completed flag, duration
  - Optional recording file path
  - Timestamps (started_at, completed_at)

### 1.2 API Endpoints (`legacy/trub-ai-backend/app/api/endpoints/play_along.py`)
- `POST /play-along/start` - Start new session, returns song details
- `POST /play-along/submit-performance` - Submit performance scores
- `GET /play-along/sessions` - List user's session history
- `GET /play-along/sessions/{id}` - Get specific session details
- `GET /play-along/stats` - Get aggregate statistics
- `DELETE /play-along/sessions/{id}` - Delete session

### 1.3 Audio Analysis Components
- **AudioProcessorService** (`legacy/trub-ai-backend/app/services/audio_processor.py`)
  - Orchestrates multiple analyzers
  - Trumpet detection validation
  - Returns comprehensive audio analysis results

- **Analyzers** (in `legacy/trub-ai-backend/app/analyzers/`)
  - `BreathControlAnalyzer` - Breath intervals and consistency
  - `ToneAnalyzer` - Harmonic ratio and tone quality
  - `RhythmAnalyzer` - Tempo, timing, beat strength
  - `ExpressionAnalyzer` - Dynamic range and expression
  - `FlexibilityAnalyzer` - Transition smoothness
  - `TrumpetDetector` - Validates audio is actually trumpet

- **Audio Utilities** (`legacy/trub-ai-backend/app/utils/audio_utils.py`)
  - AudioPreprocessor class
  - Bandpass filtering for trumpet frequency range (165-1400 Hz)
  - Noise reduction using spectral subtraction
  - Signal enhancement using harmonic/percussive separation

### 1.4 CRUD Operations (`legacy/trub-ai-backend/app/database/crud.py`)
- `create_play_along_session()`
- `complete_play_along_session()`
- `get_user_play_along_sessions()`
- `get_play_along_session_by_id()`
- Song CRUD operations

---

## 2. Architecture Distribution

### 2.1 Frontend (React + TypeScript)

**Responsibilities:**
- User interface for play-along feature
- Audio recording from user's microphone
- Playing backing track audio
- Visual feedback during practice
- Display performance results

**Components to Build:**

1. **SongBrowser Component**
   - Browse songs by genre/difficulty
   - Display song metadata (title, composer, tempo, key)
   - Filter and search functionality
   - Song selection interface

2. **PlayAlongPlayer Component**
   - Audio player for backing track
   - Synchronized metronome/click track
   - Visual beat indicator
   - Play/pause/stop controls
   - Volume controls

3. **RecordingController Component**
   - Microphone access management
   - Real-time audio recording using Web Audio API
   - Recording state management (ready, recording, processing)
   - Audio buffer handling
   - Upload recorded audio to backend

4. **SheetMusicViewer Component** (Optional Phase 2)
   - Display PDF sheet music
   - Auto-scroll synchronized with playback
   - Zoom controls

5. **PerformanceFeedback Component**
   - Display pitch accuracy score (0-100)
   - Display rhythm accuracy score (0-100)
   - Display total score (0-100)
   - Visual charts/graphs of performance
   - Breakdown by musical section
   - Recommendations for improvement

6. **SessionHistory Component**
   - List past play-along sessions
   - Filter by song, date, score
   - View session details
   - Delete sessions

7. **PlayAlongStats Component**
   - Aggregate statistics (average scores, total time)
   - Progress charts over time
   - Best performances

**State Management:**
- Current song selection
- Session state (idle, playing, recording, analyzing, completed)
- Audio playback state
- Recording data
- Performance results
- User settings (volume, metronome on/off)

**API Calls (to Node.js Backend):**
- `GET /api/songs` - Fetch song catalog
- `GET /api/songs/:id` - Get song details
- `GET /api/songs/:id/audio/:difficulty` - Stream backing track
- `POST /api/play-along/start` - Start new session
- `POST /api/play-along/upload-recording` - Upload user's recording
- `GET /api/play-along/sessions` - Get session history
- `GET /api/play-along/sessions/:id` - Get session details
- `GET /api/play-along/stats` - Get aggregate stats
- `DELETE /api/play-along/sessions/:id` - Delete session

**Libraries Needed:**
- `react-h5-audio-player` or custom Web Audio API player
- `react-pdf` or `pdfjs` for sheet music display
- `recharts` or `chart.js` for performance visualizations
- `axios` for API calls (already installed)

---

### 2.2 Backend (Node.js + Express + TypeORM)

**Responsibilities:**
- API gateway and request orchestration
- Session management and persistence
- Song catalog management
- File management (audio files, sheet music)
- Authentication/authorization
- Proxy requests to Python audio service
- Return formatted results to frontend

**Components to Build:**

1. **Song Routes** (`services/backend/src/routes/song.routes.ts`)
   - GET `/api/songs` - List all songs
   - GET `/api/songs/:id` - Get song details
   - GET `/api/songs/:id/audio/:difficulty` - Stream backing track file
   - GET `/api/songs/:id/sheet-music/:difficulty` - Serve PDF
   - POST `/api/songs` - Admin: Create song
   - PUT `/api/songs/:id` - Admin: Update song
   - DELETE `/api/songs/:id` - Admin: Delete song

2. **PlayAlong Routes** (`services/backend/src/routes/play-along.routes.ts`)
   - POST `/api/play-along/start` - Start session
   - POST `/api/play-along/upload-recording` - Upload user recording
   - GET `/api/play-along/sessions` - List sessions
   - GET `/api/play-along/sessions/:id` - Get session
   - GET `/api/play-along/stats` - Get user stats
   - DELETE `/api/play-along/sessions/:id` - Delete session

3. **Song Controller** (`services/backend/src/controllers/song.controller.ts`)
   - Song CRUD operations
   - File serving logic
   - Validation

4. **PlayAlong Controller** (`services/backend/src/controllers/play-along.controller.ts`)
   - Session creation
   - Handle recording upload
   - Call audio-service for analysis
   - Update session with results
   - Return formatted response

5. **Song Service** (`services/backend/src/services/song.service.ts`)
   - Business logic for song management
   - File path resolution
   - Database queries via TypeORM

6. **PlayAlong Service** (`services/backend/src/services/play-along.service.ts`)
   - Session management logic
   - Audio service integration
   - Statistics calculation
   - Performance scoring

7. **Audio Service Client** (`services/backend/src/clients/audio-service.client.ts`)
   - HTTP client to communicate with Python audio-service
   - Send audio file for analysis
   - Parse analysis results
   - Error handling

**Database Operations:**
- Use existing `PlayAlongSession` entity (already created)
- Use existing `Song` entity (already created)
- CRUD methods via TypeORM repositories

**File Storage:**
- Store songs in `data/songs/` directory
- Structure: `data/songs/{song-id}/`
  - `beginner.mid`, `intermediate.mid`, `advanced.mid`
  - `beginner.pdf`, `intermediate.pdf`, `advanced.pdf`
  - `backing-track.wav`
- Store user recordings in `data/recordings/` directory
- Structure: `data/recordings/{user-id}/{session-id}.wav`

**Middleware:**
- JWT authentication (already exists)
- File upload middleware (multer)
- Error handling

---

### 2.3 Audio Service (Python + FastAPI)

**Responsibilities:**
- Receive audio recording from backend
- Perform comprehensive audio analysis
- Calculate pitch accuracy
- Calculate rhythm accuracy
- Generate total score
- Return detailed analysis results

**Components to Migrate/Create:**

1. **Play-Along Endpoint** (`services/audio-service/routers/play_along.py`)
   - POST `/api/analyze-performance` - Analyze user recording
   - Accepts: audio file + reference song metadata (tempo, key, difficulty)
   - Returns: pitch_accuracy, rhythm_accuracy, total_score, detailed_metrics

2. **AudioProcessorService** (MIGRATE AS-IS)
   - Copy from `legacy/trub-ai-backend/app/services/audio_processor.py`
   - Keep all existing analysis logic
   - **DO NOT MODIFY** the core algorithms

3. **All Analyzers** (MIGRATE AS-IS)
   - Copy entire `legacy/trub-ai-backend/app/analyzers/` directory
   - Preserve all existing logic:
     - `breath_analyzer.py`
     - `tone_analyzer.py`
     - `rhythm_analyzer.py`
     - `expression_analyzer.py`
     - `flexibility_analyzer.py`
     - `trumpet_detector.py`

4. **Audio Utilities** (MIGRATE AS-IS)
   - Copy `legacy/trub-ai-backend/app/utils/audio_utils.py`
   - Copy `legacy/trub-ai-backend/app/utils/signal_processing.py`
   - AudioPreprocessor class
   - All filtering and noise reduction logic

5. **Performance Scoring Logic** (NEW)
   - `services/audio-service/utils/scoring.py`
   - Calculate pitch_accuracy from tone analysis
   - Calculate rhythm_accuracy from rhythm analysis
   - Combine metrics into total_score
   - Weight factors based on difficulty level
   - Return 0-100 scores

6. **MIDI Reference Processor** (NEW - Optional for Phase 2)
   - Parse MIDI file for reference notes
   - Extract expected pitch sequence
   - Extract expected rhythm pattern
   - Compare user performance against reference

**Dependencies:**
- librosa (audio analysis)
- numpy, scipy (signal processing)
- noisereduce (noise reduction)
- fastapi, uvicorn (API)
- python-multipart (file upload)
- pydub (audio format conversion)

**Response Format:**
```json
{
  "pitch_accuracy": 85.5,
  "rhythm_accuracy": 78.2,
  "total_score": 81.9,
  "detailed_metrics": {
    "breath_control": { ... },
    "tone_quality": { ... },
    "rhythm_timing": { ... },
    "expression": { ... },
    "flexibility": { ... }
  },
  "recommendations": [
    "Focus on breath support for longer phrases",
    "Work on timing consistency in measures 12-16"
  ]
}
```

---

## 3. Data Flow

### 3.1 Session Start Flow
```
1. User selects song + difficulty in Frontend
   ↓
2. Frontend → Backend: POST /api/play-along/start
   ↓
3. Backend creates PlayAlongSession in DB
   ↓
4. Backend retrieves Song data from DB
   ↓
5. Backend → Frontend: Returns session_id + song details
   ↓
6. Frontend loads backing track audio file
```

### 3.2 Performance Recording & Analysis Flow
```
1. Frontend plays backing track
   ↓
2. Frontend records user audio via microphone (Web Audio API)
   ↓
3. User completes performance
   ↓
4. Frontend → Backend: POST /api/play-along/upload-recording
   - multipart/form-data with audio file
   - session_id in request body
   ↓
5. Backend saves recording to disk
   ↓
6. Backend → Audio Service: POST /api/analyze-performance
   - audio file
   - song metadata (tempo, key, difficulty)
   ↓
7. Audio Service:
   - Loads audio file
   - Preprocesses (filter, denoise)
   - Runs all analyzers
   - Calculates pitch_accuracy, rhythm_accuracy, total_score
   ↓
8. Audio Service → Backend: Returns analysis results
   ↓
9. Backend updates PlayAlongSession in DB:
   - pitch_accuracy
   - rhythm_accuracy
   - total_score
   - completed = true
   - completed_at = now()
   - duration_seconds
   ↓
10. Backend → Frontend: Returns performance results
    ↓
11. Frontend displays results in PerformanceFeedback component
```

### 3.3 Session History Flow
```
1. Frontend → Backend: GET /api/play-along/sessions
   ↓
2. Backend queries PlayAlongSession + Song tables (JOIN)
   ↓
3. Backend → Frontend: Returns array of sessions with song details
   ↓
4. Frontend displays in SessionHistory component
```

---

## 4. API Endpoints Specification

### 4.1 Backend Endpoints (Node.js)

#### **Songs**

**GET /api/songs**
- Query params: `?genre=classical&difficulty=beginner`
- Returns: Array of songs
```json
[
  {
    "id": 1,
    "title": "Amazing Grace",
    "composer": "Traditional",
    "genre": "folk",
    "tempo": 80,
    "key_signature": "G major",
    "time_signature": "3/4",
    "has_beginner": true,
    "has_intermediate": true,
    "has_advanced": false
  }
]
```

**GET /api/songs/:id**
- Returns: Song details
```json
{
  "id": 1,
  "title": "Amazing Grace",
  "composer": "Traditional",
  "artist": null,
  "genre": "folk",
  "tempo": 80,
  "key_signature": "G major",
  "time_signature": "3/4",
  "duration_seconds": 120,
  "available_difficulties": ["beginner", "intermediate"]
}
```

**GET /api/songs/:id/audio/:difficulty**
- Params: difficulty = "beginner" | "intermediate" | "advanced"
- Returns: Audio file stream (WAV)
- Content-Type: audio/wav

**GET /api/songs/:id/sheet-music/:difficulty**
- Returns: PDF file stream
- Content-Type: application/pdf

#### **Play-Along**

**POST /api/play-along/start**
- Body:
```json
{
  "song_id": 1,
  "difficulty": "beginner"
}
```
- Returns:
```json
{
  "session_id": 123,
  "song": {
    "id": 1,
    "title": "Amazing Grace",
    "tempo": 80,
    "key_signature": "G major",
    "duration_seconds": 120
  },
  "difficulty": "beginner",
  "started_at": "2024-01-17T12:00:00Z"
}
```

**POST /api/play-along/upload-recording**
- Content-Type: multipart/form-data
- Body:
  - `session_id`: number
  - `audio`: File (WAV/MP3)
- Returns:
```json
{
  "session_id": 123,
  "pitch_accuracy": 85.5,
  "rhythm_accuracy": 78.2,
  "total_score": 81.9,
  "detailed_metrics": { ... },
  "recommendations": ["..."],
  "completed_at": "2024-01-17T12:05:00Z"
}
```

**GET /api/play-along/sessions**
- Query params: `?skip=0&limit=50&completed_only=true`
- Returns: Array of sessions
```json
[
  {
    "id": 123,
    "song_id": 1,
    "song_title": "Amazing Grace",
    "difficulty": "beginner",
    "pitch_accuracy": 85.5,
    "rhythm_accuracy": 78.2,
    "total_score": 81.9,
    "completed": true,
    "started_at": "2024-01-17T12:00:00Z",
    "completed_at": "2024-01-17T12:05:00Z"
  }
]
```

**GET /api/play-along/sessions/:id**
- Returns: Session details with song info

**GET /api/play-along/stats**
- Returns:
```json
{
  "total_sessions": 45,
  "completed_sessions": 42,
  "average_score": 78.5,
  "average_pitch_accuracy": 82.1,
  "average_rhythm_accuracy": 75.3,
  "total_practice_time_minutes": 240
}
```

**DELETE /api/play-along/sessions/:id**
- Returns: Success message

---

### 4.2 Audio Service Endpoints (Python)

**POST /api/analyze-performance**
- Content-Type: multipart/form-data
- Body:
  - `audio`: File (WAV/MP3)
  - `tempo`: number (optional reference)
  - `key_signature`: string (optional reference)
  - `difficulty`: string
- Returns:
```json
{
  "pitch_accuracy": 85.5,
  "rhythm_accuracy": 78.2,
  "total_score": 81.9,
  "detailed_metrics": {
    "breath_control": {
      "average_breath_length": 4.2,
      "breath_consistency": 0.85,
      "breath_count": 12
    },
    "tone_quality": {
      "harmonic_ratio": 0.78,
      "quality_score": 82,
      "recommendations": ["..."]
    },
    "rhythm_timing": {
      "tempo": 78,
      "consistency": 0.88,
      "timing_deviation": 0.05
    },
    "expression": {
      "dynamic_range": 15.2,
      "expression_level": 0.72
    },
    "flexibility": {
      "transition_smoothness": 0.81
    }
  },
  "recommendations": [
    "Improve breath support consistency",
    "Focus on rhythm timing in faster sections"
  ],
  "trumpet_detected": true,
  "confidence": 0.92
}
```

---

## 5. Migration Phases

### Phase 1: Backend Infrastructure (Week 1)
- [ ] Create Song entity (already exists)
- [ ] Create Song routes and controller
- [ ] Implement song CRUD operations
- [ ] Add file serving for audio and PDFs
- [ ] Create PlayAlong routes and controller
- [ ] Implement session management
- [ ] Add audio upload handling (multer)
- [ ] Create audio service client

### Phase 2: Audio Service Migration (Week 1-2)
- [ ] Copy all analyzer files from legacy
- [ ] Copy audio utilities
- [ ] Create play-along endpoint
- [ ] Implement performance analysis endpoint
- [ ] Create scoring logic
- [ ] Test with sample audio files
- [ ] Verify results match legacy system

### Phase 3: Frontend Core (Week 2-3)
- [ ] Create SongBrowser component
- [ ] Implement song selection UI
- [ ] Create PlayAlongPlayer component
- [ ] Implement audio playback
- [ ] Create RecordingController component
- [ ] Implement microphone recording
- [ ] Create PerformanceFeedback component
- [ ] Display analysis results

### Phase 4: Integration & Testing (Week 3)
- [ ] End-to-end testing of complete flow
- [ ] Test with real trumpet recordings
- [ ] Verify accuracy scores
- [ ] Performance optimization
- [ ] Error handling improvements

### Phase 5: Advanced Features (Week 4+)
- [ ] SessionHistory component
- [ ] PlayAlongStats component
- [ ] SheetMusicViewer component
- [ ] Real-time visual feedback during practice
- [ ] MIDI comparison (optional)
- [ ] Progress tracking over time

---

## 6. File Structure

```
services/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── song.routes.ts (NEW)
│   │   │   └── play-along.routes.ts (NEW)
│   │   ├── controllers/
│   │   │   ├── song.controller.ts (NEW)
│   │   │   └── play-along.controller.ts (NEW)
│   │   ├── services/
│   │   │   ├── song.service.ts (NEW)
│   │   │   └── play-along.service.ts (NEW)
│   │   ├── clients/
│   │   │   └── audio-service.client.ts (NEW)
│   │   ├── entities/
│   │   │   ├── Song.entity.ts (EXISTS)
│   │   │   └── PlayAlongSession.entity.ts (EXISTS)
│   │   └── types/
│   │       └── play-along.types.ts (NEW)
│   └── data/
│       ├── songs/ (NEW - song files)
│       └── recordings/ (NEW - user recordings)
│
├── audio-service/
│   ├── routers/
│   │   └── play_along.py (NEW)
│   ├── services/
│   │   └── audio_processor.py (MIGRATE from legacy)
│   ├── analyzers/ (MIGRATE entire directory)
│   │   ├── breath_analyzer.py
│   │   ├── tone_analyzer.py
│   │   ├── rhythm_analyzer.py
│   │   ├── expression_analyzer.py
│   │   ├── flexibility_analyzer.py
│   │   └── trumpet_detector.py
│   ├── utils/
│   │   ├── audio_utils.py (MIGRATE)
│   │   ├── signal_processing.py (MIGRATE)
│   │   └── scoring.py (NEW)
│   └── models/
│       └── analysis_models.py (MIGRATE from legacy core/models.py)
│
└── frontend/
    └── src/
        ├── pages/
        │   └── PlayAlong.tsx (NEW)
        ├── components/
        │   └── play-along/
        │       ├── SongBrowser.tsx (NEW)
        │       ├── PlayAlongPlayer.tsx (NEW)
        │       ├── RecordingController.tsx (NEW)
        │       ├── PerformanceFeedback.tsx (NEW)
        │       ├── SessionHistory.tsx (NEW)
        │       └── PlayAlongStats.tsx (NEW)
        ├── services/
        │   └── play-along.service.ts (NEW)
        └── types/
            └── play-along.types.ts (NEW)
```

---

## 7. Critical Migration Rules

### ✅ DO:
1. **Preserve all audio analysis algorithms** from legacy
2. Copy analyzer files AS-IS without modification
3. Use existing TypeORM entities (already created)
4. Follow existing code patterns in services/
5. Implement proper error handling
6. Add logging for debugging
7. Test with real trumpet audio files

### ❌ DON'T:
1. **Don't modify core audio analysis logic** - it's battle-tested
2. Don't skip trumpet detection validation
3. Don't hardcode file paths
4. Don't skip authentication middleware
5. Don't over-engineer - keep it simple
6. Don't skip test files from legacy

---

## 8. Testing Strategy

### Backend Tests
- Song CRUD operations
- Session creation and completion
- File serving (audio, PDFs)
- Audio service client
- Error scenarios

### Audio Service Tests
- Analyzer functionality
- Scoring calculations
- File format handling
- Performance under load

### Frontend Tests
- Component rendering
- Audio recording
- API integration
- User flow testing

### Integration Tests
- Complete play-along session flow
- Real audio file analysis
- Score accuracy validation
- Error handling

---

## 9. Questions to Resolve

1. **Song Catalog**: Do we need an admin interface to upload songs, or will songs be added manually to the database and file system?

2. **Real-time Feedback**: Should the frontend provide real-time visual feedback while the user is playing (like a tuner), or only after they finish?

3. **MIDI Analysis**: Should we implement MIDI-based comparison in Phase 1, or is simple audio analysis sufficient initially?

4. **Recording Format**: What audio format should the frontend record in? (WAV is highest quality but large, MP3 is compressed)

5. **File Storage**: Should we use cloud storage (S3, GCS) for song files and recordings, or local filesystem is fine?

6. **Metronome**: Should the backing track include a metronome/click track, or should we generate it separately?

7. **Sheet Music**: Is sheet music display a Phase 1 requirement, or can it be deferred to Phase 2?

---

## 10. Dependencies to Add

### Backend
```json
"multer": "^2.0.0",  // File upload handling
"axios": "^1.6.0"    // HTTP client for audio service (already installed)
```

### Audio Service
```txt
librosa>=0.10.0
numpy>=1.24.0
scipy>=1.10.0
noisereduce>=2.0.0
python-multipart>=0.0.6
pydub>=0.25.0
```

### Frontend
```json
"react-pdf": "^7.5.0",           // PDF viewer (optional Phase 2)
"recharts": "^2.10.0",           // Charts for stats
"wavesurfer.js": "^7.4.0"        // Audio waveform visualization (optional)
```

---

## 11. Success Criteria

- [ ] User can browse song catalog
- [ ] User can start play-along session
- [ ] User can hear backing track
- [ ] User can record their performance
- [ ] System analyzes recording and returns scores
- [ ] Pitch accuracy score is within ±5% of legacy system
- [ ] Rhythm accuracy score is within ±5% of legacy system
- [ ] User can view session history
- [ ] User can view aggregate statistics
- [ ] All audio analysis algorithms work identically to legacy
- [ ] End-to-end flow completes in <30 seconds

---

**Next Step**: Review this plan, answer open questions, then begin Phase 1 implementation.
