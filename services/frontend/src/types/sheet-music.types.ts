/**
 * Sheet Music and MIDI Types for Play-Along Feature
 * Updated with REST support for proper sheet music rendering
 */

// VexFlow note duration types (including rests with 'r' suffix)
export type VexFlowDuration =
    | 'w' | 'h' | 'q' | '8' | '16' | '32'           // Notes
    | 'hd' | 'qd' | '8d'                             // Dotted notes
    | 'wr' | 'hr' | 'qr' | '8r' | '16r' | '32r'     // Rests
    | 'hdr' | 'qdr' | '8dr';                         // Dotted rests

// Difficulty levels
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// Play modes
export type PlayMode = 'flow' | 'wait';

// Validation result types
export type ValidationResult = 'correct' | 'close' | 'wrong' | 'silent' | 'rest';

/**
 * VexFlow note data structure (can represent notes OR rests)
 */
export interface VexFlowNote {
    keys: string[];           // e.g., ['c/4', 'e/4', 'g/4'] or ['b/4'] for rests
    duration: VexFlowDuration;
    time: number;             // Start time in seconds (normalized)
    endTime: number;          // End time in seconds
    velocity: number;         // MIDI velocity (0-1), 0 for rests
    name: string;             // Original note name (e.g., 'C4') or 'rest'
    midi: number;             // MIDI note number, -1 for rests
    originalDuration: number; // Original duration in seconds
    isRest?: boolean;         // TRUE if this is a rest, not a note
}

/**
 * Expected note format for validation
 */
export interface ExpectedNote {
    pitch: string;            // e.g., 'C4', 'F#5', or 'rest'
    startTime: number;
    endTime: number;
    duration: number;
    index: number;
    isRest?: boolean;         // TRUE if this is a rest period
}

/**
 * MIDI data converted to VexFlow format
 */
export interface VexFlowMidiData {
    notes: VexFlowNote[];     // Notes only (for backwards compatibility)
    events?: VexFlowNote[];   // All events including rests
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
    isRest?: boolean;         // Was this validation for a rest period?
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
    restPeriods: number;      // Number of rest periods encountered
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
    onMidiLoaded?: (notes: VexFlowNote[], events?: VexFlowNote[]) => void;
}

/**
 * Color coding for note states
 */
export const NOTE_COLORS = {
    current: '#FF5500',       // Orange - current note/rest being played
    correct: '#10b981',       // Green - correctly played
    close: '#f59e0b',         // Amber - close enough
    wrong: '#ef4444',         // Red - wrong note
    silent: '#9ca3af',        // Gray - missed/silent
    rest: '#6366f1',          // Indigo - rest period
    default: '#000000',       // Black - not yet played
    dimmed: '#00000080'       // Dimmed black - already passed
} as const;

/**
 * Sheet music viewer controls
 */
export interface SheetMusicControls {
    zoom: number;             // 75-150
    autoScroll: boolean;
    tempo: number;            // 50-150 (percentage)
    showRests: boolean;       // Whether to highlight rest periods
}