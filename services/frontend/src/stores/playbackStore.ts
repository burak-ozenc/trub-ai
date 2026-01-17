import { create } from 'zustand';
import type {
  PlayMode,
  ExpectedNote,
  DetectedPitch,
  NoteValidation,
  SessionStats
} from '../types/sheet-music.types';

interface PlaybackState {
  // Playback control
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  tempo: number;

  // Session info
  sessionId: number | null;
  songId: number | null;
  difficulty: string | null;
  playMode: PlayMode;

  // Current note tracking
  currentNoteIndex: number;
  expectedNote: ExpectedNote | null;
  noteStartTime: number | null;
  totalNotes: number;

  // Detected pitch
  detectedPitch: DetectedPitch;

  // Validation results
  currentNoteResult: NoteValidation | null;
  noteResults: NoteValidation[];

  // Session stats
  sessionStats: SessionStats;

  // Actions
  initializePlayback: (config: {
    sessionId: number;
    songId: number;
    difficulty: string;
    duration: number;
    totalNotes: number;
  }) => void;
  setPlaying: (playing: boolean) => void;
  updateCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setTempo: (tempo: number) => void;
  togglePlayMode: () => void;
  setCurrentNoteIndex: (index: number) => void;
  setExpectedNote: (note: ExpectedNote | null) => void;
  setNoteStartTime: (time: number | null) => void;
  updateDetectedPitch: (pitch: DetectedPitch) => void;
  setCurrentNoteResult: (result: NoteValidation | null) => void;
  addNoteResult: (result: NoteValidation) => void;
  advanceToNextNote: () => void;
  resetPlayback: () => void;
}

const defaultDetectedPitch: DetectedPitch = {
  note: null,
  octave: null,
  frequency: null,
  cents: null,
  isDetecting: false,
  audioLevel: 0
};

const defaultStats: SessionStats = {
  correctNotes: 0,
  closeNotes: 0,
  wrongNotes: 0,
  silentNotes: 0,
  pitchAccuracy: 0,
  durationAccuracy: 0,
  overallAccuracy: 0,
  totalNotes: 0
};

const calculateStats = (results: NoteValidation[], totalNotes: number): SessionStats => {
  const correctNotes = results.filter(r => r.result === 'correct').length;
  const closeNotes = results.filter(r => r.result === 'close').length;
  const wrongNotes = results.filter(r => r.result === 'wrong').length;
  const silentNotes = results.filter(r => r.result === 'silent').length;

  const playedNotes = results.length;
  const pitchAccuracy = playedNotes > 0
    ? Math.round(((correctNotes + closeNotes * 0.5) / playedNotes) * 100)
    : 0;

  const avgAccuracy = playedNotes > 0
    ? results.reduce((sum, r) => sum + (r.accuracy || 0), 0) / playedNotes
    : 0;

  return {
    correctNotes,
    closeNotes,
    wrongNotes,
    silentNotes,
    pitchAccuracy,
    durationAccuracy: Math.round(avgAccuracy),
    overallAccuracy: Math.round((pitchAccuracy + avgAccuracy) / 2),
    totalNotes
  };
};

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  // Initial state
  isPlaying: false,
  isPaused: false,
  currentTime: 0,
  duration: 0,
  tempo: 100,

  sessionId: null,
  songId: null,
  difficulty: null,
  playMode: 'flow',

  currentNoteIndex: -1,
  expectedNote: null,
  noteStartTime: null,
  totalNotes: 0,

  detectedPitch: defaultDetectedPitch,
  currentNoteResult: null,
  noteResults: [],
  sessionStats: defaultStats,

  // Actions
  initializePlayback: (config) => {
    console.log('📊 Initializing playback:', config);
    set({
      sessionId: config.sessionId,
      songId: config.songId,
      difficulty: config.difficulty,
      duration: config.duration,
      totalNotes: config.totalNotes,
      currentNoteIndex: -1,
      noteResults: [],
      currentTime: 0,
      isPlaying: false,
      sessionStats: { ...defaultStats, totalNotes: config.totalNotes }
    });
  },

  setPlaying: (playing) => {
    console.log(playing ? '▶️ Playing' : '⏸️ Paused');
    set({ isPlaying: playing, isPaused: !playing });
  },

  updateCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setDuration: (duration) => {
    set({ duration });
  },

  setTempo: (tempo) => {
    console.log('🎵 Tempo changed:', tempo);
    set({ tempo });
  },

  togglePlayMode: () => {
    const current = get().playMode;
    const newMode = current === 'flow' ? 'wait' : 'flow';
    console.log('🔄 Mode changed:', current, '→', newMode);
    set({ playMode: newMode });
  },

  setCurrentNoteIndex: (index) => {
    const prev = get().currentNoteIndex;
    if (prev !== index) {
      console.log('🎯 Note index changed:', prev, '→', index);
      set({ currentNoteIndex: index });
    }
  },

  setExpectedNote: (note) => {
    set({ expectedNote: note });
  },

  setNoteStartTime: (time) => {
    set({ noteStartTime: time });
  },

  updateDetectedPitch: (pitch) => {
    set({ detectedPitch: pitch });
  },

  setCurrentNoteResult: (result) => {
    set({ currentNoteResult: result });
  },

  addNoteResult: (result) => {
    set((state) => {
      // Avoid duplicates
      const existingIndex = state.noteResults.findIndex(r => r.index === result.index);
      let newResults;

      if (existingIndex >= 0) {
        newResults = [...state.noteResults];
        newResults[existingIndex] = result;
      } else {
        newResults = [...state.noteResults, result];
      }

      const newStats = calculateStats(newResults, state.totalNotes);

      console.log('💾 Note result saved:', result.index, result.result);

      return {
        noteResults: newResults,
        sessionStats: newStats
      };
    });
  },

  advanceToNextNote: () => {
    const { currentNoteIndex, totalNotes } = get();
    const nextIndex = currentNoteIndex + 1;

    if (nextIndex < totalNotes) {
      console.log('➡️ Advancing to next note:', nextIndex);
      set({
        currentNoteIndex: nextIndex,
        noteStartTime: null,
        currentNoteResult: null
      });
    } else {
      console.log('🏁 Reached end of song');
      set({ isPlaying: false });
    }
  },

  resetPlayback: () => {
    console.log('🔄 Resetting playback');
    set({
      isPlaying: false,
      isPaused: false,
      currentTime: 0,
      currentNoteIndex: -1,
      expectedNote: null,
      noteStartTime: null,
      detectedPitch: defaultDetectedPitch,
      currentNoteResult: null,
      noteResults: [],
      sessionStats: defaultStats
    });
  }
}));
