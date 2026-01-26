import { Difficulty } from '../entities/enums';

export interface StartSessionRequest {
  songId: number;
  difficulty: Difficulty;
}

export interface StartSessionResponse {
  sessionId: number;
  song: {
    id: number;
    title: string;
    composer: string | null;
    artist: string | null;
    genre: string;
    tempo: number | null;
    keySignature: string | null;
    timeSignature: string | null;
    durationSeconds: number | null;
  };
  difficulty: Difficulty;
  startedAt: Date;
  message: string;
}

export interface UploadRecordingRequest {
  sessionId: number;
}

export interface PerformanceSubmitRequest {
  sessionId: number;
  pitchAccuracy?: number;
  rhythmAccuracy?: number;
  totalScore?: number;
  durationSeconds?: number;
}

export interface PerformanceSubmitResponse {
  message: string;
  sessionId: number;
  totalScore: number | null;
  pitchAccuracy: number | null;
  rhythmAccuracy: number | null;
  completedAt: Date | null;
  detailedMetrics?: any;
  recommendations?: string[];
}

export interface SessionResponse {
  id: number;
  userId: number;
  songId: number;
  songTitle?: string;
  songComposer?: string;
  difficulty: Difficulty;
  pitchAccuracy: number | null;
  rhythmAccuracy: number | null;
  totalScore: number | null;
  completed: boolean;
  durationSeconds: number | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface SessionDetailResponse extends SessionResponse {
  song: {
    id: number;
    title: string;
    composer: string | null;
    artist: string | null;
    genre: string;
    tempo: number | null;
  } | null;
}

export interface SessionStatsResponse {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  averagePitchAccuracy: number;
  averageRhythmAccuracy: number;
  totalPracticeTimeMinutes: number;
}

export interface AudioAnalysisResult {
  pitchAccuracy: number;
  rhythmAccuracy: number;
  totalScore: number;
  durationSeconds?: number;
  detailedMetrics: any;
  recommendations: string[];
  trumpetDetected: boolean;
  confidence: number;
}
