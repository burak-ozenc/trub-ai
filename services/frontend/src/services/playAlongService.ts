import api from './api';
import type { Difficulty } from '../types/sheet-music.types';

export interface Song {
  id: number;
  title: string;
  composer: string | null;
  artist: string | null;
  genre: string;
  tempo: number | null;
  keySignature: string | null;
  timeSignature: string | null;
  durationSeconds: number | null;
  hasBeginner: boolean;
  hasIntermediate: boolean;
  hasAdvanced: boolean;
  isPublicDomain: boolean;
  isActive: boolean;
  availableDifficulties?: Difficulty[];
  beginnerMidiPath?: string;
  intermediateMidiPath?: string;
  advancedMidiPath?: string;
  backingTrackPath?: string;
}

export interface PlayAlongSession {
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
  startedAt: string;
  message: string;
}

export interface SessionSummary {
  id: number;
  songTitle: string;
  difficulty: Difficulty;
  pitchAccuracy: number | null;
  rhythmAccuracy: number | null;
  totalScore: number | null;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
}

export interface SessionStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  averagePitchAccuracy: number;
  averageRhythmAccuracy: number;
  totalPracticeTimeMinutes: number;
}

/**
 * Get all songs
 */
export const getSongs = async (): Promise<Song[]> => {
  const response = await api.get('/songs');
  return response.data;
};

/**
 * Get song details by ID
 */
export const getSongDetails = async (songId: number): Promise<Song> => {
  const response = await api.get(`/songs/${songId}`);
  return response.data;
};

/**
 * Get MIDI file as blob
 */
export const getSongMidi = async (songId: number, difficulty: Difficulty): Promise<Blob> => {
  const response = await api.get(`/songs/${songId}/midi/${difficulty}`, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Get backing track as blob
 */
export const getSongBackingTrack = async (songId: number): Promise<Blob> => {
  const response = await api.get(`/songs/${songId}/audio/beginner`, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Get sheet music as blob
 */
export const getSongSheetMusic = async (songId: number, difficulty: Difficulty): Promise<Blob> => {
  const response = await api.get(`/songs/${songId}/sheet-music/${difficulty}`, {
    responseType: 'blob'
  });
  return response.data;
};

/**
 * Start a new play-along session
 */
export const startPlayAlongSession = async (
  songId: number,
  difficulty: Difficulty
): Promise<PlayAlongSession> => {
  const response = await api.post('/play-along/start', {
    songId,
    difficulty
  });
  return response.data;
};

/**
 * Get user's play-along sessions
 */
export const getSessions = async (): Promise<SessionSummary[]> => {
  const response = await api.get('/play-along/sessions');
  return response.data;
};

/**
 * Get a specific session by ID
 */
export const getSessionById = async (sessionId: number): Promise<SessionSummary> => {
  const response = await api.get(`/play-along/sessions/${sessionId}`);
  return response.data;
};

/**
 * Get user's play-along statistics
 */
export const getStats = async (): Promise<SessionStats> => {
  const response = await api.get('/play-along/stats');
  return response.data;
};

/**
 * Submit performance results
 */
export const submitPerformance = async (
  sessionId: number,
  data: {
    pitchAccuracy: number;
    rhythmAccuracy: number;
    totalScore: number;
    durationSeconds: number;
  }
): Promise<void> => {
  await api.post('/play-along/submit-performance', {
    sessionId,
    ...data
  });
};

/**
 * Delete a session
 */
export const deleteSession = async (sessionId: number): Promise<void> => {
  await api.delete(`/play-along/sessions/${sessionId}`);
};

/**
 * Get current user profile
 */
export const getCurrentUser = async (): Promise<any> => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Save recording after PlayAlong session
 */
export const saveRecording = async (
  sessionId: number,
  audioBlob: Blob,
  filename: string,
  duration?: number
): Promise<{ recordingId: number; s3Key: string; createdAt: string }> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  formData.append('sessionId', sessionId.toString());
  if (duration !== undefined) {
    formData.append('duration', duration.toString());
  }

  const response = await api.post('/play-along/save-recording', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

/**
 * Get user's PlayAlong recordings
 */
export const getRecordings = async (): Promise<{
  recordings: any[];
  total: number;
}> => {
  const response = await api.get('/play-along/recordings');
  return response.data;
};

/**
 * Get presigned URL for recording playback
 */
export const getRecordingPlaybackUrl = async (recordingId: number): Promise<string> => {
  const response = await api.get(`/play-along/recordings/${recordingId}/playback-url`);
  return response.data.url;
};

/**
 * Delete a recording
 */
export const deleteRecording = async (recordingId: number): Promise<void> => {
  await api.delete(`/play-along/recordings/${recordingId}`);
};
