/**
 * Sheet Music and MIDI Types for Play-Along Feature
 */

// VexFlow note duration types
export type VexFlowDuration = 'w' | 'h' | 'q' | '8' | '16' | '32' | 'wr' | 'hr' | 'qr' | '8r' | '16r' | '32r';

// Difficulty levels
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// Play modes
export type PlayMode = 'flow' | 'wait';

// Validation result types
export type ValidationResult = 'correct' | 'close' | 'wrong' | 'silent';

/**
 * VexFlow note data structure
 */
export interface VexFlowNote {
  keys: string[];           // e.g., ['c/4', 'e/4', 'g/4']
  duration: VexFlowDuration;
  time: number;             // Start time in seconds (normalized)
  endTime: number;          // End time in seconds
  velocity: number;         // MIDI velocity (0-1)
  name: string;             // Original note name (e.g., 'C4')
  midi: number;             // MIDI note number
  originalDuration: number; // Original duration in seconds
}

/**
 * Expected note format for validation
 */
export interface ExpectedNote {
  pitch: string;            // e.g., 'C4', 'F#5'
  startTime: number;
  endTime: number;
  duration: number;
  index: number;
}

/**
 * MIDI data converted to VexFlow format
 */
export interface VexFlowMidiData {
  notes: VexFlowNote[];
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  keySignature: string;
  totalDuration: number;
}

/**
 * Time signature structure
 */
export interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Note validation result
 */
export interface NoteValidation {
  index: number;
  result: ValidationResult;
  accuracy: number;         // 0-100
  feedback: string;
  progress?: number;        // 0-1 (for wait mode)
  durationHeld?: number;    // Seconds held (for wait mode)
}

/**
 * Detected pitch from tuner
 */
export interface DetectedPitch {
  note: string | null;      // e.g., 'C', 'F#'
  octave: number | null;
  frequency: number | null;
  cents: number | null;
  isDetecting: boolean;
  audioLevel: number;
}

/**
 * Session statistics
 */
export interface SessionStats {
  correctNotes: number;
  closeNotes: number;
  wrongNotes: number;
  silentNotes: number;
  pitchAccuracy: number;    // 0-100
  durationAccuracy: number; // 0-100
  overallAccuracy: number;  // 0-100
  totalNotes: number;
}

/**
 * Sheet music renderer props
 */
export interface SheetMusicRendererProps {
  songId: number;
  difficulty: Difficulty;
  onMidiLoaded?: (notes: VexFlowNote[]) => void;
}

/**
 * Color coding for note states
 */
export const NOTE_COLORS = {
  current: '#FF5500',
  correct: '#10b981',
  close: '#f59e0b',
  wrong: '#ef4444',
  silent: '#9ca3af',
  default: '#000000',
  dimmed: '#00000080'
} as const;

/**
 * Sheet music viewer controls
 */
export interface SheetMusicControls {
  zoom: number;             // 75-150
  autoScroll: boolean;
  tempo: number;            // 50-150 (percentage)
}
