import { create } from 'zustand';
import type { Difficulty } from '../types/sheet-music.types';

export interface Recording {
  id: number;
  filename: string;
  duration: number | null;
  createdAt: string;
  playAlongSessions?: Array<{
    id: number;
    difficulty: Difficulty;
    totalScore: number | null;
    pitchAccuracy: number | null;
    rhythmAccuracy: number | null;
    song?: {
      id: number;
      title: string;
      composer: string | null;
    };
  }>;
}

interface RecordingsState {
  recordings: Recording[];
  isLoading: boolean;
  error: string | null;
  currentPlayingId: number | null;

  // Actions
  fetchRecordings: () => Promise<void>;
  addRecording: (recording: Recording) => void;
  deleteRecording: (id: number) => Promise<void>;
  setCurrentPlaying: (id: number | null) => void;
  clearError: () => void;
}

export const useRecordingsStore = create<RecordingsState>((set, get) => ({
  recordings: [],
  isLoading: false,
  error: null,
  currentPlayingId: null,

  fetchRecordings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { getRecordings } = await import('../services/playAlongService');
      const result = await getRecordings();
      set({ recordings: result.recordings, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch recordings',
        isLoading: false
      });
    }
  },

  addRecording: (recording: Recording) => {
    set((state) => ({
      recordings: [recording, ...state.recordings]
    }));
  },

  deleteRecording: async (id: number) => {
    try {
      const { deleteRecording } = await import('../services/playAlongService');
      await deleteRecording(id);
      set((state) => ({
        recordings: state.recordings.filter((r) => r.id !== id),
        currentPlayingId: state.currentPlayingId === id ? null : state.currentPlayingId
      }));
    } catch (error) {
      console.error('Failed to delete recording:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to delete recording'
      });
      throw error;
    }
  },

  setCurrentPlaying: (id: number | null) => {
    set({ currentPlayingId: id });
  },

  clearError: () => {
    set({ error: null });
  }
}));
