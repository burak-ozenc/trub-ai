import type {
  ExpectedNote,
  DetectedPitch,
  NoteValidation,
  ValidationResult
} from '../types/sheet-music.types';

/**
 * Skill level thresholds for note validation
 * Base thresholds - will be scaled based on frequency
 * VERY FORGIVING to ensure notes accumulate properly
 */
const SKILL_THRESHOLDS = {
  beginner: {
    correctCents: 100,  // ±100 cents (extremely forgiving - almost a semitone)
    closeCents: 150,    // ±150 cents (1.5 semitones)
    minAudioLevel: 0.02
  },
  intermediate: {
    correctCents: 80,   // ±80 cents (very forgiving)
    closeCents: 120,    // ±120 cents (1 semitone)
    minAudioLevel: 0.02
  },
  advanced: {
    correctCents: 60,   // ±60 cents (forgiving)
    closeCents: 90,     // ±90 cents
    minAudioLevel: 0.02
  }
};

/**
 * Calculate frequency-dependent tolerance scaling
 * Higher frequencies get more tolerance because it's harder to be accurate
 *
 * @param frequency - The detected frequency in Hz
 * @returns Scaling factor (1.0 = no change, >1.0 = more tolerant)
 */
const getFrequencyTolerance = (frequency: number): number => {
  // Reference frequency: A4 (440 Hz) - middle of typical range
  const referenceFreq = 440;

  // Calculate ratio: how much higher/lower than reference
  const ratio = frequency / referenceFreq;

  // Apply logarithmic scaling for higher notes
  // - At 440 Hz (A4): scaling = 1.0 (no change)
  // - At 880 Hz (A5): scaling ≈ 1.4 (40% more tolerance)
  // - At 1320 Hz (E6): scaling ≈ 1.7 (70% more tolerance)
  // - At 220 Hz (A3): scaling ≈ 0.8 (20% less tolerance)
  if (ratio > 1) {
    // Higher than reference: increase tolerance
    return 1.0 + Math.log2(ratio) * 0.6;
  } else {
    // Lower than reference: slightly decrease tolerance
    return 1.0 - (1 - ratio) * 0.2;
  }
};

/**
 * Convert note name to frequency in Hz
 * @param noteName - Note name like 'C4', 'F#5', 'Bb3'
 * @returns Frequency in Hz
 */
const noteNameToFrequency = (noteName: string): number => {
  // Parse note name
  const match = noteName.match(/^([A-G][#b♯♭]?)(\d+)$/);
  if (!match) return 0;

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr);

  // Note to semitone mapping (C = 0)
  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'C♯': 1, 'Db': 1, 'D♭': 1,
    'D': 2, 'D#': 3, 'D♯': 3, 'Eb': 3, 'E♭': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'F♯': 6, 'Gb': 6, 'G♭': 6,
    'G': 7, 'G#': 8, 'G♯': 8, 'Ab': 8, 'A♭': 8,
    'A': 9, 'A#': 10, 'A♯': 10, 'Bb': 10, 'B♭': 10,
    'B': 11
  };

  const semitone = noteMap[note];
  if (semitone === undefined) return 0;

  // Calculate MIDI note number
  // A4 = 69, C4 = 60
  const midiNote = (octave + 1) * 12 + semitone;

  // Convert MIDI note to frequency
  // f = 440 * 2^((n - 69) / 12)
  const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

  return frequency;
};

/**
 * Validate if detected pitch matches expected note
 */
export const validateNote = (
  expectedNote: ExpectedNote,
  detectedPitch: DetectedPitch,
  currentTime: number,
  noteStartTime: number,
  skillLevel: 'beginner' | 'intermediate' | 'advanced' = 'intermediate'
): NoteValidation => {
  const thresholds = SKILL_THRESHOLDS[skillLevel];

  // Check if pitch is being detected
  // Trust the tuner's isDetecting flag - don't enforce audioLevel as a hard requirement
  // This allows quieter playing while the tuner still has confidence
  if (!detectedPitch.isDetecting ||
      !detectedPitch.note ||
      detectedPitch.octave === null) {
    return {
      index: expectedNote.index,
      result: 'silent',
      accuracy: 0,
      feedback: `Play ${expectedNote.pitch}`
    };
  }

  // Construct detected note name
  const detectedNoteName = `${detectedPitch.note}${detectedPitch.octave}`;

  // Check if pitch matches (note + octave)
  const expectedPitch = expectedNote.pitch.replace(/♯/g, '#').replace(/♭/g, 'b');
  const pitchMatches = detectedNoteName === expectedPitch;

  // Apply frequency-dependent tolerance scaling
  const detectedFreq = detectedPitch.frequency || 440; // Default to A4 if no frequency
  const frequencyScaling = getFrequencyTolerance(detectedFreq);
  const adjustedCorrectCents = thresholds.correctCents * frequencyScaling;
  const adjustedCloseCents = thresholds.closeCents * frequencyScaling;

  // Calculate frequency-based deviation (more forgiving than note name matching)
  // Convert expected note to frequency for comparison
  const expectedFreq = noteNameToFrequency(expectedNote.pitch);
  let centDeviation = 0;

  if (expectedFreq > 0 && detectedPitch.frequency && detectedPitch.frequency > 0) {
    // Calculate cents from frequency ratio: 1200 * log2(detected / expected)
    const freqRatio = detectedPitch.frequency / expectedFreq;
    centDeviation = Math.abs(1200 * Math.log2(freqRatio));
  } else if (pitchMatches && detectedPitch.cents !== undefined && detectedPitch.cents !== null) {
    // Fall back to cents from tuner if available
    centDeviation = Math.abs(detectedPitch.cents);
  } else if (!pitchMatches) {
    // Notes don't match - use a large deviation
    centDeviation = 200;
  } else {
    // Same note but no frequency/cents data - assume it's good enough
    centDeviation = 0;
  }

  // Minimal validation logging
  if (Math.random() < 0.05 && centDeviation > adjustedCloseCents) {
    console.log('❌', detectedNoteName, 'vs', expectedPitch, centDeviation.toFixed(0) + '¢', '(need <' + adjustedCloseCents.toFixed(0) + '¢)');
  }

  let result: ValidationResult;
  let accuracy: number;
  let feedback: string;

  // Use frequency-based validation (more forgiving)
  if (centDeviation <= adjustedCorrectCents) {
    result = 'correct';
    accuracy = 100 - (centDeviation / adjustedCorrectCents) * 20; // 80-100
    feedback = '✓ Perfect!';
  } else if (centDeviation <= adjustedCloseCents) {
    result = 'close';
    accuracy = 70 - (centDeviation / adjustedCloseCents) * 20; // 50-70
    feedback = '≈ Close';
  } else {
    result = 'wrong';
    accuracy = 30;
    feedback = pitchMatches
      ? `Off by ${Math.round(centDeviation)}¢`
      : `Wrong note (got ${detectedNoteName})`;
  }

  // Calculate progress (time-based)
  const elapsed = currentTime - noteStartTime;
  const progress = Math.min(elapsed / expectedNote.duration, 1);

  return {
    index: expectedNote.index,
    result,
    accuracy: Math.round(accuracy),
    feedback,
    progress
  };
};
